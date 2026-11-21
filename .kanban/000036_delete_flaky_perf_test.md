---
name: "fix: delete the flaky ten-dice wall-time performance test"
priority: "medium"
state: "to-live-test"
worktree: "fix/36-delete-flaky-perf-test"
issuer: "#34"
complexity: "trivial"
shortName: "delete-flaky-perf-test"
changes: "{\"base\":\"main\",\"ins\":0,\"del\":18,\"files\":1}"
commits: "[{\"hash\":\"c229b03\",\"subject\":\"test(physics): delete flaky ten-dice wall-time performance test\",\"when\":\"2026-11-21T21:20:21+01:00\"}]"
---

# Summary
Delete the wall-time performance test in src/physics/world.e2e.test.js. It fails on main at 584-612 ms against its 500 ms limit because of JIT warm-up and parallel test files, so it can block merges.

# Specs
# Need
- Delete the test `simulates ten dice for one second in under 500 ms` in `src/physics/world.e2e.test.js` (about lines 255-271 on main).
- Remove an import, constant or helper only when this test was its last user. Keep everything that other tests still use.

# Constraints
- Do not change any other test or any source file under `src/` other than `src/physics/world.e2e.test.js`.
- Do not add a replacement timing check.

# Acceptance criteria
- `grep -n "under 500 ms" src/physics/world.e2e.test.js` finds nothing.
- The file has no unused imports or helpers that this deletion caused.

# Notes
- Deleted the `performance` describe block with the `simulates ten dice for one second in under 500 ms` test from `src/physics/world.e2e.test.js`.
- No import, constant or helper became unused: `mulberry32`, `randomQuat`, `DIE_RADIUS`, `DICE_TYPES`, `STEPS_PER_SECOND`, `dropBody` are all still used by the remaining tests.
- Verification at c229b03: `grep -n "under 500 ms" src/physics/world.e2e.test.js` returns nothing (exit 1); `npm test -- src/physics/world.e2e.test.js` gives 12 passed (was 13).
- Assumption: no replacement timing check added, as the Specs require.
