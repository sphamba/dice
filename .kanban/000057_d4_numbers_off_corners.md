---
name: "fix: move the d4 numbers away from the corners"
priority: "medium"
state: "doing"
worktree: "fix/57-d4-numbers-off-corners"
issuer: "user"
complexity: "simple"
shortName: "d4-numbers-off-corners"
blockedBy: ""
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
- Deliverable: d4 number centres moved from 0.62 to 0.32 of the corner position, with a smaller fit box (0.125 R wide, 0.146 R tall) because the 0.3 mm margin rule cannot be met at the old glyph size. Every d4 glyph box now stays inside the bevelled inset triangle with a worst-case margin of 0.34 mm, and no two glyph boxes on a face overlap. `D4_LABEL_CENTER` is exported and reused by `carve.test.js`. No other die type changed.
- Evidence at HEAD 221e852: `npx vitest run src/dice` 80 passed; `npm test` 28 files / 355 passed; `npm run build` green, dist/index.html assets resolve. New test `labels.test.js > buildLabelAtlas d4 flat-face fit` rebuilds each glyph box from the recorded paint transform and checks containment margin plus pairwise separation against `faceInsetData`.
- Live check passed on a build of this branch: desktop 1440x900 and phone 390x844, 6 rolls each, exactly 3 legible digits per visible d4 face, no digit on a rounded edge or corner, no digit overlap, no console errors.
- Assumptions: the 0.3 mm margin is measured on the real die geometry (DIE_RADIUS, BEVEL_RADIUS), not on the unit-radius test fixture; Arial bold metrics of 0.56 em advance and 0.71 em cap height; the spec's suggested 0.45 start leaves a 0.5 mm cap height, so the centre was tuned down to 0.32 to reach 1.6 mm at the 0.3 mm margin.
- Manual checks left to other roles: the preview port 4173 on this machine is held by a stale server from another checkout, so a live check must use `--strictPort` on a free port and confirm the served bundle carries the new constants.
- Blockers: none.
- Open questions: none.
