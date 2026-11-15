export const MIN_SPEED = 0.8;

export const MAX_SPEED = 3;

export const MIN_DURATION_MS = 5;

export const MAX_DURATION_MS = 20;

export const GAP_MS = 60;

function navigatorVibrate(ms) {
  const navigator = globalThis.navigator;
  return typeof navigator?.vibrate === 'function' ? navigator.vibrate(ms) : false;
}

export function createHaptics({ vibrate = navigatorVibrate, now = () => globalThis.performance?.now() ?? 0 } = {}) {
  let lastPlayed = -Infinity;
  return {
    play(events) {
      let strongest = 0;
      for (const event of events ?? []) {
        if (event?.speed > MIN_SPEED && event.speed > strongest) strongest = event.speed;
      }
      if (strongest === 0) return 0;
      const time = now();
      if (time - lastPlayed < GAP_MS) return 0;
      const blend = Math.min((strongest - MIN_SPEED) / (MAX_SPEED - MIN_SPEED), 1);
      const duration = Math.round(MIN_DURATION_MS + (MAX_DURATION_MS - MIN_DURATION_MS) * blend);
      lastPlayed = time;
      return vibrate(duration) === false ? 0 : duration;
    },
  };
}
