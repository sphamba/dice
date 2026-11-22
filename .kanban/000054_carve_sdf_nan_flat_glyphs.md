---
name: "fix: carve bake writes flat normals where signedDistance returns NaN"
priority: "high"
state: "live-testing"
worktree: "fix/54-carve-sdf-nan-flat-glyphs"
issuer: "#49"
complexity: "moderate"
shortName: "carve-sdf-nan-flat-glyphs"
splitter: "done"
changes: "{\"base\":\"main\",\"ins\":226,\"del\":2,\"files\":2}"
commits: "[{\"hash\":\"f570c92\",\"subject\":\"fix: size the EDT row scratch to the longest pass so tall masks stay finite\",\"when\":\"2026-11-22T14:49:10+01:00\"}]"
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
Live test in progress (checkpoint write).

## Results so far (run 1 complete, /tmp/dice-lt54/run1.log + results-driver.json)
- A1 probe: PASS (webgl2, capture sane 2200x2200, 17.9 fps swiftshader, console clean).
- A3 desktop d6 (value 5): 5/5 pips dimpled, lower(gy=-1) min diff 23.4 vs upper mean 24.2, balance ok. Pre-fix signature was 7.1/negative -> gate discriminates, fix visible in live GL.
- A5 phone d6 (value 4): 4/4 pips dimpled, lower 24.2/24.7 vs upper 24.3. PASS.
- A4 desktop d10: glyphSpread 27.7 vs bodySpread 0.0. PASS.
- A6 phone d10 (#49 deferred re-check, headline): glyphSpread=20.7 vs bodySpread=0.0 -> PASS (pre-fix: 19.7 vs 68.7 FAIL). No regression in d8 (21.7), d12 (25.7), d20 (24.0) phone numbers either.
- A8: no GL errors anywhere, no error overlay, frames + zoom crops saved (frame/zoom-desktop-d6, frame/zoom-phone-d6, zoom-phone-d10).

## Harness bugs found by my own gates (fixed, atlas phase pending re-run)
- buildCarveAtlas returns {size, data}; my first probe read carve[q] (undefined) so all byte comparisons were false. The "atlas probe byte path validated" check caught it (142812/142812 non-glyph samples read non-flat, impossible by bake design). Fixed to carve.data[q]; atlas flat/violation numbers from run 1 are VOID, re-running atlas phase only.
- consoleClean was cumulative across phases; made phase-scoped (from-index).

## willReadFrequently console warning: attributed to harness, not the app
- Run 1 showed 2x "Canvas2D: Multiple readback operations using getImageData are faster with willReadFrequently" warnings, accumulated from the atlas-probe phase.
- App-only attribution test (fresh page, real panel spawn of d6+d10, no probe): console EMPTY. Normal app usage does not emit the warning; only my probe's extra getImageData readbacks do. Not a product defect; atlas-phase console gate whitelists it.

## Remaining
- Re-run atlas phase (fixed carve.data reads) to replace the voided A2 numbers: expect 0 off-ridge flat interior glyph pixels for d6 (45613 interior px) and d10 (17831 px).
- Then final wrap-up: results table, notes rewrite, server killed (run 1 and attribution test servers already stopped and verified).
