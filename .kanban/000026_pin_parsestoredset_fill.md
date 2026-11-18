---
name: "fix: pin parseStoredSet fill for missing keys (DEFAULT_SET vs 0)"
priority: "low"
state: "to-merge"
worktree: "fix/26-pin-parsestoredset-fill"
issuer: "#24"
complexity: "trivial"
blockedBy: ""
map: "{\"files\":[{\"path\":\"src/ui/panel.js\",\"symbols\":[{\"name\":\"emptySet\",\"kind\":\"fn\",\"ins\":2,\"del\":0,\"isNew\":true},{\"name\":\"parseStoredSet\",\"kind\":\"fn\",\"ins\":1,\"del\":1,\"isNew\":false}]},{\"path\":\"src/ui/panel.test.js\",\"symbols\":[{\"name\":\"fills missing types with zero\",\"kind\":\"case\",\"ins\":3,\"del\":0,\"isNew\":false},{\"name\":\"falls back to 2 x d6 only when storage is missing or invalid\",\"kind\":\"case\",\"ins\":4,\"del\":0,\"isNew\":true}]}],\"flows\":[],\"role\":\"developer\",\"run\":0,\"model\":\"DeepSeek V4.1 Flash\",\"at\":\"2026-11-18T21:34:27.578Z\",\"head\":\"c6ba85b\"}"
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
- Deliverable: `parseStoredSet` in `src/ui/panel.js` now builds the result from a zero-filled set of `DICE_TYPES` (new `emptySet()` helper) instead of `DEFAULT_SET`, so omitted types are 0. The `DEFAULT_SET` fallback (2 x d6) still applies only when storage is missing, unparsable, not an object, holds an unknown type, a non-integer or negative count, or a total above `MAX_DICE`.
- Verification: HEAD `c6ba85b`. `npm test -- src/ui/panel.test.js` 10 passed, `npm run build` green. New assertions: stored `{"d20":1}` yields the full set with d6 = 0, and missing/invalid storage still yields 2 x d6.
- Assumptions: a valid partial set is never invalid, so it never triggers the fallback; `DEFAULT_SET` stays the panel's first-run default only, not a fill template. `parseStoredSet` has one caller (`createPanel`), so the change needed no caller-specific handling.
- Manual checks left to other roles: reload with an old `dice.set` value that only names some types and confirm the panel shows zeros for the others.

# Open questions

