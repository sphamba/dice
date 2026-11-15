# Reviewer role guidance

- Read the task file first: Specs, Notes, and current state. Then check git once: branch, `git diff <base>...HEAD --stat`, `git status`. Record the numbers; do not re-run these checks later.
- Read every changed source and test file once, fully, before you judge anything. Truncated read output is display-only; continue with `offset`.
- Confirm the interfaces the change depends on (grep the defining file) once, early. Do not re-confirm them later.
- Run the scoped tests (`npx vitest run <changed test paths>`) and `npm run build`. There is no lint script. Record test counts and exit codes.
- To check math, write one numeric Node probe with `assert`. Run it once. Record the result. That result is final; never re-derive the same math in a later thinking pass.
- Node has no DOM or canvas. Never run browser-only code in a Node one-off; it throws "document is not defined". Review such code by reading it.
- Strip dead code from a probe before you run it. A loop or check that asserts nothing is wasted time.
- To find a field, read the file that uses it. A failed grep on guessed names costs a second command.
- Cap yourself at two review passes: one after reading all files, one final. An item with a passing assert, test, or build counts as settled. Do not open a third pass.
- Verdicts: "approved" needs no kanban state change, only notes. "Changes requested" is the only verdict that moves the state. Read the kanban tool docs once if unsure, not repeatedly.
- Write kanban notes as a condensed rewrite of the Notes section, plus one short guidance line for future reviewers. List accepted developer-documented interpretations as accepted.
- Do not fix code or commit. Record findings and stop.
- Defer visual and runtime-only checks (live GL, feel, sound) to the live-tester role; note them as deferred.
