import { DICE_TYPES } from '../dice/shapes.js';

export const MAX_DICE = 10;

export const DEFAULT_SET = { d4: 0, d6: 2, d8: 0, d10: 0, d12: 0, d20: 0 };

export const STORAGE_KEY = 'dice.set';

export const ROWS_ID = 'dice-rows';

const isKnown = (type) => DICE_TYPES.includes(type);

const total = (set) => DICE_TYPES.reduce((sum, type) => sum + set[type], 0);

const emptySet = () => Object.fromEntries(DICE_TYPES.map((type) => [type, 0]));

export function parseStoredSet(raw) {
  const fallback = () => ({ ...DEFAULT_SET });
  if (typeof raw !== 'string') return fallback();

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return fallback();
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return fallback();

  const set = emptySet();
  for (const [type, count] of Object.entries(parsed)) {
    if (!isKnown(type) || !Number.isInteger(count) || count < 0) return fallback();
    set[type] = count;
  }
  return total(set) <= MAX_DICE ? set : fallback();
}

export function canAdd(set, type) {
  return isKnown(type) && total(set) < MAX_DICE;
}

export function canRemove(set, type) {
  return isKnown(type) && set[type] > 0;
}

function readStorage() {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStorage(set) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(set));
  } catch {
    // Private mode or a full quota: the panel keeps working in memory.
  }
}

const SVG_NS = 'http://www.w3.org/2000/svg';

const DIE_SHAPE = [
  ['rect', { x: '3', y: '3', width: '18', height: '18', rx: '4', fill: 'none', stroke: 'currentColor', 'stroke-width': '2' }],
  ...[8, 16].map((x) => ['circle', { cx: String(x), cy: '8', r: '1.6', fill: 'currentColor' }]),
  ['circle', { cx: '12', cy: '12', r: '1.6', fill: 'currentColor' }],
  ...[8, 16].map((x) => ['circle', { cx: String(x), cy: '16', r: '1.6', fill: 'currentColor' }]),
];

const SLIDERS_SHAPE = [
  ...[6, 12, 18].map((y, index) => [
    'line',
    {
      x1: '4',
      y1: String(y),
      x2: '20',
      y2: String(y),
      stroke: 'currentColor',
      'stroke-width': '2',
      'stroke-linecap': 'round',
    },
  ]),
  ...[14, 9, 16].map((x, index) => [
    'circle',
    { cx: String(x), cy: String([6, 12, 18][index]), r: '2.4', fill: 'currentColor' },
  ]),
];

function buildIcon(shape) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', '24');
  svg.setAttribute('height', '24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  for (const [tag, attributes] of shape) {
    const node = document.createElementNS(SVG_NS, tag);
    for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, value);
    svg.append(node);
  }
  return svg;
}

function buildRow(type, set, onChange) {
  const row = document.createElement('div');
  row.className = 'panel-row';

  const label = document.createElement('span');
  label.className = 'panel-type';
  label.textContent = type;

  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'panel-step';
  remove.textContent = '\u2212';
  remove.setAttribute('aria-label', `Remove ${type}`);

  const count = document.createElement('span');
  count.className = 'panel-count';
  count.setAttribute('aria-live', 'polite');

  const add = document.createElement('button');
  add.type = 'button';
  add.className = 'panel-step';
  add.textContent = '+';
  add.setAttribute('aria-label', `Add ${type}`);

  const sync = () => {
    count.textContent = String(set[type]);
    remove.disabled = !canRemove(set, type);
    add.disabled = !canAdd(set, type);
  };

  remove.addEventListener('click', () => {
    if (!canRemove(set, type)) return;
    set[type] -= 1;
    sync();
    onChange('remove', type);
  });

  add.addEventListener('click', () => {
    if (!canAdd(set, type)) return;
    set[type] += 1;
    sync();
    onChange('add', type);
  });

  row.append(label, remove, count, add);
  return { row, sync };
}

export const MESSAGE_ID = 'unsupported';

export function showMessage(root, message) {
  let element = null;
  for (const child of root.children) if (child.id === MESSAGE_ID) element = child;
  if (!element) {
    element = document.createElement('p');
    element.id = MESSAGE_ID;
    element.setAttribute('role', 'alert');
    root.append(element);
  }
  element.textContent = String(message);
  return element;
}

export function createPanel(root, { initialSet, onAdd, onRemove, onRoll } = {}) {
  const set = parseStoredSet(
    initialSet === undefined ? readStorage() : JSON.stringify(initialSet),
  );

  const panel = document.createElement('div');
  panel.className = 'panel';
  panel.setAttribute('role', 'group');
  panel.setAttribute('aria-label', 'Dice set');

  const rows = document.createElement('div');
  rows.className = 'panel-rows';
  rows.id = ROWS_ID;
  rows.hidden = true;

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'panel-toggle';
  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('aria-controls', ROWS_ID);
  toggle.append(buildIcon(SLIDERS_SHAPE));

  const toggleLabel = (shown) => (shown ? 'Hide controls' : 'Show controls');
  toggle.setAttribute('aria-label', toggleLabel(false));

  let expanded = false;
  toggle.addEventListener('click', () => {
    const wasInRows = rows.contains(document.activeElement);
    expanded = !expanded;
    rows.hidden = !expanded;
    toggle.setAttribute('aria-label', toggleLabel(expanded));
    toggle.setAttribute('aria-expanded', String(expanded));
    if (!expanded && wasInRows) toggle.focus();
  });

  const syncers = [];
  const syncAll = () => syncers.forEach((sync) => sync());

  const onChange = (action, type) => {
    writeStorage(set);
    syncAll();
    if (action === 'add') onAdd?.(type);
    else onRemove?.(type);
  };

  rows.append(
    ...DICE_TYPES.map((type) => {
      const { row, sync } = buildRow(type, set, onChange);
      syncers.push(sync);
      return row;
    }),
  );

  const roll = document.createElement('button');
  roll.type = 'button';
  roll.className = 'panel-roll';
  roll.setAttribute('aria-label', 'Roll dice');
  roll.append(buildIcon(DIE_SHAPE));
  roll.addEventListener('click', () => onRoll?.());

  panel.append(toggle, rows, roll);
  panel.addEventListener('pointerdown', (event) => event.stopPropagation());

  const onKeyDown = (event) => {
    if (event.code !== 'Space' || event.repeat) return;
    if (event.target?.tagName === 'BUTTON') return;
    event.preventDefault();
    onRoll?.();
  };
  document.addEventListener('keydown', onKeyDown);

  root.append(panel);
  syncAll();

  return { getSet: () => ({ ...set }) };
}
