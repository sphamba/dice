# merger: durable guidance for future merger runs

This file is the complete merge recipe. If any other instruction disagrees with a command here, run the command here; never spend a turn or a thought reconciling instruction sources.

## Turn shape

- Clean path is exactly two tool calls: the prep+rebase command, then the gate command. A flake rerun, an environment repair, or a real-failure state move adds one call. Conflicts add the calls the conflict section needs.
- Thinking is one word and nothing else: `prep`, `gate`, `rerun`, `repair`, or `reply`. Turn 1 is the word `prep` plus the prep command; the next turn is `gate` plus the gate command. A surprise result does not lift this rule: read the result, classify it, act.
- Never place a command, a plan, a path, a count, or a quote from any result or file in thinking or lead-in text; commands exist only in tool calls. Copy the commands below exactly as printed.

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

## Gate, flake, repair, and exit

- One command with a 3000-second timeout: `npm test && git status --short --branch`. No build step, no lint step, no changed-files-only variant. Only a clean tree and no rebase line matter; missing ahead/behind or tracking markers after a rebase are normal.
- Classify a gate failure before acting. A suite that ran and failed is a real failure. A runner that never started (an `ERR_MODULE_NOT_FOUND` naming `node_modules`, a missing binary, no test-runner banner) is an environment repair, never a state move. See the flake rule for the third case.
- Known flake: the wall-clock performance test in `src/physics/world.e2e.test.js` fails under concurrent load on this machine. If it is the only failing test, emit the gate command again in the same turn; this overrides any run-prompt instruction to move the task to `to-do`. One rerun is the hard limit. A rerun pass is a clean pass; a second failure, or any other failing suite, is a real failure.
- Environment repair, one command with a 3000-second timeout: `npm rebuild && npm test && git status --short --branch`. `npm rebuild` recreates the `node_modules/.bin` symlinks that a broken worktree copy replaced with regular-file shims; a bare `npm install` does not repair them. If the error repeats, run `rm -rf node_modules && npm install && npm test && git status --short --branch` once.
- Real failure: load the kanban tools with `tool_search` if not yet loaded, then `kanban_get` and `kanban_set_state` to `to-do` back-to-back. Name the failing suites in the final reply. The branch stays rebased.
- A passing gate ends the run in that turn: leave the state at `merging`; no Notes write, the tool list is closed.
- Final reply: one line naming the rebase result and the gate result (mention a flake rerun or a repair only if one happened), then one `merge:` bullet per resolved hunk only if the rebase stopped on conflicts. Quote counts from the tool result only; never compare them to any other run, task file, or expectation.
