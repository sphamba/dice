# live-tester: project guidance for future agents of this role. The doctor rewrites this file after every run, keeping only durable, task-agnostic bullets (environment facts, recipes, shell traps, workflow tips). Never edit this file as the role agent.

## Environment (this machine)
- No global `playwright` npm package. Browser binaries live in `~/.cache/ms-playwright`. A usable package exists in other repos (e.g. `/home/phamba/repos/tarot/app/node_modules`). Run browser scripts with `NODE_PATH=<that dir> node script.js`.
- PyYAML and ImageMagick (`convert`) are installed. PIL is not. Do not guess `js-yaml` or other require paths in foreign `node_modules`.
- Probe each module before you write a long script: `NODE_PATH=<dir> node -e "require('playwright'); console.log('ok')"`. If a probe fails, fix the resolution path once; never retry the same require.

## Recipes
- Headless browser tests: write scripts to `/tmp`, run with the probed `NODE_PATH`, use Chromium. Cover desktop, phone (device emulation), and fractional-DPR viewports, plus resize, in one script with batched checks.
- Compute expected values numerically with a throwaway Node script (independent formula or reference implementation), not by hand. Hand-derive only trivial cases (identity, axis-aligned 90-degree rotations). In-head algebra is slow, error-prone, and turns harness mistakes into false product bugs.
- For numeric modules, keep test inputs inside documented preconditions (unit axes, proper rotation matrices, non-zero initial states) and compare with tolerances that match storage precision (Float32 eps ~1e-6 per op; error accumulates over repeated steps). Out-of-precondition inputs cause false failures.
- Pixel color check on a screenshot: `convert shot.png[1x1+X+Y] txt:-`. Not PIL.
- Workflow YAML check: `python3 -c "import yaml,sys; yaml.safe_load(open(sys.argv[1])); print('ok')" <file>`.
- Sub-path deploy simulation: copy `dist` under a fake path (e.g. `/tmp/pages-sim/<name>`), serve with `python3 -m http.server <port>`, then run the browser checks against `<base>/index.html`.
- Background servers: `nohup <cmd> & echo $! > /tmp/<name>.pid`, then read the log after a short sleep. Pick uncommon ports. Curl-check HTTP 200 before browser work.

## Shell traps
- Never `pkill -f <pattern>` when the pattern appears in your own command line. The bash tool wraps your command, so pkill kills your own process (exit 143). Kill by pidfile or by port: `lsof -t -i:<port> | xargs -r kill`.
- Verify shutdown with a listing whose pattern cannot match itself (e.g. `pgrep -af "[v]ite"`), before you report cleanup done.

## Method
- Read the task file first. Record the task ID and acceptance scope at the start; you need them for the report, not at the end.
- Plan the whole live test before you run anything, then execute in one pass.
- Scope: exercise real user flows end to end. Skip the unit test suite unless the task asks for it; CI runs it.
- When several checks fail at once, suspect the harness before the product: audit test inputs and expected constants first. Confirm each suspect expectation with a numeric script before you change product code or file a defect.
- Batch all version web searches (all actions and libraries at once) into one round. Do not re-verify a version you already confirmed.
- State assumptions and environment notes in the report. File no defect tasks when nothing is found.
- End of run: stop servers by pidfile or port, persist notes with the kanban tool, then give the finish message with a results table.
