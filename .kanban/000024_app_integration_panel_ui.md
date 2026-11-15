---
name: "feat: dice set panel UI, storage, roll button and Space key"
priority: "high"
state: "to-merge"
worktree: "feat/24-app-integration-panel-ui"
issuer: "#8"
complexity: "moderate"
shortName: "app-integration-panel-ui"
splitter: "done"
map: "{\"files\":[{\"path\":\"src/style.css\",\"symbols\":[{\"name\":\".panel\",\"kind\":\"class\",\"ins\":15,\"del\":0,\"isNew\":true},{\"name\":\".panel-rows\",\"kind\":\"class\",\"ins\":6,\"del\":0,\"isNew\":true},{\"name\":\".panel-row\",\"kind\":\"class\",\"ins\":5,\"del\":0,\"isNew\":true},{\"name\":\".panel-type\",\"kind\":\"class\",\"ins\":6,\"del\":0,\"isNew\":true},{\"name\":\".panel-count\",\"kind\":\"class\",\"ins\":5,\"del\":0,\"isNew\":true},{\"name\":\".panel-step, .panel-roll\",\"kind\":\"class\",\"ins\":12,\"del\":0,\"isNew\":true},{\"name\":\".panel-step:disabled\",\"kind\":\"class\",\"ins\":4,\"del\":0,\"isNew\":true},{\"name\":\".panel-step:focus-visible, .panel-roll:focus-visible\",\"kind\":\"class\",\"ins\":5,\"del\":0,\"isNew\":true},{\"name\":\".panel-roll\",\"kind\":\"class\",\"ins\":7,\"del\":0,\"isNew\":true},{\"name\":\".panel-step:not(:disabled):hover, .panel-roll:hover\",\"kind\":\"class\",\"ins\":4,\"del\":0,\"isNew\":true},{\"name\":\".panel-roll:hover\",\"kind\":\"class\",\"ins\":3,\"del\":0,\"isNew\":true}]},{\"path\":\"src/ui/.gitkeep\",\"symbols\":[]},{\"path\":\"src/ui/panel.js\",\"symbols\":[{\"name\":\"MAX_DICE\",\"kind\":\"class\",\"ins\":1,\"del\":0,\"isNew\":true},{\"name\":\"DEFAULT_SET\",\"kind\":\"class\",\"ins\":1,\"del\":0,\"isNew\":true},{\"name\":\"STORAGE_KEY\",\"kind\":\"class\",\"ins\":1,\"del\":0,\"isNew\":true},{\"name\":\"isKnown\",\"kind\":\"fn\",\"ins\":1,\"del\":0,\"isNew\":true},{\"name\":\"total\",\"kind\":\"fn\",\"ins\":1,\"del\":0,\"isNew\":true},{\"name\":\"parseStoredSet\",\"kind\":\"fn\",\"ins\":19,\"del\":0,\"isNew\":true},{\"name\":\"canAdd\",\"kind\":\"fn\",\"ins\":3,\"del\":0,\"isNew\":true},{\"name\":\"canRemove\",\"kind\":\"fn\",\"ins\":3,\"del\":0,\"isNew\":true},{\"name\":\"readStorage\",\"kind\":\"fn\",\"ins\":7,\"del\":0,\"isNew\":true},{\"name\":\"writeStorage\",\"kind\":\"fn\",\"ins\":7,\"del\":0,\"isNew\":true},{\"name\":\"buildRow\",\"kind\":\"fn\",\"ins\":47,\"del\":0,\"isNew\":true},{\"name\":\"createPanel\",\"kind\":\"fn\",\"ins\":53,\"del\":0,\"isNew\":true}]},{\"path\":\"src/ui/panel.test.js\",\"symbols\":[{\"name\":\"parseStoredSet\",\"kind\":\"fn\",\"ins\":41,\"del\":0,\"isNew\":true},{\"name\":\"canAdd\",\"kind\":\"fn\",\"ins\":12,\"del\":0,\"isNew\":true},{\"name\":\"canRemove\",\"kind\":\"fn\",\"ins\":12,\"del\":0,\"isNew\":true}]}],\"flows\":[],\"role\":\"developer\",\"run\":0,\"model\":\"DeepSeek V4.1 Flash\",\"at\":\"2026-11-15T19:54:58.240Z\",\"head\":\"4160868\"}"
---

# Summary
Self-contained panel module: parse and store the dice set in localStorage, render per-type −/+ count rows with a cap of 10 total, add a Roll button and a Space key handler, with full accessibility. No imports from main.js or physics; emits onAdd/onRemove/onRoll callbacks.

