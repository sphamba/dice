import { describe, expect, it } from 'vitest';
import { DICE_TYPES } from '../dice/shapes.js';
import { DEFAULT_SET, MAX_DICE, canAdd, canRemove, parseStoredSet } from './panel.js';

const setOf = (counts) => Object.fromEntries(DICE_TYPES.map((type) => [type, counts[type] ?? 0]));

describe('parseStoredSet', () => {
  it('returns every known type for a valid stored set', () => {
    const set = parseStoredSet(JSON.stringify(setOf({ d4: 1, d20: 3 })));
    expect(set).toEqual(setOf({ d4: 1, d20: 3 }));
    expect(Object.keys(set).sort()).toEqual([...DICE_TYPES].sort());
  });

  it('falls back to DEFAULT_SET for invalid content', () => {
    const cases = [
      '{not json',
      '',
      'null',
      '[]',
      '42',
      JSON.stringify({ ...setOf({ d6: 1 }), d100: 2 }),
      JSON.stringify(setOf({ d4: -1 })),
      JSON.stringify(setOf({ d4: 1.5 })),
      JSON.stringify({ ...setOf({}), d6: '2' }),
      JSON.stringify(setOf({ d4: 6, d20: 5 })),
      null,
      undefined,
    ];
    for (const raw of cases) expect(parseStoredSet(raw)).toEqual(DEFAULT_SET);
  });

  it('accepts a total equal to MAX_DICE', () => {
    const stored = setOf({ d4: 4, d8: 6 });
    expect(parseStoredSet(JSON.stringify(stored))).toEqual(stored);
    expect(MAX_DICE).toBe(10);
  });

  it('fills missing types with zero', () => {
    expect(parseStoredSet('{"d6":3}')).toEqual(setOf({ d6: 3 }));
    expect(parseStoredSet('{"d20":1}')).toEqual(setOf({ d20: 1 }));
    expect(parseStoredSet('{"d20":1}').d6).toBe(0);
  });

  it('falls back to 2 x d6 only when storage is missing or invalid', () => {
    expect(parseStoredSet(null)).toEqual(setOf({ d6: 2 }));
    expect(parseStoredSet('{not json')).toEqual(setOf({ d6: 2 }));
  });

  it('does not share the DEFAULT_SET object', () => {
    const set = parseStoredSet(null);
    expect(set).not.toBe(DEFAULT_SET);
    expect(DEFAULT_SET).toEqual(setOf({ d6: 2 }));
  });
});

describe('canAdd', () => {
  it('allows a known type below the cap', () => {
    expect(canAdd(setOf({}), 'd6')).toBe(true);
    expect(canAdd(setOf({ d4: 9 }), 'd20')).toBe(true);
  });

  it('blocks at the cap and for unknown types', () => {
    expect(canAdd(setOf({ d4: 4, d8: 6 }), 'd12')).toBe(false);
    expect(canAdd(setOf({ d4: 8, d8: 2 }), 'd20')).toBe(false);
    expect(canAdd(setOf({}), 'd100')).toBe(false);
  });
});

describe('canRemove', () => {
  it('allows a known type with a positive count', () => {
    expect(canRemove(setOf({ d4: 1 }), 'd4')).toBe(true);
    expect(canRemove(setOf({ d4: 1, d20: 9 }), 'd20')).toBe(true);
  });

  it('blocks at zero and for unknown types', () => {
    expect(canRemove(setOf({ d6: 2 }), 'd4')).toBe(false);
    expect(canRemove(setOf({}), 'd6')).toBe(false);
    expect(canRemove(setOf({ d6: 2 }), 'd100')).toBe(false);
  });
});
