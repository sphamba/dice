# live-tester: project guidance for future agents of this role. The doctor rewrites this file after every run, keeping only durable, task-agnostic bullets (environment facts, recipes, shell traps, workflow tips). Never edit this file as the role agent.

## Environment
- No global `playwright` npm package. Browser binaries live in `~/.cache/ms-playwright`; a usable package exists in other repos (e.g. `/home/phamba/repos/tarot/app/node_modules`). Probe once with `NODE_PATH=<dir> node -e "require('playwright')"`; if the probe fails, fix the path once, never retry the same require.
- Headless Chromium (SwiftShader): WebGL2 contexts can drop after ~20 `readPixels` calls; rerun once on CONTEXT_LOST, keep readbacks few, and use `readPixels` values as evidence (screenshots come back blank). Emulation caps: spoof `navigator.maxTouchPoints` via `addInitScript` before page load, dispatch synthetic `DeviceMotionEvent`s (set instance properties with `defineProperty` if the init dict is ignored); hardware-only paths (iOS permission dialogs, real sensors, `screen.orientation.angle`) go in Notes as limits.
- ImageMagick (`convert`) and PyYAML are installed; PIL is not. One-liners: pixel color via `convert shot.png[1x1+X+Y] txt:-`; YAML check via `python3 -c "import yaml,sys; yaml.safe_load(open(sys.argv[1]))" <file>`.

## Test scripts
- Structure every test script linearly: build all reference data and helpers first, then run the check loop. Referencing consts defined later is a TDZ crash. When a script needs reordering, or accumulated patches have scattered fixes through it, rewrite the whole file instead of chaining edits.
- Compute every non-trivial expected value with an independent Node reference script; write expected values to one JSON file the live test reads. Validate the reference against known closed forms before using it to judge the product; a wrong reference looks exactly like a product bug.
- Read the module's exact API and the math-lib conventions (argument and return shapes, multiply order, sign rules, rounding) from source before writing expectations. Shape mismatches give all-zero or all-undefined results that look like product defects.
- Do hard derivations in a script, not in your head. When a check fails, print the intermediate data (keys, candidates, diffs) before forming hypotheses; cycling theories without data is the slowest path to a diagnosis.
- Multi-phase tests must chain state identically in reference and live scripts; diff initial conditions and phase sequence before the first run. Keep numeric inputs inside documented preconditions and match tolerances to storage precision (Float32 eps ~1e-6 per op).

## Reference math for geometry checks
- Canonicalize floating-point dedup keys: negative zero makes `toFixed` strings differ (`-0.000000000` vs `0.000000000`), so normalize each component with `x + 0`, or key by a rounded tolerance bucket, before stringifying.
- Generated candidate sets (sign flips, axis permutations, orbits) overlap; dedupe by key and sanity-check counts before use. Prefer generic enumeration (vertex tuples with tolerance-based supporting-plane tests) over clever assumptions (duals, orientations); verify any clever assumption numerically before building on it.
- To extract polygon edges, sort face vertices by angle around the face normal (CCW for outward normals), then walk consecutive pairs and dedupe undirected edges; walking discovery or index order yields chords, not edges.

## Browser flow
- A module the app does not import yet is still testable: serve the repo, `await import('/src/<path>.js')` in the page, drive it, and capture console/page errors in the driver. Write drivers to `/tmp`, run with the probed `NODE_PATH` and Chromium, and batch device emulation (desktop/phone/tablet) and checks into one script.
- Inside `page.evaluate` and init-script callbacks, declare every variable or attach it to `globalThis` (`globalThis.__state = 0`); implicit globals throw ReferenceErrors only at runtime, after the script is long.
- WebGL render-check isolation, in order: validate the test mesh (non-degenerate, plane and winding face the camera), draw with an identity camera, then add view, projection, model one at a time, logging clip-space coords of a known point.

## Servers and processes
- Serve with `python3 -m http.server <uncommon-port> -d <repo-dir>` so the directory is explicit, check the port is free first (`lsof -i:<port>`), curl-check HTTP 200 for the module URL before browser work, and record the PID and port you started.
- Never `pkill -f <pattern>` when the pattern appears in your own command line (self-kill, exit 143). Kill by port (`lsof -t -i:<port> | xargs -r kill`) and verify with a self-immune pattern (`pgrep -af "[h]ttp.server"`). Do not investigate or kill servers on ports you did not start.

## Method
- Read the task file first; record the task ID and acceptance scope. Plan the whole live test before running anything, then execute in one pass. Scope: real user flows end to end; skip the unit test suite unless the task asks for it (CI runs it).
- After a run with more than two failed checks, stop and batch-audit every failure before the next run: classify each as harness bug, reference bug, or product bug, and confirm with a numeric script. Only a confirmed product defect becomes a filed task.
- Before any rerun, do one completeness sweep so all fixes land in a single cycle: `node --check` every edited script, run the reference script end to end, and grep the live script for removed or renamed identifiers, leftover literals, and obsolete checks.
- End of run: stop your servers and verify, persist notes with the kanban tool, then give the finish message with a results table. State assumptions and environment limits in the report. File no defect tasks when nothing is found.
