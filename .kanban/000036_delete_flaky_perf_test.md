---
name: "fix: delete the flaky ten-dice wall-time performance test"
priority: "medium"
state: "done"
worktree: ""
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
Live test of the merged commit c229b03 (worktree clean, HEAD = main = c229b03). The change is a test-file-only deletion, so no runtime flow exists to exercise; the test was a static acceptance check of the real file, with no test suite runs.

Results:
- PASS `grep -n "under 500 ms" src/physics/world.e2e.test.js` finds nothing (exit 1). No match anywhere under src/.
- PASS Scope: `git show c229b03 --stat` shows only src/physics/world.e2e.test.js, 18 deletions, 0 insertions. The diff removes exactly the `performance` describe block with the `simulates ten dice for one second in under 500 ms` test. No other test or source file touched.
- PASS No replacement timing check: the file has no `performance` reference and no wall-time assertion left.
- PASS No unused imports or helpers from the deletion: every import (describe, expect, it, boxFromViewport, createBody, createShape, DIE_RADIUS, DICE_TYPES, FIXED_DT, createWorld, quat, vec3) and every top-level constant/helper (BOX, GRAVITY, STEPS_PER_SECOND, vec, mulberry32, randomQuat, randomUnit, scratchVertex, worldVertex, lowestVertex, deepestFaceAgainstFloor, boxOvershoot, dropBody) still has at least one user in the remaining tests. The deleted test used only the `performance` global, so nothing else became dead.
- PASS Structure: the file declares 12 test cases (6 from the settling loop over DICE_TYPES + 6 fixed), which matches the recorded "12 passed (was 13)" at c229b03. `node --check` passes on the file.

Assumptions:
- The change has no user-facing runtime interface, so the live test is the static acceptance verification above. App behavior is unchanged by construction because no source file changed; running the app or the vitest suite was out of scope for the live test.

No defects found.
