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
Live test in progress on merged commit ba75a40. Setup: `npm run build` fails through the worktree's copied `node_modules/.bin/vite` shim (resolves `node_modules/dist/node/cli.js`, environment quirk); `node node_modules/vite/bin/vite.js build` builds green (62ms). Serving `dist/` at http://127.0.0.1:4719 (python http.server). Playwright harness in /tmp/dice-lt31 (playwright 1.59 from /home/phamba/repos/tarot/app, chromium-1217).

Smoke pass (390x844): 8/8 checks green. Measured fps=58 (no SwiftShader slowness). Verified: default collapsed on load (toggle "Show controls", aria-expanded=false, rows hidden + display:none), Roll visible, aria-controls=dice-rows, expand/collapse flips label+aria, 6 rows with default counts 0,2,0,0,0,0, Space at body level rolls (pixel-verified, 11320 px change). Console artifacts (environment, benign): one WebGL CONTEXT_LOST warning at load (renderer recovers, canvas renders), GPU stall ReadPixels warnings, and in run 1 a blocked navigator.vibrate call. One driver-side false failure fixed: Space was pressed while focus stayed on the toggle button after collapsing, so Space activated the button instead of rolling; probe now blurs focus first.

Checks written for the full run (driver.mjs, not yet executed): repeat:true keydown ignored + default not prevented; Space exactly once with preventDefault; hold-Space repeats arrive and don't re-roll; Roll click while collapsed; expanded a11y tree + full 14-stop tab cycle; add/remove counts+storage; cap of 10 preserved across hide/show; show/hide leaves live dice pixel-identical; focus handover row->toggle on hide; rows restore same values; Enter/Space on toggle and Roll own activation (defaultPrevented=false at BUTTON target proves document listener early-return); synthetic Space targeted at Roll does not roll; drag on toggle/Roll never drags dice; exposed area above panel accepts die dragging; no keydown-listener accumulation or panel recreation over 12 toggles; reload starts collapsed with storage preserved; viewport matrix 320x568, 360x640, 375x667, 1280x800, 667x375 (collapsed+expanded reachability, 44px targets, elementFromPoint hits); keyboard/a11y at 320x568.

Assumptions made in test design: headless Chromium has no safe-area insets, so "safe areas" reduce to viewport-bounds reachability at the named sizes; "exactly once" rolling is verified as (a) synthetic repeat:true ignored, (b) real hold produces one visible roll with repeats observed unhandled, since two instantaneous rolls are not distinguishable in pixels; hidden rows must change nothing in the accessibility snapshot (display:none removes them from the tree).
