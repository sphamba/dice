# Reviewer role guidance

- Read the task file first: Specs, Notes, and current state. Then check git once, inside the worktree: branch, `git diff <base>...HEAD --stat`, `git status`. Record the numbers; do not re-run these checks later.
- Tasks live in git worktrees under `.worktrees/<fix|feat>/<n>-<slug>`. The repo root is the main checkout. If the task does not name a base, diff `main...HEAD`.
- Repo layout: `src/main.js` wires the modules in `src/{audio,dice,input,math,physics,render,ui}`. Tests sit next to sources as `*.test.js`.
- Read every changed source and test file once, fully, before you judge anything. Truncated read output is display-only; continue with `offset`.
- Confirm the interfaces the change depends on (grep the defining file) once, early. Do not re-confirm them later.
- Worktree trap: the `node_modules/.bin` shims are often dereferenced copies that fail with `ERR_MODULE_NOT_FOUND`. Fix once with `ln -sf ../vitest/vitest.mjs node_modules/.bin/vitest && ln -sf ../vite/bin/vite.js node_modules/.bin/vite`, or bypass with `node node_modules/vitest/vitest.mjs run <paths>` and `node node_modules/vite/bin/vite.js build`. Do not inspect node_modules internals. This fix stays untracked; `node_modules` is gitignored.
- Run the scoped tests (`npx vitest run <changed test paths>`) and `npm run build`. There is no lint script. Record test counts and exit codes.
- To check math, write one numeric Node probe with `assert`. Design it in one pass before you write it: inputs, expected values, asserts. Derive the expected values independently of the reviewed code, and check cross-product and rotation signs (for example omega x r) before the first run.
- If a probe assert fails, suspect the probe's own formula first, fix once, and rerun. The passing result is final; never re-derive the same math in a later thinking pass.
- Node has no DOM or canvas. Never run browser-only code in a Node one-off; it throws "document is not defined". Review such code by reading it. Strip dead code from a probe; a loop or check that asserts nothing is wasted time.
- To find a field, read the file that uses it. A failed grep on guessed names costs a second command.
- Shell trap: quote `sed` ranges, as in `sed -n '50,70p'`. A malformed range prints nothing and costs a retry.
- Cap yourself at two review passes: one after reading all files, one final. An item with a passing assert, test, or build counts as settled. Do not open a third pass.
- Verdicts: "approved" needs no kanban state change, only notes. "Changes requested" is the only verdict that moves the state. Read the kanban tool docs once if unsure, not repeatedly.
- Write kanban notes once, at the end, after the verdict and the probe result are final. Do not write preliminary notes.
- Notes format: a condensed rewrite of the Notes section, plus one short guidance line for future reviewers. List accepted developer-documented interpretations as accepted.
- Do not fix code or commit. Record findings and stop. The `node_modules` symlink repair above is the only allowed untracked fix.
- Defer visual and runtime-only checks (live GL, feel, sound) to the live-tester role; note them as deferred.
