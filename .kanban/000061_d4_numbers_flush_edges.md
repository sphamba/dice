---
name: "fix: place the d4 numbers flush with the rounded edges"
priority: "high"
state: "to-review"
worktree: "fix/61-d4-numbers-flush-edges"
issuer: "user"
complexity: "simple"
shortName: "d4-numbers-flush-edges"
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
## Deliverable
- `src/dice/labels.js`: `D4_LABEL_CENTER` 0.21 -> 0.305. `D4_MAX_WIDTH` and `D4_MAX_HEIGHT` unchanged, so the em stays 3.533 mm. Comment updated to speak of the digit ink, not the glyph box.
- `src/dice/labels.test.js`: the 0.3 mm margin on the 0.56 x 0.71 em glyph box is replaced by the real outline of the limiting digit 4 (Arimo Bold, second contour included) in font em, with the Chromium-measured advance 0.55615234375 and `textBaseline='middle'` offset 0.31 em. The check pins the ink clearance in 0.10 to 0.25 mm. Neighbour gap (0.2 mm), em (3.5 mm) and box-separation checks unchanged.
- `src/physics/body.js`: the `BEVEL_RADIUS` comment no longer claims that the d4 number tips reach into the rounded band.
- Commit `20f7129` on `fix/61-d4-numbers-flush-edges`.

## Verification
- Red first: the new ink test failed at `D4_LABEL_CENTER = 0.21` with 0.0006443 m (probe and test agreed), then passed after the constant change.
- `npx vitest run src/dice`: 84 passed. `npm test`: 367 passed in 28 files. `npm run build`: OK, `dist/assets/index-BXf4sC4d.js`.
- Chromium live check on the real label atlas (OffscreenCanvas path, ink = alpha > 0), own Vite dev server on 127.0.0.1:5199, killed after the run: worst ink-to-flat-triangle distance 0.1507 mm (limiting digit 4 on face 2, next tightest 0.1593), all 12 labels carry ink, 0 ink pixels outside the flat triangle, pixel scale 0.040825 mm/px. Measured value sits on the spec target of 0.15 mm, so no second constant change was needed.
- Measurement plumbing validated on a synthetic square whose near edge was 0.5 mm inside a face edge: 0.5338 mm.
- Zoomed screenshot, real atlas face cell at 4x with the flat triangle border in red: `/tmp/live-check/d4-atlas-cell-zoom.png` (and `-4x.png`). Rendered scene with three d4 after a roll: `/tmp/live-check/d4-roll1.png` (also `d4-settled.png`, `d4-roll2.png`, `d4-roll3.png`). Numbers sit close to the rounded edges, legible, no ink on the rounded band.
- No page console errors during load, measurement or three rolls.

## Assumptions
- The Chrome `textBaseline='middle'` offset is font-metric and stable at 0.31 em for Arimo Bold; the test freezes it as a constant, so a font-metric change would show as a test drift.
- A d4 seen from the fixed orthographic top camera never shows a face face-on (it rests on a face with a vertex up), so the atlas cell zoom is the closest available face-on evidence, next to the rendered scene shots.

## Blockers
None.
