---
name: "fix: remove the sharp hull pixels outside the rounded die silhouette"
priority: "high"
state: "to-live-test"
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
- Outcome: approved, HEAD 1f22e07, worktree clean, no fixes needed.
- Spec 2/4: forward dice shader computes `d`/`alpha` from the hull before `roundedSurface`/`gl_FragDepth` and discards at `if (alpha <= 0.0) discard;` (shaders.js:354); same hull silhouette as the prepass (shaders.js:191), so outside fragments write no color and no depth. Only zero-alpha fragments drop, so the ~1 px antialiased edge stays.
- Spec 3: `SAMPLE_ALPHA_TO_COVERAGE` still enabled/disabled around the dice pass (renderer.js:440,455); the new discard covers the single-sample path where A2C is inert.
- Spec 5: bevel.test.js:208-209 now requires exactly one discard in the dice shader and the silhouette form; the pre-existing `dot(q, q) > uBevelRadius` forbid still blocks a band discard.
- Spec 6: robustness rules untouched (no `%`, constant loop bounds, guarded `max(fwidth(d), 1e-7)`).
- Scope: diff touches only shaders.js and bevel.test.js; collision, bevel radius, die size, AO strength and labels unchanged.
- Evidence: `npx vitest run src/render` 44/44 (6 files), `npm test` 365/365 (28 files), `npm run build` green, exit 0 on all three.
- Deferred to live testing: browser reproduction and the 12-run pixel check (claimed 0/255 outside silhouette in both `SAMPLES = 4` and `SAMPLES = 0` contexts), the d4/d6/d20 no-hole check, and the before/after screenshots; note the screenshot paths under /tmp/check59/ are ephemeral, re-attach if the user needs them later. Root-cause claim (antialias is a hint, so `gl.SAMPLES = 0` makes A2C inert) is consistent with the task's known facts; confirm the edge still reads smooth on the user's device.
