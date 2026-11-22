---
name: "fix: restore rendering on Android and show render errors on the page"
priority: "critical"
state: "to-merge"
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
## Review outcome: fixed

- All Spec changes verified in the diff and green: constant hull loop with count break and wrap ternary, insetPoint-based insetOffset (no dynamic local array, no `%` — none anywhere in shaders.js), guarded fwidth division, `alpha: false` with antialias untouched, try/catch + `error`/`unhandledrejection` listeners routed to one `#unsupported[role=alert]` overlay, all silent catches replaced with logged fallbacks, restore failure reported through `onError`.
- Findings list mapped every Spec bullet to diff or test evidence; the recorded assumptions (fatal creation failure replaces the panel, shared `#unsupported` element, uHull[20] sizing) are all stated and sound.
- One fix committed (4652e66): the failed-restore catch left `resources` pointing at dead pre-loss GL handles, and `draw()` (past its `isContextLost()` check after restore) kept issuing calls with them — contradicted the deliverable claim "keeps the old resources out of use". Now nulls `resources` so draw is inert; the restore-failure test gained an assertion that no framebuffer binds after a failed restore, A/B-verified against the pre-fix source.
- Evidence: `npx vitest run src/render src/ui` 54/54 (7 files); `npm test` 311/311 (27 files); `npm run build` green; probe — max shape vertex count is 20 (d12), so `uHull[20]` fits; glslangValidator ES 300: 8/8 sources compile, 5/5 pairs link, 0 failures.
- Deferred to the live-tester role: desktop headless render + forced-error overlay check, and the Android Chrome/Firefox manual check.
