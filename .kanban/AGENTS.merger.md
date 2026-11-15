# merger: durable guidance for future merger runs

The run prompt owns the step order (read task, abort a stale rebase, clear context paths, rebase, resolve, test, report). This file only removes waste from that path. The clean path is three model turns (prep+rebase, gate, final reply) with two tool calls. Tool time is small and fixed (a few seconds of git, then the test gate). The only cost worth cutting is model output, and the observed waste is thinking and commentary that restate this file.

## Turn discipline

- Turn 1: emit the prep command as the first tool call, with no thinking and no text before it. This file already fixes the command. A first turn that plans the run or quotes the command is pure output with no information.
- Between tool calls: when a result matches a listed outcome below, emit the next tool call in the same turn. Empty thinking is the target; one clause naming the branch (clean / conflict / fail) is the ceiling. Never re-quote command text, timeouts, output lines, branch names, counts, or rules of this file in thinking or in lead-in text. Lead-in text is banned: text exists only in the final reply.
- A passing gate ends the run in that turn: write the one-line final reply directly, with no thinking before it.

## Prep and rebase (one command)

- Do not open TASK.md with the read tool. The frontmatter `map` field is machine output for other roles, grows to thousands of characters on complex tasks, and holds no merge content. Read the body once, Summary and Specs and Notes, inside the prep command below, and never read the task file again later in the run.
- Run prep and rebase as one command: `git status --short --branch && git log --oneline -5 && awk '/^---$/{n++; next} n>=2' TASK.md && git update-index --no-skip-worktree -- AGENTS.md TASK.md 2>/dev/null; git restore --staged --worktree -- AGENTS.md TASK.md 2>/dev/null; git rebase main`. The awk part prints the task body and skips the frontmatter. The path clear runs unconditionally and is safe either way. Judge branch state from the printed status; the restore prints nothing on success, and that silence needs no confirmation.
- Task numbers can disagree between the run prompt, the branch name, and the printed TASK.md (stale numbering, cross-references to other tasks). Never spend a thinking turn reconciling them. The printed body is the only merge content, and numbering has no effect on the merge or the gate.
- The chained rebase refuses when a rebase is already in progress ("already a rebase-merge directory"). Then run `git rebase --abort && git rebase main` as one command and move on; do not re-run status or log first. Any other rebase stop goes to the conflicts section.
- Treat the rebase output as the truth. "Current branch ... is up to date", "Fast-forwarded", and "Successfully rebased and updated refs/heads/..." are all final clean results: no fetch, no history or merge-base inspection, no conflict pass, no re-parse, and no thinking turn about them. Do not tell a replay from a fast-forward; the next step is the same. Go straight to the test gate call. Do not `git fetch` first; the daemon resolves the local `main`.

## Conflicts (only when the rebase stops)

- In a rebase the sides invert: `--ours` is the base branch, `--theirs` is your commit. `git checkout --theirs <path>` keeps your side.
- Read the other side with `git blame -L <start>,<end> main -- <path>` and `git log --oneline -1 <sha>`. A subject suffix `(#NNN)` maps to `.kanban/0000NN_*.md`; read that task's Summary and Specs.
- Both sides fit: re-apply the other side by hand. They do not fit: keep your side and add one open question through `kanban_update` with `openQuestions`.
- Continue with `GIT_EDITOR=true git rebase --continue`. A rebase can stop once per replayed commit; resolve and continue again. On a sign failure, retry with `GIT_EDITOR=true git -c commit.gpgsign=false rebase --continue`.

## Gate and exit

- `npm test` in the worktree is the whole merge gate: no build step, no lint step, no changed-files-only variant. Run the gate and the closing check as one command with a 3000-second timeout: `npm test && git status --short --branch`; the status line must show a clean tree and no rebase in progress. Do not re-verify acceptance criteria, re-count tests, or re-list files.
- After a rebase the closing status can show no ahead/behind or tracking markers. That is normal. Only a clean tree and no rebase line matter.
- A passing summary line ends the gate. Write the final reply in the same turn, with no thinking before it. Never compare its test or file counts to any other run, task file, or expectation; the reply quotes the counts from the tool result, never from thinking.
- A conflict-free rebase produces no `merge:` bullets. Only a rebase that stopped on conflicts gets one `merge:` bullet per resolved hunk, naming the other task and whether both sides survived.
- Final reply shape: exactly one line naming the rebase result and the test result, then any `merge:` bullets, nothing else. No second paragraph and no explanation of absent bullets; silence means none. No Notes write; the tool list is closed.
- Suite success: leave the state at `merging`. Suite failure: `kanban_get`, then `kanban_set_state` to `to-do`, and name the failing suites in the final reply; run those calls with no thinking between them.
