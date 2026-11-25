import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DICE_TYPES } from '../dice/shapes.js';
import { randomDieColor, toHex } from '../dice/colors.js';
import {
  DEFAULT_SET,
  MAX_DICE,
  STORAGE_KEY,
  canAdd,
  canRemove,
  createPanel,
  parseStoredState,
  showMessage,
} from './panel.js';

const setOf = (counts) => Object.fromEntries(DICE_TYPES.map((type) => [type, counts[type] ?? 0]));

class StubElement {
  constructor(tag) {
    this.tagName = tag.toUpperCase();
    this.children = [];
    this.attributes = new Map();
    this.listeners = new Map();
    this.hidden = false;
    this.disabled = false;
    this.className = '';
    this.textContent = '';
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  getAttribute(name) {
    return this.attributes.get(name) ?? null;
  }

  append(...nodes) {
    for (const node of nodes) {
      node.parent = this;
      this.children.push(node);
    }
  }

  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(listener);
  }

  fire(type, event = {}) {
    for (const listener of this.listeners.get(type) ?? []) listener({ type, target: this, ...event });
  }

  click() {
    this.fire('click');
  }

  contains(node) {
    if (node === this) return true;
    return this.children.some((child) => child.contains(node));
  }

  focus() {
    stubDocument.activeElement = this;
  }
}

const stubDocument = {
  activeElement: null,
  listeners: new Map(),
  createElement: (tag) => new StubElement(tag),
  createElementNS: (_ns, tag) => new StubElement(tag),
  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(listener);
  },
};

const keyDown = (init) => {
  const event = { code: 'Space', repeat: false, defaultPrevented: false, ...init };
  event.preventDefault = () => {
    event.defaultPrevented = true;
  };
  for (const listener of stubDocument.listeners.get('keydown') ?? []) listener(event);
  return event;
};

const childrenByTag = (root, tagName) =>
  root.children.filter((child) => child.tagName === tagName.toUpperCase());

const usesCurrentColor = (root) =>
  [...root.attributes.values()].includes('currentColor') ||
  root.children.some((child) => usesCurrentColor(child));

const byClass = (root, className) => {
  if (String(root.className).split(' ').includes(className)) return root;
  for (const child of root.children) {
    const found = byClass(child, className);
    if (found) return found;
  }
  return null;
};

describe('parseStoredState counts', () => {
  it('returns every known type for a valid stored set', () => {
    const set = parseStoredState(JSON.stringify(setOf({ d4: 1, d20: 3 }))).set;
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
    for (const raw of cases) expect(parseStoredState(raw).set).toEqual(DEFAULT_SET);
  });

  it('accepts a total equal to MAX_DICE', () => {
    const stored = setOf({ d4: 4, d8: 6 });
    expect(parseStoredState(JSON.stringify(stored)).set).toEqual(stored);
    expect(MAX_DICE).toBe(10);
  });

  it('fills missing types with zero', () => {
    expect(parseStoredState('{"d6":3}').set).toEqual(setOf({ d6: 3 }));
    expect(parseStoredState('{"d20":1}').set).toEqual(setOf({ d20: 1 }));
    expect(parseStoredState('{"d20":1}').set.d6).toBe(0);
  });

  it('falls back to 2 x d6 only when storage is missing or invalid', () => {
    expect(parseStoredState(null).set).toEqual(setOf({ d6: 2 }));
    expect(parseStoredState('{not json').set).toEqual(setOf({ d6: 2 }));
  });

  it('does not share the DEFAULT_SET object', () => {
    const set = parseStoredState(null).set;
    expect(set).not.toBe(DEFAULT_SET);
    expect(DEFAULT_SET).toEqual(setOf({ d6: 2 }));
  });
});

