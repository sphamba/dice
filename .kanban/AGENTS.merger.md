# merger: durable guidance for future merger runs

The run prompt owns the step order (read task, abort a stale rebase, clear context paths, rebase, resolve, test, report). This file only removes waste from that path.

## General

- Spend no thinking tokens re-narrating the run prompt or the step list. Tool time is trivial here; model latency is the whole run cost. Pick the next command in one short sentence, then call it.
- When a command fails or a result looks odd, match it to this file first. Most failures in this workflow are by design. Think only about failures this file does not explain.

## Pre-rebase

- Read the task file once, with the read tool, at the start of the run. Do not cat or re-read it in later bash commands.
- Run all pre-rebase prep as one command: `git status --short --branch && git log --oneline -5 && git update-index --no-skip-worktree -- AGENTS.md TASK.md 2>/dev/null; git restore --staged --worktree -- AGENTS.md TASK.md 2>/dev/null; true`. Judge branch state and a rebase in progress from the printed status; the path clear runs unconditionally and is safe either way. If the status shows a rebase you did not start, abort it as the next command.
- The restore part prints nothing on success. That silence is success: do not re-run status or log to confirm the clear. Start the rebase in the next command.
- Do not inspect tracking or skip-worktree state, do not explain suppressed errors, and never deduce path status from `git status`. Go straight to the rebase.

## Rebase

- Treat the `git rebase main` output as the truth. "Current branch ... is up to date", "Fast-forwarded", and "Successfully rebased and updated refs/heads/..." are all final clean results: no fetch, no history or merge-base inspection, no conflict pass, no re-parse. Do not tell a replay from a fast-forward; the next step is the same. Go straight to the test gate.
- Do not `git fetch` before the rebase. The daemon resolves the local `main`; a network fetch changes nothing.

## Conflicts (only when the rebase stops)

- In a rebase the sides invert: `--ours` is the base branch, `--theirs` is your commit. `git checkout --theirs <path>` keeps your side.
- Read the other side with `git blame -L <start>,<end> main -- <path>` and `git log --oneline -1 <sha>`. A subject suffix `(#NNN)` maps to `.kanban/0000NN_*.md`; read that task's Summary and Specs.
- Both sides fit: re-apply the other side by hand. They do not fit: keep your side and add one open question through `kanban_update` with `openQuestions`.
- Continue with `GIT_EDITOR=true git rebase --continue`. A rebase can stop once per replayed commit; resolve and continue again. On a sign failure, retry with `GIT_EDITOR=true git -c commit.gpgsign=false rebase --continue`.

## Gate and exit

- `npm test` in the worktree is the whole merge gate: no build step, no lint step, no changed-files-only variant. Run the gate and the closing check as one command: `npm test && git status --short --branch`; the status line must show a clean tree and no rebase in progress. Do not re-verify acceptance criteria, re-count tests, or re-list files.
- After a rebase the closing status can show no ahead/behind or tracking markers. That is normal. Only a clean tree and no rebase line matter.
- A passing summary line ends the gate. Never compare its test or file counts to any other run, task file, or expectation; counts legitimately differ between tasks.
- A conflict-free rebase produces no `merge:` bullets. Only a rebase that stopped on conflicts gets one `merge:` bullet per resolved hunk, naming the other task and whether both sides survived.
- Final reply shape: one line naming the rebase result and the test result, then any `merge:` bullets, nothing else. No Notes write; the tool list is closed.
- Suite success: leave the state at `merging`. Suite failure: `kanban_get`, then `kanban_set_state` to `to-do`, and name the failing suites in the final reply.
