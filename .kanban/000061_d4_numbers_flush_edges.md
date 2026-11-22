---
name: "fix: place the d4 numbers flush with the rounded edges"
priority: "high"
state: "to-live-test"
worktree: "fix/61-d4-numbers-flush-edges"
issuer: "user"
complexity: "simple"
shortName: "d4-numbers-flush-edges"
changes: "{\"base\":\"main\",\"ins\":36,\"del\":9,\"files\":3}"
commits: "[{\"hash\":\"db3d447\",\"subject\":\"fix: move the d4 numbers flush with the rounded edges\",\"when\":\"2026-11-22T22:12:11+01:00\"}]"
---

# Summary
The d4 numbers are too far from the borders. Keep their size and move each number toward its corner until its ink is flush with the rounded edges, on the flat part of the face.

# Specs
## Need
On the d4, each number must sit flush with the rounded edges, on the flat part of the face. The ink must not enter the rounded band.

## Facts (main, 6d593ef)
- `src/dice/labels.js:168-177` places each number at `D4_LABEL_CENTER` times the vector from the face centroid to the corner. The top of each digit points to its corner.
- Face circumradius R = 10.4512 mm. Flat triangle circumradius 5.9257 mm (0.5670 R), inradius 2.9628 mm (0.2835 R).
- Current em 3.533 mm, from `D4_MAX_HEIGHT = 0.24` and `D4_MAX_WIDTH = 0.19`.
- With real digit outlines (Arimo Bold, the Arial metric substitute), the current clearance to the flat border is 0.645 to 0.709 mm. The range comes from the unconfirmed browser position of `textBaseline = 'middle'`.
- Carve does not spread past the mask. Estimated visible reach past the outline is 0.06 to 0.087 mm, so a clearance of 0.10 mm is too small.

## Change
1. Set `D4_LABEL_CENTER = 0.305`. Keep `D4_MAX_WIDTH` and `D4_MAX_HEIGHT`. The calculated clearance of the real outline is 0.15 to 0.21 mm.
2. Measure the real label canvas in Chromium. If the smallest clearance is outside 0.12 to 0.22 mm, change only `D4_LABEL_CENTER` to put it at 0.15 mm.
3. `src/dice/labels.test.js:327, 437-441` pins a margin of at least 0.3 mm on a 0.56 by 0.71 em box. This box is larger than the digit ink and is outside the flat triangle at the new position. Replace it with the real outline of the limiting digit 4 in em coordinates, and pin a clearance of at least 0.10 mm. Keep the neighbor gap (at least 0.2 mm) and em (at least 3.5 mm) checks without change.
4. Update the comment at `src/physics/body.js:9-11`, because it says that number tips reach into the rounded band.

## Scope limits
Do not change the number size, the labels of other dice, the carve method, the bevel radius or the die geometry.

## Acceptance
- `npx vitest run src/dice` passes.
- `npm test` passes.
- `npm run build` passes.
- Browser check in Chromium: from the real d4 label canvas, for all 12 numbers, the smallest distance from ink to the flat triangle border is between 0.10 and 0.25 mm, and no ink is outside the flat triangle.
- A zoomed screenshot of a d4 face shows the three numbers close to the rounded edges, legible and with no ink on the rounded band. Record the file path in Notes.

# Notes
- Spec 1: `D4_LABEL_CENTER = 0.305` with `D4_MAX_WIDTH`/`D4_MAX_HEIGHT` untouched (src/dice/labels.js:25-27), em stays 3.533 mm; comment now speaks of digit ink, not the glyph box.
- Spec 3: the 0.3 mm box-margin test replaced by the real Arimo Bold digit-4 ink (two contours in em coords) mapped through the recorded paint transform (labels.test.js `D4_INK`, `glyphInk`); clearance pinned in [0.10, 0.25] mm (labels.test.js:327-328, 462-468). Gap (0.2 mm), em (3.5 mm) and box-separation checks unchanged.
- Spec 4: src/physics/body.js comment no longer claims the number tips reach into the rounded band.
- Spec 2: Chromium live measurement accepted from the developer's Notes: worst ink clearance 0.1507 mm (limiting digit 4, face 2), inside the 0.12-0.22 mm window, so no second constant change; screenshot at /tmp/live-check/d4-atlas-cell-zoom.png recorded. Screenshot review and rendered-scene feel deferred to the live-tester.
- Red-first re-verified by A/B: with the constant restored to 0.21 the new test fails with worstMargin 0.0006443056 m, identical to the recorded red value; green after restoring 0.305.
- Evidence: npx vitest run src/dice 84 passed; npm test 367 passed in 28 files; npm run build OK (dist/assets/index-BXf4sC4d.js). Scope limits hold: no size, other-dice, carve, bevel or geometry changes; carve.test.js follows D4_LABEL_CENTER via import and stays green.
- Outcome: approved. No open questions.
