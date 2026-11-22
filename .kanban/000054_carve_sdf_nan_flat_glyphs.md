---
name: "fix: carve bake writes flat normals where signedDistance returns NaN"
priority: "high"
state: "to-do"
worktree: ""
issuer: "#49"
complexity: "moderate"
shortName: "carve-sdf-nan-flat-glyphs"
---

# Summary
signedDistance in src/dice/carve.js returns NaN for glyphs far from ink, and buildCarveAtlas bakes those pixels as flat normals (no carving). Dice show painted labels with no carve on arbitrary glyph positions; explains the d10 (phone) wall-shading FAIL of task #49.

# Specs
# Defect

`buildCarveAtlas` (src/dice/carve.js) bakes FLAT normals for every glyph pixel whose signed distance is NaN. NaN fails every `sdf[p] < 0` comparison, so `height` stays 0 and the pixel is forced to flat `(128,128,255)` with cavity 255. Rendered dice then show painted labels with NO carving, on arbitrary glyph positions (any glyph landing in the lower half of its atlas cell).

# Evidence

1. Minimal repro (Node, shipped modules): `/tmp/dice-lt49/repro.mjs` imports `signedDistance`/`carveCell` from src/dice/carve.js. Mask 341x512 px (one d6 cell), two 22 px disks at (99,148) upper and (99,364) lower, spacing 1:
   - `sdf` at upper disk centre = -22.023 (correct).
   - `sdf` at lower disk centre = **NaN**.
   - `carveCell` output: lower disk 361/361 sample points flat; upper disk partially flat (124/361) — NaN spreads through the distance transform.
2. In-page atlas probe (`/tmp/dice-lt49/atlas-probe.mjs`, rebuilds both atlases with the exact shipped functions): in EVERY atlas cell, glyphs below the cell midline bake flat (25/25 sample points flat at label alpha 255), glyphs in the upper half carve correctly. All six d6 faces show it; deterministic across rebuilds.
3. Live render (task #49 run 1): some d6 pips have flat interiors (luma 254, carve normal (0,0,1)) while other pips on the SAME face show the dimple gradient (+10..+22 luma on the away side). Which pips are flat depends on the rolled face.
4. The task #49 FAIL "numbers carved (wall shading): d10 (phone): glyphSpread=19.7 vs bodySpread=68.7" is the same defect (d10 digits landing in cell lower halves bake flat, collapsing the glyph luma spread). Same root cause — no second card needed.

# Suspected root cause (trace still to do)

`edt1d` (Felzenszwalb-Huttenlocher 1D EDT) uses `INF = 1e20`; NaN is suspected to enter via INF−INF arithmetic in the parabola intersection `s = (f[q]+c·q² − f[v[k]]−c·v[k]²) / (2c(q−v[k]))` or via `v[k]` underflow poisoning `z[k]`, for rows/regions far from glyph ink. `signedDistance` then propagates it.

# Fix direction

- Make the EDT non-finite-safe (clamp inputs to a large finite value or use a guarded INF; assert `Number.isFinite` on `s`), or replace the FH pass for far-from-ink regions with a finite upper bound.
- Guard at the boundary: in `signedDistance`, clamp non-finite results to a large finite distance before `sdf = toInside - toOutside`.
- Regression tests: repro.mjs case must give finite sdf and a carved lower disk; keep the existing carve unit tests (they only cover glyphs in cell upper halves, which is why this slipped through).

# Acceptance

- repro.mjs: sdf finite everywhere; lower disk carves (0 flat sample points).
- In-page atlas probe: flatCarve = 0/25 for every glyph of every face value on all dice types.
- Task #49 check "numbers carved (wall shading): d10 (phone)" passes; d6 pips show dimple asymmetry on every rolled face.

# Notes
