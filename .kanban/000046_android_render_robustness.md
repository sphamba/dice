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
## PM steer
- The hollow baseline dice under SwiftShader support the root cause of this task. Record it as evidence: the pre-change shaders misrender on a software rasterizer too, so the baseline cannot judge "no visual change". Do not investigate it further.
- Fix the R5 harness flip, re-judge R4 against the E4 no-AO reference, then write the final results and finish. The Android check stays a manual check for the user.

## Live test (desktop headless, SwiftShader; #46 scope only)
Setup: vite dev :8797 from this worktree; baseline worktree at pre-change commit 8625cc5 in /tmp/dice-base-46 (:8798); Playwright Chromium SwiftShader, viewport 900x900, dpr 1; gl.readPixels inside a rAF after the app's draw. Artifacts in /tmp/dice-lt46/.

Checks so far: 35/40 pass.
- Green: env probe (WebGL2, alpha:false + antialias:true, backing size, fps 18.3); console and GL clean through load and settle; red dice present; background == #14151a and floor present; no overlay on a healthy page; forced dice-shader failure shows the #unsupported[role=alert] overlay with "fragment shader compile failed: ERROR: ... 'DICE_BREAK'" and no uncaught pageerror; forced AO failure logs console.error, renders with the 1x1 white fallback and no overlay; WEBGL_lose_context loss and restore renders again; a failed restore shows the overlay and draw is inert; window 'error' and unhandledrejection show in the overlay.
- R5: harness flip (GL bottom-up vs top-down indexing), not a product issue.
- R4: AO spread 7.7 vs an untraced threshold 8; the E4 no-AO reference is 0.0, so AO is present.
- B1b/B1d: baseline 8625cc5 renders hollow dice under SwiftShader (bevel band only, faces transparent), head renders solid dice with pips, rounded edges and AO. See PM steer.
