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

## Live test in progress (run id lt60/lt60s, harness /tmp/dice-lt60)

Setup: served this worktree with vite on :8944, Playwright Chromium 1.59 with SwiftShader WebGL, desktop 1280x800 dpr1. User flow: expand panel, remove 2 d6, add 1 d4, collapse panel, press Roll. No app code edited; no repo test suites run.

Findings so far:
- Setup flows work: default set is 2 d6; +/- buttons adjust; exactly one d4 spawns. Console clean (0 product errors in every phase so far).
- Settled top view (the user's primary view), 3 rolls: the d4 rests apex-up and shows its three side faces with numbers. All visible numbers legible (r1: 2,3,4,3; r2: 2,3,2,4,4,3; r3: 3,1,2,3,4,3,1,2), sitting clear of the rounded edges with visible margins, no contact between numbers. Scene settles (AE=0) after every roll. Evidence: /tmp/dice-lt60/lt60-settled-crop-r1..r3.png.
- Acceptance wants a flat-on face (all three numbers of one face). A resting d4 shows only foreshortened side faces under the fixed top-down ortho camera (src/render/camera.js), so a flat-on view exists only transiently mid-tumble. Capture attempts: full-viewport screenshot burst is 3.6 s/frame under SwiftShader and misses the ~1-2 s flight; CDP Page.startScreencast yields only 3 stalled frames per 4.5 s roll (all pre-roll). Both miss the flight, so the flat-on capture is currently a harness/environment limit (software rasterizer frame rate), not an app defect. Next: fast small-clip screenshot polling during flight; if that also fails I record the limit and judge the face-on criteria from the settled view plus zoomed crops.
- Die silhouette measures ~240 px wide at 1280x800 dpr1, consistent with DIE_RADIUS = 0.0128*sqrt(3)/2 m and METERS_PER_DEVICE_PIXEL = 0.0254/440 m (my initial 481 px estimate used a wrong radius; measured and derived now agree within ~10%).
- Gates green so far: setup, settle AE=0 (4/4 rolls), die visible in tray, carved ink present, console clean. No product defects found yet.
