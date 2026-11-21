---
name: "feat: make dice controls hideable with Roll still available"
priority: "high"
state: "live-testing"
worktree: "feat/31-hideable-dice-controls"
issuer: "#8"
complexity: "moderate"
shortName: "hideable-dice-controls"
blockedBy: ""
splitter: "done"
changes: "{\"base\":\"main\",\"ins\":227,\"del\":6,\"files\":3}"
commits: "[{\"hash\":\"ba75a40\",\"subject\":\"feat(ui): hide the dice rows behind a disclosure button\",\"when\":\"2026-11-18T22:44:02+01:00\"}]"
---

# Summary
Always start with only Show controls and Roll visible. Let the user manually expose and hide the add/remove rows without changing the dice, while keeping Space rolling and all controls accessible.

# Specs
# Required behavior
- Start with the six add/remove dice rows hidden on every page load. Do not persist the expanded/collapsed state.
- When collapsed, keep a small `Show controls` button and the Roll button visible. Space still rolls while collapsed.
- When expanded, show all dice rows, a `Hide controls` button and Roll. Temporary overlay of the drawing area while expanded is acceptable; hiding the rows exposes the canvas again.
- Showing or hiding controls changes neither dice counts nor the live dice. Preserve storage, the total cap of 10 and all add/remove behavior, including #26's missing-key-equals-zero contract.

# Interaction and accessibility
- Use a native disclosure button with an accessible name, `aria-expanded`, `aria-controls`, visible focus and a target at least 44 x 44 CSS px.
- Hidden rows must leave rendering, pointer hit-testing, keyboard tab order and the accessibility tree. Restore the same values when shown. If hiding moves focus from a row, put focus on the disclosure button.
- On the disclosure button or Roll button, Enter and Space perform standard button activation and must not also trigger the document Space-roll shortcut. Elsewhere, Space rolls exactly once, repeats are ignored and the default scroll is prevented.
- Panel/disclosure pointer events must never drag dice. Newly exposed drawing areas must accept normal die dragging.
- Keep controls reachable around safe areas at 320 x 568, 360 x 640 and 375 x 667 CSS px, on desktop, and in short landscape viewports.

# Implementation scope
- Make the disclosure UI-local to `src/ui/panel.js` and `src/style.css`; do not recreate the panel or accumulate document listeners on each toggle.
- Preserve the existing `createPanel` API and callbacks. No world/renderer exclusion zone and no new dependency are needed.
- Add focused tests for the disclosure state/keyboard behavior where practical in the existing test setup. Cover default-collapsed, collapsed Roll/Space, no accidental canvas input, persistence across show/hide, and accessibility in live testing.

# Acceptance commands
- `npm test`
- `npm run build`

# Notes
Live test on merged commit ba75a40, checkpoint 2. Setup unchanged: dist served at http://127.0.0.1:4719, playwright harness /tmp/dice-lt31 (playwright 1.59, chromium-1217, 58fps measured, WebGL2 fine).

Progress: first full driver run completed Phase 1 and was killed mid-Phase-1-pollution; calibration + tab-order probes done since. 21 checks green so far, including: default collapsed (toggle label/aria/aria-controls, rows hidden+display:none), Roll visible collapsed, 44px targets, a11y tree hides rows collapsed / exposes expanded, collapsed tab order [Show controls, Roll dice], synthetic keydown repeat:true ignored and default not prevented, Space at body rolls + defaultPrevented=true, Roll button rolls, expand/collapse flips label+aria, cap of 10 (adds all disabled, total=10) preserved across hide/show, Enter on Roll rolls, Space on Roll rolls via native activation and is not handled by the document listener (dp=false at BUTTON target), Enter/Space on toggle own activation (dp=false, no roll side effect observable).

Driver-side bugs found and being fixed (not product): (1) storage comparisons must parse JSON: the app stores the full zero-filled set (e.g. {"d4":9,"d6":1,"d8":0,...}), consistent with the #26 contract; (2) roll motion completes in <400ms for resting dice, so a movement check must sample from before the trigger; calibration shows roll signals of 416-18400 diff px vs ~0 at rest, MOVE_TOL=300 kept; (3) my expected expanded tab sequence was wrong: with the default set all "Remove" buttons for zero-count rows are disabled and correctly untabbable, so the real order from the toggle is [Add d4, Remove d6, Add d6, Add d8, Add d10, Add d12, Add d20, Roll dice]; (4) state tracking drift after the cap-test block made several expectations stale - the product behaved correctly in every drifted case; v2 asserts panel state at each block start.

Technical difficulty (environment/product, pre-existing, out of this task's scope): with >=8 dice the resting pile micro-jitters forever (waitForStill times out at 85s), which breaks all stillness-based checks at high dice counts. V2 keeps still-sensitive checks at 2 dice and runs the cap test last with counts/storage assertions only. Also noting: fresh load with no stored set keeps localStorage empty (storage=null) until the first add/remove; parse falls back to DEFAULT_SET - expected per code path, not a defect.
