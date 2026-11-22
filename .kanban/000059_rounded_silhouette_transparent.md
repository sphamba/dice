---
name: "fix: remove the sharp hull pixels outside the rounded die silhouette"
priority: "high"
state: "done"
worktree: ""
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

## Live test report - task 59 - VERDICT: PASS, no product defect found
Final clean run: /tmp/lt-59/results-final2.json (95 checks, 0 FAIL). Harness: /tmp/lt-59/{harness,run}.mjs, merge commit 1f22e07, baseline commit 7a82756.

### Environments (both reported every run)
- default context: gl.SAMPLES = 4, antialias attr true (SwiftShader honors the hint here).
- forced context (init script wraps getContext, adds antialias:false): gl.SAMPLES = 0, antialias attr false.

### Harness validation (pre-fix baseline, flat d4) - matches the steer exactly
- samples:0 context: outside check FAILS on baseline as expected - outMax 182/255, 3567 of 16257 outside pixels differ by more than 2/255. The check detects the defect.
- samples:4 context: baseline clean - outMax 0/255. Defect absent with MSAA, as the PM measured.

### Merged build (12 phases: d4, d6, d20 x flat, tilted x both contexts)
- Outside check `d > r + 1px, diff <= 2/255`: PASS in all 12 phases. outMax 0/255 everywhere (7.8k-27k outside pixels per phase, die present in all; inStrong 19k-56k).
- No holes inside the rounded silhouette: holesExact (floor shown through bit-exactly, the real-hole signature) = 0 in all 12 phases, PASS on the 6 gated tilted phases.
- holesNear (diff <= 2/255 inside): 0-19 isolated px per phase, recorded as observation only. Instrumented once: they sit on the die's dark AO contact band / bevel band against the equally dark shadowed floor, values 48-54 vs 50-52 per channel, diffs 1-4 spread smoothly over the band. The zoomed crop /tmp/lt-59/hole-inspect-a.png shows a continuous face with its carved ink up to the antialiased edge. Shade coincidence, not missing fragments; a real hole would reproduce the floor bit-exactly and in numbers.
- Console clean, no page errors, in both contexts.

### Required screenshots (from the antialias: false context, 8x zoom)
- Before: /tmp/lt-59/baseline-flat-d4-noantialias-corner.png - translucent ghost wedge of the sharp silhouette extends past the rounded edge.
- After: /tmp/lt-59/flat-d4-noantialias-corner.png - rounded corner, antialiased edge, dark floor meets it directly.
- Also: /tmp/lt-59/baseline-flat-d4-default-corner.png (before, MSAA), /tmp/lt-59/flat-d4-{d6,d20}-{default,noantialias}-corner.png (after).

### Evidence table
- baseline samples:0 outside check: FAIL (defect present) -> harness detects the defect.
- baseline samples:4 outside check: PASS (clean) -> matches the steer.
- merged 12 phases outside check: 12/12 PASS, outMax 0/255.
- merged 6 tilted phases hole gate: 6/6 PASS, holesExact 0.
- env checks (page errors, console): PASS both contexts.

### Fixed harness issues during the run (not product defects)
- Toggle aria-label flips after first expansion; leftover dice between phases (setPanel now idempotent, removes all types).
- Baseline self-validation expectation: defect detectable only at samples:0, clean at samples:4 (per the steer).

### Cleanup
- Both vite servers killed (ports 4621, 4622 verified free). Baseline worktree .worktrees/lt-baseline-59 removed. Artifacts and harness preserved under /tmp/lt-59/.
