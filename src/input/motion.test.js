import { expect, test } from 'vitest';
import { MAX_GRAVITY, deviceToWorldGravity } from './motion.js';

const G = 9.81;

const expectVec = (actual, expected) => {
  expect(actual[0]).toBeCloseTo(expected[0], 5);
  expect(actual[1]).toBeCloseTo(expected[1], 5);
  expect(actual[2]).toBeCloseTo(expected[2], 5);
};

test('a phone flat on a table gives downward gravity for every screen angle', () => {
  const flat = { x: 0, y: 0, z: G };
  for (const angle of [0, 90, 180, 270]) {
    expectVec(deviceToWorldGravity(flat, angle), [0, 0, -G]);
  }
});

test('an upright portrait phone at angle 0 gives gravity along -y', () => {
  expectVec(deviceToWorldGravity({ x: 0, y: G, z: 0 }, 0), [0, -G, 0]);
});

test('the tilt in the screen plane rotates with the screen angle', () => {
  const upright = { x: 0, y: G, z: 0 };
  expectVec(deviceToWorldGravity(upright, 90), [G, 0, 0]);
  expectVec(deviceToWorldGravity(upright, 180), [0, G, 0]);
  expectVec(deviceToWorldGravity(upright, 270), [-G, 0, 0]);
});

test('a negative angle maps to its positive equivalent', () => {
  const upright = { x: 0, y: G, z: 0 };
  expectVec(deviceToWorldGravity(upright, -90), deviceToWorldGravity(upright, 270));
});

test('a sideways shake moves the dice against the acceleration', () => {
  expectVec(deviceToWorldGravity({ x: G, y: 0, z: 0 }, 0), [-G, 0, 0]);
});

test('the inverted iOS sign restores the spec convention', () => {
  expectVec(deviceToWorldGravity({ x: 0, y: 0, z: -G }, 0, -1), [0, 0, -G]);
});

test('the magnitude is clamped to MAX_GRAVITY without changing the direction', () => {
  expect(MAX_GRAVITY).toBeCloseTo(4 * G, 5);
  expectVec(deviceToWorldGravity({ x: 0, y: 0, z: 100 }, 0), [0, 0, -MAX_GRAVITY]);
  const clamped = deviceToWorldGravity({ x: 0, y: 300, z: 400 }, 0);
  expect(Math.hypot(...clamped)).toBeCloseTo(MAX_GRAVITY, 5);
  expectVec(clamped, [0, -MAX_GRAVITY * 0.6, -MAX_GRAVITY * 0.8]);
});

test('a device at rest in free fall gives zero gravity', () => {
  expectVec(deviceToWorldGravity({ x: 0, y: 0, z: 0 }, 0), [0, 0, 0]);
});
