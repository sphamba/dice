# merger: durable guidance for future merger runs

The run prompt owns the step order (read task, abort a stale rebase, clear context paths, rebase, resolve, test, report). This file only removes waste from that path. The clean path is three model turns: prep+rebase, gate, final reply. Model latency is the whole run cost; tool time is trivial except the test gate, so thinking turns are the only cost worth cutting.

## General

- Your first model turn is the prep command below, called with no thinking and no planning text before it. The command already exists verbatim in this file, so planning it again is pure waste. Narrate each command once, in one short text lead-in sentence, and never the same sentence in both thinking and text. Reserve thinking for a result this file does not already explain. The final reply carries the outcome.
- When a command fails or a result looks odd, match it to this file first. Most failures in this workflow are by design. Think only about failures this file does not explain.

## Prep and rebase (one command)

- Do not open TASK.md with the read tool. The frontmatter `map` field is machine output for other roles, grows to thousands of characters on complex tasks, and holds no merge content. Read the body once, Summary and Specs and Notes, inside the prep command below, and never read the task file again later in the run.
- Run prep and rebase as one command: `git status --short --branch && git log --oneline -5 && awk '/^---$/{n++; next} n>=2' TASK.md && git update-index --no-skip-worktree -- AGENTS.md TASK.md 2>/dev/null; git restore --staged --worktree -- AGENTS.md TASK.md 2>/dev/null; git rebase main`. The awk part prints the task body and skips the frontmatter. The path clear runs unconditionally and is safe either way. Judge branch state from the printed status; the restore prints nothing on success, and that silence needs no confirmation.
- Task numbers can disagree between the run prompt, the branch name, and the printed TASK.md (stale numbering, cross-references to other tasks). Never spend a thinking turn reconciling them. The printed body is the only merge content, and numbering has no effect on the merge or the gate.
- The chained rebase refuses when a rebase is already in progress ("already a rebase-merge directory"). Then run `git rebase --abort && git rebase main` as one command and move on; do not re-run status or log first. Any other rebase stop goes to the conflicts section.
- Treat the rebase output as the truth. "Current branch ... is up to date", "Fast-forwarded", and "Successfully rebased and updated refs/heads/..." are all final clean results: no fetch, no history or merge-base inspection, no conflict pass, no re-parse. Do not tell a replay from a fast-forward; the next step is the same. Go straight to the test gate. Do not `git fetch` first; the daemon resolves the local `main`.

## Conflicts (only when the rebase stops)

- In a rebase the sides invert: `--ours` is the base branch, `--theirs` is your commit. `git checkout --theirs <path>` keeps your side.
- Read the other side with `git blame -L <start>,<end> main -- <path>` and `git log --oneline -1 <sha>`. A subject suffix `(#NNN)` maps to `.kanban/0000NN_*.md`; read that task's Summary and Specs.
- Both sides fit: re-apply the other side by hand. They do not fit: keep your side and add one open question through `kanban_update` with `openQuestions`.
- Continue with `GIT_EDITOR=true git rebase --continue`. A rebase can stop once per replayed commit; resolve and continue again. On a sign failure, retry with `GIT_EDITOR=true git -c commit.gpgsign=false rebase --continue`.

## Gate and exit

- `npm test` in the worktree is the whole merge gate: no build step, no lint step, no changed-files-only variant. Run the gate and the closing check as one command with a 3000-second timeout: `npm test && git status --short --branch`; the status line must show a clean tree and no rebase in progress. Do not re-verify acceptance criteria, re-count tests, or re-list files.
- After a rebase the closing status can show no ahead/behind or tracking markers. That is normal. Only a clean tree and no rebase line matter.
- A passing summary line ends the gate with no thinking turn before the final reply. Never compare its test or file counts to any other run, task file, or expectation; counts legitimately differ between tasks.
- A conflict-free rebase produces no `merge:` bullets. Only a rebase that stopped on conflicts gets one `merge:` bullet per resolved hunk, naming the other task and whether both sides survived.
- Final reply shape: exactly one line naming the rebase result and the test result, then any `merge:` bullets, nothing else. No second paragraph and no explanation of absent bullets; silence means none. No Notes write; the tool list is closed.
- Suite success: leave the state at `merging`. Suite failure: `kanban_get`, then `kanban_set_state` to `to-do`, and name the failing suites in the final reply.
