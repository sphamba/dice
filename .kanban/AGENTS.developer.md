# developer: project guidance for future agents of this role. The doctor rewrites this file after every run, keeping only durable, task-agnostic bullets (repo structure, build/test tips). Never edit this file as the role agent.

- Stack: Vite + Vitest, ESM (`"type": "module"`). Scripts: `npm run dev`, `npm run build`, `npm test` (= `vitest run --passWithNoTests`). Tests sit next to sources as `src/**/*.test.js`; Vite and Vitest share `vite.config.js` (relative `base`, node test env).
- Tasks run in git worktrees under `.worktrees/<branch>`; `main` is the default branch. Give empty scaffold dirs a `.gitkeep` file.
- Fresh worktrees have no `node_modules`. Run `npm ci` before the first test or build run there. "Cannot find module vite/vitest" at startup means a missing install, not broken code; install and rerun, do not diagnose further.
- npm trap: `~/.npmrc` sets `min-release-age=7` and `ignore-scripts=true`. Versions younger than about a week are invisible to resolution and can hang `npm install` in a retry loop. Before picking version floors, check `npm view <pkg> time` and choose floors at least 7 days old.
- First install of new dependencies: cap the timeout at 120-300 s and redirect output to a file (`npm install --loglevel=http > /tmp/npm.log 2>&1`). Never run a bare install against a long timeout. On failure, read the log and `cat ~/.npmrc` before any retry.
- Verify failure hypotheses with cheap metadata (`npm view`, config files, `npm ping`) instead of retrying the failing command blind.
- Commit the lockfile; `npm ci` needs it. Commit incrementally per logical unit. Never commit TASK.md, AGENTS.md, or `.kanban/`.
- Clean-room acceptance before finishing: `git archive HEAD | tar -x -C /tmp/check`, then run `npm ci && npm test && npm run build` in the copy. This validates the committed tree without touching the worktree's `node_modules`.
- After a build, confirm `dist/index.html` references relative asset paths.
- actionlint is not installed. Validate workflow YAML with `python3 -c "import yaml,sys; yaml.safe_load(open(sys.argv[1]))" <file>`. Verify GitHub Action majors against their release tags, not memory. Reuse and update the existing workflow in `.github/workflows/` when one exists.
- Delegate browser checks to a subagent: dev server on an uncommon port, desktop plus mobile viewports, console error scan, and concrete layout or rendering assertions. Require the subagent to kill the server and leave the repo clean.
- While a background subagent runs, do unrelated local work. Block on `get_subagent_result` only when truly blocked; do not poll. Never let two agents run npm or git commands in the same worktree at the same time.
- For pure logic, go test-first: write the test, run to red, implement, run to green.
- In test files, import only modules the task spec lists or the repo already contains. Confirm every import path resolves before running the suite.
- For formula-dense code (matrix math, projections, physics), transcribe from one known-good reference in a single pass and let the test suite verify. Do not re-read your own output to re-derive formulas; trust the tests.
- Load kanban tools via tool_search ("kanban"). Record assumptions, versions chosen, and verification results on the task card at the end.
- Shell trap: `ls` or `cat` on missing paths exits non-zero and prints to stderr; treat this as noise, not failure. Use `ls -a` to confirm dotfiles such as `.gitkeep`.
