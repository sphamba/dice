export function backingSize(cssWidth, cssHeight, devicePixelRatio) {
  const ratio = devicePixelRatio > 0 ? Math.min(devicePixelRatio, 2) : 1;
  return {
    width: Math.max(1, Math.round(cssWidth * ratio)),
    height: Math.max(1, Math.round(cssHeight * ratio)),
  };
}
