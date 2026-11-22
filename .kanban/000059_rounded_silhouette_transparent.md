---
name: "fix: remove the sharp hull pixels outside the rounded die silhouette"
priority: "high"
state: "doing"
worktree: "fix/59-rounded-silhouette-transparent"
issuer: "user"
complexity: "moderate"
shortName: "rounded-silhouette-transparent"
splitter: "done"
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
## Deliverable
- `src/render/shaders.js`: the forward dice fragment shader now discards when `alpha <= 0.0`, using the same `hullDistance(vWorldPos.xy)` silhouette test as the AO prepass and testing it before `gl_FragDepth`. Fragments outside `s·P ⊕ ball(r)` write no color and no depth. `SAMPLE_ALPHA_TO_COVERAGE` stays enabled, so the ~1 px edge stays smooth where the buffer is multisampled.
- `src/render/bevel.test.js`: the "no discard in the dice shader" assertion now permits exactly one discard and requires the silhouette form; a `|q| > uBevelRadius` band discard stays forbidden.

## Verification
- HEAD `1f22e07`. Clean room from `git archive HEAD`: `npm ci`, then `npm test` 365 passed (28 files), `npm run build` green.
- `npx vitest run src/render`: 44 passed (6 files).
- Browser check (Playwright, SwiftShader, temporary harness on a dev server, deleted before commit), d4/d6/d20 at a flat and a tilted pose, in two contexts: `{alpha:false}` giving `gl.SAMPLES = 4` and `{alpha:false, antialias:false}` giving `gl.SAMPLES = 0`. Frame with dice against a frame with the same AO texture and no forward dice draw: for every pixel with `d > r + 1 px` the maximum channel difference is 0/255 in all 12 runs.
- Same check before the fix: single-sample context leaked full die color outside the rounded shape (max 206/255 per channel, 4684 pixels on d4 flat, 2922 on d4 tilt, 2758 on d6 tilt). The 4-sample context was already clean.
- No holes inside the rounded silhouette on any pose in either context. One interior pixel on the d20 tilted pose comes within 1/255 of the floor color in both contexts: dark carved ink, a metric coincidence, not geometry.
- Zoomed corner screenshots, d6 flat pose, single-sample context, 6x: before `/tmp/check59/corner-before-sharp-hull.png` (sharp square corner), after `/tmp/check59/corner-after-rounded.png` (rounded corner).

## Assumptions
- Root cause: the `antialias` context attribute is only a hint, so a browser can hand back `gl.SAMPLES = 0`; alpha-to-coverage is then inert and alpha-0 fragments wrote full die color and depth. The multisampled path was already correct.
- The reported translucent look is the rim-lit sharp-hull flange outside the rounded shape, drawn at full color on a buffer without MSAA.
- Scope respected: no change to collision, bevel radius, die size, AO strength or labels.

## Blockers
- None.

## Manual checks left to other roles
- Confirm the rounded edge still reads smooth on the user's device and record its `gl.SAMPLES`.
