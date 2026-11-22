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
- Live test in progress, held at watch checkpoint. No defects filed yet.
- Read task + merged diff (1f22e07: forward dice shader computes d/alpha before roundedSurface/gl_FragDepth and adds `if (alpha <= 0.0) discard;`; bevel.test.js now requires exactly one silhouette-form discard). No code edited.
- Setup done: vite serves the merged worktree (cwd, :4621) and a pre-fix baseline checkout (.worktrees/lt-baseline-59 at parent commit 7a82756, :4622, created only for the required before-fix screenshot and to prove the pixel check detects the defect); both serve HTTP 200. Playwright-core 1.59.0 resolved from /home/phamba/repos/tarot/app/node_modules, chromium-1217 in ~/.cache/ms-playwright. Harness in /tmp/lt-59/.
- Test design (usage-level, browser only, no unit suites): real UI panel clicks add exactly one d4/d6/d20; flat pose = die settled via the running simulation; tilted pose = frozen mid-air spawn (the state users see during every roll), verified tilted from the captured model matrix. A two-tick in-page capture freezes the app clock and grabs frame A (dice drawn) and frame B (same frozen inputs, forward dice draw calls skipped, AO passes intact = same AO texture). Pixels are classified against the exact hull silhouette mirrored from src/render/renderer.js pointHullDistance2D using hull/bevelRadius/halfExtents captured from the live GL uniform uploads. Checks per pose: outside-silhouette (d > r + 1 px) frame diff <= 2/255; no holes inside (d <= r - 2 px, diff <= 2/255 vs floor-only frame); non-degeneracy guards (die visibly present, outside region non-empty); gl.SAMPLES and contextAttributes().antialias reported; zoomed corner screenshots before (baseline) and after (merged).
- Assumptions: tilted pose as frozen mid-air spawn is user-visible equivalent to mid-roll; headless Chromium + SwiftShader context is the environment under test (measured, not assumed); the 1-2 px antialiased band (r - 2 px < d <= r + 1 px) is excluded from both checks per the acceptance wording.
- Remaining: node --check + smoke run, baseline validation run (expected outside-diff FAIL there), full merged run (6 pose captures + screenshots), then report + cleanup (kill servers, remove baseline worktree).
