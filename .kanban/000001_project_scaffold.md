---
name: "feat: project scaffold, Vite + Vitest, GitHub Pages deploy"
priority: "critical"
state: "backlog"
worktree: ""
issuer: "user"
complexity: "moderate"
shortName: "project-scaffold"
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
