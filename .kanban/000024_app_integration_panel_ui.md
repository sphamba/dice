---
name: "feat: dice set panel UI, storage, roll button and Space key"
priority: "high"
state: "done"
worktree: "feat/24-app-integration-panel-ui"
issuer: "#8"
complexity: "moderate"
shortName: "app-integration-panel-ui"
splitter: "done"
map: "{\"files\":[{\"path\":\"src/style.css\",\"symbols\":[{\"name\":\".panel\",\"kind\":\"class\",\"ins\":15,\"del\":0,\"isNew\":true},{\"name\":\".panel-rows\",\"kind\":\"class\",\"ins\":6,\"del\":0,\"isNew\":true},{\"name\":\".panel-row\",\"kind\":\"class\",\"ins\":5,\"del\":0,\"isNew\":true},{\"name\":\".panel-type\",\"kind\":\"class\",\"ins\":6,\"del\":0,\"isNew\":true},{\"name\":\".panel-count\",\"kind\":\"class\",\"ins\":5,\"del\":0,\"isNew\":true},{\"name\":\".panel-step, .panel-roll\",\"kind\":\"class\",\"ins\":12,\"del\":0,\"isNew\":true},{\"name\":\".panel-step:disabled\",\"kind\":\"class\",\"ins\":4,\"del\":0,\"isNew\":true},{\"name\":\".panel-step:focus-visible, .panel-roll:focus-visible\",\"kind\":\"class\",\"ins\":5,\"del\":0,\"isNew\":true},{\"name\":\".panel-roll\",\"kind\":\"class\",\"ins\":7,\"del\":0,\"isNew\":true},{\"name\":\".panel-step:not(:disabled):hover, .panel-roll:hover\",\"kind\":\"class\",\"ins\":4,\"del\":0,\"isNew\":true},{\"name\":\".panel-roll:hover\",\"kind\":\"class\",\"ins\":3,\"del\":0,\"isNew\":true}]},{\"path\":\"src/ui/.gitkeep\",\"symbols\":[]},{\"path\":\"src/ui/panel.js\",\"symbols\":[{\"name\":\"MAX_DICE\",\"kind\":\"class\",\"ins\":1,\"del\":0,\"isNew\":true},{\"name\":\"DEFAULT_SET\",\"kind\":\"class\",\"ins\":1,\"del\":0,\"isNew\":true},{\"name\":\"STORAGE_KEY\",\"kind\":\"class\",\"ins\":1,\"del\":0,\"isNew\":true},{\"name\":\"isKnown\",\"kind\":\"fn\",\"ins\":1,\"del\":0,\"isNew\":true},{\"name\":\"total\",\"kind\":\"fn\",\"ins\":1,\"del\":0,\"isNew\":true},{\"name\":\"parseStoredSet\",\"kind\":\"fn\",\"ins\":19,\"del\":0,\"isNew\":true},{\"name\":\"canAdd\",\"kind\":\"fn\",\"ins\":3,\"del\":0,\"isNew\":true},{\"name\":\"canRemove\",\"kind\":\"fn\",\"ins\":3,\"del\":0,\"isNew\":true},{\"name\":\"readStorage\",\"kind\":\"fn\",\"ins\":7,\"del\":0,\"isNew\":true},{\"name\":\"writeStorage\",\"kind\":\"fn\",\"ins\":7,\"del\":0,\"isNew\":true},{\"name\":\"buildRow\",\"kind\":\"fn\",\"ins\":47,\"del\":0,\"isNew\":true},{\"name\":\"createPanel\",\"kind\":\"fn\",\"ins\":53,\"del\":0,\"isNew\":true}]},{\"path\":\"src/ui/panel.test.js\",\"symbols\":[{\"name\":\"parseStoredSet\",\"kind\":\"fn\",\"ins\":41,\"del\":0,\"isNew\":true},{\"name\":\"canAdd\",\"kind\":\"fn\",\"ins\":12,\"del\":0,\"isNew\":true},{\"name\":\"canRemove\",\"kind\":\"fn\",\"ins\":12,\"del\":0,\"isNew\":true}]}],\"flows\":[],\"role\":\"developer\",\"run\":0,\"model\":\"DeepSeek V4.1 Flash\",\"at\":\"2026-11-15T19:54:58.240Z\",\"head\":\"4160868\"}"
changes: "{\"base\":\"main\",\"ins\":313,\"del\":0,\"files\":4}"
commits: "[{\"hash\":\"acd71bd\",\"subject\":\"feat(ui): add dice set panel with storage, roll button and Space key\",\"when\":\"2026-11-15T20:51:22+01:00\"}]"
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
Live test of commit acd71bd, run from this worktree. src/main.js does not import the panel yet (wiring is #25), so the test mounted createPanel on #ui in the real page with the pinned contract callbacks. Serve: python3 -m http.server 8737. Browser: headless Chromium, viewports 1280x800 and 375x667, Playwright driver /tmp/dice-panel-live.mjs, log /tmp/dice-panel-live.log, screenshots /tmp/dice-panel-initial.png and /tmp/dice-panel-capped.png.

Result: 44 checks, 44 pass, 0 fail, no console or page errors. One behavior finding, filed as #26.

Passes:
- Contract: MAX_DICE=10, DEFAULT_SET, STORAGE_KEY='dice.set'. getSet() returns a copy. initialSet {d20:3,d6:1} renders and writes nothing to storage until a change.
- Render: panel inside #ui at the bottom edge (border-box bottom 784 of 800, centered), background alpha 0.72, no overflow at 375x667. Rows in DICE_TYPES order, minus/count/plus per row. #ui stays pointer-events none, panel subtree auto.
- Counts: default 2 x d6. Add and Remove update the count, fire onAdd/onRemove once, and write JSON.stringify(set) to localStorage on every change. Reload restores the stored set. Minus disabled at count 0, every plus disabled at total 10 with greyed style (opacity 0.35), clicks on disabled buttons do nothing, plus buttons re-enable after a remove.
- Roll: button click, Space keydown and Space on the focused Roll button each give exactly one roll. defaultPrevented is true on Space. repeat=true is ignored. KeyA is ignored. Enter still clicks the focused Roll button. Space on a focused minus rolls once and does not activate the button (side effect accepted by the specs).
- Accessibility: role=group, aria-label "Dice set", "Add d20"/"Remove d20" per row, "Roll dice", aria-live=polite counts, every button at least 44x44 CSS px.
- pointerdown guard: a pointerdown on the panel never reaches a document-level listener, a pointerdown on #view does, and panel buttons still work with the guard active.
- Storage validation: 9 invalid payloads (bad JSON, unknown key d7, negative, 1.5, total 12, "null", "[]", a quoted string, a bare number) all fall back to DEFAULT_SET on reload.

Finding: stored '{"d8":1}' renders d6=2. parseStoredSet inherits DEFAULT_SET values for keys missing from the stored JSON, but the previous Notes recorded the assumption "fills missing type keys with 0". Specs do not pin this case. Filed #26 with an open question.

Assumptions and limits of this test:
- Mounting the panel with the pinned callbacks stands in for #25 wiring. No die drag exists yet, so the pointerdown guard was measured against a document-level listener, not against canvas drag.
- Headless Chromium reports env(safe-area-inset-*) as 0, so inset padding was not measured. The #ui rule keeps the existing env() padding and the panel stayed inside the viewport at both sizes.
- localStorage throwing (private mode or quota) was not exercised live. The read and write paths sit in try/catch in src/ui/panel.js.
- The :focus-visible ring was not asserted in the live run. The rule exists in src/style.css for .panel-step and .panel-roll.
- Semi-transparency was checked against the flat page background. The renderer did not draw the box in these page loads.
