import { DICE_TYPES } from '../dice/shapes.js';

export const MAX_DICE = 10;

export const DEFAULT_SET = { d4: 0, d6: 2, d8: 0, d10: 0, d12: 0, d20: 0 };

export const STORAGE_KEY = 'dice.set';

const isKnown = (type) => DICE_TYPES.includes(type);

const total = (set) => DICE_TYPES.reduce((sum, type) => sum + set[type], 0);

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

  const set = fallback();
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
  roll.textContent = 'Roll';
  roll.setAttribute('aria-label', 'Roll dice');
  roll.addEventListener('click', () => onRoll?.());

  panel.append(rows, roll);
  panel.addEventListener('pointerdown', (event) => event.stopPropagation());

  const onKeyDown = (event) => {
    if (event.code !== 'Space' || event.repeat) return;
    event.preventDefault();
    onRoll?.();
  };
  document.addEventListener('keydown', onKeyDown);

  root.append(panel);
  syncAll();

  return { getSet: () => ({ ...set }) };
}
