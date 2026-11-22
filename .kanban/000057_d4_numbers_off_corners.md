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
Live test in progress on merged commit (worktree fix/57-d4-numbers-off-corners).

Scope fixed from Summary+Specs: live acceptance = "a d4 at desktop and phone size shows 3 readable, carved numbers per visible face, clear of the rounded corners". No unit suites run. Assumptions: ortho top-down camera; settled d4 rests face-down so exactly 3 faces are visible, 9 glyphs per pose; panel flow (toggle, clear default set, Add d4, Roll) is the real user path.

Harness: /tmp/dice-lt57 (harness.mjs copied from proven /tmp/dice-lt54, retargeted; port 8957 strictPort; driver.mjs). Gates grounded in printed source constants (DIE_RADIUS 11.085 mm, BEVEL_RADIUS 1.6 mm, D4_LABEL_CENTER 0.32, fit 0.125R x 0.146R, margin rule 0.3 mm, faceInsetData inset). Env smoke green: WebGL2, backing 2200x2200 = viewport*dpr, capture path valid, fps 19.1 (SwiftShader), no console errors.

Results so far (full run, desktop pose A settled):
- PASS: clearance gate, real pixels: worst ink margin 0.556 mm inside inset (rule 0.3 mm) - measured in face-2D via plane hit, exact space (flat plane == sharp plane since s*rho+r = rho).
- PASS: ink vs body contrast on all 3 faces.
- Visual evidence crop-desktopA.png read: 9 numbers visible, 3 per face, all sitting toward face centres, clearly clear of rounded corners/edges. Looks correct.
- FAIL (harness, not product): glyph component checks - my absolute ink threshold luma<70 shatters the 1-2 px AA glyph strokes into specks (calibrated distribution: glyph p50 luma 86 on shadow faces vs body 91; glyph core <40). Fix in flight: per-face relative core classifier (luma < 0.55*local body), no erode, core-count gate per expected centre.
- FAIL (harness): desktop pose B captured with asleep=false - settle timeout too short after Roll; fix: longer waitForAsleep + retry.
- Probe2 (in-page): advance('4')=55.6 px/100 px font, cap ascent 69 (close to CAP_HEIGHT=71 model); atlas glyph union 180x162 px per 512 px cell; box.W=0.127 m confirmed. Rendered die silhouette is ~0.75x the sharp-vertex projection - expected, the #55 rounded shape (s=0.567 + 1.6 mm ball) cuts the corners; glyph centre projections still matched measured centroids within 4-11 px, so the 0.32-centre gate stays valid with tol 21 px.

Still to do: classifier + settle fixes, rerun full (desktop A/B + phone), read evidence crops, then final report. No product defects filed yet.
