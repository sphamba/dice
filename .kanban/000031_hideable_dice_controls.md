---
name: "feat: make dice controls hideable with Roll still available"
priority: "high"
state: "to-live-test"
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
- Deliverable: `src/ui/panel.js` builds a native disclosure button (`panel-toggle`, `Show controls` / `Hide controls`, `aria-expanded`, `aria-controls="dice-rows"`), appended before the rows. Rows start `hidden` in a fresh panel, so every page load starts collapsed; the expanded state is never stored. Toggling only flips `rows.hidden` and the button label, so dice counts, `getSet()`, storage, the 10-dice cap and the #26 zero-fill contract are untouched. `createPanel` API and callbacks are unchanged.
- Keyboard: the document Space listener keeps `preventDefault` + `event.repeat` handling but returns early when `event.target.tagName === 'BUTTON'`, so Enter/Space on the disclosure, Roll or any add/remove button use native activation and never double-roll.
- Focus: when hiding, a focused element inside the rows moves focus to the disclosure button and the value the button had is preserved because the same row nodes are re-shown.
- CSS: `.panel-toggle` gets the 44 x 44 target, focus-visible outline, hover and `.panel-rows[hidden] { display: none }` (the rule is required, `.panel-rows` sets `display: flex`, which wins over the UA `[hidden]` rule).
- Verification: `npm test -- src/ui/panel.test.js` → 17 passed (7 new disclosure cases over a minimal node-side DOM stub: default collapsed, show/hide state, single document listener, Space roll once with repeats ignored, buttons own Space, focus handover, pointerdown stop). `npm run build` green (`✓ built in 85ms`); `dist/index.html` references `./assets/index-DZm1vFQj.js` and `./assets/index-DA_12YQk.css`. Commit `b859084`.
- Assumptions: the disclosure sits above the rows, so collapsed shows Show controls then Roll stacked; video-height overlay while expanded is accepted as the spec allows. Expanded layout at 320 x 568 relies on that overlay, no scrolling added. Full suite not run, only the panel suite.
- Manual checks left to other roles: live-test focus order and 44 x 44 targets at 320 x 568, 360 x 640, 375 x 667, desktop and short landscape; confirm dragging a die in the area uncovered by hiding the rows.
