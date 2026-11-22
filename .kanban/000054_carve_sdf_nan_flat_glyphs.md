---
name: "fix: carve bake writes flat normals where signedDistance returns NaN"
priority: "high"
state: "done"
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
Live test complete. Verdict: the fix works. No product defects found; no cards filed.

## Scope and method
Tested the one-line EDT fix (carve.js:45, row scratch Math.max(w,h)) through the real app served by vite from the worktree, driven headless (SwiftShader WebGL2) with the proven #49 harness retargeted to /tmp/dice-lt54 (env LT_PORT/LT_OUT/LT_CWD). Two runs: run1 = probe + atlas + live GL (desktop, phone), run2 = corrected atlas re-run. Artifacts: /tmp/dice-lt54/{run1.log,run2-atlas.log,results-driver.json,frames,zooms,shots}. No unit tests run. Assumptions stated at the first checkpoint all held; none contradicted.

## Results (check -> outcome)
| Check | Outcome |
|---|---|
| A1 probe: webgl2, capture sane 2200x2200, 17.9 fps, console | PASS |
| A2 atlas bake, d6 (in-page, app's real buildLabelAtlas+buildCarveAtlas): 45613 interior glyph px across 6 faces, 0 off-ridge flat bakes (31 byte-flat, all within 2px of pip ridge centres - matches the dev quantisation note) | PASS |
| A2 atlas bake, d10: 17831 interior px across 10 faces, 0 off-ridge flat (198 byte-flat, all on stroke skeleton ridges, i.e. the profile's stationary line) | PASS |
| A2 detector sanity: 264612 non-glyph samples all exactly (128,128,255) | PASS |
| A3 desktop d6 (value 5): 5/5 pips dimpled, lower(gy=-1) min diff 23.4 vs upper mean 24.2, balance ok | PASS |
| A5 phone d6 (value 4): 4/4 pips dimpled, lower 24.2/24.7 vs upper 24.3 | PASS |
| A4 desktop d10: glyphSpread 27.7 vs bodySpread 0.0 | PASS |
| A6 phone d10 (#49 deferred re-check): glyphSpread=20.7 vs bodySpread=0.0 -> PASS (pre-fix: 19.7 vs 68.7 FAIL) | PASS |
| A7 phone d8/d12/d20 numbers: 21.7 / 25.7 / 24.0 vs bodySpread 0.0, no regression | PASS |
| A8 no GL errors, no error overlay, console clean on all pages/phases | PASS |
| Visual: zoom-phone-d6 shows all 4 pips (incl. both lower-half) with identical dimple shading; zoom-desktop-d6, zoom-phone-d10 crops saved | PASS |

Discrimination: pre-fix reference values from #49's own run of the same harness - d6 lower pips diff 7.1 (phone) / negative (desktop) vs upper ~22-24; d10 phone check FAILED 19.7 vs 68.7; #49 evidence 1+2 show whole lower zone flat in the atlas. The shipped code shows lower/upper symmetric diffs and a clean atlas, so the gates separate fix from defect. The d10 phone pass ran with bodySpread 0.0 (random orientation), so that single gate is weaker than the pre-fix run; the d6 balance gates and the atlas scan carry the discrimination.

## Observations (not defects)
- Byte-flat (128,128,255) bake occurs exactly at profile stationary points: pip centres (31 px on d6) and digit-stroke skeleton lines (198 px on d10), all within 2px of a local depth maximum. Consistent with the round-profile design and the dev's 1.51-1.59 px pip measurement. For future test authors: the pip-centre exemption in the unit test extends to digit skeletons.
- App-only console (fresh page, real panel spawns, no probe) is completely clean; normal usage does not trigger the Chrome willReadFrequently perf hint.

## Technical difficulties hit while testing (resolved in the test rig, no product impact)
- First atlas numbers were void: my probe read carve[q] but buildCarveAtlas returns {size, data}; every byte comparison evaluated false. Caught by the detector-sanity gate (all non-glyph samples read non-flat, impossible by bake design), fixed to carve.data[q], re-run green.
- Console audit was cumulative across phases, letting atlas-phase messages fail later phases' gates; made phase-scoped and re-verified clean.

## Environment
Servers stopped and verified (lsof: 0 listeners on 8954/8955). Two unrelated vite processes left untouched (main repo --host server; task #53 harness on 8801). Artifacts in /tmp/dice-lt54.
