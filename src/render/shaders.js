// GLSL ES 3.00 sources. Attribute locations are fixed by layout() qualifiers:
// 0 = position, 1 = normal, 2 = uv.

const LIGHTING_FS = `
uniform vec3 uLightDir;
uniform vec3 uEye;
uniform float uAmbient;
uniform float uIntensity;
uniform float uDirectAo;
uniform highp sampler2D uAo;
uniform highp sampler2D uAoDepth;
uniform vec2 uAoSize;
uniform vec2 uViewport;
uniform vec2 uDepthRange;

in vec3 vWorldPos;
in vec3 vNormal;

// Depth-aware bilinear upsample of the AO buffer around this fragment.
float sampleAo() {
  vec2 coord = gl_FragCoord.xy / uViewport * uAoSize - 0.5;
  ivec2 size = ivec2(uAoSize);
  ivec2 lo = clamp(ivec2(floor(coord)), ivec2(0), size - 1);
  vec2 f = clamp(coord - floor(coord), 0.0, 1.0);
  float z = vWorldPos.z;
  float total = 0.0;
  float weights = 0.0;
  for (int iy = 0; iy < 2; iy++) {
    for (int ix = 0; ix < 2; ix++) {
      ivec2 t = min(lo + ivec2(ix, iy), size - 1);
      float zt = uDepthRange.x - texelFetch(uAoDepth, t, 0).r * uDepthRange.y;
      float w = mix(1.0 - f.x, f.x, float(ix)) * mix(1.0 - f.y, f.y, float(iy)) / (1e-4 + abs(zt - z));
      total += texelFetch(uAo, t, 0).r * w;
      weights += w;
    }
  }
  return weights > 0.0 ? total / weights : 1.0;
}

vec3 litColor(vec3 base) {
  vec3 n = normalize(vNormal);
  vec3 toLight = -uLightDir;
  float ndotl = dot(n, toLight);
  float diffuse = max(ndotl, 0.0);
  vec3 viewDir = normalize(uEye - vWorldPos);
  vec3 halfDir = normalize(viewDir + toLight);
  float specular = pow(max(dot(n, halfDir), 0.0), 40.0) * 0.22 * step(0.0, ndotl);
  float ao = sampleAo();
  return base * (uAmbient * ao + uIntensity * diffuse * mix(1.0, ao, uDirectAo)) + vec3(specular * uIntensity * ao);
}
`;

// AO prepass: dice only, world normal encoded for the GTAO pass.
export const aoPrepassVertexSource = `#version 300 es
layout(location = 0) in vec3 aPosition;
layout(location = 1) in vec3 aNormal;

uniform mat4 uViewProj;
uniform mat4 uModel;

out vec3 vNormal;

void main() {
  vNormal = mat3(uModel) * aNormal;
  gl_Position = uViewProj * uModel * vec4(aPosition, 1.0);
}
`;

export const aoPrepassFragmentSource = `#version 300 es
precision highp float;

in vec3 vNormal;
out vec4 outColor;

void main() {
  outColor = vec4(normalize(vNormal) * 0.5 + 0.5, 1.0);
}
`;

// Full-screen triangle without a VAO (gl_VertexID).
export const fullscreenVertexSource = `#version 300 es
void main() {
  vec2 pos = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(pos * 2.0 - 1.0, 0.0, 1.0);
}
`;