# Specs
# Context
- Standalone UI module. The only allowed import is `DICE_TYPES` from `src/dice/shapes.js` (#3, done). Do not import from `src/main.js`, `src/physics/`, `src/render/` or `src/input/`.
- `src/main.js` integration is task #25. #25 imports this module and codes against the interface pinned below, so the exact export names and signatures are a contract: do not change them.
- Do not touch `src/main.js` (owned by #25). You own `src/ui/panel.js`, `src/ui/panel.test.js` and the panel styles in `src/style.css`.

# Interface contract (pinned, used by #25)
```js
// src/ui/panel.js
import { DICE_TYPES } from '../dice/shapes.js';
export const MAX_DICE = 10;
export const DEFAULT_SET = { d4: 0, d6: 2, d8: 0, d10: 0, d12: 0, d20: 0 };
export const STORAGE_KEY = 'dice.set';
export function parseStoredSet(raw) // string|null|undefined → { d4: n, ... } with every DICE_TYPES key present; invalid content → DEFAULT_SET
export function canAdd(set, type) // known type and total < MAX_DICE
export function canRemove(set, type) // known type and set[type] > 0
export function createPanel(root, { initialSet, onAdd, onRemove, onRoll }) // → { getSet() }
```
- `createPanel` builds the DOM in `root` (the app's `#ui` element), loads the set itself when `initialSet` is undefined: `parseStoredSet(localStorage.getItem(STORAGE_KEY))` inside try/catch (private mode throws). `onAdd(type)`, `onRemove(type)`, `onRoll()` are called on user actions after the internal set is updated. `getSet()` returns the current counts. Counts are saved to `localStorage` (`JSON.stringify`) on each change, inside try/catch.

# Behavior
- Overlay panel at the bottom of the screen inside `#ui`: semi-transparent background so the box stays visible, respects `env(safe-area-inset-*)`. `#ui` keeps `pointer-events: none` (see `src/style.css`); the panel subtree sets `pointer-events: auto` and stops `pointerdown` propagation so panel events never start a die drag on the canvas behind it.
- One row per type in `DICE_TYPES` order (d4, d6, d8, d10, d12, d20): `−` button, count, `+` button. Total over all types is 0 to `MAX_DICE`. Disable `+` when the total is 10 and `−` when the count is 0 (also grey the disabled style).
- Default set when nothing is stored: `DEFAULT_SET` (2 × d6).
- Storage validation on read (trust boundary): only known types, integers ≥ 0, total ≤ 10; on any invalid content use `DEFAULT_SET`. Catch all `localStorage` errors.
- Roll button: calls `onRoll()`. It stays enabled even with 0 dice.
- Space key rolls: document-level `keydown`, `e.code === 'Space'`, ignore `e.repeat`, call `e.preventDefault()`, then `onRoll()` once. preventDefault on keydown also stops the focused Roll button from firing a click on keyup, so there is no double roll when the Roll button has focus. Side effect to accept: Space never activates a focused panel button; Enter still does.
- Accessibility: real `<button>` elements, `aria-label` "Add d20", "Remove d20", "Roll dice", each row's count in an `aria-live="polite"` element, visible focus ring (`:focus-visible`), touch targets ≥ 44 × 44 CSS px.

# Styles (src/style.css)
- Panel positioned at the bottom edge of `#ui` (which is a fixed grid overlay with safe-area padding); add only panel-scoped rules, do not alter existing `#view`/`#ui` rules beyond what the panel needs.

# Tests
- `src/ui/panel.test.js` (vitest, node environment, pure functions only): `parseStoredSet` for valid input, invalid JSON, unknown type, negative value, non-integer, total > 10, and null/undefined — all invalid cases fall back to `DEFAULT_SET`; `canAdd`/`canRemove` at the boundaries (total = 10, count = 0, unknown type).
- Do not test `createPanel` (needs DOM; the parent live test covers it).

# Acceptance criteria
- `npm test` exits 0 and `npm run build` exits 0 (this module alone makes the build green; #25 adds the wiring).
- No stub or placeholder for `src/main.js` work; #25 owns it.

# Notes
- `src/ui/panel.js` implements the pinned contract exactly: `MAX_DICE`, `DEFAULT_SET`, `STORAGE_KEY`, `parseStoredSet`, `canAdd`, `canRemove`, `createPanel(root, {initialSet, onAdd, onRemove, onRoll}) -> {getSet}`. Only import is `DICE_TYPES` from `src/dice/shapes.js`.
- Panel DOM: one row per type in `DICE_TYPES` order (`−` button, `aria-live="polite"` count, `+` button), plus a Roll button; `+` disabled at total 10 and `−` at count 0 (re-synced for all rows on every change); `pointerdown` propagation stopped on the panel subtree.
- Space key: document-level `keydown`, `code === 'Space'`, `repeat` ignored, `preventDefault()` then `onRoll()`.
- Storage: read and write wrapped in try/catch (private mode, quota); the set is written with `JSON.stringify` on each change.
- `src/style.css`: panel-scoped rules only (`.panel*`), bottom edge via `place-self: end center` on the `#ui` grid so the existing safe-area padding applies; `pointer-events: auto`; 44 px minimum buttons; `:focus-visible` ring.
- Assumptions: `parseStoredSet` fills missing type keys with 0, while an unknown key, non-integer, negative value, non-object JSON or total above 10 falls back to `DEFAULT_SET`; `initialSet` goes through the same validation via `JSON.stringify`; no total counter is displayed (not in the specs); the Space listener is never removed because the contract returns only `getSet()`.
- `createPanel` is not unit-tested per the specs; its behaviour (clicks, cap, disabled states, Space, storage, `pointerdown` guard) was verified with a throwaway DOM-shim probe, now deleted.
- Verification: `npx vitest run src/ui/panel.test.js` 9 passed; clean-room copy of HEAD `npm test` 196 passed, `npm run build` OK, relative asset paths in `dist/index.html`. Commit `4160868`.
