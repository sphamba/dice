// GLSL ES 3.00 sources. Attribute locations are fixed by layout() qualifiers:
// 0 = position, 1 = normal, 2 = uv.

const LIGHTING_FS = `
uniform vec3 uLightDir;
uniform vec3 uEye;
uniform float uAmbient;
uniform float uIntensity;
uniform highp sampler2D uShadowMap;
uniform vec2 uShadowTexel;

in vec3 vWorldPos;
in vec3 vNormal;
in vec4 vShadowCoord;

float shadowFactor(float ndotl) {
  vec3 coord = vShadowCoord.xyz / vShadowCoord.w * 0.5 + 0.5;
  if (any(lessThan(coord, vec3(0.0))) || any(greaterThan(coord, vec3(1.0)))) return 1.0;
  float bias = max(0.0025 * (1.0 - ndotl), 0.0006);
  float depth = coord.z - bias;
  float lit = 0.0;
  for (int y = -1; y <= 1; y += 1) {
    for (int x = -1; x <= 1; x += 1) {
      float stored = texture(uShadowMap, coord.xy + vec2(x, y) * uShadowTexel).r;
      lit += depth <= stored ? 1.0 : 0.0;
    }
  }
  return lit / 9.0;
}

vec3 litColor(vec3 base) {
  vec3 n = normalize(vNormal);
  vec3 toLight = -uLightDir;
  float ndotl = dot(n, toLight);
  float diffuse = max(ndotl, 0.0);
  vec3 viewDir = normalize(uEye - vWorldPos);
  vec3 halfDir = normalize(viewDir + toLight);
  float specular = pow(max(dot(n, halfDir), 0.0), 40.0) * 0.22 * step(0.0, ndotl);
  float shadow = shadowFactor(ndotl);
  return base * (uAmbient + uIntensity * diffuse * shadow) + vec3(specular * uIntensity * shadow);
}
`;

export const depthVertexSource = `#version 300 es
layout(location = 0) in vec3 aPosition;

uniform mat4 uLightViewProj;
uniform mat4 uModel;

void main() {
  gl_Position = uLightViewProj * uModel * vec4(aPosition, 1.0);
}
`;

export const depthFragmentSource = `#version 300 es
precision highp float;

void main() {}
`;

export const diceVertexSource = `#version 300 es
layout(location = 0) in vec3 aPosition;
layout(location = 1) in vec3 aNormal;
layout(location = 2) in vec2 aUV;

uniform mat4 uViewProj;
uniform mat4 uModel;
uniform mat4 uLightViewProj;

out vec3 vWorldPos;
out vec3 vNormal;
out vec2 vUV;
out vec4 vShadowCoord;

void main() {
  vec4 world = uModel * vec4(aPosition, 1.0);
  vWorldPos = world.xyz;
  vNormal = mat3(uModel) * aNormal;
  vUV = aUV;
  vShadowCoord = uLightViewProj * world;
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
uniform mat4 uLightViewProj;
uniform vec2 uHalfExtents;

out vec3 vWorldPos;
out vec3 vNormal;
out vec4 vShadowCoord;

void main() {
  vec3 world = vec3(aPosition * uHalfExtents, 0.0);
  vWorldPos = world;
  vNormal = vec3(0.0, 0.0, 1.0);
  vShadowCoord = uLightViewProj * vec4(world, 1.0);
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
