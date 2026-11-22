// GLSL ES 3.00 sources. Attribute locations are fixed by layout() qualifiers:
// 0 = position, 1 = normal, 2 = uv.

// Fraction of the GTAO darkening kept in the forward pass (1 = full, 0 = none).
export const AO_STRENGTH = 0.5;

const LIGHTING_FS = `
uniform vec3 uLightDir;
uniform float uAmbient;
uniform float uIntensity;
uniform float uDirectAo;
uniform highp sampler2D uAo;
uniform highp sampler2D uAoDepth;
uniform vec2 uAoSize;
uniform vec2 uViewport;
uniform vec2 uDepthRange;

const float AO_STRENGTH = ${AO_STRENGTH};

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

vec3 litColor(vec3 base, vec3 n) {
  vec3 toLight = -uLightDir;
  float ndotl = dot(n, toLight);
  float diffuse = max(ndotl, 0.0);
  // Orthographic top-down camera: the toward-eye vector is constant (+z) for
  // every fragment. A point-eye viewDir here would put a position-dependent
  // specular pool on the floor.
  vec3 viewDir = vec3(0.0, 0.0, 1.0);
  vec3 halfDir = normalize(viewDir + toLight);
  float specular = pow(max(dot(n, halfDir), 0.0), 40.0) * 0.22 * step(0.0, ndotl);
  float ao = sampleAo();
  ao = mix(1.0, ao, AO_STRENGTH);
  // Hemisphere ambient; the Schlick rim picks out the bevel band (zero on the
  // flat top faces).
  vec3 hemi = mix(vec3(0.5, 0.45, 0.4), vec3(1.0), n.z * 0.5 + 0.5);
  float rim = pow(1.0 - clamp(n.z, 0.0, 1.0), 5.0) * 0.3;
  return base * (uAmbient * hemi * ao + uIntensity * diffuse * mix(1.0, ao, uDirectAo)) + vec3((specular + rim) * uIntensity * ao);
}
`;

// Bevel attributes shared by the dice and AO-prepass programs: per-vertex face
// 2D position and tangent, plus the flat 5-point inset polygon.
const BEVEL_VERT = `
layout(location = 3) in vec2 aFacePos;
layout(location = 4) in vec3 aTangent;
layout(location = 5) in vec4 aInset0;
layout(location = 6) in vec4 aInset1;
layout(location = 7) in vec4 aInset2;

out vec2 vFacePos;
out vec3 vTangent;
flat out vec4 vInset0;
flat out vec4 vInset1;
flat out vec4 vInset2;

void bevelVertex(mat3 model) {
  vFacePos = aFacePos;
  vTangent = model * aTangent;
  vInset0 = aInset0;
  vInset1 = aInset1;
  vInset2 = aInset2;
}
`;

// Bevel fragment logic shared by the dice and AO-prepass programs.
const BEVEL_FRAG = `
uniform vec2 uHull[20];
uniform int uHullCount;
uniform float uBevelRadius;

in vec2 vFacePos;
in vec3 vTangent;
flat in vec4 vInset0;
flat in vec4 vInset1;
flat in vec4 vInset2;

// q = fragment minus the closest point of the 5-edge inset polygon, zero
// inside it. Padded zero-length edges are guarded by the max() epsilon.
vec2 insetPoint(int k) {
  if (k == 0) return vInset0.xy;
  if (k == 1) return vInset0.zw;
  if (k == 2) return vInset1.xy;
  if (k == 3) return vInset1.zw;
  return vInset2.xy;
}

vec2 insetOffset(vec2 p) {
  vec2 q = vec2(0.0);
  float bestD2 = 1e30;
  float minCr = 1e30;
  for (int k = 0; k < 5; k++) {
    vec2 a = insetPoint(k);
    vec2 e = insetPoint(k < 4 ? k + 1 : 0) - a;
    vec2 w = p - a;
    float t = clamp(dot(w, e) / max(dot(e, e), 1e-12), 0.0, 1.0);
    vec2 d = w - t * e;
    float d2 = dot(d, d);
    if (d2 < bestD2) {
      bestD2 = d2;
      q = d;
    }
    minCr = min(minCr, e.x * w.y - e.y * w.x);
  }
  return minCr >= 0.0 ? vec2(0.0) : q;
}

// Face normal on the flat region, the exact two-face bisector at each sharp
// edge, smooth in between.
vec3 bevelNormal(vec3 n) {
  vec3 t = normalize(vTangent);
  vec3 b = cross(n, t);
  vec3 nts = normalize(vec3(insetOffset(vFacePos), uBevelRadius));
  return normalize(t * nts.x + b * nts.y + n * nts.z);
}

// 0 inside the CCW hull, segment distance outside.
float hullDistance(vec2 p) {
  if (uHullCount < 3) return 1e30;
  float best = 1e30;
  float minCr = 1e30;
  for (int k = 0; k < 20; k++) {
    if (k >= uHullCount) break;
    vec2 a = uHull[k];
    vec2 e = uHull[k + 1 < uHullCount ? k + 1 : 0] - a;
    vec2 w = p - a;
    float t = clamp(dot(w, e) / max(dot(e, e), 1e-12), 0.0, 1.0);
    best = min(best, length(w - t * e));
    minCr = min(minCr, e.x * w.y - e.y * w.x);
  }
  return minCr >= 0.0 ? 0.0 : best;
}
`;

// AO prepass: dice only, bevel normal encoded for the GTAO pass. The AO
// targets carry no multisampling, so the rounded outline is a discard instead
// of a coverage mask.
export const aoPrepassFragmentSource = `#version 300 es
precision highp float;

in vec3 vNormal;
in vec3 vWorldPos;
out vec4 outColor;

${BEVEL_FRAG}

void main() {
  if (hullDistance(vWorldPos.xy) > uBevelRadius) discard;
  outColor = vec4(bevelNormal(normalize(vNormal)) * 0.5 + 0.5, 1.0);
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

${BEVEL_VERT}

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
  bevelVertex(mat3(uModel));
}
`;

export const diceFragmentSource = `#version 300 es
precision highp float;

uniform vec3 uColor;
uniform highp sampler2D uAtlas;

in vec2 vUV;
out vec4 outColor;

${LIGHTING_FS}

${BEVEL_FRAG}

void main() {
  vec3 n = bevelNormal(normalize(vNormal));
  vec4 label = texture(uAtlas, vUV);
  // Rounded outline: coverage alpha from the distance to the body's 2D hull.
  float d = hullDistance(vWorldPos.xy);
  float alpha = clamp((uBevelRadius - d) / max(fwidth(d), 1e-7) + 0.5, 0.0, 1.0);
  outColor = vec4(litColor(mix(uColor, label.rgb, label.a), n), alpha);
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
  outColor = vec4(litColor(uColor, normalize(vNormal)), 1.0);
}
`;
