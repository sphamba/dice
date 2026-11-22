---
name: "fix: enlarge the d4 numbers"
priority: "medium"
state: "done"
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
# Notes

## Live test report (task #60, fix: enlarge the d4 numbers)

Runs: lt60 (results-lt60.json), lt60s (lt60s-results.json), lt60b (lt60b-results.json), all in /tmp/dice-lt60. Served this worktree with vite on :8944; Playwright Chromium 1.59, SwiftShader WebGL; desktop 1280x800 dpr1. User flow exercised: expand panel, remove both default d6, add one d4, collapse panel, press Roll; repeated rolls and inspection of settled and mid-tumble states. No app code edited; no repo test suites run.

### Assumptions made when designing the usage tests
- Standard user window 1280x800 dpr1; physical mm sizes from the spec are viewport-independent, so legibility at this size is the acceptance proxy.
- A resting d4 shows only foreshortened side faces under the fixed top-down ortho camera (src/render/camera.js); a flat-on face exists only transiently mid-tumble, so the acceptance view was captured by polling screenshots during flight (roll spin 15-40 rad/s, src/physics/roll.js:8-10, decorrelates orientation between ~2.4 s frames). This matches the developer's flat-on evidence frame (/tmp/bigzoom-1.png).
- Carve is baked into the face texture, so glyph-to-edge and glyph-to-glyph distances are orientation-invariant; margins judged on near-flat views hold at rest.
- No observed behavior contradicts the task's stated assumptions: visible number size is consistent with the spec em (about 40 px at dpr1 for 3.533 mm), and margins/gaps look comfortably above the 0.3 mm / 0.2 mm limits in every capture.

### Results table
| Check | Result |
|---|---|
| Setup: default set 2 d6; +/- buttons adjust; tray ends with exactly one d4 | PASS |
| Console clean (0 product errors, every phase of every run) | PASS |
| Scene settles after roll (AE=0 double-shot), 10 of 10 rolls | PASS |
| Settled top view: all visible numbers legible, clear of rounded edges, no number-number contact (9 rolls; e.g. 2,3,2,4,4,3 and 3,1,2,3,4,3,1,2) | PASS |
| Face-on mid-tumble captures: faces 4-3-1, 4-1-2, 2-4-1, 4-2-1 (4 independent captures); all three numbers per face fully legible, wide margins to the rounded edges, wide gaps between numbers, no contact | PASS |
| Acceptance evidence files | /tmp/dice-lt60/zoom-lt60b-r4-f00.png, zoom-lt60b-r6-f00.png, zoom-lt60b-r3-f00.png, zoom-lt60b-r5-f00.png; settled views lt60-settled-crop-r1..r3.png, lt60s-final-die-zoom.png (x3) |
| CDP screencast mid-flight capture | Harness limit: stalled at 3 frames per 4.5 s roll under software GL; replaced by first-frame-per-roll screenshot polling |
| Continuous mid-flight frame stream | Harness limit: SwiftShader renders about 0.4 fps at 1280x800 and full screenshot bursts are 2.4 s/frame, while flight plus settle completes in under about 2.4 s, so only the first post-click frame per roll was mid-flight |

### Environment notes (not product defects)
- Software rasterizer frame rate is the only constraint hit; it shaped the capture strategy but blocked no acceptance check.
- The dice set persists in localStorage; fresh contexts always start with the 2 d6 default.
- Die silhouette measures about 240 px wide at 1280x800 dpr1, consistent with DIE_RADIUS = 0.0128*sqrt(3)/2 m (src/physics/body.js:7) and METERS_PER_DEVICE_PIXEL = 0.0254/440 (src/physics/box.js:1); my initial 481 px estimate had used a wrong radius and was corrected against the measurement.

### Verdict
All acceptance-relevant checks pass. No product defects found; no cards filed. Servers killed and verified (port 8944 free; stray hung drivers from earlier sessions in /tmp/dice-lt45 and /tmp/dice-lt50 also killed).
