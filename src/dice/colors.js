// Random die body colors and the WCAG contrast rule that picks the label ink.

export const HUE_RANGE = [0, 360];
export const SATURATION_RANGE = [0.45, 0.85];
export const LIGHTNESS_RANGE = [0.25, 0.75];

export const BLACK_INK = [0, 0, 0];
export const WHITE_INK = [1, 1, 1];

const HEX_PATTERN = /^#[0-9a-f]{6}$/i;

const pick = ([min, max], random) => min + random() * (max - min);

export function hslToRgb(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const sector = (((h % 360) + 360) % 360) / 60;
  const x = c * (1 - Math.abs((sector % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] =
    sector < 1 ? [c, x, 0]
    : sector < 2 ? [x, c, 0]
    : sector < 3 ? [0, c, x]
    : sector < 4 ? [0, x, c]
    : sector < 5 ? [x, 0, c]
    : [c, 0, x];
  return [r + m, g + m, b + m];
}

export function randomDieColor(random = Math.random) {
  return hslToRgb(
    pick(HUE_RANGE, random),
    pick(SATURATION_RANGE, random),
    pick(LIGHTNESS_RANGE, random),
  );
}

const linear = (value) => {
  const c = Math.min(Math.max(value, 0), 1);
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

export function relativeLuminance([r, g, b]) {
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

const contrast = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

// Black wins a tie, so the ink choice flips at relative luminance 0.1791.
export function inkForDie(rgb) {
  const luminance = relativeLuminance(rgb);
  return contrast(luminance, 0) >= contrast(luminance, 1) ? BLACK_INK : WHITE_INK;
}

const byte = (value) => Math.round(Math.min(Math.max(value, 0), 1) * 255);

export function toHex([r, g, b]) {
  const hex = (value) => byte(value).toString(16).padStart(2, '0');
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

export function fromHex(hex) {
  if (typeof hex !== 'string' || !HEX_PATTERN.test(hex)) return null;
  return [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16) / 255);
}