// GTAO (Jimenez 2016) with the XeGTAO slice integral, adapted to the ortho
// top-down camera: view vector is the constant +z, world space == view space.
export const gtaoFragmentSource = ({ slices, steps, samplePower, finalPower, zFalloffScale }) => `#version 300 es
precision highp float;

uniform highp sampler2D uNormalTex;
uniform highp sampler2D uDepthTex;
uniform vec2 uHalfExtents;
uniform vec2 uTexelWorld;
uniform vec2 uAoSize;
uniform vec2 uDepthRange;
uniform float uRadius;
uniform float uFalloffMul;
uniform float uFalloffAdd;
uniform float uMinDist;

out vec4 outColor;

const float PI = 3.141592653589793;
const float PI_HALF = 1.5707963267948966;

float worldZ(float d) {
  return uDepthRange.x - d * uDepthRange.y;
}

void main() {
  ivec2 texel = ivec2(gl_FragCoord.xy);
  vec3 n = normalize(texelFetch(uNormalTex, texel, 0).xyz * 2.0 - 1.0);
  vec3 p = vec3(gl_FragCoord.xy * uTexelWorld - uHalfExtents, worldZ(texelFetch(uDepthTex, texel, 0).r));

  int idx = (texel.x & 3) + 4 * (texel.y & 3);
  float sliceNoise = (float(idx) + 0.5) / 16.0;
  float stepJitter = (float((idx * 5 + 2) & 15) + 0.5) / 16.0;

  float visibility = 0.0;
  for (int i = 0; i < ${slices}; i++) {
    float phi = (float(i) + sliceNoise) * PI / ${slices}.0;
    vec2 dir = vec2(cos(phi), sin(phi));
    vec3 axis = vec3(dir.y, -dir.x, 0.0);
    vec3 np = n - axis * dot(n, axis);
    float len = max(length(np), 1e-6);
    float nAng = sign(dot(vec3(dir, 0.0), np)) * acos(clamp(np.z / len, 0.0, 1.0));
    vec2 lowHorizon = vec2(cos(nAng + PI_HALF), cos(nAng - PI_HALF));
    vec2 horizonCos = lowHorizon;
    for (int j = 0; j < ${steps}; j++) {
      float u = (float(j) + stepJitter) / ${steps}.0;
      float s = max(pow(u, ${samplePower}), uMinDist / uRadius) * uRadius;
      for (int side = 0; side < 2; side++) {
        float sideSign = side == 0 ? 1.0 : -1.0;
        vec3 delta = vec3(dir * (s * sideSign), 0.0);
        ivec2 sc = ivec2(floor((p.xy + delta.xy + uHalfExtents) / uTexelWorld));
        if (any(lessThan(sc, ivec2(0))) || any(greaterThanEqual(sc, ivec2(uAoSize)))) continue;
        delta.z = worldZ(texelFetch(uDepthTex, sc, 0).r) - p.z;
        float cosH = delta.z / length(delta);
        float w = clamp(length(vec3(delta.xy, delta.z * ${zFalloffScale})) * uFalloffMul + uFalloffAdd, 0.0, 1.0);
        float shc = mix(lowHorizon[side], cosH, w);
        horizonCos[side] = max(horizonCos[side], shc);
      }
    }
    vec2 h = clamp(vec2(-acos(clamp(horizonCos.y, -1.0, 1.0)), acos(clamp(horizonCos.x, -1.0, 1.0))), nAng - PI_HALF, nAng + PI_HALF);
    visibility += len * ((cos(nAng) + 2.0 * h.x * sin(nAng) - cos(2.0 * h.x - nAng))
                       + (cos(nAng) + 2.0 * h.y * sin(nAng) - cos(2.0 * h.y - nAng))) / 4.0;
  }
  float ao = max(0.03, pow(visibility / ${slices}.0, ${finalPower}));
  outColor = vec4(ao, 0.0, 0.0, 1.0);
}
`;

export const blurFragmentSource = () => `#version 300 es
precision highp float;

uniform highp sampler2D uAoTex;
uniform highp sampler2D uDepthTex;
uniform vec2 uDepthRange;
uniform float uBlurDz;

out vec4 outColor;

float worldZ(float d) {
  return uDepthRange.x - d * uDepthRange.y;
}

void main() {
  ivec2 texel = ivec2(gl_FragCoord.xy);
  ivec2 size = textureSize(uAoTex, 0);
  float z0 = worldZ(texelFetch(uDepthTex, texel, 0).r);
  float total = 0.0;
  float weights = 0.0;
  for (int oy = -2; oy <= 1; oy++) {
    for (int ox = -2; ox <= 1; ox++) {
      ivec2 sc = clamp(texel + ivec2(ox, oy), ivec2(0), size - 1);
      float w = max(0.0, 1.0 - abs(worldZ(texelFetch(uDepthTex, sc, 0).r) - z0) / uBlurDz);
      total += texelFetch(uAoTex, sc, 0).r * w;
      weights += w;
    }
  }
  outColor = vec4(total / weights, 0.0, 0.0, 1.0);
}
`;

export const diceVertexSource = `#version 300 es
layout(location = 0) in vec3 aPosition;
layout(location = 1) in vec3 aNormal;
layout(location = 2) in vec2 aUV;

uniform mat4 uViewProj;
uniform mat4 uModel;

out vec3 vWorldPos;
out vec3 vNormal;
out vec2 vUV;

void main() {
  vec4 world = uModel * vec4(aPosition, 1.0);
  vWorldPos = world.xyz;
  vNormal = mat3(uModel) * aNormal;
  vUV = aUV;
  gl_Position = uViewProj * world;
}
`;

export const diceFragmentSource = `#version 300 es
precision highp float;

uniform vec3 uColor;
uniform highp sampler2D uAtlas;

in vec2 vUV;
out vec4 outColor;

${LIGHTING_FS}

void main() {
  vec4 label = texture(uAtlas, vUV);
  outColor = vec4(litColor(mix(uColor, label.rgb, label.a)), 1.0);
}
`;

export const floorVertexSource = `#version 300 es
layout(location = 0) in vec2 aPosition;

uniform mat4 uViewProj;
uniform vec2 uHalfExtents;

out vec3 vWorldPos;
out vec3 vNormal;

void main() {
  vec3 world = vec3(aPosition * uHalfExtents, 0.0);
  vWorldPos = world;
  vNormal = vec3(0.0, 0.0, 1.0);
  gl_Position = uViewProj * vec4(world, 1.0);
}
`;

export const floorFragmentSource = `#version 300 es
precision highp float;

uniform vec3 uColor;

out vec4 outColor;

${LIGHTING_FS}

void main() {
  outColor = vec4(litColor(uColor), 1.0);
}
`;
