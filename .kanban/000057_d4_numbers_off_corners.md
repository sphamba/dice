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
## PM hint
- The acceptance is visual. The real-pixel clearance gate (0.556 mm) and the crop review already cover desktop. Drop the glyph component classifier. Run the phone pose only, read the crop, then write the results table and finish within 10 minutes.

## Progress
- Harness /tmp/dice-lt57 (port 8957). Env green, no console errors.
- Desktop pose A: worst ink margin 0.556 mm inside the inset (rule 0.3 mm). Contrast PASS on 3 faces. The crop shows 9 numbers, 3 per face, clear of rounded corners and edges.
- Component and pose-B fails are harness-side.
