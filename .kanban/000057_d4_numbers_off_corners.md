---
name: "fix: move the d4 numbers away from the corners"
priority: "medium"
state: "done"
worktree: ""
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
# Notes
Live test of the merged commit (worktree fix/57-d4-numbers-off-corners) is DONE. Result: PASS, no product defects found, nothing filed.

Flows exercised like a user: panel toggle, clear, Add d4, Roll, all via real clicks on :8957 (vite, strictPort). One d4 spawned per pose; settled (asleep) before capture. Poses: desktopA (spawn), desktopB (after Roll), phone (spawn, 390x844 dpr 2 -> 780x1688 backing). Console audit: 0 errors, 0 warnings.

Final run run-d: 51/51 checks PASS (/tmp/dice-lt57/results-lt57-d.json). Evidence: /tmp/dice-lt57/crop-desktopA.png, crop-desktopB.png, crop-phone.png (200% crops) and full frames.

Acceptance mapping:
- 3 readable carved numbers per visible face: PASS on all 3 poses (9 glyphs each, values per face as expected, 3 per face). Measured per-glyph dark-core pixel counts 19-85 with extents 5-16 px, contrast core-vs-body 130-190 luma. Crops show crisp legible digits.
- Numbers clear of rounded corners: PASS. Worst glyph-edge margin inside the inset: desktopA 0.598 mm, desktopB 0.597 mm, phone 0.608 mm (min over all analysed faces, per-pixel), all above the 0.3 mm rule and the ~0.087 mm 1 px AA tolerance.
- Numbers toward face centres at 0.32 x corner: PASS. Every owned glyph cloud centroid within 0.3-4.0 px of the projected 0.32*corner position (tol 21 px desktop / 14 px phone); the old 0.62 placement would sit ~50 px away, so the gate stresses the change. All 4 d4 faces covered live (desktopA 0,1,2 + desktopB 1,2,3 + phone 0,1,2).
- Settled resting geometry: exactly 3 faces visible, upness 0.33 each, on every pose.

Gates grounded in printed source constants (DIE_RADIUS 11.085 mm, BEVEL_RADIUS 1.6 mm, D4_LABEL_CENTER 0.32, fit 0.125R x 0.146R, CAP_HEIGHT 71) and in printed pixel distributions (ink = luma < 0.55 * per-face body p85; calibrated: glyph core <40, AA blends 40-95, body 91-221). Presence floor recalibrated once on measured core extents (0.45 -> 0.25 * capPx); readability itself judged from the crops, not the floor.

Harness notes for the record: one mid-run bug was my own (missing Y flip when indexing the bottom-up readPixels buffer; H.pxAt does it). One unreproduced environment flake: in run-c the die woke again ~0.3 s after falling asleep post-Roll on SwiftShader; the final clean run showed correct sleep-hold behaviour, so not filed as a defect.

Results table:
- env: WebGL2, backing = viewport * min(dpr,2), capture fields, no unsupported overlay - PASS (run-c; env phase skipped in run-d as already green)
- each pose: capture sane / one d4 / asleep / 3 visible faces - PASS x3
- each face: clearance >= 0.3 mm - PASS x9; presence+size - PASS x9; position at 0.32 - PASS x9; contrast - PASS x9
- console audit - PASS
- harness-limit notes: none remaining; presence-floor recalibration documented above

Server stopped and port verified free.
