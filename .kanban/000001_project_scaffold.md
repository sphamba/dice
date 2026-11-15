---
name: "feat: project scaffold, Vite + Vitest, GitHub Pages deploy"
priority: "critical"
state: "done"
worktree: "feat/1-project-scaffold"
issuer: "user"
complexity: "moderate"
shortName: "project-scaffold"
map: "{\"files\":[{\"path\":\".github/workflows/pages.yml\",\"symbols\":[{\"name\":\"build\",\"kind\":\"fn\",\"ins\":20,\"del\":0,\"isNew\":true},{\"name\":\"deploy\",\"kind\":\"fn\",\"ins\":10,\"del\":0,\"isNew\":true}]},{\"path\":\".gitignore\",\"symbols\":[]},{\"path\":\"README.md\",\"symbols\":[]},{\"path\":\"index.html\",\"symbols\":[]},{\"path\":\"package-lock.json\",\"symbols\":[]},{\"path\":\"package.json\",\"symbols\":[]},{\"path\":\"src/audio/.gitkeep\",\"symbols\":[]},{\"path\":\"src/dice/.gitkeep\",\"symbols\":[]},{\"path\":\"src/input/.gitkeep\",\"symbols\":[]},{\"path\":\"src/main.js\",\"symbols\":[{\"name\":\"resize\",\"kind\":\"fn\",\"ins\":11,\"del\":0,\"isNew\":true}]},{\"path\":\"src/math/.gitkeep\",\"symbols\":[]},{\"path\":\"src/physics/.gitkeep\",\"symbols\":[]},{\"path\":\"src/render/canvas-size.js\",\"symbols\":[{\"name\":\"backingSize\",\"kind\":\"fn\",\"ins\":7,\"del\":0,\"isNew\":true}]},{\"path\":\"src/render/canvas-size.test.js\",\"symbols\":[{\"name\":\"keeps the CSS size at device pixel ratio 1\",\"kind\":\"case\",\"ins\":3,\"del\":0,\"isNew\":true},{\"name\":\"scales the backing store by the device pixel ratio\",\"kind\":\"case\",\"ins\":3,\"del\":0,\"isNew\":true},{\"name\":\"caps the ratio at 2\",\"kind\":\"case\",\"ins\":3,\"del\":0,\"isNew\":true},{\"name\":\"falls back to ratio 1 for a missing or invalid ratio\",\"kind\":\"case\",\"ins\":4,\"del\":0,\"isNew\":true},{\"name\":\"never returns a zero dimension\",\"kind\":\"case\",\"ins\":3,\"del\":0,\"isNew\":true},{\"name\":\"rounds fractional sizes\",\"kind\":\"case\",\"ins\":3,\"del\":0,\"isNew\":true}]},{\"path\":\"src/style.css\",\"symbols\":[]},{\"path\":\"src/ui/.gitkeep\",\"symbols\":[]},{\"path\":\"vite.config.js\",\"symbols\":[]}],\"flows\":[],\"role\":\"developer\",\"run\":0,\"model\":\"DeepSeek V4.1 Flash\",\"at\":\"2026-11-15T17:22:32.236Z\",\"head\":\"49b0306\"}"
changes: "{\"base\":\"main\",\"ins\":1321,\"del\":0,\"files\":17}"
commits: "[{\"hash\":\"49b0306\",\"subject\":\"ci: deploy to GitHub Pages on push to main\",\"when\":\"2026-11-15T18:19:36+01:00\"},{\"hash\":\"f8cd418\",\"subject\":\"feat: add Vite scaffold with WebGL2 canvas and Vitest setup\",\"when\":\"2026-11-15T18:18:35+01:00\"}]"
---

# Summary
Set up the repo as a vanilla HTML/CSS/JS app (no framework, no runtime dependencies) with Vite for the dev server with live reload, Vitest for unit tests, the source directory structure, a full-screen mobile-friendly WebGL2 canvas, and a GitHub Actions workflow that deploys to GitHub Pages.

# Specs
## Goal
A dice simulator that runs in the browser (phone and desktop). This task makes only the base that all other tasks build on.

## Constraints
- App code: vanilla HTML, CSS, JavaScript ES modules. No framework. No runtime dependencies.
- devDependencies: `vite` and `vitest` only (current major versions). Commit `package-lock.json` (the Pages workflow uses `npm ci`).
- Node 24 is the target.

## Files to create
- `package.json`: `"type": "module"`, `"private": true`, scripts:
  - `dev`: `vite` (dev server with live reload)
  - `build`: `vite build` (output `dist/`)
  - `preview`: `vite preview`
  - `test`: `vitest run --passWithNoTests`
- `vite.config.js`: `base: './'` (the site must work under any GitHub Pages sub-path), Vitest `test.environment: 'node'`, test files `src/**/*.test.js`.
- `.gitignore`: `node_modules/`, `dist/`.
- `index.html`: `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`, `<meta name="theme-color">`, a `<canvas id="view">` that fills the viewport, a `<div id="ui">` overlay container (empty for now), loads `src/main.js` as module and `src/style.css`.
- `src/style.css`: html/body margin 0, `overflow: hidden`, canvas `position: fixed; inset: 0; width: 100dvw; height: 100dvh; touch-action: none; display: block`. Disable text selection, tap highlight and overscroll (`overscroll-behavior: none`) on the page.
- `src/main.js`: get a `webgl2` context from `#view`. If WebGL2 is not available, show a readable message in the page ("WebGL2 is not supported by this browser") instead of a blank screen. Otherwise size the canvas backing store to CSS size × min(devicePixelRatio, 2), clear to a neutral color, and redo this on `resize`.
- Empty directories with the final layout (each gets its modules from later tasks, use `.gitkeep` only where a directory has no file yet):
  - `src/math/` (vec3, mat4, quat)
  - `src/physics/` (rigid body, symplectic Euler integrator, world/box, collision, impulse solver)
  - `src/dice/` (polyhedron shapes, face labels)
  - `src/render/` (WebGL2 renderer)
  - `src/input/` (pointer fling, device motion)
  - `src/ui/` (dice set panel)
  - `src/audio/` (synthesized sound, haptics)
