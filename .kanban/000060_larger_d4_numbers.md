---
name: "fix: enlarge the d4 numbers"
priority: "medium"
state: "to-merge"
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
# Notes

## Review (approved)
- Spec values verified in `src/dice/labels.js:25-27` (0.21 / 0.19 / 0.24); no leftover old literals (0.32 / 0.125 / 0.146) anywhere in `src/dice`; diff touches only `labels.js` and `labels.test.js`, so other dice, carve and geometry are untouched.
- Margin and overlap tests not weakened: `D4_MARGIN` stays 0.0003, the >= 0.3 mm margin and zero-overlap assertions are verbatim; the fit loop is a faithful refactor into `measureD4()` plus two new guards (quad-to-quad gap >= 0.2 mm, em >= 3.5 mm) matching the spec constraints.
- A/B check: with main's constants the new em-floor test fails (1 failed / 14 passed), with HEAD it passes, so the new test covers the change.
- Evidence: `npx vitest run src/dice` 3 files / 84 tests green; `npm test` 28 files / 367 green; `npm run build` green, asset `index-DMC1bYI6.js`. HEAD 96a4148, tree clean.
- Accepted stated assumptions: the spec's 0.554 mm gap uses a different measure than the test's Euclidean 0.64 mm (both above the 0.2 mm limit, values unchanged); the 3.5 mm em floor uses the test glyph box (0.56 x 0.71 em), not real font metrics.
- Deferred to live-tester: browser screenshot of a d4 face showing three legible numbers with no contact (developer reports flat-on face 4/3/1 legible with clear margins; frame /tmp/bigzoom-1.png).
