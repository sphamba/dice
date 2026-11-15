# live-tester: project guidance for future agents of this role. The doctor rewrites this file after every run, keeping only durable, task-agnostic bullets (environment facts, recipes, shell traps, workflow tips). Never edit this file as the role agent.

## Environment (this machine)
- No global `playwright` npm package. Browser binaries live in `~/.cache/ms-playwright`; a usable package exists in other repos (e.g. `/home/phamba/repos/tarot/app/node_modules`). Probe once with `NODE_PATH=<dir> node -e "require('playwright')"` before writing any script; if it fails, fix the path once, never retry the same require.
- Headless Chromium WebGL2 (SwiftShader): the context can drop after ~20 `readPixels` calls; rerun once on CONTEXT_LOST and keep readbacks few. Canvas screenshots come back blank; treat `readPixels` assertions as the evidence, not the screenshot.
- ImageMagick (`convert`) and PyYAML are installed; PIL is not. Do not guess require paths inside foreign `node_modules`.

## Recipes
- Serve test pages with `python3 -m http.server <uncommon-port>` in the background, curl-check HTTP 200 before browser work, and capture console/page errors in the driver.
- Write browser scripts to `/tmp`, run with the probed `NODE_PATH`, use Chromium. Cover desktop, phone (device emulation), and fractional-DPR viewports plus resize in one script with batched checks.
- Compute every non-trivial expected value with an independent Node reference script, and write all expected values to a JSON file the live test reads. Expectations must have one source of truth; never inline or hand-round numeric literals into assertions while patching, because float drift at ~1e-8 turns into false failures.
- Multi-phase simulations must chain state: each phase continues from the previous phase's final state, identically in the reference script and the browser script. Before the first live run, diff the two scripts' initial conditions and phase sequence; a mismatch there poisons every downstream check.
- Read math-lib conventions (multiply order, column/row major, aliasing rules) from the source before writing expectations; assumed conventions produce cascading false failures.
- Keep numeric inputs inside documented preconditions (unit quaternions, proper rotations, non-zero states) and use tolerances that match storage precision (Float32 eps ~1e-6 per op).
- WebGL render-check isolation, in this order: (1) validate the test mesh (two non-degenerate triangles, plane and normal face the camera, winding matches culling), (2) draw it with an identity camera, (3) add view, projection, model one at a time, logging clip-space coords of a known point.
- One-liners: pixel color via `convert shot.png[1x1+X+Y] txt:-`; YAML via `python3 -c "import yaml,sys; yaml.safe_load(open(sys.argv[1]))" <file>`.

## Shell traps
- Never `pkill -f <pattern>` when the pattern appears in your own command line (self-kill, exit 143). Kill by port (`lsof -t -i:<port> | xargs -r kill`) and verify shutdown with a self-immune pattern (`pgrep -af "[h]ttp.server"`) before reporting cleanup done.

## Method
- Read the task file first. Record the task ID and acceptance scope at the start.
- Plan the whole live test before you run anything, then execute in one pass. Scope: real user flows end to end; skip the unit test suite unless the task asks for it (CI runs it).
- After the first run, if more than two checks fail, stop: batch-audit all your expectations numerically before the next run. Suspect the harness before the product, and confirm each suspect with a numeric script before changing product code or filing a defect.
- Before any rerun, do one completeness sweep so all fixes land in a single cycle: `node --check` every edited script, run the reference script end to end, and grep the live script for identifiers you removed or renamed (ReferenceErrors), leftover hardcoded values, and obsolete checks.
- Keep edits small and exact-match; if an edit fails to apply, re-read the target region and retry, do not guess the text.
- Do hard derivations in a script, not in your head; in-head algebra is slow and turns harness mistakes into false product bugs. Batch all version web searches into one round.
- End of run: stop servers and verify, persist notes with the kanban tool, then give the finish message with a results table. State assumptions and environment notes in the report. File no defect tasks when nothing is found.
