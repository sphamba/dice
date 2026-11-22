---
name: "fix: restore rendering on Android and show render errors on the page"
priority: "critical"
state: "done"
worktree: ""
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
## Live test result: pass, no defects filed (desktop headless, SwiftShader)

Scope: only #46 flows (render robustness + error surfacing), through the real browser interface. Serve: vite dev :8797 from this worktree (HTTP 200 preflight for /, /src/main.js, /src/render/shaders.js). Playwright Chromium SwiftShader, viewport 900x900 pinned at creation, dpr 1; full-frame gl.readPixels inside a rAF registered after the app's draw (no drawImage/getImageData). Baseline: pre-change commit 8625cc5 in a temp worktree served on :8798. Artifacts: /tmp/dice-lt46/ (run2.log full suite, run4/run5 rerun logs, results-*.json, render-head.png, render-base.png, overlay-shader-fail.png, render-ao-fail.png, render-after-restore.png). Servers stopped, ports verified free, baseline worktree removed.

Results:

| Check | Result | Evidence |
| --- | --- | --- |
| Env probe | PASS | WebGL2 live; getContextAttributes alpha:false + antialias:true (Spec 3); backing == client*min(dpr,2), dpr 1 in headless (cap verified once); fps 18.3 |
| Console + GL clean | PASS | load + settle: no console errors, no pageerrors, gl.getError() == 0 |
| Dice render | PASS | red (d6) pixels 17.9% of frame with the default 2x d6 set |
| Opaque canvas look | PASS | background pixels classify as #14151a (clear color == page background) exactly where the die coverage mask is alpha 0; floor pixels present (81%) |
| AO | PASS | floor ring 150-260 px around each die mean luma 39.4 vs far floor (>330 px from all dice) 49.3, drop 9.9; no-AO reference measured in the E4 rerun: uniform 49.3, drop 0.0 |
| Bevel / rounded outline | PASS | silhouette transition band present with intermediate pixels ((81,33,28), (109,40,34) between die red (211,60,48) and surround); interior solid: red fraction 0.74 / 1.00 across the die span (pip-robust metric) |
| No stray overlay | PASS | #unsupported absent on a healthy page |
| Forced dice-shader failure (route rewrite of served shaders.js) | PASS | #unsupported[role=alert] overlay, visible, centered, 16px, text "fragment shader compile failed: ERROR: ... 'DICE_BREAK'" (includes the shader info log); no panel (matches the recorded assumption: fatal creation failure replaces the panel); error caught, no uncaught pageerror |
| Forced AO-program failure (route rewrite) | PASS | console.error "ambient occlusion unavailable, rendering without it"; scene still renders on the 1x1 white fallback (floor uniform, spread 0.0); no overlay; panel present |
| Context restore, real loss | PASS | WEBGL_lose_context lose + restore: resources rebuilt on the restored context, scene renders again, no overlay, no console errors during the round trip |
| Failed restore | PASS | synthetic webglcontextrestored with gl.createProgram stubbed to throw: overlay shows the error; draw inert afterwards (0 gl.enable, 0 bindFramebuffer calls over 60 frames) |
| Global listeners | PASS | window 'error' (throw in setTimeout) and unhandledrejection (Promise.reject) each replace the overlay text, role=alert kept |
| Baseline 8625cc5 comparison | PARTIAL, see evidence | floor-side features match (background fraction, AO spread 7.7 vs 11.0); red/floor fractions differ (0.045 vs 0.179) because the pre-change code renders hollow dice on SwiftShader |

Evidence recorded (per PM steer, not investigated further): the pre-change commit renders HOLLOW dice under the desktop software rasterizer too - only the bevel band survives, faces transparent over the dark AO pool (render-base.png), while the fixed code renders solid dice with pips, rounded edges and AO (render-head.png). The removed driver-hostile constructs were therefore not Android-only; this supports the task's root cause. Consequence: the SwiftShader baseline cannot judge the "no visual change on desktop" constraint. That constraint and the Android Chrome/Firefox check stay manual checks for the user on real hardware.

Assumptions made while designing the usage tests:
- Desktop headless SwiftShader stands in for "desktop"; the Android device check is the user's manual step per the task.
- "Renders as before" judged by feature presence and measured references (bevel band, AO pools, solid dice, clear color), not a pixel-exact diff: spawn poses are random and frame timing varies under SwiftShader.
- Failed-restore exercised via a synthetic webglcontextrestored event with a stubbed createProgram - the same handler path a real failed restore takes, since served module code cannot be altered after load.
- The default set (2x d6) was used for all render checks; no input or physics flows were exercised (out of task scope).

Harness difficulties hit while testing (resolved, no product impact): readPixels row indexing is bottom-up while the helper sampled top-down (first scanline run read the wrong row); a single-pixel interior check hit the label pip (replaced by red fraction over the die span); the first AO threshold (8) was untraced (replaced by ring-vs-far luminance against the measured no-AO reference 0.0).
