---
name: "feat: make dice controls hideable with Roll still available"
priority: "high"
state: "backlog"
worktree: ""
issuer: "#8"
complexity: "moderate"
shortName: "hideable-dice-controls"
blockedBy: "#26"
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
