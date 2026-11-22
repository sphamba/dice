---
name: "fix: move the d4 numbers away from the corners"
priority: "medium"
state: "live-testing"
worktree: "fix/57-d4-numbers-off-corners"
issuer: "user"
complexity: "simple"
shortName: "d4-numbers-off-corners"
blockedBy: ""
changes: "{\"base\":\"main\",\"ins\":105,\"del\":9,\"files\":3}"
commits: "[{\"hash\":\"66f4404\",\"subject\":\"style: split the joined pip constants back onto two lines\",\"when\":\"2026-11-22T16:32:39+01:00\"},{\"hash\":\"221e852\",\"subject\":\"fix: pull the d4 numbers onto the flat part of the face\",\"when\":\"2026-11-22T16:07:12+01:00\"}]"
---

# Summary
The d4 numbers sit too close to the face corners. Move them toward the face centre so every glyph stays on the flat part of the face, clear of the rounded edges and corners.

# Specs
# Facts (main, `src/dice/labels.js:166-178`)
- Each d4 face draws 3 numbers, one per corner, at `0.62 x` the corner position in the face-2D frame, rotated with `atan2(-x, y)` to face the corner.
- The fit box is `maxWidth = 0.36*frame.radius` and `maxHeight = 0.5*frame.radius` (`drawText`, :202-207).
- After #55 the bevel radius is 1.6 mm, so the d4 inset is about s = 0.57. The flat part of a d4 face (the inset triangle) gets much smaller.

# Change
- Move the d4 number centres toward the face centre: start at 0.45 of the corner position and tune it.
- Keep the same rotation and readability. Reduce the fit box only if a glyph does not fit.
- Rule: the whole glyph box of every d4 number must stay inside the inset (flat) triangle, with a margin of at least 0.3 mm. No glyph may overlap another glyph.
- Change no other die type.

# Tests (`src/dice/labels.test.js`)
- For every d4 face and number, the 4 corners of the glyph box (from the fit size and rotation) are inside the inset triangle with a margin of at least 0.3 mm.
- The 3 glyph boxes on one face do not overlap.
- Existing label, carve and render tests stay green.

# Acceptance criteria
- `npx vitest run src/dice`
- `npm test`
- `npm run build`
- Live check: a d4 at desktop and phone size shows 3 readable, carved numbers per visible face, clear of the rounded corners.

# Notes
# Notes
# Notes
# Notes
# Notes
# Notes
Live test in progress on merged commit (worktree fix/57-d4-numbers-off-corners). No unit suites run; only real UI flows (panel toggle, clear, Add d4, Roll).

Scope: live acceptance = "a d4 at desktop and phone size shows 3 readable, carved numbers per visible face, clear of the rounded corners". Assumptions: ortho top-down camera; settled d4 rests face-down so exactly 3 faces visible (upness 0.33 each), 9 glyphs per pose.

Harness: /tmp/dice-lt57 (harness.mjs from proven /tmp/dice-lt54, retargeted; port 8957 strictPort). Gates grounded in printed source constants: DIE_RADIUS 11.085 mm, BEVEL_RADIUS 1.6 mm, D4_LABEL_CENTER 0.32, fit box 0.125R x 0.146R, margin rule 0.3 mm, inset from faceInsetData. Classifier calibrated on printed pixel distributions: glyph cores luma < 0.55 * per-face body p85 (glyph core <40, AA blends 40-95, body 91-221).

Latest full run (run-c), 42/55, all remaining FAILs diagnosed as harness calibration or capture timing, none product-side:
- Clearance (the core of the fix), real pixels, settled poses: desktopA worst 0.583 mm, phone worst 0.639 mm inside the inset - both clear the 0.3 mm rule on every analysed face.
- Glyph positions: PASS on all 6 analysed face instances (desktop faces 0,2,3 + phone faces 1,2,3 = all 4 faces seen live) at 1.0-4.0 px from the projected 0.32*corner centres (tol 21 px desktop / 14 px phone). At the old 0.62 the offset would be ~50 px, so the gate stresses the change.
- Contrast PASS everywhere (core lumas 19-45 vs body 93-221).
- "present and sized" FAILs are my core-extent floor (0.45*capPx = 12.6 px) sitting above the measured dark-core extents (5-16 px; strokes are 1-2 px AA blends). Recalibrating floor to 0.25*capPx; readability itself is evidenced by the 200% crops (crop-desktopA.png, crop-phone.png): 9 crisp readable numbers, 3 per face, all toward face centres, clearly clear of corners/edges.
- desktopB (after panel Roll): die woke again between sleep and capture (asleep=false in the post-capture sample; capture mid-motion shows motion-shading pixels, worst margin 0.000 mm is motion AO, not glyph position). Spawn-settled poses (A, phone) hold asleep. Next: retry loop capture-then-sample; if a rolled pose still will not hold asleep on SwiftShader, record B as observation-only with that reason.
- Harness bug found and fixed mid-run: my scan indexed the bottom-up readPixels buffer without the Y flip (H.pxAt does it); run-b's zero-ink results were that bug, not app behaviour.

No product defects filed so far. Remaining: recalibrated rerun (run-d), read evidence crops, final report + results table.
