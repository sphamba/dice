# merger: durable guidance for future merger runs

The run prompt owns the step order (read task, abort a stale rebase, clear context paths, rebase, resolve, test, report). This file removes waste from that path and resolves conflicts with the run prompt: on merge mechanics this file wins, and the run prompt's numbered steps map onto the two commands below, not onto separate tool calls. The clean run is two tool calls; a flaky-gate rerun adds one.

## Turn and thinking discipline

- The whole run is two tool calls on the clean path: prep+rebase, then gate. Each turn may open with one thinking clause that names the step (`prep`, `gate`, `rerun`). That is the full budget.
- Thinking never holds plans, quoted commands, quoted results, counts, fallback derivations, or text from this file or the run prompt. The commands below are final: copy them into the tool call as printed. Do not compose, restate, or re-derive them.
- When a tool result matches an outcome below, emit the next tool call in the same turn. The call is the analysis; do not restate the result first.
- Lead-in text before a tool call: none. If one is emitted anyway, it names only the next step in at most five words and never quotes results, numbers, or paths.
- This file wins over the run prompt on merge mechanics. Never spend thinking reconciling instruction sources; the mapping and all fallbacks are already decided here.

## Prep and rebase (one command)

- Never open TASK.md with the read tool: the `awk` inside the prep command prints the task body and covers the run prompt's read step. Go straight to the prep command with no deliberation.
- Run prep and rebase as one command: `git status --short --branch && git log --oneline -5 && awk '/^---$/{n++; next} n>=2' TASK.md && git update-index --no-skip-worktree -- AGENTS.md TASK.md 2>/dev/null; git restore --staged --worktree -- AGENTS.md TASK.md 2>/dev/null; git rebase main`. Judge branch state from the printed status; a silent restore is success.
- Task numbers can disagree between the run prompt, the branch name, and the printed TASK.md. Never reconcile them; the printed body is the only merge content.
- If the chained rebase refuses because a rebase is in progress, run `git rebase --abort && git rebase main` as one command and move on. Any other rebase stop goes to the conflicts section.
- "Up to date", "Fast-forwarded", and "Successfully rebased" are final clean results: no fetch, no history or merge-base inspection, no conflict pass. The next step is the gate call.

## Conflicts (only when the rebase stops)

- In a rebase the sides invert: `--ours` is the base branch, `--theirs` is your commit. `git checkout --theirs <path>` keeps your side.
- Read the other side with `git blame -L <start>,<end> main -- <path>` and `git log --oneline -1 <sha>`. A subject suffix `(#NNN)` maps to `.kanban/0000NN_*.md`; read that task's Summary and Specs.
- Both sides fit: re-apply the other side by hand. They do not fit: keep your side and add one open question through `kanban_update` with `openQuestions`.
- Continue with `GIT_EDITOR=true git rebase --continue`. A rebase can stop once per replayed commit. On a sign failure, retry with `GIT_EDITOR=true git -c commit.gpgsign=false rebase --continue`.

## Gate, flake rerun, and exit

- `npm test` in the worktree is the whole gate: no build step, no lint step, no changed-files-only variant. One command with a 3000-second timeout: `npm test && git status --short --branch`. Only a clean tree and no rebase line matter; missing ahead/behind or tracking markers after a rebase are normal.
- Known gate noise: the wall-clock performance test in `src/physics/world.e2e.test.js` fails under concurrent load on this machine. If it is the only failing test, rerun the full gate once instead of moving the task. This overrides the run prompt's immediate to-do move. A pass is a clean pass; a second failure, or any other failing suite, is a real failure.
- Real failure: load the kanban tools with `tool_search` if not yet loaded, then `kanban_get` and `kanban_set_state` to `to-do` back-to-back with no thinking between. Name the failing suites in the final reply. The branch stays rebased.
- A passing gate ends the run in that turn: write the final reply directly, with no reply planning in thinking, and leave the state at `merging`; no Notes write, the tool list is closed.
- Final reply: one line naming the rebase result and the gate result (mention a flake rerun only if one happened), then one `merge:` bullet per resolved hunk only if the rebase stopped on conflicts. Quote counts from the tool result only; never compare them to any other run, task file, or expectation.
