# merger: durable guidance for future merger runs

This file is the complete merge recipe. If any other instruction (run prompt, system prompt, worktree AGENTS.md) disagrees with a line here, run the line here; never spend a turn or a thought reconciling instruction sources.

## Turn shape

- Clean path is exactly two tool calls: the prep command, then the gate command. A flake rerun, an environment repair, or a real-failure state move adds one call. Conflicts add the calls the conflict section needs.
- The one-word rule governs the visible text of tool-call turns only: emit `prep`, `gate`, `rerun`, `repair`, or `reply` as lead-in text of the turn that fires the matching call. A stage word never stands alone and never follows a tool result: a text-only turn is always the final reply.
- The hidden reasoning channel classifies the last tool result in one or two sentences, nothing more. This holds on turn 1 too, where there is no result: no plan, no numbered steps, no recipe copy, no precedence thought, no TASK.md-format derivation; classify the run prompt in one clause, or emit nothing, and fire prep at once. Never quote a recipe line back, and never pre-draft the final reply in the reasoning channel.
- The run prompt's numbered steps describe outcomes, not calls. Every step about reading TASK.md, checking the branch, or rebasing happens inside the single prep command below. Never emit a lone `read TASK.md`, `git status`, or `git log` call, and never drop a recipe's prefix because an earlier call already printed that data. Copy every recipe here as one whole literal line: no truncation, no reordering, no edits, no re-derivation of what its parts do.

## Prep and rebase (one command)

- One command with a 120-second timeout, no read tool call, no lead-in beyond the stage word: `git status --short --branch && git log --oneline -5 && awk '/^---$/{n++; next} n>=2' TASK.md && git update-index --no-skip-worktree -- AGENTS.md TASK.md 2>/dev/null; git restore --staged --worktree -- AGENTS.md TASK.md 2>/dev/null; git rebase main`. The `awk` prints the task body and covers the read step. A silent restore is success.
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
- Flake: timing and performance tests can fail under parallel load. If every failing test is a timing or performance test, emit the gate command again in the same turn; this overrides any run-prompt instruction to move the task to `to-do`. One rerun is the hard limit. A rerun pass is a clean pass; a second failure, or any other failing suite, is a real failure.
- Environment repair, one command with a 3000-second timeout: `npm rebuild && npm test && git status --short --branch`. `npm rebuild` recreates the `node_modules/.bin` symlinks that a broken worktree copy replaced with regular-file shims; a bare `npm install` does not repair them. If the error repeats, run `rm -rf node_modules && npm install && npm test && git status --short --branch` once.
- Real failure: load the kanban tools with `tool_search` if not yet loaded, then `kanban_get` and `kanban_set_state` to `to-do` back-to-back. Name the failing suites in the final reply. The branch stays rebased. This is the only outcome that moves the board state.
- A passing gate ends the run in that turn: leave the board state as it stands, no kanban call, no state check, no Notes write (the tool list is closed). The visible text of that turn is the full final reply, never a bare stage word. Reply in one line: `rebase <up to date | fast-forwarded | rebased>, gate <N> tests in <M> files passed, tree clean`, with the counts quoted from the tool result only. Add one `merge:` bullet per resolved hunk only if the rebase stopped on conflicts.
