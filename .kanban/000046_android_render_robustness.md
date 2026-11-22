---
name: "fix: restore rendering on Android and show render errors on the page"
priority: "critical"
state: "live-testing"
worktree: "fix/46-android-render-robustness"
issuer: "#39"
complexity: "moderate"
shortName: "android-render-robustness"
splitter: "done"
changes: "{\"base\":\"main\",\"ins\":194,\"del\":27,\"files\":8}"
commits: "[{\"hash\":\"b798ac2\",\"subject\":\"fix(render): stop draw from using stale resources after a failed restore\",\"when\":\"2026-11-22T12:20:09+01:00\"},{\"hash\":\"b05d988\",\"subject\":\"fix(render): drop driver-hostile shader constructs and surface render errors\",\"when\":\"2026-11-22T12:11:25+01:00\"}]"
---

# Summary
Since the GTAO (#38) and rounded-edge (#39) merges, the canvas is black on the user's Android phone in Chrome and Firefox. Remove the shader constructs that mobile GPU drivers handle badly, guard the fwidth division, use an opaque canvas, and show any renderer error on the page.

# Specs
# Problem
- On the user's Android phone (Chrome and Firefox), the canvas is black after the #38 and #39 merges. All shaders compile and link with `glslangValidator` in strict ES 3.00 mode, so the likely fault is a mobile GPU driver that rejects or miscompiles valid code.
- The dice and floor programs are built outside any try/catch (`src/render/renderer.js` around :220-221 and :324). A compile or link failure throws out of `createRenderer` before `createPanel` runs (`src/main.js:48`), and the page shows nothing. The AO `catch {}` blocks (renderer.js :293-297, :302-308, :404-408) drop errors with no log.

# Changes
1. Shader robustness (`src/render/shaders.js`, `BEVEL_FRAG` and every program that uses it):
   - `hullDistance`: use a constant loop bound with an early break, and no modulo by a uniform: `for (int k = 0; k < 20; k++) { if (k >= uHullCount) break; vec2 a = uHull[k]; vec2 e = uHull[k + 1 < uHullCount ? k + 1 : 0] - a; ... }`.
   - `insetOffset`: no dynamically indexed local array and no `%`. Use the flat inset varyings directly, or unroll the 5 edges, or index with `k < 4 ? k + 1 : 0`.
   - No other `%` or uniform-bounded loop in any fragment shader. Keep the same results.
2. Divide guard: in the dice fragment shader, `alpha = clamp((uBevelRadius - d) / max(fwidth(d), 1e-7) + 0.5, 0.0, 1.0)`.
3. Opaque canvas: `canvas.getContext('webgl2', { alpha: false })` in `src/main.js`. The clear color stays the same as the page background, so the look does not change. Keep the default `antialias: true`.
4. Error visibility:
   - In `src/main.js`, wrap the renderer creation in try/catch. On failure, show the error message (it includes the shader info log from `gl.js`) on the page in a readable overlay, and still create the panel when it can work without the renderer, or show the message where `#unsupported` is shown.
   - Add global `error` and `unhandledrejection` listeners that show the message in the same overlay.
   - Replace every silent `catch {}` in `src/render/renderer.js` with `console.error(...)` plus the existing fallback.
5. Context restore: catch errors from `buildResources()` on `webglcontextrestored` and show them in the overlay instead of throwing.

# Constraints
- No visual change on desktop: same bevel, same outline, same AO, same colors.
- No new dependency.

# Tests
- Source checks (vitest, node): no fragment shader contains `% uHullCount` or a `for` loop whose bound is a uniform. The dice shader divides by `max(fwidth(`. `main.js` requests `alpha: false`. No `catch {}` with an empty body remains in `src/render/`.
- A test with a fake GL whose shader compile fails: renderer creation reports the error through the new error path, and the error message contains the info log.
- Existing render, bevel and AO tests stay green.

# Acceptance criteria
- `npx vitest run src/render`
- `npm test`
- `npm run build`
- `glslangValidator` is installed on this machine: extract every shader string to `/tmp` files with the right stage and run `glslangValidator` on each (ES 300). All compile, and the program pairs link.
- Live check (desktop headless): the scene renders as before (bevel, AO, dice), no console or GL errors. Make the dice shader fail on purpose (in a test page or with a route rewrite) and check that the overlay shows the error.
- Manual check left to the user: open the deployed page on the Android phone in Chrome and Firefox. The scene renders, or the overlay shows the exact error.

# Notes
## Live test in progress (desktop headless, SwiftShader; #46 scope only)

Setup: vite dev :8797 from this worktree; baseline worktree at pre-change commit 8625cc5 in /tmp/dice-base-46 (:8798); Playwright Chromium SwiftShader, viewport 900x900 pinned, dpr 1; full-frame gl.readPixels inside a rAF registered after the app's draw (no drawImage/getImageData); route rewrites built from the served response body. Artifacts in /tmp/dice-lt46/ (run2.log, render-head.png, render-base.png, overlay-shader-fail.png, render-ao-fail.png, render-after-restore.png, results-dice-lt46.json).

Checks so far: 35/40 pass. Green: P1-P4 env probe (WebGL2 live; getContextAttributes alpha:false + antialias:true per Spec 3; backing == client*min(dpr,2), dpr 1 in headless; fps 18.3); R1 console+GL clean through load+settle (gl.getError()==0); R2 red dice present; R3 background == #14151a clear color and floor present; R6 no overlay on healthy page; E1 forced dice-shader compile failure via route rewrite -> #unsupported[role=alert] overlay, visible, centered, text "fragment shader compile failed: ERROR: ... 'DICE_BREAK'", no panel (matches recorded assumption: fatal creation failure replaces the panel), failure caught (no uncaught pageerror); E4 forced AO-program failure -> console.error "ambient occlusion unavailable, rendering without it", scene still renders via 1x1 white fallback (floor uniform, spread 0.0), no overlay, panel present; E5 real WEBGL_lose_context loss+restore -> resources rebuilt, scene renders again, no overlay, no console errors; E6 failed restore (synthetic webglcontextrestored + createProgram stub) -> overlay shows the error and draw is inert (0 gl.enable / 0 bindFramebuffer over 60 frames); E2 window 'error' and E3 unhandledrejection -> overlay text replaced each time, role=alert kept.

Open items (5 fails, classification under way):
- R5 (harness bug, fix prepared): scanline check passed die centres in GL bottom-up coords while the readback helper indexes top-down; firstRed=-1 is a flip error, not a product issue.
- R4 AO spread measured 7.7 vs my untraced threshold 8; no-AO reference (E4) measured 0.0 -> AO clearly present; will re-judge with traced threshold.
- B1b/B1d (head vs 8625cc5 baseline): baseline redF 0.045 vs head 0.179. Screenshots show the pre-change code renders HOLLOW dice under SwiftShader (bevel band only, faces transparent over the dark AO pool) while the fixed code renders solid dice with pips + rounded edges + AO. Hypothesis: the removed driver-hostile constructs (uniform-bounded hull loop, % / dynamic indexing) also misbehave on the desktop software rasterizer, so the SwiftShader baseline is itself broken and "no visual change" cannot be judged against it. Cross-checking #38/#39 live-test screenshots for precedent, then classifying (likely harness/environment limit: real-GPU desktop comparison stays a user manual check, like the Android check).
