// GLSL ES 3.00 sources. Attribute locations are fixed by layout() qualifiers:
// 0 = position, 1 = normal, 2 = uv.

import {
  AMBIENT_GROUND,
  AMBIENT_SKY,
  AO_STRENGTH,
  DICE_MATERIAL,
  F0,
  INK_SPECULAR_OCCLUSION,
  LIGHT_DIRECTION,
  LIGHT_RADIANCE,
  ROUGHNESS,
  SPECULAR_NORMALIZATION,
} from './material.js';

// Fraction of the GTAO darkening kept in the forward pass (1 = full, 0 = none).
export { AO_STRENGTH };

// PCSS tap counts. The inner blocker search (16 taps over a 22 mm disk) has a
// 10.1 mm covering radius, so a die silhouette centered within 11 mm of the
// receiver is always caught: the contact and stacking zone stays leak-free.
// The outer search (24 taps over the full search disk) is best effort: far
// blockers lift the penumbra into a ~10% tint where a missed tap costs a
// faint blotch.
export const SHADOW_BLOCKER_INNER_TAPS = 16;
export const SHADOW_BLOCKER_OUTER_TAPS = 24;
export const SHADOW_PCF_TAPS = 8;

// PCSS against the dice-only shadow map: a dense inner blocker search sizes
// the Vogel-disk PCF kernel, a sparse outer search covers tall blockers, the
// hardware depth compare does the filtering, and an interleaved-gradient
// rotation decorrelates neighbouring fragments. The blocker depths come from
// the 16-bit packed RGBA8 copy because a sampler2DShadow cannot return the
// stored depth.
const SHADOW_FS = `
uniform highp sampler2DShadow uShadowMap;
uniform highp sampler2D uShadowBlocker;
uniform mat4 uShadowMatrix;
uniform vec2 uShadowTexel;
uniform vec4 uShadowParams; // uv scale xy, frustum depth span (m), tan(light angular radius)
uniform vec3 uShadowSearch; // outer search radius in uv xy, inner search fraction
uniform vec2 uShadowBias;   // normal offset (m), depth bias (ndc)
uniform float uShadowEnabled;

const int SHADOW_BLOCKER_INNER_TAPS = ${SHADOW_BLOCKER_INNER_TAPS};
const int SHADOW_BLOCKER_OUTER_TAPS = ${SHADOW_BLOCKER_OUTER_TAPS};
const int SHADOW_PCF_TAPS = ${SHADOW_PCF_TAPS};

float shadowFactor(vec3 worldPos, vec3 n) {
  if (uShadowEnabled < 0.5) return 1.0;
  vec3 coord = (uShadowMatrix * vec4(worldPos + n * uShadowBias.x, 1.0)).xyz * 0.5 + 0.5;
  if (coord.x < 0.0 || coord.x > 1.0 || coord.y < 0.0 || coord.y > 1.0 || coord.z <= 0.0 || coord.z >= 1.0) {
    return 1.0;
  }
  float rot = 6.2831853 * fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
  float ref = coord.z - uShadowBias.y;
  float blockerSum = 0.0;
  float blockerCount = 0.0;
  for (int i = 0; i < SHADOW_BLOCKER_INNER_TAPS; i++) {
    float phi = float(i) * 2.39996323 + rot;
    float r = sqrt((float(i) + 0.5) / float(SHADOW_BLOCKER_INNER_TAPS));
    vec2 off = vec2(cos(phi), sin(phi)) * (r * uShadowSearch.xy * uShadowSearch.z);
    vec2 e = texture(uShadowBlocker, coord.xy + off).rg;
    float bd = e.x + e.y / 255.0;
    if (bd < ref) {
      blockerSum += bd;
      blockerCount += 1.0;
    }
  }
  if (blockerCount == 0.0) {
    for (int i = 0; i < SHADOW_BLOCKER_OUTER_TAPS; i++) {
      float phi = float(i) * 2.39996323 + rot;
      float r = sqrt((float(i) + 0.5) / float(SHADOW_BLOCKER_OUTER_TAPS));
      vec2 off = vec2(cos(phi), sin(phi)) * (r * uShadowSearch.xy);
      vec2 e = texture(uShadowBlocker, coord.xy + off).rg;
      float bd = e.x + e.y / 255.0;
      if (bd < ref) {
        blockerSum += bd;
        blockerCount += 1.0;
      }
    }
  }
  if (blockerCount == 0.0) return 1.0;
  float dist = max(ref - blockerSum / blockerCount, 0.0) * uShadowParams.z;
  vec2 radius = max(dist * uShadowParams.w * uShadowParams.xy, uShadowTexel);
  float lit = 0.0;
  for (int i = 0; i < SHADOW_PCF_TAPS; i++) {
    float phi = float(i) * 2.39996323 + rot;
    float r = sqrt((float(i) + 0.5) / float(SHADOW_PCF_TAPS));
    vec2 off = vec2(cos(phi), sin(phi)) * (r * radius);
    lit += texture(uShadowMap, vec3(coord.xy + off, ref));
  }
  return lit / float(SHADOW_PCF_TAPS);
}
`;

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
float sampleAo(float z) {
  vec2 coord = gl_FragCoord.xy / uViewport * uAoSize - 0.5;
  ivec2 size = ivec2(uAoSize);
  ivec2 lo = clamp(ivec2(floor(coord)), ivec2(0), size - 1);
  vec2 f = clamp(coord - floor(coord), 0.0, 1.0);
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

${SHADOW_FS}
`;

// Present display-space lighting of the floor. The dice material below does not
// share it, so the floor output stays exactly as it was before the dice moved
// to a linear workflow.
const FLOOR_LIGHTING_FS = `
vec3 litColor(vec3 base, vec3 n, float cavity, float z) {
  vec3 toLight = -uLightDir;
  float ndotl = dot(n, toLight);
  float diffuse = max(ndotl, 0.0);
  // Orthographic top-down camera: the toward-eye vector is constant (+z) for
  // every fragment. A point-eye viewDir here would put a position-dependent
  // specular pool on the floor.
  vec3 viewDir = vec3(0.0, 0.0, 1.0);
  vec3 halfDir = normalize(viewDir + toLight);
  float specular = pow(max(dot(n, halfDir), 0.0), 40.0) * 0.22 * step(0.0, ndotl);
  float ao = sampleAo(z);
  ao = mix(1.0, ao, AO_STRENGTH);
  // The shadow attenuates the direct terms only; the hemisphere ambient keeps
  // its AO. The Schlick rim picks out the bevel band and is zero on the flat
  // top faces.
  float shadow = shadowFactor(vWorldPos, n);
  vec3 hemi = mix(vec3(0.5, 0.45, 0.4), vec3(1.0), n.z * 0.5 + 0.5);
  float rim = pow(1.0 - clamp(n.z, 0.0, 1.0), 5.0) * 0.3;
  return base * (uAmbient * hemi * ao * cavity + uIntensity * diffuse * mix(1.0, ao, uDirectAo) * shadow) + vec3((specular + rim) * uIntensity * ao * shadow);
}
`;

const glsl = (value) => (Number.isInteger(value) ? `${value}.0` : `${value}`);
const glslVec3 = (v) => `vec3(${v.map(glsl).join(', ')})`;

// Dice material: a metallic-free dielectric under one distant disk light,
// evaluated in linear space, tone mapped, then encoded to sRGB. Every number
// comes from material.js, the module the lighting test integrates against.
const DICE_MATERIAL_FS = `
const float PI = 3.141592653589793;
const vec3 LIGHT_DIRECTION = ${glslVec3(LIGHT_DIRECTION)};
const float LIGHT_COT = ${glsl(DICE_MATERIAL.cotLight)};
const float LIGHT_COT_SQ = ${glsl(DICE_MATERIAL.cotLightSq)};
const float LIGHT_ATAN_COT = ${glsl(DICE_MATERIAL.atanCotLight)};
const float LIGHT_RADIANCE = ${glsl(LIGHT_RADIANCE)};
const vec3 AMBIENT_SKY = ${glslVec3(AMBIENT_SKY)};
const vec3 AMBIENT_GROUND = ${glslVec3(AMBIENT_GROUND)};
const float ROUGHNESS = ${glsl(ROUGHNESS)};
const float WIDENED_ALPHA = ${glsl(DICE_MATERIAL.widenedAlpha)};
const float REPRESENTATIVE_RADIUS = ${glsl(DICE_MATERIAL.representativeRadius)};
const float SPECULAR_NORMALIZATION = ${glsl(SPECULAR_NORMALIZATION)};
const float F0 = ${glsl(F0)};
const float INK_SPECULAR_OCCLUSION = ${glsl(INK_SPECULAR_OCCLUSION)};

vec3 srgbToLinear(vec3 c) {
  vec3 s = max(c, vec3(0.0));
  return mix(pow((s + 0.055) / 1.055, vec3(2.4)), s / 12.92, step(s, vec3(0.04045)));
}

vec3 linearToSrgb(vec3 c) {
  vec3 s = max(c, vec3(0.0));
  return mix(1.055 * pow(s, vec3(1.0 / 2.4)) - 0.055, s * 12.92, step(s, vec3(0.0031308)));
}

// Khronos PBR Neutral: compresses the highlights without shifting the hue.
vec3 neutralToneMap(vec3 color) {
  const float startCompression = 0.8 - 0.04;
  const float desaturation = 0.15;
  float x = min(color.r, min(color.g, color.b));
  float offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
  color -= offset;
  float peak = max(color.r, max(color.g, color.b));
  if (peak < startCompression) return color;
  float d = 1.0 - startCompression;
  float newPeak = 1.0 - d * d / (peak + d - startCompression);
  float g = 1.0 - 1.0 / (desaturation * (peak - newPeak) + 1.0);
  return mix(color * (newPeak / peak), vec3(newPeak), g);
}

// Irradiance of the light disk above the horizon per unit radiance: closed form
// of the spherical cap minus the part below the surface plane.
float capIrradiance(float cosGamma) {
  float cg = clamp(cosGamma, -1.0, 1.0);
  float gamma = acos(cg);
  if (gamma < LIGHT_ATAN_COT) return PI * cg / (1.0 + LIGHT_COT_SQ);
  float sg = sqrt(max(1.0 - cg * cg, 0.0));
  float cotGamma = cg / max(sg, 1e-8);
  float horizon = sqrt(max(1.0 - LIGHT_COT_SQ * cotGamma * cotGamma, 0.0));
  return -LIGHT_COT * horizon * sg / (1.0 + LIGHT_COT_SQ)
    + atan(horizon * sg / LIGHT_COT)
    + cg * (PI - acos(clamp(LIGHT_COT * cotGamma, -1.0, 1.0))) / (1.0 + LIGHT_COT_SQ);
}

float ggxDistribution(float alpha, float ndoth) {
  float a2 = alpha * alpha;
  float d = ndoth * ndoth * (a2 - 1.0) + 1.0;
  return a2 / (PI * d * d);
}

float smithVisibility(float ndotv, float ndotl, float alpha) {
  float a2 = alpha * alpha;
  float lambdaV = ndotl * sqrt(ndotv * ndotv * (1.0 - a2) + a2);
  float lambdaL = ndotv * sqrt(ndotl * ndotl * (1.0 - a2) + a2);
  return 0.5 / max(lambdaV + lambdaL, 1e-6);
}

// Karis/Lazarov analytic environment BRDF: vec2(scale, bias) from NoV.
vec2 envBrdfApprox(float ndotv, float roughness) {
  const vec4 c0 = vec4(-1.0, -0.0275, -0.572, 0.022);
  const vec4 c1 = vec4(1.0, 0.0425, 1.04, -0.04);
  vec4 r = roughness * c0 + c1;
  float a004 = min(r.x * r.x, exp2(-9.28 * ndotv)) * r.x + r.y;
  return vec2(-1.04, 1.04) * a004 + r.zw;
}

// Widened GGX lobe at the representative point: the closest direction in the
// eroded light cone to the mirror direction.
float specularRadiance(vec3 n, float ndotv, float irradiance) {
  vec3 viewDir = vec3(0.0, 0.0, 1.0);
  vec3 mirror = reflect(-viewDir, n);
  float cosMirror = clamp(dot(mirror, LIGHT_DIRECTION), -1.0, 1.0);
  vec3 l = mirror;
  if (acos(cosMirror) > REPRESENTATIVE_RADIUS) {
    vec3 tangent = mirror - LIGHT_DIRECTION * cosMirror;
    tangent /= max(length(tangent), 1e-6);
    l = normalize(LIGHT_DIRECTION * cos(REPRESENTATIVE_RADIUS) + tangent * sin(REPRESENTATIVE_RADIUS));
  }
  float ndotl = dot(n, l);
  if (ndotl <= 0.0) return 0.0;
  vec3 h = viewDir + l;
  h /= max(length(h), 1e-6);
  float vdoth = clamp(dot(viewDir, h), 1e-6, 1.0);
  float fresnel = F0 + (1.0 - F0) * pow(1.0 - vdoth, 5.0);
  return SPECULAR_NORMALIZATION
    * ggxDistribution(WIDENED_ALPHA, clamp(dot(n, h), 1e-6, 1.0))
    * smithVisibility(ndotv, ndotl, WIDENED_ALPHA)
    * fresnel * irradiance;
}

vec3 diceLitColor(vec3 baseSrgb, vec3 n, float cavity, float z, float ink, float shadow) {
  vec3 base = srgbToLinear(baseSrgb);
  float ao = sampleAo(z);
  ao = mix(1.0, ao, AO_STRENGTH);
  float directAo = mix(1.0, ao, uDirectAo);
  float ndotv = clamp(n.z, 1e-4, 1.0);
  float irradiance = capIrradiance(dot(n, LIGHT_DIRECTION)) * LIGHT_RADIANCE;
  vec3 hemi = mix(AMBIENT_GROUND, AMBIENT_SKY, n.z * 0.5 + 0.5);
  vec2 ab = envBrdfApprox(ndotv, ROUGHNESS);
  // The ink sits at the bottom of the engraving, where the walls block most of
  // the incoming light: the specular keeps only INK_SPECULAR_OCCLUSION of its
  // face value, otherwise the wide lobe fills the glyph with a sheen.
  float specularOcclusion = cavity * mix(1.0, INK_SPECULAR_OCCLUSION, clamp(ink, 0.0, 1.0));
  // The shadow attenuates the direct terms only; the ambient keeps its AO.
  vec3 direct = (base * (irradiance / PI * directAo) + vec3(specularRadiance(n, ndotv, irradiance) * directAo * specularOcclusion)) * shadow;
  vec3 ambient = base * hemi * ao * cavity + (F0 * ab.x + ab.y) * hemi * ao * specularOcclusion;
  return linearToSrgb(neutralToneMap(direct + ambient));
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
vec3 bevelNormal(vec3 n, vec2 q) {
  vec3 t = normalize(vTangent);
  vec3 b = cross(n, t);
  // Beyond the band the direction freezes at the rim: fragments there belong
  // to the neighbouring face's band or to the outline, never to this arc.
  vec2 qc = q * min(1.0, uBevelRadius * inversesqrt(max(dot(q, q), 1e-12)));
  vec3 nts = normalize(vec3(qc, uBevelRadius));
  return normalize(t * nts.x + b * nts.y + n * nts.z);
}

// Height of the emulated rounded surface below the face plane at inset offset
// q: the ball arc around the shrunken face, ending r below at |q| = r.
float bevelDrop(vec2 q) {
  float r2 = uBevelRadius * uBevelRadius;
  return uBevelRadius - sqrt(max(r2 - dot(q, q), 0.0));
}

// Surface point of the emulated rounded shape s*P + ball(r) over this
// fragment, and its window depth for gl_FragDepth.
vec3 roundedSurface(vec3 p, vec3 n, vec2 q) {
  return p - n * bevelDrop(q);
}

float surfaceDepth(vec3 surface) {
  return (uDepthRange.x - surface.z) / max(uDepthRange.y, 1e-6);
}

// 0 inside the CCW hull, segment distance outside. The inside test tolerates
// tiny negative crosses: at some resting poses two shape corners project ~10nm
// apart, and the resulting degenerate hull edge can point against the winding,
// which would classify half the die's interior as outside (a cross of ~1e-10
// for a 1e-8 edge) and discard everything more than the bevel radius from the
// boundary — a large triangle-shaped hole in the dice (and in the AO prepass)
// that appears for one frame during the final settling snap. Genuine outside
// points sit at cross <= -2e-9 (1um out on a 2mm edge), so -1e-9 separates the
// two by an order of magnitude.
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
  return minCr >= -1e-9 ? 0.0 : best;
}
`;

// AO prepass: dice only, bevel normal encoded for the GTAO pass. The AO
// targets carry no multisampling, so the rounded outline is a discard instead
// of a coverage mask.
export const aoPrepassFragmentSource = `#version 300 es
precision highp float;

uniform vec2 uDepthRange;

in vec3 vNormal;
in vec3 vWorldPos;
out vec4 outColor;

${BEVEL_FRAG}

void main() {
  if (hullDistance(vWorldPos.xy) > uBevelRadius) discard;
  vec2 q = insetOffset(vFacePos);
  vec3 nGeo = normalize(vNormal);
  vec3 surface = roundedSurface(vWorldPos, nGeo, q);
  gl_FragDepth = surfaceDepth(surface);
  outColor = vec4(bevelNormal(nGeo, q) * 0.5 + 0.5, 1.0);
}
`;

// Shadow-map depth pass: dice only, from the disk light. Same rounded surface
// as the AO prepass so the stored depth matches the visible silhouette, plus a
// 16-bit fixed-point copy of the depth in the color target for the blocker
// search (a sampler2DShadow cannot return the stored depth).
export const shadowDepthVertexSource = `#version 300 es
layout(location = 0) in vec3 aPosition;
layout(location = 1) in vec3 aNormal;

${BEVEL_VERT}

uniform mat4 uLightViewProj;
uniform mat4 uModel;

out vec3 vWorldPos;
out vec3 vNormal;

void main() {
  vec4 world = uModel * vec4(aPosition, 1.0);
  vWorldPos = world.xyz;
  vNormal = mat3(uModel) * aNormal;
  gl_Position = uLightViewProj * world;
  bevelVertex(mat3(uModel));
}
`;

export const shadowDepthFragmentSource = `#version 300 es
precision highp float;

uniform vec3 uLightEye;
uniform vec3 uLightForward;
uniform vec2 uShadowNearSpan; // near plane distance and span along the light ray, meters
uniform vec2 uDepthRange; // declared for the shared bevel helpers; unused here

in vec3 vNormal;
in vec3 vWorldPos;
out vec4 outColor;

${BEVEL_FRAG}

void main() {
  if (hullDistance(vWorldPos.xy) > uBevelRadius) discard;
  vec2 q = insetOffset(vFacePos);
  vec3 surface = roundedSurface(vWorldPos, normalize(vNormal), q);
  float d = dot(uLightEye - surface, uLightForward);
  float depth = clamp((d - uShadowNearSpan.x) / uShadowNearSpan.y, 0.0, 1.0);
  gl_FragDepth = depth;
  float e = depth * 255.0;
  outColor = vec4(floor(e) / 255.0, fract(e), 0.0, 1.0);
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
uniform vec3 uInk;
uniform highp sampler2D uAtlas;
uniform highp sampler2D uCarve;

in vec2 vUV;
out vec4 outColor;

${LIGHTING_FS}

${DICE_MATERIAL_FS}

${BEVEL_FRAG}

void main() {
  vec3 nGeo = normalize(vNormal);
  vec2 q = insetOffset(vFacePos);
  // Rounded outline: coverage alpha from the distance to the body's 2D hull.
  // Alpha to coverage only masks a multisampled buffer, so the fragments it
  // would leave uncovered are dropped here instead of writing color and depth.
  float d = hullDistance(vWorldPos.xy);
  float alpha = clamp((uBevelRadius - d) / max(fwidth(d), 1e-7) + 0.5, 0.0, 1.0);
  if (alpha <= 0.0) discard;
  // Emulated displacement of the rounded shape: inside the band the surface
  // sits bevelDrop(q) below the face plane along the face normal, and beyond
  // |q| = uBevelRadius the fragment belongs to another face's band or to the
  // transparent outline.
  vec3 surface = roundedSurface(vWorldPos, nGeo, q);
  gl_FragDepth = surfaceDepth(surface);
  vec3 n = bevelNormal(nGeo, q);
  vec4 label = texture(uAtlas, vUV);
  vec4 carve = texture(uCarve, vUV);
  // Carved labels carry a tangent-space normal; labels never reach the bevel
  // band, so the carve normal replaces the flat geometric one outright.
  if (q.x == 0.0 && q.y == 0.0) {
    vec3 t = normalize(vTangent);
    vec3 b = cross(nGeo, t);
    vec3 c = carve.rgb * 2.0 - 1.0;
    n = normalize(t * c.x + b * c.y + nGeo * c.z);
  }
  float shadow = shadowFactor(surface, n);
  outColor = vec4(diceLitColor(mix(uColor, uInk, label.a), n, carve.a, surface.z, label.a, shadow), alpha);
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

${FLOOR_LIGHTING_FS}

void main() {
  outColor = vec4(litColor(uColor, normalize(vNormal), 1.0, vWorldPos.z), 1.0);
}
`;
