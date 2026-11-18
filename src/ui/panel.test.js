import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DICE_TYPES } from '../dice/shapes.js';
import {
  DEFAULT_SET,
  MAX_DICE,
  canAdd,
  canRemove,
  createPanel,
  parseStoredSet,
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

const byClass = (root, className) => {
  if (String(root.className).split(' ').includes(className)) return root;
  for (const child of root.children) {
    const found = byClass(child, className);
    if (found) return found;
  }
  return null;
};

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
    expect(toggle.textContent).toBe('Show controls');
    expect(rows.hidden).toBe(true);
    expect(roll.hidden).toBe(false);
  });

  it('shows and hides the rows without touching the dice', () => {
    const { panel, toggle, rows } = mount();
    const count = byClass(rows, 'panel-count').textContent;

    toggle.click();
    expect(rows.hidden).toBe(false);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(toggle.textContent).toBe('Hide controls');

    toggle.click();
    expect(rows.hidden).toBe(true);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(toggle.textContent).toBe('Show controls');
    expect(byClass(rows, 'panel-count').textContent).toBe(count);
    expect(panel.getSet()).toEqual(setOf({ d6: 2 }));
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
