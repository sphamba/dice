# live-tester: project guidance for future agents of this role. The doctor rewrites this file after every run, keeping only durable, task-agnostic bullets (environment facts, recipes, shell traps, workflow tips). Never edit this file as the role agent.

## Environment (this machine)
- No global `playwright` npm package. Browser binaries live in `~/.cache/ms-playwright`. A usable package exists in other repos (e.g. `/home/phamba/repos/tarot/app/node_modules`). Run browser scripts with `NODE_PATH=<that dir> node script.js`.
- Probe module resolution before writing long scripts: `NODE_PATH=<dir> node -e "require('playwright')"`. If it fails, fix the path once; never retry the same require.
- ImageMagick (`convert`) and PyYAML are installed. PIL is not. Do not guess require paths in foreign `node_modules`.
- Headless Chromium WebGL2 quirks: the context can drop after ~20 `readPixels` calls (SwiftShader flake; rerun once on CONTEXT_LOST and keep readbacks few). Canvas screenshots come back blank; treat `readPixels` assertions as the evidence, not the screenshot.

## Recipes
- Headless browser tests: write scripts to `/tmp`, run with the probed `NODE_PATH`, use Chromium. Cover desktop, phone (device emulation), and fractional-DPR viewports, plus resize, in one script with batched checks.
- Serve test pages with `python3 -m http.server <uncommon-port>` in the background, curl-check HTTP 200 before browser work, and capture console/page errors in the driver.
- Compute every non-trivial expected value with a throwaway Node reference script (independent formula or reference implementation). Hand-derive only identity and axis-aligned cases. In-head algebra is slow and turns harness mistakes into false product bugs.
- WebGL math libs (gl-matrix style) are column-major, `out`-first, with documented aliasing rules. Read multiply order and aliasing semantics from the source before writing expectations; assumed conventions produce cascading false failures.
- Keep numeric inputs inside documented preconditions (unit quaternions, proper rotations, non-zero states) and use tolerances that match storage precision (Float32 eps ~1e-6 per op).
- Render-check isolation, in this order: (1) validate the test mesh (vertex order gives two non-degenerate triangles; the plane and normal face the camera; winding matches culling), (2) draw it with an identity camera, (3) add view, projection, model one at a time, logging clip-space coords of a known point. Correct matrices with blank pixels almost always mean geometry or scene-setup error.
- Run `node --check <script>` after every edit of a test script, before executing it.
- Pixel color check on a screenshot: `convert shot.png[1x1+X+Y] txt:-`. Workflow YAML check: `python3 -c "import yaml,sys; yaml.safe_load(open(sys.argv[1]))" <file>`.

## Shell traps
- Never `pkill -f <pattern>` when the pattern appears in your own command line (self-kill, exit 143). Prefer kill-by-port: `lsof -t -i:<port> | xargs -r kill`. Pidfile kills can silently miss; verify shutdown with a self-immune pattern (`pgrep -af "[h]ttp.server"`) before you report cleanup done.

## Method
- Read the task file first. Record the task ID and acceptance scope at the start.
- Plan the whole live test before you run anything, then execute in one pass. Scope: real user flows end to end; skip the unit test suite unless the task asks for it (CI runs it).
- After the first run, if more than two checks fail, stop: batch-audit all your expectations numerically before the next run. Patch expectations in one pass; do not burn one run cycle per failure.
- Suspect the harness before the product. Confirm each suspect expectation with a numeric script before you change product code or file a defect.
- Batch all version web searches into one round.
- End of run: stop servers and verify, persist notes with the kanban tool, then give the finish message with a results table. State assumptions and environment notes in the report. File no defect tasks when nothing is found.
