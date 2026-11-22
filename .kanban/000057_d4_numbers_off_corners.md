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
- Outcome: fixed. One cosmetic commit by the reviewer at 66f4404 (split the pip const line the diff had joined onto one line); no functional changes. All Spec bullets mapped to diff or test evidence; nothing stale.
- Spec: d4 centres moved 0.62 → 0.32 via exported D4_LABEL_CENTER (labels.js:24,170-171), rotation `atan2(-x, y)` kept, no other die type touched (grep clean, diff touches only the d4 branch). Fit box reduced to 0.125R x 0.146R; accepted, the 0.3 mm rule cannot hold at the old glyph size on the bevelled inset. Containment and no-overlap are enforced by the new `buildLabelAtlas d4 flat-face fit` test, which rebuilds glyph boxes from the recorded paint transform against `faceInsetData` on real geometry (DIE_RADIUS 11.085 mm, BEVEL_RADIUS 1.6 mm).
- Evidence at 66f4404: `npx vitest run src/dice` 3 files / 80 passed; `npm test` 28 files / 355 passed; `npm run build` green. Existing label and carve tests updated to the constant and stay green.
- Probe re-measures the worst glyph-box margin at 0.388 mm on face 0; the developer's note said 0.34 mm. Value re-measured, both clear the 0.3 mm rule.
- Judgment calls: tuning to 0.32 below the suggested 0.45 start is within "and tune it"; Arial bold 0.56 em advance / 0.71 em cap metrics match the existing CAP_HEIGHT=71 model and the test mock.
- For the live-tester role: readability and corner clearance of the carved d4 numbers at desktop and phone size stay live scope. The developer flags port 4173 on this machine as held by a stale server from another checkout, so run the preview with `--strictPort` on a free port.
- Open questions: none.