- `.github/workflows/pages.yml`: on push to `main` and `workflow_dispatch`. Permissions `contents: read`, `pages: write`, `id-token: write`. Concurrency group `pages`. Job build: checkout, `actions/setup-node` (Node 24, npm cache), `npm ci`, `npm test`, `npm run build`, `actions/configure-pages`, `actions/upload-pages-artifact` with path `dist`. Job deploy: `actions/deploy-pages`, environment `github-pages`. Use the current major versions of these actions (check the docs).
- `README.md`: one short paragraph on what the app is, the commands (`npm ci`, `npm run dev`, `npm test`, `npm run build`), the directory layout above with one line per directory, and one line that says Pages must use "GitHub Actions" as source in the repo settings.

## Acceptance criteria
- `npm ci && npm test && npm run build` exits 0.
- `test -f dist/index.html && grep -q './assets/' dist/index.html` exits 0 (relative asset paths).
- `npm run dev` serves the page. In a browser the canvas fills the screen with no scroll bars on desktop and phone sizes.
- `test -f .github/workflows/pages.yml` exits 0.

# Notes
# Notes (live test)

## Result
All specced flows pass. No defects filed. 41 browser/CLI checks, 0 failures.

## What was tested (user flows, from cwd)
- Clean user flow: removed `node_modules/` and `dist/`, then `npm ci` and `npm run build`. Both exit 0. `dist/index.html` exists and references `./assets/index-*.js` and `./assets/index-*.css` (relative paths). `.github/workflows/pages.yml` exists. (`npm test` not run; unit suites are out of scope for the live test, CI runs them.)
- `npm run dev` (port 5199) served the page. Headless Chromium, desktop 1280x800 dpr 1: canvas fills the viewport exactly (0,0), no scrollbars (`overflow: hidden` on html and body, scroll extents 1280x800), backing store 1280x800, clear colour srgb(20,21,26) sampled from a screenshot, touch-action none, viewport meta with `viewport-fit=cover`, theme-color #14151a, `#ui` overlay present and empty, no console errors. Vite HMR client present (live reload wired).
- Resize on the desktop page: set viewport to 1000x600 then 823x500; the backing store followed to exactly those sizes each time.
- Phone emulation 390x844, dpr 3, touch: no scrollbars, canvas 390x844 CSS, backing store 780x1688 (dpr capped at 2), tap on canvas raises no errors, no console errors.
- Fractional dpr: 640x400 at dpr 1.25 gave backing store 800x500 (rounded CSS x dpr), no scrollbars.
- WebGL2 not available: message "WebGL2 is not supported by this browser" shows in the page, no page errors, clear colour still paints behind it.
- `npm run preview` (port 5299): production build serves, canvas renders 1280x800 at dpr 2 (backing 2560x1600), no failed requests, no console errors.
- GitHub Pages sub-path simulation: served `dist/` under `/dice/` with a static server; page loads, all asset requests resolve relative to the sub-path, canvas renders, no errors. This validates `base: './'` for Pages project sites.
- Workflow: YAML parses; triggers push to `main` + `workflow_dispatch`, permissions `contents: read` / `pages: write` / `id-token: write`, concurrency group `pages`, build job (checkout, setup-node Node 24 with npm cache, `npm ci`, `npm test`, `npm run build`, configure-pages, upload-pages-artifact path `dist`), deploy job with `deploy-pages` and `github-pages` environment. Action majors confirmed current via release pages: checkout@v7, setup-node@v7, configure-pages@v6, upload-pages-artifact@v5, deploy-pages@v5.
- README has the app paragraph, the four commands, one line per `src/` directory, and the "Pages source = GitHub Actions" note.

## Assumptions made while designing the tests
- `npm test` (Vitest) was excluded from the live test per the live-tester rule, although it is in the task's acceptance criteria; the Pages workflow runs it in CI.
- Live reload verified by confirming the Vite HMR client is injected and loaded in the page, not by editing a source file (no code edits allowed during live test).
- The WebGL2-unavailable path was tested by overriding `HTMLCanvasElement.prototype.getContext` so `webgl2` returns null in Chromium; no real WebGL2-less browser was available.
- The Pages deploy workflow cannot run locally; verified by file inspection, YAML parse, and a web check of the action release tags.
- The Pages sub-path case was simulated with a static server serving `dist/` under `/dice/`; the real workflow builds at the repo root and publishes the same artifact.
- Phone behaviour was tested with Playwright device emulation (390x844, dpr 3, touch), not on real hardware.

## Environment problems (not defects in this change)
- Playwright is not installed globally or in this repo. Tests borrowed it from `/home/phamba/repos/tarot/app/node_modules` via NODE_PATH. Install playwright (or add it to a shared location) if future live tests need a browser.

## Contradictions with the task's stated assumptions
None observed. `package.json` pins `vite ^8.3.6` / `vitest ^5.1.0` as the Notes assume, and npm ci resolved without issues on Node 24.22.1.

