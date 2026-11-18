---
name: "fix: pin parseStoredSet fill for missing keys (DEFAULT_SET vs 0)"
priority: "low"
state: "done"
worktree: ""
issuer: "#24"
complexity: "trivial"
blockedBy: ""
map: "{\"files\":[{\"path\":\"src/ui/panel.js\",\"symbols\":[{\"name\":\"emptySet\",\"kind\":\"fn\",\"ins\":2,\"del\":0,\"isNew\":true},{\"name\":\"parseStoredSet\",\"kind\":\"fn\",\"ins\":1,\"del\":1,\"isNew\":false}]},{\"path\":\"src/ui/panel.test.js\",\"symbols\":[{\"name\":\"fills missing types with zero\",\"kind\":\"case\",\"ins\":3,\"del\":0,\"isNew\":false},{\"name\":\"falls back to 2 x d6 only when storage is missing or invalid\",\"kind\":\"case\",\"ins\":4,\"del\":0,\"isNew\":true}]}],\"flows\":[],\"role\":\"developer\",\"run\":0,\"model\":\"DeepSeek V4.1 Flash\",\"at\":\"2026-11-18T21:34:27.578Z\",\"head\":\"c6ba85b\"}"
changes: "{\"base\":\"main\",\"ins\":10,\"del\":1,\"files\":2}"
commits: "[{\"hash\":\"17fee15\",\"subject\":\"fix(ui): fill missing stored dice types with zero\",\"when\":\"2026-11-18T22:33:33+01:00\"}]"
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
Live test of the pinned fill behavior through the real interface (built dist served over http, headless Chromium via Playwright 1.59.0, 800x600 viewport, localStorage seeded before app load). 33 checks, all passed. No defects filed, no open questions.

Coverage (all PASS):
- The fix: seeded old partial `dice.set` values, read rendered panel counts. Stored `{"d20":1}` -> d20=1 and 0 for every other type, d6=0 (not 2). Storage left untouched on load (`{"d20":1}` survives). Stored `{"d6":3}` -> others 0.
- Fallback preserved (2 x d6) for: no storage, `not-json`, `null`, `[]`, unknown type `{"d7":1}`, non-integer `{"d6":2.5}`, negative `{"d6":-1}`, over-cap `{"d4":11}`.
- Cap preserved: stored `{"d4":10}` kept as d4=10, every + button disabled.
- Panel persistence preserved through the new fill: with `{"d20":1}` seeded, + on d6 -> d6=1 and storage rewritten as the full 6-key set; after reload d6=1 and d20=1 both persist. Remove flow same (`{"d6":2}` -> - -> d6=1 persists after reload).
- Buttons derived from counts on every scenario: add disabled at total 10, remove disabled at count 0.
- Page clean on every scenario: no pageerror, no non-vibrate console errors, no failed requests.

Assumptions made while designing the usage tests:
1. The real interface is the browser page: main.js calls createPanel without initialSet, so the panel reads localStorage `dice.set` at load.
2. Row order and set shape follow DICE_TYPES (d4,d6,d8,d10,d12,d20) from src/dice/shapes.js.
3. "Preserve panel persistence behavior" covers storage being written only on add/remove, never on load, and rewrites as the full set.
4. Button enable/disable derives from counts (matches panel.js sync()); asserted as preserved panel behavior.

Contradicts stated assumptions: none observed.

Environment/driver notes:
- rAF ~19-20 fps headless SwiftShader, record only; DOM checks need no timing assertions.
- Playwright imported by absolute path from /home/phamba/repos/tarot/app/node_modules/playwright; server on :8613, killed and verified closed. dist rebuilt from HEAD 17fee15 before testing.
- Two driver bugs fixed before judging product behavior: button expectations were not derived from counts, and the seed init script re-applied storage on every navigation, masking persistence (fixed with one-shot seeding). One clean rerun after the fixes.
- Out of scope observation (not filed): loading with dice spawned from storage logs `Blocked call to navigator.vibrate ...` console errors in headless (haptics/spawn path, no user gesture in automation); unrelated to this task's change.
- Unit suite not run by this live test; panel.test.js results are already recorded in the task Notes.

Results table: C1 first-run fallback counts+buttons PASS | C2 partial d20 counts/buttons/storage-untouched/page PASS | C3 partial d6 PASS | C4-C9 invalid-input fallback (unknown type, non-integer, negative, unparsable, array, null) PASS | C10a over-cap fallback PASS | C10b at-cap kept + add disabled PASS | C11 add persistence + full-set storage rewrite + reload PASS | C12 remove persistence + reload PASS | page-clean per scenario PASS.

# Open questions

