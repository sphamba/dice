---
name: "fix: restore rendering on Android and show render errors on the page"
priority: "critical"
state: "to-review"
worktree: "fix/46-android-render-robustness"
issuer: "#39"
complexity: "moderate"
shortName: "android-render-robustness"
splitter: "done"
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
## Deliverable
- `src/render/shaders.js`: `hullDistance` walks a constant `for (int k = 0; k < 20; k++)` with `if (k >= uHullCount) break;` and the wrap index `k + 1 < uHullCount ? k + 1 : 0`; `insetOffset` reads the flat inset varyings through `insetPoint(int)` instead of a dynamically indexed local array; no `%` and no uniform-bounded loop remains in any program; the dice outline alpha divides by `max(fwidth(d), 1e-7)`.
- `src/main.js`: `getContext('webgl2', { alpha: false })` (antialias untouched), renderer creation wrapped in `tryCreateRenderer`, `error` and `unhandledrejection` listeners registered; all failures go to one `<p id="unsupported" role="alert">` through the new `showMessage` export in `src/ui/panel.js` (style.css widens it, scrolls it and enables pointer events for long info logs).
- `src/render/renderer.js`: `createRenderer(gl, { onError })`; a failed rebuild on `webglcontextrestored` reports through `onError` and keeps the old resources out of use; the three former empty catches around the AO setup, the AO restore and the AO target resize now `console.error` and keep their fallbacks.

## Verification
- HEAD `e9287af`: `npx vitest run src/render src/ui` 54 passed (7 files); `npm test` 311 passed (27 files); `npm run build` green (`✓ built in 70ms`), `dist/index.html` references its hashed js and css.
- `glslangValidator` on the 9 extracted sources (ES 3.00): 9/9 compile, 5/5 program pairs link, 0 failures.
- New coverage: `src/render/robustness.test.js` (no `%`, constant loop bounds, hull bound and break, guarded fwidth, `alpha: false`, try/catch + listener wiring, no empty catch in `src/render/`), fake-GL failure cases in `renderer.test.js` (creation throws with the info log, restore failure reaches `onError`), `showMessage` in `panel.test.js`.
- Live headless (Chromium + swiftshader on :5199, server killed and port free afterwards): live WebGL2 context with `alpha: false, antialias: true`; center crop 1301 distinct colors, red dice with white pips on the dark floor, `gl.getError()` 0; no overlay on the healthy load; a forced dice-fragment syntax error shows a visible overlay reading `fragment shader compile failed: ERROR: 0:132: 'syntax_error_here' : undeclared identifier`.

## Assumptions
- A renderer creation failure is fatal: the overlay replaces the panel and the scene, rather than a renderer-less panel over a black canvas.
- The WebGL2-unsupported text and every render error share the existing `#unsupported` element and style.
- The `uHull[20]` uniform array stays big enough: the largest shape (d12, 20 vertices) projects to at most 20 hull points.

## Blockers
- None.

## Manual checks left to other roles
- Open the deployed page on the Android phone in Chrome and Firefox: the scene renders, or the overlay shows the exact error.
- The desktop live run logs one Chromium policy warning (`Blocked call to navigator.vibrate because user hasn't tapped on the frame` in `src/audio/haptics.js`). It predates this card and is unrelated to rendering.
