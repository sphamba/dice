---
name: "fix: place the d4 numbers flush with the rounded edges"
priority: "high"
state: "live-testing"
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
# Live test report (worktree fix/61-d4-numbers-flush-edges, commit db3d447)

## What was tested
Real usage in Chromium (Playwright, SwiftShader WebGL) against the vite dev server on the merged commit: the app loaded from the panel (default state), 3 d4 added through the real "Show controls" / "Add d4" buttons, dice left to settle, zoomed screenshots taken. The acceptance browser check ran in the same live page by importing the served app modules (/src/dice/labels.js, shapes.js, physics/body.js) and building the real d4 label atlas through the app's own code path, then measuring every ink pixel against the flat-triangle border (faceInsetData inset polygon). Spec 4 verified in source: src/physics/body.js:9-11 now says the d4 corner numbers stay on the flat part.

## Results
- Constant live-confirmed: D4_LABEL_CENTER = 0.305 from the served module; atlas 1024 px, 0.0408 mm/px.
- All 12 numbers inked; smallest clearance overall 0.1507 mm (digit 4, face 2), matching the developer's recorded value exactly; solid-ink (alpha>=128) worst 0.1797 mm.
- inkOutside = 0: no ink pixel on or outside the flat triangle, under both ink criteria. The need "ink must not enter the rounded band" is met.
- Harness self-check: synthetic ink square with its near edge 0.5 mm inside a border measured 0.5338 mm (within pixel quantization).
- Per-number clearance, fringe-inclusive (solid): digit 1 x3: 0.2553 (0.2757); digit 4 x3: 0.1507-0.1593 (0.1797-0.1860); digit 2 x3: 0.2050-0.2165 (0.2403-0.2464); digit 3 x3: 0.1961-0.2072 (0.2314-0.2403). All mm.
- Acceptance range [0.10, 0.25] mm: 9/12 numbers pass. The three digit-1 labels measure above the upper bound. Filed as #65 with an open question, because spec 2 forbids a constant change while the smallest clearance (0.1507) stays inside its 0.12-0.22 window.
- Visual check: the numbers sit close to the rounded edges on the flat part, legible, no ink on the band, on the atlas cell and on both rendered dice inspected. The 1s are marginally less flush than the other digits (about 2 css px difference at dpr 2), barely perceptible.

## Evidence files
- Zoomed d4 face (acceptance screenshot): /tmp/dice61-lt/out/d4-atlas-cell-zoom.png (red line = flat-triangle border), 4x version d4-atlas-cell-zoom-4x.png
- Rendered scene: /tmp/dice61-lt/out/scene-settled.png, crops scene-die-zoom-0/1/2.png
- Measured data: /tmp/dice61-lt/out/results-atlas.json, results-env-atlas-scene.json; driver /tmp/dice61-lt/driver.cjs, logs run-full.log, run-atlas-strict.log

## Assumptions made
- "Ink" means canvas alpha > 0 (the convention behind the developer's recorded 0.1507); the solid-ink variant (alpha >= 128) is reported alongside.
- The acceptance's 0.25 mm upper bound applies to each of the 12 numbers individually (the developer's evidence had only checked the global worst against spec 2's window).
- The zoomed screenshot of a d4 face is the atlas cell of one face (flat, with its three numbers); the app's fixed top-down camera cannot show one face head-on, so rendered crops of settled dice serve as the in-scene evidence.
- Clearance scale derives from the atlas geometry itself (cell 512 px over 2 x face radius 10.4512 mm).

## Contradictions with the task's stated assumptions
- Spec 1 fact "calculated clearance of the real outline is 0.15 to 0.21 mm" does not hold for the digit 1: its measured solid clearance is 0.2757 mm. The calculation apparently underestimates the digit-1 glyph offset in its box. Root of #65.

## Technical difficulties (environment, no product defect)
- The control panel starts collapsed: "Add d4" is not visible/clickable until "Show controls" is toggled; cost one aborted driver run.
- A full-viewport screenshot under SwiftShader costs about 6.5 s; captures were planned around it.
- One benign console warning before the first user gesture: navigator.vibrate blocked (haptics needs activation; out of this task's scope).

## Outcome
Need met, evidence matches the developer's measurement, one acceptance-range exceedance on the digit 1 filed as #65 (needs a user decision).
