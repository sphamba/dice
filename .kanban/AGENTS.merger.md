# merger: durable guidance for future merger runs

The run prompt owns the step order (read task, abort a stale rebase, clear context paths, rebase, resolve, test, report). This file owns merge mechanics and wins over the run prompt on them. The clean run is two tool calls; a flake rerun adds one.

## Turn and thinking discipline

- Two tool calls on the clean path: prep+rebase, then gate. A flake rerun or a real-failure state move adds one call. Conflicts add the calls the conflict section needs.
- If a thinking block appears, its whole content is one word: `prep`, `gate`, `rerun`, or `reply`. Banned in thinking and lead-in text: plans, restatements of the previous result, commands, paths, counts, quotes from this file or the run prompt.
- Copy the two commands below exactly as printed. Do not compose, restate, or re-derive them.
- Never spend thinking reconciling the run prompt with this file; every fallback is decided here.

## Prep and rebase (one command)

- One command, no read tool call, no lead-in: `git status --short --branch && git log --oneline -5 && awk '/^---$/{n++; next} n>=2' TASK.md && git update-index --no-skip-worktree -- AGENTS.md TASK.md 2>/dev/null; git restore --staged --worktree -- AGENTS.md TASK.md 2>/dev/null; git rebase main`. The `awk` prints the task body and covers the read step. A silent restore is success.
- Task numbers can disagree between the run prompt, the branch name, and the printed TASK.md. Never reconcile them; the printed body is the only merge content.
- "Up to date", "Fast-forwarded", and "Successfully rebased" are final clean results: no fetch, no history or merge-base inspection, no conflict pass. The next step is the gate call.
- If the chained rebase refuses because a rebase is in progress, run `git rebase --abort && git rebase main` as one command and move on. Any other rebase stop goes to the conflicts section.

## Conflicts (only when the rebase stops)

- In a rebase the sides invert: `--ours` is the base branch, `--theirs` is your commit. `git checkout --theirs <path>` keeps your side.
- Read the other side with `git blame -L <start>,<end> main -- <path>` and `git log --oneline -1 <sha>`. A subject suffix `(#NNN)` maps to `.kanban/0000NN_*.md`; read that task's Summary and Specs.
- Both sides fit: re-apply the other side by hand. They do not fit: keep your side and add one open question through `kanban_update` with `openQuestions`.
- Continue with `GIT_EDITOR=true git rebase --continue`. A rebase can stop once per replayed commit. On a sign failure, retry with `GIT_EDITOR=true git -c commit.gpgsign=false rebase --continue`.

## Gate, flake rerun, and exit

- One command with a 3000-second timeout: `npm test && git status --short --branch`. No build step, no lint step, no changed-files-only variant. Only a clean tree and no rebase line matter; missing ahead/behind or tracking markers after a rebase are normal.
- Known gate noise: the wall-clock performance test in `src/physics/world.e2e.test.js` fails under concurrent load on this machine. If it is the only failing test, emit the gate command again in the same turn; this overrides any run-prompt instruction to move the task to `to-do`. One rerun is the hard limit. A rerun pass is a clean pass; a second failure, or any other failing suite, is a real failure.
- Real failure: load the kanban tools with `tool_search` if not yet loaded, then `kanban_get` and `kanban_set_state` to `to-do` back-to-back. Name the failing suites in the final reply. The branch stays rebased.
- A passing gate ends the run in that turn: leave the state at `merging`; no Notes write, the tool list is closed.
- Final reply: one line naming the rebase result and the gate result (mention a flake rerun only if one happened), then one `merge:` bullet per resolved hunk only if the rebase stopped on conflicts. Quote counts from the tool result only; never compare them to any other run, task file, or expectation.
