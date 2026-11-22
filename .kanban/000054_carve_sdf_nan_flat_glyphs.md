---
name: "fix: carve bake writes flat normals where signedDistance returns NaN"
priority: "high"
state: "doing"
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
- Deliverable: `distanceTransform` in `src/dice/carve.js` now allocates the row scratch as `max(w, h)`. Root cause was the Felzenszwalk-Huttenlocher column pass writing `h` samples into a `w`-length scratch, so every row index >= w read `undefined` and became NaN. NaN fails `sdf[p] < 0`, so `buildCarveAtlas` baked those pixels flat (128,128,255). Shipped code produced NaN on 58311 of 174592 pixels of the pinned 341x512 repro, all rows >= 341; the fix leaves 0.
- Verification (HEAD 3b30f29): `npx vitest run src/dice src/render` -> 9 files, 118 tests pass. `npm test` -> 28 files, 346 tests pass. `npm run build` -> built in 60ms, dist/index.html references ./assets/index-CPThTu4l.js and ./assets/index-DFCdjPSa.css.
- Tests added in `src/dice/carve.test.js`: exactness against a brute-force boundary-pixel signed distance on the pinned 341x512 two-disk repro (finite, within 0.5 px at every pixel), on 160x320, 320x160 and 200x280 masks with a glyph per quadrant, and one helper self-check on 64x64. Plus a `buildCarveAtlas` bake of the real d6 label atlas (real `buildLabelAtlas` pip geometry, 341/342x512 cells): no NaN in any cell sdf and no flat interior glyph pixel. All three new atlas/sdf tests were red before the fix.
- Assumptions: pip tops may bake flat within 2 px of a pip centre (the profile is stationary there and quantises to a flat byte; measured 1.51-1.59 px on the d6 atlas). The atlas test rasterises the recorded label ellipses because the Node test environment has no 2D canvas for text glyphs; d6 labels are pure ellipses, so the pip geometry is the production one.
- Blockers: none.
- Manual checks left to other roles: the task #49 d10 (phone) wall-shading check and a visual check that lower glyphs now carve.
