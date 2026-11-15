# live-tester: project guidance for future agents of this role. The doctor rewrites this file after every run, keeping only durable, task-agnostic bullets (environment facts, recipes, shell traps, workflow tips). Never edit this file as the role agent.

## Scoping
- Read the task file first; record the task ID and acceptance scope. Plan the whole live test before running anything, then execute in one pass. Scope: real user flows end to end; skip the unit test suite unless the task asks for it (CI runs it). Get exact kanban card filenames from `kanban_list` (or ls of the kanban dir) before fetching; never guess slugs.
- Before designing any harness, trace the feature's runtime data flow end to end in the current branch: grep for who produces and who consumes each piece of state the feature needs (broadphase/collision output, event wiring, module singletons). A dependency whose producer is not wired yet (unfinished task) makes pipeline-based setups impossible; detect it by reading first, design the harness to place or inject state directly, and record it in Notes as a test limit.

## Environment
- No global `playwright` npm package. Browser binaries live in `~/.cache/ms-playwright`; a usable package exists in other repos (e.g. `/home/phamba/repos/tarot/app/node_modules`). ESM `import` ignores `NODE_PATH` (only CJS `require` honors it), so probe module resolution in the same style the driver uses, or import by absolute path into that node_modules dir. Probe once; if it fails, fix the path once, never retry the same require.
- Headless Chromium (SwiftShader): WebGL2 contexts can drop after ~20 `readPixels` calls; rerun once on CONTEXT_LOST, keep readbacks few, and use `readPixels` values as evidence (screenshots come back blank).
- ImageMagick (`convert`) and PyYAML are installed; PIL is not. One-liners: pixel color via `convert shot.png[1x1+X+Y] txt:-`; YAML check via `python3 -c "import yaml,sys; yaml.safe_load(open(sys.argv[1]))" <file>`.
- Emulation is incomplete: dispatch synthetic events with instance properties set via `defineProperty` when init dicts are ignored; hardware-only paths (real sensors, iOS permission dialogs) go in Notes as limits, never as pass/fail checks. `navigator.maxTouchPoints` is unreliable under device emulation; override it with `addInitScript` when a code branch gates on it.

## Browser probes
- Before writing any expectation, run a tiny probe page in each planned context and print the facts the harness will depend on (API existence, event behavior, capture semantics). Build reference data from probe output, not from assumptions about what emulation does.
- Timing-bound checks (velocity windows, dt-based decay) need in-page synthetic events with controlled `timeStamp`/`performance.now`; CDP-driven input has uncontrolled gaps. Reserve CDP/real-input paths for proving events arrive and wire up. CDP touch ids are not pointer event ids: read the actual `pointerId` values from recorded events instead of assuming the dispatched id.

## Reference and harness
- Compute every non-trivial expected value with an independent Node reference script that writes one expected JSON file the live test reads. Do all derivations there (geometry, heights, thresholds, movement distances) and assert they fit the constraints (viewport size, wall clamps, spawn bounds) before writing any harness code; in-head re-derivations cause planning churn. Read the module's exact API from source first and validate the reference against known closed forms; a wrong reference looks exactly like a product bug. Normalize negative zero before stringifying dedup keys.
- Multi-phase tests must chain state identically in reference and live scripts; reset sample buffers before each measured phase and scope analysis windows to exclude pre-phase transients; diff initial conditions and phase sequence before the first run.
- Structure every test script linearly: reference data and helpers first, then the check loop. `node --check` every driver and reference script immediately after each write; rewrite the whole file instead of chaining edits when reordering. Batched `edit` calls with overlapping regions are rejected whole: keep regions disjoint or rewrite the file.
- Before the first full run, smoke-test the driver's runtime path end to end in one context: server up, one `page.evaluate` round trip, one event dispatch, one helper call at a real call site. Syntax checks do not catch serialize-boundary or signature bugs.

## Drivers and runs
- A module the app does not import yet is still testable: serve the repo and `await import('/src/<path>.js')` in the page; capture console and page errors in the driver.
- Inside `page.evaluate` and init-script callbacks, declare every variable or attach it to `globalThis`; values from Node scope must be passed as evaluate arguments, never closed over (implicit globals throw only at runtime, deep into the run).
- Run hygiene: set a page default timeout (15-20 s) so hangs fail fast; write output to a log file and tail the file (never pipe a long run through `| tail` — buffering hides progress and hang location); print each check result as it completes so a mid-run crash keeps earlier evidence. Keep drivers compact and batch all contexts into one script; a smaller driver means cheaper rewrites when a defect forces one.

## Servers and processes
- Serve with `python3 -m http.server <uncommon-port> -d <repo-dir>`, check the port is free first (`lsof -i:<port>`), and curl-check HTTP 200 for the harness and module URLs before browser work.
- Background servers can die between bash calls: start them detached (`setsid`) and curl-verify in the same command that launches each browser run. Kill by port (`lsof -t -i:<port> | xargs -r kill`); never `pkill -f` a pattern that appears in your own command line. Do not investigate or kill servers on ports you did not start.

## Method
- When a check fails, print the intermediate data (values, ids, diffs) before forming hypotheses; after more than two failed checks in one run, stop and batch-audit every failure before the next run, classifying each as driver bug, reference bug, or product bug, and confirm a suspected product defect with an independent numeric script before filing.
- File only confirmed product defects as defect cards; open product questions as question cards. State harness assumptions and emulation limits in the task notes.
- End of run: stop your servers and verify, persist notes with the kanban tool, then give the finish message with a results table.
