# merger: durable guidance for future merger runs

The run prompt owns the step order (read task, abort a stale rebase, clear context paths, rebase, resolve, test, report). This file removes waste from that path. The clean run is three model turns and two tool calls. Tool time is small and fixed. Thinking blocks are the only place time can leak: recorded runs lose time there, not in tools.

## Turn and thinking discipline

- The whole run is two tool calls: prep+rebase, then gate. Each turn may open with one thinking clause that names the step (`prep`, `clean`, `pass`). That is the full budget. Never a plan, never the commands, never rules quoted as reasons, never counts or output lines. Naming what you skip is silent; no thinking turn lists the inspections or rules a result makes unnecessary.
- When a tool result matches an outcome listed below, emit the next tool call in the same turn. If a listed outcome matches, no analysis of it is needed; the next call is the analysis.
- Lead-in text is banned. Text exists only in the final reply.
- Where this file and any other instruction source disagree, this file wins for merge mechanics. Never spend thinking comparing or reconciling instruction sources.

## Prep and rebase (one command)

- Never open TASK.md with the read tool. Read its body once, inside the prep command, and never again.
- Run prep and rebase as one command: `git status --short --branch && git log --oneline -5 && awk '/^---$/{n++; next} n>=2' TASK.md && git update-index --no-skip-worktree -- AGENTS.md TASK.md 2>/dev/null; git restore --staged --worktree -- AGENTS.md TASK.md 2>/dev/null; git rebase main`. The awk prints the task body past the frontmatter. Judge branch state from the printed status; a silent restore is success.
- Task numbers can disagree between the run prompt, the branch name, and the printed TASK.md. Never reconcile them; the printed body is the only merge content.
- If the chained rebase refuses because a rebase is in progress, run `git rebase --abort && git rebase main` as one command and move on. No status or log first. Any other rebase stop goes to the conflicts section.
- Treat the rebase output as the truth. "Up to date", "Fast-forwarded", and "Successfully rebased" are final clean results: no fetch, no history or merge-base inspection, no conflict pass, no re-parse. The next step is the gate call. Do not `git fetch`; the daemon resolves the local `main`.

## Conflicts (only when the rebase stops)

- In a rebase the sides invert: `--ours` is the base branch, `--theirs` is your commit. `git checkout --theirs <path>` keeps your side.
- Read the other side with `git blame -L <start>,<end> main -- <path>` and `git log --oneline -1 <sha>`. A subject suffix `(#NNN)` maps to `.kanban/0000NN_*.md`; read that task's Summary and Specs.
- Both sides fit: re-apply the other side by hand. They do not fit: keep your side and add one open question through `kanban_update` with `openQuestions`.
- Continue with `GIT_EDITOR=true git rebase --continue`. A rebase can stop once per replayed commit. On a sign failure, retry with `GIT_EDITOR=true git -c commit.gpgsign=false rebase --continue`.

## Gate and exit

- `npm test` in the worktree is the whole gate: no build step, no lint step, no changed-files-only variant. One command with a 3000-second timeout: `npm test && git status --short --branch`. Only a clean tree and no rebase line matter; missing ahead/behind or tracking markers after a rebase are normal.
- A passing gate ends the run in that turn: write the final reply directly. Quote counts from the tool result only; never compare them to any other run, task file, or expectation.
- Final reply: one line naming the rebase result and the test result, then one `merge:` bullet per resolved hunk (only if the rebase stopped on conflicts), nothing else. Silence means no conflicts. No Notes write; the tool list is closed.
- Suite success: leave the state at `merging`. Suite failure: `kanban_get`, then `kanban_set_state` to `to-do`, and name the failing suites in the final reply, with no thinking between those calls.