describe('createPanel disclosure', () => {
  const mount = (options = {}) => {
    const root = stubDocument.createElement('div');
    const panel = createPanel(root, { initialSet: setOf({ d6: 2 }), ...options });
    const container = root.children[0];
    return {
      panel,
      container,
      toggle: byClass(container, 'panel-toggle'),
      rows: byClass(container, 'panel-rows'),
      roll: byClass(container, 'panel-roll'),
    };
  };

  beforeEach(() => {
    stubDocument.activeElement = null;
    stubDocument.listeners.clear();
    globalThis.document = stubDocument;
  });

  it('starts collapsed with only the disclosure and Roll visible', () => {
    const { toggle, rows, roll } = mount();
    expect(toggle.tagName).toBe('BUTTON');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(toggle.getAttribute('aria-controls')).toBe(rows.id);
    expect(toggle.getAttribute('aria-label')).toBe('Show controls');
    expect(rows.hidden).toBe(true);
    expect(roll.hidden).toBe(false);
  });

  it('shows and hides the rows without touching the dice', () => {
    const { panel, toggle, rows } = mount();
    const count = byClass(rows, 'panel-count').textContent;

    toggle.click();
    expect(rows.hidden).toBe(false);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(toggle.getAttribute('aria-label')).toBe('Hide controls');

    toggle.click();
    expect(rows.hidden).toBe(true);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(toggle.getAttribute('aria-label')).toBe('Show controls');
    expect(byClass(rows, 'panel-count').textContent).toBe(count);
    expect(panel.getSet()).toEqual(setOf({ d6: 2 }));
  });

  it('draws one hidden icon and no visible text on each corner button', () => {
    const { toggle, roll } = mount();
    for (const button of [toggle, roll]) {
      const icons = childrenByTag(button, 'svg');
      expect(icons).toHaveLength(1);
      expect(icons[0].getAttribute('aria-hidden')).toBe('true');
      expect(usesCurrentColor(icons[0])).toBe(true);
      expect(button.textContent).toBe('');
    }
    expect(roll.getAttribute('aria-label')).toBe('Roll dice');
  });

  it('keeps a single document key listener across toggles', () => {
    const { toggle } = mount();
    toggle.click();
    toggle.click();
    toggle.click();
    expect(stubDocument.listeners.get('keydown')).toHaveLength(1);
  });

  it('rolls once on document Space and ignores repeats', () => {
    const onRoll = vi.fn();
    mount({ onRoll });
    const elsewhere = stubDocument.createElement('div');

    expect(keyDown({ target: elsewhere }).defaultPrevented).toBe(true);
    expect(onRoll).toHaveBeenCalledTimes(1);

    keyDown({ target: elsewhere, repeat: true });
    expect(onRoll).toHaveBeenCalledTimes(1);

    keyDown({ target: elsewhere });
    expect(onRoll).toHaveBeenCalledTimes(2);
  });

  it('lets buttons handle Space themselves', () => {
    const onRoll = vi.fn();
    const { toggle, roll } = mount({ onRoll });

    expect(keyDown({ target: toggle }).defaultPrevented).toBe(false);
    expect(keyDown({ target: roll }).defaultPrevented).toBe(false);
    expect(onRoll).not.toHaveBeenCalled();

    roll.click();
    expect(onRoll).toHaveBeenCalledTimes(1);
  });

  it('moves focus to the disclosure when a focused row is hidden', () => {
    const { toggle, rows } = mount();
    toggle.click();

    const rowButton = byClass(rows, 'panel-step');
    rowButton.focus();
    expect(stubDocument.activeElement).toBe(rowButton);

    toggle.click();
    expect(rows.hidden).toBe(true);
    expect(stubDocument.activeElement).toBe(toggle);
  });

  it('stops pointer events from reaching the canvas', () => {
    const { container } = mount();
    const stopPropagation = vi.fn();
    container.fire('pointerdown', { stopPropagation });
    expect(stopPropagation).toHaveBeenCalled();
  });
});

describe('showMessage', () => {
  beforeEach(() => {
    globalThis.document = stubDocument;
  });

  it('puts the text in one element that later messages reuse', () => {
    const root = stubDocument.createElement('div');
    showMessage(root, 'WebGL2 is not supported by this browser');
    expect(root.children).toHaveLength(1);
    expect(root.children[0].textContent).toBe('WebGL2 is not supported by this browser');
    expect(root.children[0].id).toBe('unsupported');
    showMessage(root, 'fragment shader compile failed: ERROR: 0:1');
    expect(root.children).toHaveLength(1);
    expect(root.children[0].textContent).toBe('fragment shader compile failed: ERROR: 0:1');
  });
});

const withColors = (counts, colors) => ({ ...setOf(counts), colors });

