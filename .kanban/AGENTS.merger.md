# merger: durable guidance for future merger runs

The run prompt owns the step order (read task, abort a stale rebase, clear context paths, rebase, resolve, test, report). This file only removes waste from that path.

## Decision rule

- When a command fails or a result looks odd, match it to this file first. Most failures in this workflow are by design. Think only about failures this file does not explain.

## Pre-rebase

- Batch the pre-rebase checks into one command: `git status --short --branch && git log --oneline -5`.
- Clear the context paths with one command: `git update-index --no-skip-worktree -- AGENTS.md TASK.md && git restore --staged --worktree -- AGENTS.md TASK.md || true`. These paths are untracked, so the update-index step prints `fatal: Unable to mark file ...`; that error is the expected success signal, and `|| true` already ends the command. Do not quote, explain, or reason about it, and never deduce tracking status from `git status`.

## Rebase

- Treat the `git rebase main` output as the truth. "Current branch ... is up to date" or "Fast-forwarded" is a final no-op merge: no fetch, no history or merge-base inspection, no conflict pass, and no re-check of the result. Go straight to the test gate.
- Do not `git fetch` before the rebase. The daemon resolves the local `main`; a network fetch changes nothing.

## Conflicts (only when the rebase stops)

- In a rebase the sides invert: `--ours` is the base branch, `--theirs` is your commit. `git checkout --theirs <path>` keeps your side.
- Read the other side with `git blame -L <start>,<end> main -- <path>` and `git log --oneline -1 <sha>`. The subject suffix `(#NNN)` maps to `.kanban/0000NN_*.md`; read that task's Summary and Specs.
- Both sides fit: re-apply the other side by hand. They do not fit: keep your side and add one open question through `kanban_update` with `openQuestions`.
- Continue with `GIT_EDITOR=true git rebase --continue`. A rebase can stop once per replayed commit; resolve and continue again. On a sign failure, retry with `GIT_EDITOR=true git -c commit.gpgsign=false rebase --continue`.

## Gate and exit

- `npm test` in the worktree is the merge gate. Never run a changed-files-only variant.
- After the gate passes, run one check only: `git status --short --branch` (clean tree, no rebase in progress). Do not re-verify acceptance criteria, re-count tests, or re-list files.
- A conflict-free rebase produces no `merge:` bullets. Only a rebase that stopped on conflicts gets one `merge:` bullet per resolved hunk, naming the other task and whether both sides survived.
- Final reply shape: one line naming the rebase result and the test result, then any `merge:` bullets, nothing else. No Notes write; the tool list is closed.
- Suite success: leave the state at `merging`. Suite failure: `kanban_get`, then `kanban_set_state` to `to-do`, and name the failing suites in the final reply.
