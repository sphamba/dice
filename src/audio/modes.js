export const MAX_MODE_FREQUENCY = 8000;

export const DEFAULT_MAX_MODES = 24;

const T60_DECAYS = Math.log(1000);

// tau for an exponential mode to fall by 60 dB in the given time.
const t60Tau = (seconds) => seconds / T60_DECAYS;

const BOX_DAMP_HF = 0.8;

const GLASS_DAMP_HF = 0.45;

export const BOX = { f11: 200, tau: t60Tau(0.08) * (1 + BOX_DAMP_HF), dampHF: BOX_DAMP_HF };

export const GLASS = {
  f11: 900,
  tau: t60Tau(0.1) * (1 + GLASS_DAMP_HF),
  dampHF: GLASS_DAMP_HF,
};

export const DIE_REFERENCE_RADIUS = 0.0139;

const DIE_BASE_FREQUENCY = 2000;

const DIE_FREQUENCY_STEP = 100;

const DIE_DETUNE_STEP = 0.003;

const DIE_MODE_RATIOS = [1, 1.47, 1.93, 2.4, 2.87];

const DIE_TAU = t60Tau(0.03);

const DIE_DAMP_REFERENCE = 4000;

function hashType(type) {
  let hash = 0;
  for (let i = 0; i < type.length; i++) {
    hash = (hash * 31 + type.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function clamp(value, lo, hi) {
  return value < lo ? lo : value > hi ? hi : value;
}

// Position-independent plate basis: every mode of the (a, b) grid below the frequency
// ceiling, sorted by frequency, with the (m, n) indices a caller needs to evaluate
// the mode shape at a contact point.
export function plateGrid(a, b, material, maxModes = DEFAULT_MAX_MODES) {
  if (!(a > 0) || !(b > 0)) return [];
  const normalization = 1 / (a * a) + 1 / (b * b);
  const limit = (MAX_MODE_FREQUENCY / material.f11) * normalization;
  const modes = [];
  for (let m = 1; (m * m) / (a * a) < limit; m++) {
    for (let n = 1; (n * n) / (b * b) < limit; n++) {
      const f = (material.f11 * ((m / a) ** 2 + (n / b) ** 2)) / normalization;
      if (f >= MAX_MODE_FREQUENCY) continue;
      modes.push({
        f,
        amp: 1,
        tau: material.tau / (1 + (material.dampHF * f) / material.f11),
        m,
        n,
      });
    }
  }
  modes.sort((x, y) => x.f - y.f);
  return modes.slice(0, Math.max(0, maxModes));
}

export function plateModes(a, b, u, v, material, maxModes = DEFAULT_MAX_MODES) {
  const cu = clamp(u, 0, a);
  const cv = clamp(v, 0, b);
  return plateGrid(a, b, material, maxModes).map(({ f, tau, m, n }) => ({
    f,
    tau,
    amp: clamp(
      Math.abs(Math.sin((m * Math.PI * cu) / a)) * Math.abs(Math.sin((n * Math.PI * cv) / b)),
      0,
      1,
    ),
  }));
}

export function dieModes(type, radius = DIE_REFERENCE_RADIUS) {
  const size = radius > 0 ? radius : DIE_REFERENCE_RADIUS;
  const seed = hashType(String(type));
  const scale = DIE_REFERENCE_RADIUS / size;
  const base = (DIE_BASE_FREQUENCY + (seed % 5) * DIE_FREQUENCY_STEP) * scale;
  const detune = 1 + ((seed % 17) - 8) * DIE_DETUNE_STEP;
  const count = 3 + (seed % 3);
  const modes = [];
  for (let k = 0; k < count; k++) {
    const f = base * DIE_MODE_RATIOS[k] * detune;
    modes.push({
      f,
      amp: clamp(1 / (1 + 0.6 * k), 0, 1),
      tau: DIE_TAU / (1 + f / DIE_DAMP_REFERENCE),
    });
  }
  return modes;
}
