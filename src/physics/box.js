export const METERS_PER_DEVICE_PIXEL = 0.0254 / 440;

export const MIN_BOX_EDGE = 0.05;

export function boxFromViewport(cssW, cssH, dpr) {
  const shortest = Math.min(cssW, cssH);
  let metersPerPixel = dpr * METERS_PER_DEVICE_PIXEL;
  // Guard: a box shorter than MIN_BOX_EDGE cannot hold the dice, so raise the scale instead.
  if (shortest > 0 && shortest * metersPerPixel < MIN_BOX_EDGE) {
    metersPerPixel = MIN_BOX_EDGE / shortest;
  }
  const W = cssW * metersPerPixel;
  const H = cssH * metersPerPixel;
  return { W, H, D: Math.min(W, H), metersPerPixel };
}
