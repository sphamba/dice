---
name: "fix: enlarge the d4 numbers"
priority: "medium"
state: "live-testing"
worktree: "fix/60-larger-d4-numbers"
issuer: "user"
complexity: "simple"
shortName: "larger-d4-numbers"
changes: "{\"base\":\"main\",\"ins\":75,\"del\":39,\"files\":2}"
commits: "[{\"hash\":\"6d593ef\",\"subject\":\"fix: enlarge the d4 numbers and pull them toward the face center\",\"when\":\"2026-11-22T20:35:35+01:00\"}]"
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
# Notes
# Notes

## Live test (run id lt60/lt60s/lt60b, harness /tmp/dice-lt60)

Setup: served this worktree with vite on :8944, Playwright Chromium 1.59, SwiftShader WebGL, desktop 1280x800 dpr1. User flow: expand panel, remove 2 d6, add 1 d4, collapse panel, press Roll. No app code edited; no repo test suites run.

Results so far:
- PASS setup: default set is 2 d6; +/- buttons adjust; tray ends with exactly one d4. Console clean (0 product errors in every phase, all runs).
- PASS settled top view (user's primary view), 9 rolls total: d4 rests apex-up, three side faces visible, all numbers legible (e.g. 2,3,2,4,4,3 and 3,1,2,3,4,3,1,2), clear of the rounded edges, no contact between numbers. Scene settles (AE=0) after every roll. Evidence: /tmp/dice-lt60/lt60-settled-crop-r1..r3.png, /tmp/dice-lt60/lt60s-final-die-zoom.png (x3 zoom).
- PASS acceptance face-on view: mid-tumble burst captures caught two near-flat-on faces. r4-f00 shows face 4-3-1, r6-f00 shows face 4-1-2: all three numbers per face fully legible, wide margins to the rounded edges, wide gaps between numbers, no contact anywhere. Evidence: /tmp/dice-lt60/zoom-lt60b-r4-f00.png, /tmp/dice-lt60/zoom-lt60b-r6-f00.png. (Carve is in the face texture, so glyph-to-edge distance is orientation-invariant; the settled view confirms the same margins from a second angle.)
- Harness/environment notes (not product defects): SwiftShader renders ~0.4 fps at 1280x800, so mid-flight capture needed per-roll screenshot polling (CDP screencast stalled at 3 frames per 4.5 s roll and full screenshot bursts were 2.4 s/frame); the flight itself settles in under ~2.4 s, so only the first post-click frame per roll was mid-flight. A resting d4 shows only foreshortened side faces under the fixed top-down ortho camera (src/render/camera.js); the flat-on view exists only transiently mid-tumble.
- Numbers size sanity: die silhouette ~240 px wide; number em ~40 px at 1280x800 dpr1, consistent with spec em 3.533 mm and METERS_PER_DEVICE_PIXEL = 0.0254/440.
- No product defects found so far. Remaining: quick look at the two other mid-flight candidates (r3/r5), then final report.
