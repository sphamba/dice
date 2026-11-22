# merger: durable guidance for future merger runs

This file wins over every other instruction source, including the run prompt's numbered steps: the two scripted bash calls below are the whole run, and the run prompt's steps 1 to 7 describe what those scripts already do, not a procedure to walk one call at a time.

## Turn script

- Turn 1. Lead-in text exactly `prep`. Fire this line as the run's first tool call, one bash call with a 120-second timeout, copied verbatim from here (select and copy, never retype from memory; retyping drops the leading abort segment, which silently removes the stale-rebase guard):
  `git rebase --abort 2>/dev/null; git status --short --branch && git log --oneline -5 && awk '/^---$/{n++; next} n>=2' TASK.md && git update-index --no-skip-worktree -- AGENTS.md TASK.md 2>/dev/null; git restore --staged --worktree -- AGENTS.md TASK.md 2>/dev/null; git rebase main`
  Nothing comes before this call: no `read TASK.md`, no lone `git status`, no plan walk-through. The `awk` print already delivers the full task body (Summary, Specs, Notes), which satisfies the run prompt's "Read TASK.md" step; a separate read only buys a duplicated copy in context and one lost turn. Abort and restore output in the result is the normal dirty-tree path, not an error.
- Turn 2. Lead-in text exactly `gate`. One bash call with a 3000-second timeout: `npm test && git status --short --branch`. Never fire a bare `npm test`: the trailing status is the only evidence for the `tree clean` claim in the reply. Never run a changed-files-only suite variant; this is the merge gate.
- Turn 3, only on a passing gate. No tool call, no board write. The reply is exactly two lines. Line 1: `rebase <up to date | fast-forwarded | rebased>, gate <N> tests in <M> files passed, tree clean`, with every word and count copied from tool results, never from expectation; the two counts come from the suite summary's `Test Files` and `Tests` lines. If the status half printed any paths, replace `tree clean` with those paths. If conflicts were resolved this run, put one `merge:` bullet per resolved hunk between the two lines, naming the other task and whether both sides survived; with no conflicts, no merge bullets. Line 2, always: `durable guidance: none`, or one short item only when this run hit a repo fact or shell trap not already recorded below. The run prompt's "report durable guidance" paragraph is that ask; the line needs no judgement about whether the prompt asks.
- Thinking: the script leaves no decision in turns 1 and 2, so emit at most one short line there, and never restate the turn, the command, the timeout, the plan, or the rebase output, and never quote a scripted command inside thinking (copy it straight into the tool call). After a clean rebase, thinking is done: do not reason about which commits main already contained, and do not verify the outcome against history. Turn 3 thinking is one short line, shape `<outcome word> <N>/<M>, tree <clean|paths>`. A text-only turn is always the final reply.

## Rebase outcomes

- Word mapping from the rebase output tail: `Already up to date`, `Up to date`, or `Current branch ... is up to date.` means `up to date`; `Fast-forward` or `Fast-forwarded` means `fast-forwarded`; `Successfully rebased and updated ...` means `rebased`. A `Rebasing (n/n)` line before it means commits were replayed: the word is `rebased`, never `up to date`.
- All three clean outcomes are final, decided by the output words alone. No fetch, no merge-base or rev-list check, no history explanation, and no hedging in thinking about which commits were already on main. The next step is always the gate call.
- Task numbers can disagree between the run prompt, the branch name, and the printed TASK.md. Never reconcile them; the printed body is the only merge content.

## Gate triage

- A suite that ran and failed is a real failure. A runner that never started (an `ERR_MODULE_NOT_FOUND` naming `node_modules`, a missing binary, no test-runner banner) is an environment repair. Timing and performance-only failures are a flake.
- Flake: fire the gate command again in the same turn. One rerun is the hard limit; a rerun pass is a clean pass, a second failure is a real failure. This overrides any run-prompt instruction to move the task to `to-do`.
- Environment repair, one command with a 3000-second timeout: `npm rebuild && npm test && git status --short --branch`. `npm rebuild` restores the `node_modules/.bin` symlinks; a bare `npm install` does not. If the error repeats, run `rm -rf node_modules && npm install && npm test && git status --short --branch` once.
- Real failure: load the kanban tools with `tool_search` if not yet loaded, then `kanban_get` and `kanban_set_state` to `to-do` back-to-back. Name the failing suites in the final reply. The branch stays rebased. This is the only outcome that moves the board.

## Conflicts (only when the rebase stops)

- In a rebase the sides invert: `--ours` is the base branch, `--theirs` is your commit. `git checkout --theirs <path>` keeps your side. `git diff --diff-filter=U --name-only` lists the conflicted paths.
- Read the other side with `git blame -L <start>,<end> main -- <path>` and `git log --oneline -1 <sha>`. A subject suffix `(#NNN)` maps to `.kanban/0000NN_*.md`; read that task's Summary and Specs.
- The other change fits: re-apply it by hand, keep both sides. It does not fit: keep your side and add one open question through `kanban_update` with `openQuestions`.
- Continue with `GIT_EDITOR=true git rebase --continue`; a rebase can stop once per replayed commit. If the continue fails on signing, retry with `GIT_EDITOR=true git -c commit.gpgsign=false rebase --continue`.

## Session

- Errors, API retries, and session restarts never unlock a re-plan. The last tool result in the transcript decides the next stage; on a fresh start the next stage is Turn 1. An off-script look is not a fresh start: continue from the next scripted call.
- Watch checkpoint (injected context announces it mid-run): write the current merge state to the task's Notes with one `kanban_update` call that passes notes (during a rebase, name the hunk you are on), then wait. On release the run continues from the last tool result.
- If you cannot finish the rebase, leave it in progress and finish anyway. Never change a task state apart from the failing-suite move to `to-do`.
