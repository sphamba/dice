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

## Scope fixed from TASK.md
Change under test: one-line fix in `distanceTransform` (src/dice/carve.js:45), EDT row scratch resized to `Math.max(w, h)` so tall atlas cells (341x512) stop baking NaN-sdf pixels as flat normals. Deferred items from Notes I must cover: (1) task #49 d10 (phone) wall-shading re-check, (2) visual/live check that lower-half glyphs now carve in the GL render.

## Batched inspection done
- Changed files: src/dice/carve.js (1 line), src/dice/carve.test.js (new tests). Commit f570c92 in cwd worktree, clean.
- Serve command: `npx vite --port <p>` from cwd; UI selectors from precedent: `.panel-toggle`, `.panel-step[aria-label="Add d6"]`, `.panel-roll`; canvas #view; error overlay #unsupported.
- Precedent harness /tmp/dice-lt49 (harness.mjs + driver.mjs + atlas-probe.mjs) is proven: world spy via main.js route rewrite, readPixels-in-rAF capture, d6 pip dimple check (halfMoonLuma toward/away), number wall-shading check (glyphSpread vs bodySpread), phone 390x844 dpr3 viewport. Copying it with LT_CWD/LT_OUT/LT_PORT env retarget, new out dir /tmp/dice-lt54.
- Pre-fix reference values from #49's own live run (same harness, pre-fix code): d10 phone FAIL glyphSpread=19.7 vs bodySpread=68.7; d6 phone lower-half pips diff only 7.1 vs upper ~22; d6 desktop probe value=4 lower pips diff NEGATIVE (-4.3, -4.6); d6/d8/d12/d20 desktop+phone all passed with weak gates.

## Check list (mapped to acceptance/deferred items, committed now)
- A1 probe: webgl2 context, capture sane, console clean.
- A2 in-page atlas probe (app's real buildLabelAtlas+buildCarveAtlas via real modules in browser, d6+d10): per-face, per-glyph interior samples (alpha>=128, >=1px inside edge, avoiding pip centre per dev-quantisation note) must have ZERO exact-flat (128,128,255) bakes in the LOWER cell half; pre-fix reference: lower half flat per #49 evidence 1+2. Upper half also 0.
- A3 desktop d6 live GL: every visible pip dimpled (away-toward luma diff > 3) AND lower-half (gy=-1) pips >= 0.6x upper-half mean diff (pre-fix signature: 7.1 vs 22, or negative).
- A4 desktop d10 live GL: numbers carved gate (glyphSpread >= 10 and > bodySpread+5) - observation only pre-fix passed weakly here.
- A5 phone d6 live GL: same gate as A3 (pre-fix 7.1 diffs fail the balance gate).
- A6 phone d10 live GL: #49 wall-shading re-check, same gate (pre-fix FAILED: 19.7 vs 68.7). Headline deferred item.
- A7 phone d8/d12/d20 live GL: same numbers gate (passed pre-fix weakly; expect higher glyphSpread post-fix).
- A8 console clean + no GL errors per page; frames + zoom crops saved as evidence.

## Assumptions
- Glyph ridge-centre pixels bake flat by design (profile height stationary along the deepest line, gradient zero), so interior sampling avoids exact pip centres and 2px quantisation zones (dev note: 1.51-1.59 px); digit-stroke samples are eroded interiors, ridge lines may contribute flat samples - if A2/A7 show isolated flat samples I will check whether they lie on stroke skeletons before calling a defect.
- Top face after settle is random; d6 value 1 has no clearly-lower pip, so re-spawn (max 3 tries) until value != 1.
- SwiftShader headless rendering is the usage surface; no unit tests are run.

Next: write /tmp/dice-lt54 harness+driver (copy of lt49 with retargeted env), syntax check, smoke run (probe phase only), then full run.
