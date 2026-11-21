---
name: "feat: make dice controls hideable with Roll still available"
priority: "high"
state: "done"
worktree: ""
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
Live test complete on merged commit ba75a40. Verdict: no product defects found; every check traced to the change passed. 60+ checks green across 5 driver runs; all earlier reds were root-caused to driver artifacts (empty trigger passed to the pixel sampler, stale expanded-state assumption drifting a page's phase, evaluate called with a string reader, two-arg evaluate, forgotten expand before an "expanded" assertion, own drag gesture clicking the toggle) and re-run green after fixes.

Setup: built dist via `node node_modules/vite/bin/vite.js build` (green, ~62ms); `npm run build` itself fails through the worktree's copied `node_modules/.bin/vite` shim (resolves `node_modules/dist/node/cli.js`) - environment quirk of this worktree's node_modules copy, not the change. Served dist at 127.0.0.1:4719, playwright 1.59 + chromium-1217, 58 fps measured, WebGL2 fine. Server stopped, ports verified closed.

Verified behavior (390x844 unless noted): page load starts collapsed on every load with toggle "Show controls", aria-expanded=false, aria-controls=dice-rows, rows hidden attribute + display:none, Roll visible; reload always collapsed, expanded state never persisted (three separate loads). A11y tree excludes the rows collapsed and exposes them expanded (ariaSnapshot, 390x844 and 320x568). Tab order collapsed [Show controls, Roll dice]; expanded [Add d4, Remove d6, Add d6, Add d8, Add d10, Add d12, Add d20, Roll dice] - zero-count removes are disabled and correctly untabbable. Hiding while a row control is focused moves focus to the disclosure button (Add d4 -> panel-toggle); rows restore identical counts and disabled states after hide/show. Toggle flips label + aria only. Keyboard: synthetic keydown repeat:true ignored with default not prevented; Space at body level rolls with defaultPrevented=true (scroll prevented); real press-and-hold rolls once (CDP generates no OS repeats; the repeat contract is covered by the synthetic repeat:true dispatch, same event.repeat code path); Enter and Space on the toggle and Roll buttons activate natively with the document listener silent (dp=false at BUTTON target proves the early return, so no double roll); synthetic Space targeted at Roll rolls nothing (max 25 px noise vs 5k-20k for real rolls); Space on toggle x2 leaves the frame unchanged (diff 3-6 px). Dice/data: show/hide leaves the live dice pixel-identical (diff 10) and counts+storage unchanged; add/remove update counts, storage (full zero-filled set, #26 contract intact) and the canvas; seeded missing-key storage {"d6":3} loads as d6=3/others 0 and survives toggling+reload; cap of 10 with all adds disabled preserved across hide/show; no keydown-listener accumulation or panel recreation over 12 toggles (CDP listener count 1 before/after) and Space still rolls after them. Pointer: drag gestures on the disclosure and Roll buttons never drag dice (canvas-region pixel diff 3-10 px; the ~300 px seen earlier was the button's own hover churn, localized to the button rect by region compare); the exposed strip above the collapsed panel hit-tests to the canvas and accepts real die dragging (5955 px signal). Viewport matrix 320x568, 360x640, 375x667, 1280x800, 667x375 landscape: collapsed and expanded, toggle+roll within bounds, elementFromPoint hits both, >=44x44 targets, no overlap, all six rows and add buttons reachable when expanded.

Assumptions made while designing the tests: headless Chromium exposes no safe-area insets, so "reachable around safe areas" reduced to viewport-bounds reachability plus elementFromPoint hit tests at the named sizes; "exactly once" rolling verified as (a) synthetic repeat:true ignored and (b) one visible roll per press with preventDefault evidence, since two instantaneous rolls are not pixel-distinguishable; disabled remove buttons expected untabbable (standard HTML). Nothing observed contradicts the task's stated assumptions; the video-height overlay while expanded behaves as accepted, and hiding the rows re-exposes the canvas to pointer input.

Observations outside this task's scope (pre-existing, no cards filed): resting dice can wedge and micro-rock indefinitely (once with 2 dice, consistently at 8+), which complicates stillness-based checks until a roll rescatters them; a fresh load with no stored set keeps localStorage empty until the first add/remove (parse falls back to DEFAULT_SET, per the code path); on desktop (1280x800) the expanded panel stretches toggle and Roll to the panel width (~905 px) - consistent with the pre-existing Roll styling, purely cosmetic.
