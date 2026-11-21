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
Live test on merged commit ba75a40, checkpoint 3. Setup: dist served at http://127.0.0.1:4719, playwright harness /tmp/dice-lt31 (playwright 1.59, chromium-1217, 58fps, WebGL2 fine).

driver2 full run finished except a Phase 2 crash on a Playwright API misuse of mine (page.evaluate with two args). Accumulated results: 44 checks green, 12 red - every red so far traced to a driver artifact, none to the change: (a) three Space-roll checks passed the keypress before starting the pixel sampler although rolls of resting dice complete in <400ms; the product rolled every time (defaultPrevented/native-activation evidence in the key observer); (b) one stale state assumption (panel was expanded where I asserted collapsed) drifted the expanded/collapsed phase for the rest of that page, invalidating the show/hide, focus-handover, Enter-flip and exposed-strip checks downstream - the product stayed consistent in all of them (aria state flips correct); (c) the exposed-drag attempt ran while the panel was expanded, so the strip was not exposed at all; (d) the collapsed-tab-order reader compared textContent ("Roll") instead of aria-label ("Roll dice") - order itself correct; (e) drag-on-toggle "failure" max=11457 was the click my own drag gesture fired (down+up on the button activates it - the panel expanded); retesting with a down-move-up-away gesture that cannot click.

Green so far, covering the core spec: default collapsed every load with label/aria-expanded/aria-controls correct, Roll visible collapsed, 44px targets, a11y tree excludes rows collapsed and exposes them expanded, collapsed tab order toggle->roll, expanded tab order [Add d4, Remove d6, Add d6, Add d8, Add d10, Add d12, Add d20, Roll dice] (zero-count removes disabled and untabbable, correct), synthetic keydown repeat:true ignored with default not prevented, Space at body rolls with preventDefault, Roll click rolls, Enter/Space on toggle and Roll own activation with the document listener silent (dp=false at BUTTON target), synthetic Space targeted at Roll does not roll, add/remove update counts+storage and spawn/remove live dice, storage keeps the full zero-filled set (#26 contract), seeded missing-key storage {"d6":3} loads as d6=3/others 0 and survives toggling+reload, cap of 10 with adds disabled preserved across hide/show, no keydown-listener accumulation or panel recreation over 12 toggles, Space still rolls after 12 toggles, reload starts collapsed and preserves the stored set, 320x568 collapsed reachability.

Known environment difficulty (pre-existing physics, out of scope): resting dice can wedge and micro-rock (seen with 2 dice once, 8+ dice always), so stillness-based pixel checks need a roll-to-rescatter fallback; driver3 adds settleOrReroll and reruns only the invalidated checks, the fixed viewport matrix, and Phase 3 (320x568 keyboard/a11y).
