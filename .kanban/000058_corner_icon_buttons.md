---
name: "feat: icon buttons in the corners for Roll and Show controls"
priority: "medium"
state: "done"
worktree: ""
issuer: "user"
complexity: "moderate"
shortName: "corner-icon-buttons"
splitter: "done"
blockedBy: ""
changes: "{\"base\":\"main\",\"ins\":106,\"del\":21,\"files\":3}"
commits: "[{\"hash\":\"0ed5dc4\",\"subject\":\"feat: move Roll and Show controls into corner icon buttons\",\"when\":\"2026-11-22T15:20:08+01:00\"}]"
---

# Summary
Make Roll a small round icon button in the lower-right corner, and the Show controls toggle a small round icon button in the lower-left corner. Keep the accessible names and the Space shortcut.

# Specs
# Facts (main)
- `src/ui/panel.js`: the toggle `<button class="panel-toggle">` shows "Show controls"/"Hide controls" text with `aria-expanded` and `aria-controls="dice-rows"`, and has no aria-label (:137-154). Roll is `<button class="panel-roll">` with the text "Roll" and `aria-label="Roll dice"` (:174-179). Order in a flex column: toggle, rows (hidden by default), Roll (:181). Space triggers Roll (:183-190).
- `src/style.css:44-136`: `.panel` sits bottom centre. Buttons are 44 px minimum. `.panel-roll` is 48 px high, `#4f6dff`.
- No icon system and no SVG in the project. No new dependency.
- `src/ui/panel.test.js` queries `panel-toggle` and `panel-roll` by class (:150,152) and checks the toggle text (:167,179,184).

# Change
- Roll: a round 48 px button fixed in the lower-right corner, with an inline SVG icon of a die face (rounded square with 5 pips) and no visible text. Keep `aria-label="Roll dice"` and the blue fill.
- Toggle: a round 48 px button fixed in the lower-left corner, with an inline SVG sliders icon and no visible text. Give it `aria-label` "Show controls"/"Hide controls" that follows the state. Keep `aria-expanded` and `aria-controls`.
- The dice rows open above the toggle, aligned to the left edge. Their content and behaviour do not change.
- Offset both buttons from the corners by 16 px plus `env(safe-area-inset-*)`. Keep a visible focus ring. The SVGs get `aria-hidden="true"` and use `currentColor`.
- Keep the Space shortcut.

# Tests (`src/ui/panel.test.js`)
- Replace the toggle text checks with `aria-label` checks ("Show controls", then "Hide controls").
- Each button contains one `svg` with `aria-hidden="true"` and has no visible text.
- Roll keeps `aria-label="Roll dice"`. The Space tests stay green.

# Acceptance criteria
- `npx vitest run src/ui`
- `npm test`
- `npm run build`
- Live check (desktop 1280x800, phone 393x852): Roll is in the lower-right corner, the toggle is in the lower-left corner, both show icons, both work with mouse, touch and keyboard, and the rows open above the toggle without covering the Roll button.

# Notes
- Outcome: live test PASSED, no defects found. 77/77 usage checks green in one final full run (exit 0) on commit 0ed5dc4 served from the worktree. No cards filed.
- Harness: headless Chromium (Playwright, SwiftShader WebGL2, fps 13.2, canvas backing = viewport x dpr), vite dev server on :8914 from cwd, phase-filtered driver at /tmp/dice-lt58 (results-lt58.json, run3.log, 38 evidence pngs). Console clean across the whole run (2 benign messages, no error/warning/pageerror, favicon whitelisted).
- Environment/identifier probe (desktop 1280x800): WebGL2 ok, .panel-toggle/.panel-roll/#dice-rows all resolve; toggle aria-label "Show controls", aria-expanded=false, aria-controls=dice-rows; roll aria-label "Roll dice"; rows hidden by default; each button exactly one svg, aria-hidden=true, focusable=false, no visible text, currentColor; toggle icon = 3 lines + 3 knobs, roll icon = rounded rect + 5 pips; mouse click opens/closes rows.
- Desktop geometry (1280x800): both buttons fixed 48x48, border-radius 50%, toggle lower-left and roll lower-right with 16 px edge gaps (safe-area insets 0 headless), roll fill rgb(79,109,255). Icon ink verified by pixel histogram inside both button interiors (toggle 152 ink px, roll 204 on phone; threshold 25), calibrated on printed colour distributions.
- Desktop mouse flow: default set d6=2 (fresh storage); click opens rows: aria-expanded=true, label "Hide controls", rows bottom gap above toggle = 10 px, left-aligned with toggle, 0 px overlap with roll, 16 px clearance to roll's left edge; six type rows; Add d6 -> 3, Remove d6 -> 2 and the die leaves the scene (full-page AE diff); close restores "Show controls"; click roll moves dice with a settled AE=0 baseline.
- Desktop keyboard: Tab #1 -> toggle, Tab #2 -> roll (hidden rows skipped); :focus-visible ring verified as #7aa2ff pixels around both buttons; Enter toggles rows; Enter on roll rolls dice; Space on body rolls dice; Space on toggle activates rows and does NOT roll (doc handler skips BUTTON targets, centre-clip AE=0); Space on roll rolls.
- Phone 393x852 (hasTouch/isMobile): same corner geometry, icon ink, tap toggle opens rows (label flips), rows above toggle 10 px, left-aligned, 0 overlap/16 px clearance to roll, tap Add/Remove d6 work, tap roll moves dice (baseline AE=0), Tab/Enter keyboard still works. Screenshots: phone-rows-open.png, phone-full.png, geo-desktop-full.png, mouse-rows-open.png.
- Contradiction check: no observed behaviour contradicts the task's stated assumptions. Rows card also proved translucent over dice (unchanged behaviour, backdrop blur visible in phone-rows-open.png).
- Assumptions made when designing the usage tests: (1) headless Chromium resolves env(safe-area-inset-*) to 0 (no notch emulation), so the spec offsets are checked as exactly 16 px/74 px/80 px resolved px on both viewports; (2) a fresh browser context has empty localStorage, so the default set is {d6:2}; (3) "rows open above the toggle without covering Roll" is checked geometrically (rect intersection 0, 10 px/16 px clearances from source constants) plus screenshots; (4) "icons visible" is checked as ink pixels against the button fill (median-luma method) not just DOM presence; (5) roll/add motion is detected by magick AE diffs over a clip with a mandatory settled baseline (AE=0 required before the gate); (6) keyboard acceptance is exercised fully on desktop, plus Tab/Enter on the phone context.
- Technical difficulties hit while testing (test-side, fixed in-run, no product impact): (a) remove-die motion gate initially used a centre clip, but removeDie despawns the body instantly and it can rest outside the clip -> switched to a full-page AE diff; (b) on the phone context, Tab was pressed while focus sat on roll (from the preceding tap), and Tab from the last tabbable element exits the document instead of wrapping -> blur before Tab; (c) harness audit-callback shape mismatch and a missing import, both fixed before the final run.
- Verdict on acceptance criteria: all live-check items from the task (desktop 1280x800 and phone 393x852 corner placement, icon visibility, mouse/touch/keyboard operation, rows above the toggle without covering Roll) verified PASS. The vitest/npm test/npm run build suites are the developer's acceptance, not part of this live test.

# Open questions

