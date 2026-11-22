---
name: "fix: remove the sharp hull pixels outside the rounded die silhouette"
priority: "high"
state: "live-testing"
worktree: "fix/59-rounded-silhouette-transparent"
issuer: "user"
complexity: "moderate"
shortName: "rounded-silhouette-transparent"
splitter: "done"
changes: "{\"base\":\"main\",\"ins\":10,\"del\":4,\"files\":2}"
commits: "[{\"hash\":\"1f22e07\",\"subject\":\"fix: discard dice fragments outside the rounded silhouette\",\"when\":\"2026-11-22T20:42:18+01:00\"}]"
---

# Summary
The sharp hull stays visible as a translucent shape at the rounded edges and corners of the dice. Pixels outside the rounded silhouette must be fully transparent, so the floor shows with no die color.

# Specs
## Need
The user sees the sharp die shape as a translucent area outside the rounded edges and corners. These pixels must be completely transparent. Only the rounded shape s·P ⊕ ball(r) can show on the screen.

## Known facts
- The forward dice pass (`src/render/shaders.js:367-369`, `src/render/renderer.js:430-456`) computes `d = hullDistance(vWorldPos.xy)` and `alpha = clamp((uBevelRadius - d) / max(fwidth(d), 1e-7) + 0.5, 0.0, 1.0)`. It keeps all fragments and depends on alpha-to-coverage (A2C) to remove them.
- The AO prepass already discards at `src/render/shaders.js:191`.
- The camera is orthographic and looks along -z. Thus `hullDistance(vWorldPos.xy) > uBevelRadius` is the exact silhouette test for all die tilts. Do not use a face-plane test such as `|q| > r`, because it makes holes on tilted dice.
- The context does not set `antialias`, and no code reads `gl.SAMPLES`. If the buffer has no samples, A2C has no effect.
- This code does not fully explain a translucent result. Alpha 0 with working MSAA must give zero coverage.

## Required work
1. Reproduce the defect first in a real browser (Playwright or the project's live-test method). Read `gl.getParameter(gl.SAMPLES)` and `gl.getContextAttributes().antialias`. Find the root cause of the translucent pixels from this measurement. Examine these causes: fragments that A2C keeps, depth written by removed fragments, the AO result, and any pass that draws after the dice.
2. Fix the root cause. The expected minimum fix is to discard the forward fragment when `alpha <= 0.0`, with the same silhouette test as the prepass. Keep the antialiased edge of about 1 pixel.
3. The result must be correct with MSAA and without MSAA.
4. Fragments outside the silhouette must write no color and no depth.
5. `src/render/bevel.test.js:203-206` forbids `discard;` in the dice shader. Change this assertion so that it permits only the silhouette discard and still forbids a `|q| > r` discard.
6. Obey the mobile GLSL rules in `src/render/robustness.test.js`.

## Scope limits
Do not change the collision, the bevel radius, the die size, the AO strength or the labels.

## Acceptance
- `npx vitest run src/render` passes.
- `npm test` passes.
- `npm run build` passes.
- Browser pixel check on a d4, a d6 and a d20, each at a flat pose and a tilted pose: render one frame with the dice and one frame with the same AO texture and no forward dice draw. For all pixels with `d > r + 1 px`, the two frames differ by at most 2/255 per channel.
- The same browser check shows no holes inside the rounded silhouette on the tilted poses.
- Attach one zoomed corner screenshot before the fix and one after the fix to the task Notes as file paths.

# Notes
## PM steer (read first)
- The defect shows only when the buffer has no samples. The developer measured a clean baseline with `gl.SAMPLES = 4` and a leak with `gl.SAMPLES = 0`.
- Run the baseline and the merged build in two contexts: the default context, and a context forced to `antialias: false` through an init script that wraps `HTMLCanvasElement.prototype.getContext`. Report `gl.SAMPLES` for each run.
- Expected result: the baseline fails the outside check only with `gl.SAMPLES = 0`. The merged build passes in both contexts. If the baseline passes in both contexts, the harness does not detect the defect: fix the harness before you give a verdict.
- Take the before and after corner screenshots from the `antialias: false` context.
- Time budget from now: 15 minutes.

## Live test progress (held at watch checkpoint; no product defect found so far)
- Environment measured, matches the steer: default context `gl.SAMPLES = 4` (antialias hint honored by SwiftShader here); forced context (init-script wraps getContext, passes `antialias:false`) gives `gl.SAMPLES = 0`. Both reported per run in /tmp/lt-59/results-*.json.
- Harness validation on the pre-fix baseline (commit 7a82756), flat d4: outside-silhouette check FAILS only in the `samples:0` context (outMax 181/255, 3540 bad pixels) and is clean in the `samples:4` context (outMax 0) - the check discriminates exactly where the PM said the defect shows. Before-fix corner screenshots saved: /tmp/lt-59/baseline-flat-d4-noantialias-corner.png (the required "before", from the antialias:false context) and baseline-flat-d4-default-corner.png.
- Merged build so far: flat-d4 and tilted-d4 in the default context pass the outside check with 0/255 (14664-16257 outside pixels, die visibly present in all). The merged run stopped early at flat-d6 on a driver bug (panel toggle aria-label flips to "Hide controls" after the first expansion, and leftover dice from the previous phase stayed on screen); fixed in run.mjs since.
- One gate needs a verdict: the raw "no holes inside" gate flagged 2 pixels (diff <= 2/255) inside the tilted-d4 silhouette. Instrumentation pass (fresh tilted d4, samples:0 context): all small-diff inside pixels sit at A = 48-54 vs B = 50-52 per channel - the die's own dark bevel band against the AO-shadowed floor, diffs 1-4 spread over ~14 px of band, including 23 px inside the silhouette. A real floor-through hole would reproduce the floor pixel bit-exactly (0/255 on all three channels); this is a smooth coincidence band of two dark shades, not missing fragments. Visual confirmation crops captured (/tmp/lt-59/hole-inspect-a.png, hole-inspect-b.png), reading them next.
- Remaining: read inspection crops, finalize the hole-gate form from that evidence, one full clean run (baseline 2 contexts + merged 6 poses x 2 contexts, after-screenshots from the antialias:false context), then report + cleanup (kill both vite servers, remove the baseline worktree).
