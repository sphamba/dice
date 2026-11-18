---
name: "fix: pin parseStoredSet fill for missing keys (DEFAULT_SET vs 0)"
priority: "low"
state: "backlog"
worktree: ""
issuer: "#24"
complexity: "trivial"
blockedBy: ""
---

# Summary
parseStoredSet inherits DEFAULT_SET values for keys missing from stored JSON, while the #24 Notes record the assumption that missing keys fill with 0. A decision is needed on which behavior is correct, then the code or the docs must move.

# Specs
# Required behavior
- For valid stored JSON that contains only some dice types, every omitted type has count 0. Do not seed missing types from `DEFAULT_SET`.
- Example: stored `{"d20":1}` produces the complete set `{d4:0,d6:0,d8:0,d10:0,d12:0,d20:1}`.
- Preserve current validation, supported types, integer/range limits, total-die cap, and panel persistence behavior.
- Preserve the separate fallback to `DEFAULT_SET` (2 x d6) when storage is missing or its content is invalid. A valid partial set is not invalid and must not trigger that fallback.

# Implementation scope
- Change the shared `parseStoredSet` fill behavior in `src/ui/panel.js`; do not special-case individual callers.
- Update `src/ui/panel.test.js` with a partial-set case that asserts all omitted types are zero and a check that missing or invalid storage still yields 2 x d6.
- Replace the outdated assumption in this task's Notes with the pinned missing-means-zero rule. Make no unrelated UI changes in this task.

# Notes

# Open questions

