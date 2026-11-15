import { expect, test } from 'vitest';
import { GAP_MS, MAX_DURATION_MS, MAX_SPEED, MIN_DURATION_MS, MIN_SPEED, createHaptics } from './haptics.js';

const impact = (speed) => ({ a: {}, surface: 'floor', point: [0, 0, 0], speed, impulse: 0.001 });

const recorder = () => {
  const calls = [];
  let now = 0;
  return { calls, vibrate: (ms) => calls.push(ms), now: () => now, advance: (ms) => { now += ms; } };
};

test('does nothing where navigator.vibrate is missing', () => {
  const haptics = createHaptics({ vibrate: () => false, now: () => 0 });
  expect(typeof haptics.play).toBe('function');
  expect(createHaptics().play([impact(5)])).toBe(0);
});

test('ignores impacts at or below the speed gate', () => {
  const log = recorder();
  const haptics = createHaptics(log);
  expect(haptics.play([impact(MIN_SPEED)])).toBe(0);
  expect(haptics.play([impact(MIN_SPEED - 0.1)])).toBe(0);
  expect(log.calls).toEqual([]);
});

test('vibrates for the strongest impact of the frame only', () => {
  const log = recorder();
  const haptics = createHaptics(log);
  haptics.play([impact(1), impact(2), impact(1.5)]);
  expect(log.calls).toHaveLength(1);
});

test('scales the duration between the minimum and the maximum with speed', () => {
  const log = recorder();
  const haptics = createHaptics(log);
  haptics.play([impact(MIN_SPEED + 0.01)]);
  log.advance(GAP_MS);
  haptics.play([impact(MAX_SPEED)]);
  log.advance(GAP_MS);
  haptics.play([impact(MAX_SPEED * 10)]);
  expect(log.calls[0]).toBe(MIN_DURATION_MS);
  expect(log.calls[1]).toBe(MAX_DURATION_MS);
  expect(log.calls[2]).toBe(MAX_DURATION_MS);
});

test('vibrates at most once per gap', () => {
  const log = recorder();
  const haptics = createHaptics(log);
  haptics.play([impact(2)]);
  log.advance(GAP_MS - 1);
  expect(haptics.play([impact(2)])).toBe(0);
  log.advance(1);
  expect(haptics.play([impact(2)])).toBeGreaterThan(0);
  expect(log.calls).toHaveLength(2);
});
