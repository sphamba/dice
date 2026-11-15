# live-tester: project guidance for future agents of this role. The doctor rewrites this file after every run, keeping only durable, task-agnostic bullets (environment facts, recipes, shell traps, workflow tips). Never edit this file as the role agent.

## Scoping
- Read the task file first and record the acceptance scope. Cap planning: read the modules under test and their wiring once (one grep for the entry points settles what the app actually imports), then start the first executable probe. Put long derivations (impulse math, geometry, thresholds) into the reference script with asserts, never as in-head math; in-head derivations cause planning churn and errors.
- Before designing any harness, trace the feature's runtime data flow in the current branch: who produces and who consumes each state the feature needs. A dependency whose producer is not merged yet makes pipeline setups impossible; detect it by reading, design the harness to place or inject state directly, and record it in Notes as a test limit.

## Environment
- No global `playwright` package. Browser binaries live in `~/.cache/ms-playwright`; a usable package exists in other repos (e.g. `/home/phamba/repos/tarot/app/node_modules`). ESM `import` ignores `NODE_PATH`, so import Playwright by absolute path on first use; do not try `NODE_PATH` first.
- Headless Chromium (SwiftShader): WebGL2 contexts can drop after ~20 `readPixels` calls; rerun once on CONTEXT_LOST, keep readbacks few, and use `readPixels` values as evidence (screenshots come back blank).
- One-liners: pixel probe `convert shot.png[1x1+X+Y] txt:-` (ImageMagick installed, PIL is not); YAML check `python3 -c "import yaml,sys; yaml.safe_load(open(sys.argv[1]))" <file>`.
- Emulation is incomplete: dispatch synthetic events with instance properties set via `defineProperty` when init dicts are ignored; drive timing-bound checks with in-page synthetic events and controlled `timeStamp` (CDP input only proves arrival); override `navigator.maxTouchPoints` with `addInitScript` when a code branch gates on it; hardware-only paths go in Notes as limits, never pass/fail checks.

## Reference and harness
- Before writing expectations, run a tiny probe page in each planned context and print the facts the harness depends on (APIs, exported constants, event behavior, capture semantics). Build reference data from probe output, not from assumptions.
- Compute every non-trivial expected value with an independent Node reference script that writes one expected JSON the live test reads. The reference must model the full per-step pipeline in the code's order (forces, damping, integration, clamps), not only the effect under test; one omitted term (damping, a gravity sign) looks exactly like a product bug. Validate the reference against known closed forms.
- Define each scenario once as data with explicit fields (initial state, per-step resets, measurement flags, tolerances) and let both reference and driver consume that same schema; never hand-mirror scenario flags in two files.
- Reset every state field between measured steps (linear and angular velocity alike), assert at the exact step boundary the scenario defines, and keep expected values strictly inside pass regions (never exactly on a threshold).
- `node --check` every driver and reference script immediately after each write; rewrite the whole file instead of chaining edits when reordering; batched `edit` calls with overlapping regions are rejected whole.
- Before the first full run, smoke-test the driver's runtime path end to end (server up, one `page.evaluate` round trip, one helper at a real call site). Make `page.evaluate` callbacks `async` when they `await`.

## Drivers and runs
- A module the app does not import yet is still testable: serve the repo and `await import('/src/<path>.js')` in the page; capture console and page errors in the driver.
- Scope discipline everywhere: declare each variable in the function that uses it (implicit cross-function globals in Node drivers fail only at runtime, deep into a run); inside `page.evaluate`, attach shared values to `globalThis` or pass them as evaluate arguments, never close over Node scope.
- Run hygiene: set a page default timeout (15-20 s) so hangs fail fast; write output to a log file and tail it (never pipe a long run through `| tail`); print each check result as it completes; keep drivers compact and batch all contexts into one script.

## Servers and processes
- Serve with `python3 -m http.server <uncommon-port> -d <repo-dir>`; check the port is free first (`lsof -i:<port>`) and curl-check HTTP 200 for the harness and module URLs before browser work.
- Start servers detached (`setsid`) and curl-verify in the same command that launches each browser run; kill by port (`lsof -t -i:<port> | xargs -r kill`); never `pkill -f` a pattern that appears in your own command line; do not touch ports you did not start.

## Method
- When checks fail, print intermediate data (values, ids, diffs) before forming hypotheses; after more than two failed checks in one run, stop and batch-audit every failure, classifying each as driver bug, reference bug, or product bug; confirm a suspected product defect with an independent numeric script before filing.
- Persist measured numbers once (notes or a JSON file) and reuse them when writing cards; never re-derive from memory. File confirmed product defects as defect cards and open questions as question cards; state harness assumptions and test limits in the task notes.
- End of run: stop your servers and verify; get exact card filenames from `kanban_list` or `ls` of the kanban dir (task files are flat, `.kanban/NNNNNN_slug.md`; there is no `tasks/` subdir); `kanban_create` requires a `summary` field; persist notes with the kanban tool, then finish with a results table.
