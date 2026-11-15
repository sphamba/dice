import { expect, test } from 'vitest';
import { backingSize } from './canvas-size.js';

test('keeps the CSS size at device pixel ratio 1', () => {
  expect(backingSize(390, 844, 1)).toEqual({ width: 390, height: 844 });
});

test('scales the backing store by the device pixel ratio', () => {
  expect(backingSize(390, 844, 2)).toEqual({ width: 780, height: 1688 });
});

test('caps the ratio at 2', () => {
  expect(backingSize(390, 844, 3)).toEqual({ width: 780, height: 1688 });
});

test('falls back to ratio 1 for a missing or invalid ratio', () => {
  expect(backingSize(390, 844, undefined)).toEqual({ width: 390, height: 844 });
  expect(backingSize(390, 844, 0)).toEqual({ width: 390, height: 844 });
});

test('never returns a zero dimension', () => {
  expect(backingSize(0, 0, 2)).toEqual({ width: 1, height: 1 });
});

test('rounds fractional sizes', () => {
  expect(backingSize(390.4, 844.6, 1)).toEqual({ width: 390, height: 845 });
});
