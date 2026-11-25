// Physically based dice material: one distant disk light over a metallic-free
// dielectric, evaluated in linear space. shaders.js interpolates these numbers
// into the GLSL and the unit test integrates against the mirrors below, so the
// shader and the reference cannot drift apart.

// Unit vector toward the light centre, 15 deg from +z: an upward face sits off
// the peak highlight, and the disk still covers the top of the dice.
export const LIGHT_DIRECTION = [0.25881904510252074, 0, 0.9659258262890683];
export const LIGHT_ANGULAR_RADIUS = (35 * Math.PI) / 180;
export const LIGHT_RADIANCE = 1.6;

// Hemisphere ambient, brighter from the top. Values are irradiance / PI, so a
// white upward face reflects exactly this much.
export const AMBIENT_SKY = [0.51, 0.51, 0.51];
export const AMBIENT_GROUND = [0.128, 0.128, 0.128];

// Fraction of the GTAO darkening kept in the forward pass (1 = full, 0 = none).
export const AO_STRENGTH = 0.5;

export const ROUGHNESS = 0.5;
export const ALPHA = ROUGHNESS * ROUGHNESS;
export const F0 = 0.04;

// Representative-point fit for a light much wider than the GGX lobe: the cone
// eroded by the lobe half-width, the lobe widened by a tenth of the light
// radius, and the energy normalization. Fitted for roughness 0.5 under the
// 35 deg disk, where the fit holds to 15% against a quadrature of the disk; a
// different roughness or light needs a refit.
export const WIDEN_FRACTION = 0.1;
export const SPECULAR_NORMALIZATION = 0.614;

const PI = Math.PI;
const TAN_LIGHT = Math.tan(LIGHT_ANGULAR_RADIUS);
const COT_LIGHT = 1 / TAN_LIGHT;
const COT_LIGHT_SQ = COT_LIGHT * COT_LIGHT;
const WIDENED_ALPHA = Math.tan(Math.atan(ALPHA) + WIDEN_FRACTION * LIGHT_ANGULAR_RADIUS);
const REPRESENTATIVE_RADIUS = LIGHT_ANGULAR_RADIUS - Math.atan(ALPHA);
const VIEW = [0, 0, 1];

export const DICE_MATERIAL = {
  tanLight: TAN_LIGHT,
  cotLight: COT_LIGHT,
  cotLightSq: COT_LIGHT_SQ,
  atanCotLight: Math.atan(COT_LIGHT),
  widenedAlpha: WIDENED_ALPHA,
  representativeRadius: REPRESENTATIVE_RADIUS,
};

const clamp = (value, lo, hi) => Math.min(Math.max(value, lo), hi);
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const scale = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

export const srgbToLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
export const linearToSrgb = (c) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);
const toLinear = (rgb) => rgb.map(srgbToLinear);

// Irradiance of the light disk above the surface horizon, per unit radiance:
// cos gamma is the cosine between the normal and the light centre.
export function capIrradiance(cosGamma) {
  const cg = clamp(cosGamma, -1, 1);
  const gamma = Math.acos(cg);
  if (gamma < Math.atan(COT_LIGHT)) return (PI * cg) / (1 + COT_LIGHT_SQ);
  const sg = Math.sqrt(Math.max(1 - cg * cg, 0));
  const cotGamma = cg / Math.max(sg, 1e-8);
  const horizon = Math.sqrt(Math.max(1 - COT_LIGHT_SQ * cotGamma * cotGamma, 0));
  return (
    (-COT_LIGHT * horizon * sg) / (1 + COT_LIGHT_SQ) +
    Math.atan((horizon * sg) / COT_LIGHT) +
    (cg * (PI - Math.acos(clamp(COT_LIGHT * cotGamma, -1, 1)))) / (1 + COT_LIGHT_SQ)
  );
}

export function ggxDistribution(alpha, ndoth) {
  const a2 = alpha * alpha;
  const d = ndoth * ndoth * (a2 - 1) + 1;
  return a2 / (PI * d * d);
}

export function smithVisibility(ndotv, ndotl, alpha) {
  const a2 = alpha * alpha;
  const lambdaV = ndotl * Math.sqrt(ndotv * ndotv * (1 - a2) + a2);
  const lambdaL = ndotv * Math.sqrt(ndotl * ndotl * (1 - a2) + a2);
  return 0.5 / Math.max(lambdaV + lambdaL, 1e-9);
}

