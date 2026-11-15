# live-tester: project guidance for future agents of this role. The doctor rewrites this file after every run, keeping only durable, task-agnostic bullets. Never edit this file as the role agent.

## Scoping
- Read the task file first and record the acceptance scope, then make one inspection pass and stop planning: grep entry points, read the modules under test, run one `git log --oneline -10`, and batch toolchain checks (Playwright import test, free-port check) into the same pass. Write the driver as soon as scope and imports are clear. Probe output settles design questions faster than deliberation; do not re-plan the same harness across several thinking cycles.
- Before designing the harness, trace the feature's runtime data flow: who produces and consumes each state it needs. If a producer is not merged yet, place or inject the state directly and record it in Notes as a test limit. Trust the repo state over the task prose; note mismatches in Notes and move on.

## Environment
- No global `playwright` package; browser binaries live in `~/.cache/ms-playwright`. A usable package exists in other repos (e.g. `/home/phamba/repos/tarot/app/node_modules`). ESM `import` ignores `NODE_PATH`; import Playwright by absolute path on first use. Verify with a real ESM dynamic import (`node -e "import('<abs path>').then(()=>console.log('ok'))"`); a require-based check can pass while the ESM import fails.
- Serve with `python3 -m http.server <uncommon-port> -d <repo-dir>` for plain ES modules, or the repo's dev server (`npx vite --port <port>`) when the app needs bundler behavior. Check the port is free (`lsof -i:<port>`) and curl-check HTTP 200 for the page and module URLs before browser work. Start servers detached (`setsid`); kill by port (`lsof -t -i:<port> | xargs -r kill`); never `pkill -f` a pattern that appears in your own command line; do not touch ports you did not start.
- Headless Chromium (SwiftShader): WebGL2 contexts can drop after ~20 `readPixels` calls; rerun once on CONTEXT_LOST, keep readbacks few, and use pixel values as evidence (screenshots can come back blank); pixel probe `convert shot.png[1x1+X+Y] txt:-` (ImageMagick is installed, PIL is not). Emulation is incomplete: dispatch synthetic events with instance properties set via `defineProperty`, drive timing-bound checks with controlled `timeStamp`, and override `navigator.maxTouchPoints` with `addInitScript` when a code branch gates on it. Hardware-only paths go in Notes as limits, never as pass/fail checks.

## Scripts
- Grep the `export` lines of every module a script imports and copy the exact names before writing it; do not assume which module owns a function (a wrong-module import costs a full browser run). For inspection of large modules, grep or offset-read the region under test instead of a full read; a truncated read leaves blind spots that surface as mid-run hedging.
- Compute every non-trivial expected value with an independent Node reference script that writes one expected JSON the driver reads. Model the full pipeline in the code's order, not only the effect under test, and validate the reference against known closed forms.
- Never write an unfinished or speculative file. Complete every section before `write`, run `node --check` immediately after each write, and rewrite the whole file instead of chaining edits when the structure changes.

## In-page code and drivers
- `page.evaluate` accepts serializable data only. Make callbacks `async` when they `await`; share values through `globalThis` or evaluate arguments; never close over Node scope. Declare each variable in the function that uses it; implicit globals fail only deep into a run.
- A module the app does not import yet is still testable: serve the repo and `await import('/src/<path>.js')` in the page; capture console and page errors in the driver.
- Run hygiene: smoke-test the driver end to end before the first full run; write output to a log file and tail it (never pipe a long run through `| tail`); print each check as it completes; set a page default timeout (15-20 s); batch all contexts into one script. Keep the todo list to 3-5 items and batch status updates.

## Scenario design
- Define each scenario once as data (initial state, per-step resets, measurement flags, tolerances) and let reference and driver consume the same schema. Reset every state field between measured steps, assert at the exact step boundary the scenario defines, and keep expected values strictly inside pass regions.
- Keep test objects inside bounded geometry at all times. An object outside a bounded region makes infinite planes report penetration and turns a harness mistake into a false product failure.

## Failure diagnosis
- When one check fails while sibling checks pass, suspect the check first: re-read its guard conditions and its scenario before forming product hypotheses. Most single-check failures are harness bugs.
- After more than two failed checks in one run, stop and batch-audit every failure. Classify each as driver bug, reference bug, or product bug. Confirm a suspected product defect with an independent numeric script before filing.
- When numeric behavior resists two hypotheses, or a value is off by orders of magnitude, stop deriving arithmetic in-head: write a trace or bisect script that calls the stage functions directly and prints intermediates, and grep existing tests for the unit convention first.
- Time-box anomalies. A failure that does not block acceptance gets at most two probes; then file a defect or open-question card, relax or annotate the check with the finding, and move on.

## Wrap-up
- Persist measured numbers once (notes or a JSON file) and reuse them when writing cards. File confirmed product defects as defect cards and open questions as question cards; state harness assumptions and test limits in the task notes.
- Draft task Notes in one clean pass and scan for duplicated lines before posting; a rewrite after posting costs a second tool call.
- End of run: stop your servers and verify; get exact card filenames from `ls` of the kanban dir (task files are flat, `.kanban/NNNNNN_slug.md`; there is no `tasks/` subdir; `kanban_list` state scopes can return cards in other states); `kanban_create` requires a `summary` field; finish with a results table.