describe('parseStoredState', () => {
  it('round trips one color per die, in add order', () => {
    const raw = JSON.stringify(withColors({ d6: 2 }, { d6: ['#112233', '#445566'] }));
    const { set, colors, generated } = parseStoredState(raw);
    expect(set).toEqual(setOf({ d6: 2 }));
    expect(colors.d6).toEqual(['#112233', '#445566']);
    expect(colors.d4).toEqual([]);
    expect(colors.d20).toEqual([]);
    expect(generated).toBe(false);
  });

  it('gives an old value without colors a random color per die and asks to save it', () => {
    const { set, colors, generated } = parseStoredState('{"d6":2,"d20":1}', () => 0.5);
    expect(set).toEqual(setOf({ d6: 2, d20: 1 }));
    expect(generated).toBe(true);
    expect(colors.d6).toEqual(Array(2).fill(toHex(randomDieColor(() => 0.5))));
    expect(colors.d20).toEqual([toHex(randomDieColor(() => 0.5))]);
  });

  it('keeps the colors it can and regenerates only the missing ones', () => {
    const raw = JSON.stringify(withColors({ d6: 3 }, { d6: ['#112233'] }));
    const { colors, generated } = parseStoredState(raw, () => 0.5);
    expect(generated).toBe(true);
    expect(colors.d6[0]).toBe('#112233');
    expect(colors.d6).toHaveLength(3);
    for (const hex of colors.d6.slice(1)) expect(hex).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('drops a color that is not a hex value', () => {
    const raw = JSON.stringify(withColors({ d6: 1 }, { d6: ['red'] }));
    const { colors, generated } = parseStoredState(raw, () => 0.5);
    expect(generated).toBe(true);
    expect(colors.d6).toEqual([toHex(randomDieColor(() => 0.5))]);
  });

  it('falls back to the default setup without throwing', () => {
    const cases = ['{not json', '', 'null', '[]', '42', JSON.stringify({ d6: 2, d100: 1 }), JSON.stringify(setOf({ d6: 11 }))];
    for (const raw of cases) {
      const { set, colors } = parseStoredState(raw, () => 0.5);
      expect(set).toEqual(DEFAULT_SET);
      expect(colors.d6).toHaveLength(2);
    }
  });

  it('treats a corrupt colors entry as missing colors', () => {
    const { set, colors, generated } = parseStoredState(JSON.stringify({ d6: 2, colors: 7 }), () => 0.5);
    expect(set).toEqual(setOf({ d6: 2 }));
    expect(generated).toBe(true);
    expect(colors.d6).toHaveLength(2);
  });
});

const memoryStorage = () => {
  const map = new Map();
  return {
    map,
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
  };
};

const rowFor = (rows, type) =>
  rows.children.find((row) => row.children[0]?.textContent === type);

const storedColors = () => JSON.parse(globalThis.localStorage.getItem(STORAGE_KEY)).colors;

describe('createPanel per-die colors', () => {
  beforeEach(() => {
    stubDocument.activeElement = null;
    stubDocument.listeners.clear();
    globalThis.document = stubDocument;
    globalThis.localStorage = memoryStorage();
  });

  const mount = (options = {}) => {
    const root = stubDocument.createElement('div');
    const panel = createPanel(root, { initialSet: setOf({ d6: 2 }), ...options });
    const container = root.children[0];
    return { panel, rows: byClass(container, 'panel-rows') };
  };

  it('reports one color per die of each type, in add order', () => {
    const { panel } = mount({ initialColors: { d6: ['#112233', '#445566'] } });
    const colors = panel.getColors();
    expect(colors.d6).toEqual([
      [0x11 / 255, 0x22 / 255, 0x33 / 255],
      [0x44 / 255, 0x55 / 255, 0x66 / 255],
    ]);
    expect(colors.d4).toEqual([]);
  });

  it('saves the generated colors on load so a reload keeps them', () => {
    localStorage.setItem(STORAGE_KEY, '{"d6":2}');
    createPanel(stubDocument.createElement('div'), { random: () => 0.5 });
    const expected = toHex(randomDieColor(() => 0.5));
    expect(storedColors().d6).toEqual([expected, expected]);
  });

  it('removes the newest color with its die and gives the added die a new one', () => {
    const onAdd = vi.fn();
    const onRemove = vi.fn();
    const { rows } = mount({
      initialColors: { d6: ['#112233', '#445566'] },
      random: () => 0,
      onAdd,
      onRemove,
    });
    const row = rowFor(rows, 'd6');
    const [, remove, count, add] = row.children;

    remove.click();
    expect(onRemove).toHaveBeenCalledWith('d6');
    expect(count.textContent).toBe('1');
    expect(storedColors().d6).toEqual(['#112233']);

    add.click();
    expect(onAdd).toHaveBeenCalledTimes(1);
    const [type, rgb] = onAdd.mock.calls[0];
    expect(type).toBe('d6');
    expect(toHex(rgb)).not.toBe('#112233');
    expect(storedColors().d6).toEqual(['#112233', toHex(rgb)]);
  });

  it('keeps the colors of the other dice across add and remove', () => {
    const { rows } = mount({
      initialSet: setOf({ d4: 1, d6: 1 }),
      initialColors: { d4: ['#010203'], d6: ['#040506'] },
      random: () => 0,
    });
    rowFor(rows, 'd6').children[1].click();
    rowFor(rows, 'd4').children[3].click();
    expect(storedColors().d4).toEqual(['#010203', toHex(randomDieColor(() => 0))]);
    expect(storedColors().d6).toEqual([]);
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
