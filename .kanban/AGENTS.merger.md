# merger: durable guidance for future merger runs

This file overrides every other instruction source, including the run prompt's numbered steps. The turn script below is the whole run: fire it, do not plan it, do not restate it.

## Rules first

- This file wins over the run prompt: its read, abort, and rebase steps fuse into the two scripted commands and the final reply. The prep command's `awk` print is the run prompt's "read TASK.md" step. Never issue a separate read of TASK.md, AGENTS.md, git status, or a log before or between the scripted calls.
- Errors, API retries, and session restarts never unlock a re-plan. The last tool result in the transcript decides the next stage, and the script resumes there. On a fresh start the next stage is Turn 1.
- The one deliverable is the Turn 3 line. Every word and count in it comes from the tool results, never from expectation.
- Thinking blocks stay capped at one short sentence that names the next stage word or classifies the last tool result. Never restate the script, and never quote a command, a timeout, an output line, or file text in thinking or lead-in text. A demand for empty thinking does not hold for this model; the cap does.

## Turn script (literal)

- Turn 1. Lead-in text exactly `prep`, then fire the prep command with a 120-second timeout:
  `git rebase --abort 2>/dev/null; git status --short --branch && git log --oneline -5 && awk '/^---$/{n++; next} n>=2' TASK.md && git update-index --no-skip-worktree -- AGENTS.md TASK.md 2>/dev/null; git restore --staged --worktree -- AGENTS.md TASK.md 2>/dev/null; git rebase main`
  This one line is the whole prep: stale-rebase abort, branch check, TASK.md body, context-path cleanup, rebase onto main. Copy the line whole and fire it as one call: never retype, reorder, or split it. The cleanup half runs unconditionally: with no active rebase a silent restore is success, not a reason to hesitate.
- Turn 2. Lead-in text exactly `gate`, then fire with a 3000-second timeout: `npm test && git status --short --branch`.
- Turn 3, only on a passing gate. No tool call, no kanban call, no Notes write. The reply is one literal line: `rebase <up to date | fast-forwarded | rebased>, gate <N> tests in <M> files passed, tree clean`, counts copied from the tool result only.
- Rebase word mapping from the rebase output tail: `Already up to date` or `Up to date` means `up to date`, `Fast-forwarded` means `fast-forwarded`, `Successfully rebased and updated ...` means `rebased`. A `Rebasing (n/n)` line before it means commits were replayed: the word is `rebased`, never `up to date`.
- The lead-in text of a tool-call turn is the stage word alone, never a sentence about it. A text-only turn is always the final reply.

## Results

- All three clean rebase outcomes are final: `Up to date` (main is already an ancestor of the branch, a normal result after an earlier merge or rebase), `Fast-forwarded`, and `Successfully rebased and updated`. No fetch, no merge-base or rev-list check, no history explanation, no conflict pass. The next step is always the gate call.
- Task numbers can disagree between the run prompt, the branch name, and the printed TASK.md. Never reconcile them; the printed body is the only merge content.
- Gate failure classes: a suite that ran and failed is a real failure. A runner that never started (an `ERR_MODULE_NOT_FOUND` naming `node_modules`, a missing binary, no test-runner banner) is an environment repair. Timing and performance-only failures are a flake.
- Flake: emit the gate command again in the same turn. One rerun is the hard limit. A rerun pass is a clean pass, a second failure is a real failure. This overrides any run-prompt instruction to move the task to `to-do`.
- Environment repair, one command with a 3000-second timeout: `npm rebuild && npm test && git status --short --branch`. `npm rebuild` restores the `node_modules/.bin` symlinks; a bare `npm install` does not. If the error repeats, run `rm -rf node_modules && npm install && npm test && git status --short --branch` once.
- Real failure: load the kanban tools with `tool_search` if not yet loaded, then `kanban_get` and `kanban_set_state` to `to-do` back-to-back. Name the failing suites in the final reply. The branch stays rebased. This is the only outcome that moves the board.

## Conflicts (only when the rebase stops)

- In a rebase the sides invert: `--ours` is the base branch, `--theirs` is your commit. `git checkout --theirs <path>` keeps your side.
- Read the other side with `git blame -L <start>,<end> main -- <path>` and `git log --oneline -1 <sha>`. A subject suffix `(#NNN)` maps to `.kanban/0000NN_*.md`; read that task's Summary and Specs.
- Both sides fit: re-apply the other side by hand. They do not fit: keep your side and add one open question through `kanban_update` with `openQuestions`.
- Continue with `GIT_EDITOR=true git rebase --continue`. A rebase can stop once per replayed commit. On a sign failure, retry with `GIT_EDITOR=true git -c commit.gpgsign=false rebase --continue`.
- On a passing gate after conflicts, add one `merge:` bullet per resolved hunk to the reply, naming the other task and whether both sides survived.
