---
name: "fix: enlarge the d4 numbers"
priority: "medium"
state: "to-review"
worktree: "fix/60-larger-d4-numbers"
issuer: "user"
complexity: "simple"
shortName: "larger-d4-numbers"
---

# Summary
The d4 numbers are too small. Make them about 64% larger and move them toward the face center, so that they stay clear of the rounded edges and of each other.

# Specs
## Need
The numbers on the d4 are too small. Make them larger. They must stay away from the corners and must not touch each other.

## Values
In `src/dice/labels.js`:

| Constant | Current | New |
|---|---|---|
| `D4_LABEL_CENTER` | 0.32 | 0.21 |
| `D4_MAX_WIDTH` | 0.125 | 0.19 |
| `D4_MAX_HEIGHT` | 0.146 | 0.24 |

Calculated result with the test glyph box (0.56 em by 0.71 em): em 2.149 mm to 3.533 mm, edge margin 0.382 mm, gap between numbers 0.554 mm.

## Constraints
- Change only these three values, unless a test proves that a value breaks a limit.
- If a limit breaks, keep the edge margin at 0.3 mm or more and the number gap at 0.2 mm or more, and use the largest size that obeys both limits.
- Do not change the labels of other dice, the carve method or the die geometry.
- Do not weaken the margin or overlap tests in `src/dice/labels.test.js:327-329` and `:372-414`.

## Acceptance
- `npx vitest run src/dice` passes.
- `npm test` passes.
- `npm run build` passes.
- A browser screenshot of a d4 shows all three numbers on a face, fully legible, with no contact between numbers and no contact with a rounded edge.

# Notes
# Notes

## Deliverable
- `src/dice/labels.js`: `D4_LABEL_CENTER` 0.32 -> 0.21, `D4_MAX_WIDTH` 0.125 -> 0.19, `D4_MAX_HEIGHT` 0.146 -> 0.24. No other die, carve or geometry code touched.
- `src/dice/labels.test.js`: the d4 flat-face fit loop moved into one `measureD4()` helper; the existing 0.3 mm margin and zero-overlap assertions are unchanged, and two guards were added: the neighbouring-number gap (>= 0.2 mm, quad-to-quad distance) and a legibility floor (em >= 3.5 mm). The em-floor test is red on the old values (0.00215 m) and green on the new ones.

## Verification
- Probe with the test's own transform helpers on DIE_RADIUS: old 2.149 mm em / 0.388 mm margin, new 3.533 mm em / 0.382 mm margin, 0.64 mm number gap. The spec table matches (2.149 -> 3.533 mm, 0.382 mm margin).
- `npx vitest run src/dice`: 3 files, 84 tests passed.
- `npm test`: 28 files, 367 tests passed.
- `npm run build`: green, asset `index-DMC1bYI6.js`; the served asset hash matched the local build on port 4319.
- Live check on the built app: one d4 roll gives a flat-on face with 4, 3 and 1 all legible, clear gaps between the digits and an obvious margin to the rounded bevel, no contact anywhere. Best frame `/tmp/bigzoom-1.png`.
- HEAD `96a4148`.

## Assumptions
- The spec's "gap between numbers 0.554 mm" uses a different measure from the Euclidean quad-to-quad distance in the test (0.64 mm). Both stay well above the 0.2 mm limit, so no value was reduced.
- The 3.5 mm em floor comes from the spec's 3.533 mm result and is asserted with the test's 0.56 em by 0.71 em glyph box, not a real font measurement.
- The camera is fixed orthographic top-down and a canvas drag flings the die instead of orbiting, so the live check judged one flat-on roll rather than orbited views.

## Blockers
- None.

## Manual checks left to other roles
- None.
