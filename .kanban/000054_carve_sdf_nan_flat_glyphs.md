---
name: "fix: carve bake writes flat normals where signedDistance returns NaN"
priority: "high"
state: "to-merge"
worktree: "fix/54-carve-sdf-nan-flat-glyphs"
issuer: "#49"
complexity: "moderate"
shortName: "carve-sdf-nan-flat-glyphs"
splitter: "done"
---

# Summary
signedDistance in src/dice/carve.js returns NaN for glyphs far from ink, and buildCarveAtlas bakes those pixels as flat normals (no carving). Dice show painted labels with no carve on arbitrary glyph positions; explains the d10 (phone) wall-shading FAIL of task #49.

# Specs
# Defect
`buildCarveAtlas` (`src/dice/carve.js`) bakes flat normals for every glyph pixel whose signed distance is NaN. NaN fails every `sdf[p] < 0` comparison, so the pixel stays flat `(128,128,255)` with cavity 255. Glyphs in the lower half of each atlas cell show paint with no carving.

# Evidence
1. Minimal repro `/tmp/dice-lt49/repro.mjs` (shipped `signedDistance`/`carveCell`): mask 341x512 px, two 22 px disks at (99,148) and (99,364). sdf at the upper disk centre = -22.023 (correct), at the lower disk centre = NaN. The lower disk is 361/361 flat, the upper disk 124/361 flat.
2. In-page atlas probe `/tmp/dice-lt49/atlas-probe.mjs`: in every atlas cell, glyphs below the cell midline bake flat. Deterministic.
3. Live render (#49): some d6 pips flat, others dimpled on the same face. The #49 d10 (phone) wall-shading FAIL has the same cause.

# Change
- Trace where NaN enters the Felzenszwalb-Huttenlocher EDT (`edt1d`, `INF = 1e20`, the parabola intersection `s`, or a wrong index or row/column stride in the 2D pass for non-square masks). Fix the root cause with the smallest change. Do not hide it with a clamp at the end of `signedDistance` only.

# Tests (`src/dice/carve.test.js`)
- The repro case as a unit test: 341x512 mask, two 22 px disks (upper and lower half). sdf is finite at every pixel, and within 0.5 px of the exact Euclidean value at every pixel, inside and outside.
- The same check on a non-square mask with the glyph in each quadrant.
- `buildCarveAtlas` on the real label atlas: no NaN in the sdf, and every glyph pixel with label alpha above 0.5 that is more than 1 px inside the edge has a non-flat normal or is at the exact centre of a pip.
- The existing carve, render, bevel, AO and #46 tests stay green.

# Acceptance criteria
- `npx vitest run src/dice src/render`
- `npm test`
- `npm run build`

# Notes
- Review verdict: approved. Root cause confirmed in the diff: `edt1d`'s column pass writes h samples into the shared `row` scratch sized `w`, so for h > w every row index >= w read `undefined` -> NaN; NaN then failed `sdf[p] < 0` in `carveCell` and baked flat (128,128,255). Fix is the minimal one-line re-size to `Math.max(w, h)` in `distanceTransform`; no end-clamp, matches the "fix the root cause" spec bullet.
- Spec bullets all map to diff/test evidence: 341x512 two-disk repro (upper+lower half, finite, <= 0.5 px vs brute-force exact at every pixel), non-square quadrant masks (160x320, 320x160, 200x280), and a `buildCarveAtlas` bake of the real d6 label atlas (real `buildLabelAtlas` pip geometry via a fake OffscreenCanvas/ellipse/fill ctx that matches the labels.js contract) asserting no NaN and no flat interior glyph pixel (sdf <= -1). `edt1d`/`distanceTransform` have no other callers (grep).
- Accepted adaptation (recorded assumption): the atlas test exempts flat pixels within 2 px of a pip centre, not only the exact centre, because the round profile is stationary at the pip top and quantises to a flat byte (dev measured 1.51-1.59 px); stated in Notes, accepted. Node has no canvas, so the atlas test rasterises the recorded ellipses; d6 labels are pure ellipses, so geometry matches production.
- Verification (re-run at review): `npx vitest run src/dice src/render` 9 files/118 tests pass; `npm test` 28 files/346 tests pass; `npm run build` OK (dist assets index-CPThTu4l.js, index-DFCdjPSa.css). Worktree clean at 3b30f29.
- Deferred to live-test role: task #49 d10 (phone) wall-shading re-check and a visual check that lower-half glyphs now carve in the live GL render.