const fresnel = (cosTheta) => F0 + (1 - F0) * (1 - clamp(cosTheta, 0, 1)) ** 5;

// Closest direction in the representative cone to the mirror direction.
export function representativePoint(mirror) {
  const cosR = clamp(dot(mirror, LIGHT_DIRECTION), -1, 1);
  if (Math.acos(cosR) <= REPRESENTATIVE_RADIUS) return mirror;
  const tangent = mirror.map((c, i) => c - LIGHT_DIRECTION[i] * cosR);
  const length = Math.max(Math.hypot(...tangent), 1e-6);
  const axis = scale(LIGHT_DIRECTION, Math.cos(REPRESENTATIVE_RADIUS));
  return axis.map(
    (c, i) => c + (tangent[i] / length) * Math.sin(REPRESENTATIVE_RADIUS),
  ).map((c, i, all) => c / Math.max(Math.hypot(...all), 1e-6));
}

// GGX specular of the widened lobe at the representative point, weighted by the
// light irradiance.
export function specularRadiance(n, irradiance) {
  const ndotv = clamp(n[2], 1e-4, 1);
  const mirror = [2 * n[2] * n[0], 2 * n[2] * n[1], 2 * n[2] * n[2] - 1];
  const l = representativePoint(mirror);
  const ndotl = dot(n, l);
  if (ndotl <= 0) return 0;
  const hv = [VIEW[0] + l[0], VIEW[1] + l[1], VIEW[2] + l[2]];
  const hl = Math.max(Math.hypot(...hv), 1e-6);
  const h = scale(hv, 1 / hl);
  const vdoth = clamp(dot(VIEW, h), 1e-6, 1);
  return (
    SPECULAR_NORMALIZATION *
    ggxDistribution(WIDENED_ALPHA, clamp(dot(n, h), 1e-6, 1)) *
    smithVisibility(ndotv, ndotl, WIDENED_ALPHA) *
    fresnel(vdoth) *
    irradiance
  );
}

export const ambientRadiance = (n) => mix(AMBIENT_GROUND, AMBIENT_SKY, n[2] * 0.5 + 0.5);

// Karis/Lazarov analytic environment BRDF: vec2(scale, bias).
export function envBrdfApprox(ndotv, roughness) {
  const r = [roughness * -1.0 + 1.0, roughness * -0.0275 + 0.0425, roughness * -0.572 + 1.04, roughness * 0.022 - 0.04];
  const a004 = Math.min(r[0] * r[0], 2 ** (-9.28 * ndotv)) * r[0] + r[1];
  return [-1.04 * a004 + r[2], 1.04 * a004 + r[3]];
}

export function toneMapNeutral(rgb) {
  const startCompression = 0.8 - 0.04;
  const desaturation = 0.15;
  const x = Math.min(...rgb);
  const offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
  let color = rgb.map((c) => c - offset);
  const peak = Math.max(...color);
  if (peak < startCompression) return color;
  const d = 1 - startCompression;
  const newPeak = 1 - (d * d) / (peak + d - startCompression);
  const g = 1 - 1 / (desaturation * (peak - newPeak) + 1);
  return color.map((c) => c * (newPeak / peak) * (1 - g) + newPeak * g);
}

// Linear output of the dice material for one fragment.
export function diceLinear(baseSrgb, n, cavity, ao, directAo) {
  const base = toLinear(baseSrgb);
  const occlusion = 1 + (ao - 1) * AO_STRENGTH;
  const directOcclusion = 1 + (occlusion - 1) * directAo;
  const irradiance = capIrradiance(dot(n, LIGHT_DIRECTION)) * LIGHT_RADIANCE;
  const hemi = ambientRadiance(n);
  const [scale, bias] = envBrdfApprox(Math.max(n[2], 1e-4), ROUGHNESS);
  const directSpecular = specularRadiance(n, irradiance) * directOcclusion;
  return base.map((c, i) =>
    (c * irradiance * directOcclusion) / PI +
    c * hemi[i] * occlusion * cavity +
    directSpecular +
    (F0 * scale + bias) * hemi[i] * occlusion);
}

export function diceSrgb(baseSrgb, n, cavity, ao, directAo) {
  const linear = diceLinear(baseSrgb, n, cavity, ao, directAo).map((c) => Math.max(c, 0));
  return toneMapNeutral(linear).map((c) => linearToSrgb(Math.max(c, 0)));
}
