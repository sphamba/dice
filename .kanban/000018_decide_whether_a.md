---
name: "feat: decide whether a die already held by one pointer may be grabbed by a second pointer"
priority: "low"
state: "done"
worktree: ""
issuer: "#13"
complexity: "trivial"
blockedBy: ""
map: "{\"files\":[{\"path\":\"src/input/pointer.test.js\",\"symbols\":[{\"name\":\"shares one die between two pointers in insertion order and releases each grab alone\",\"kind\":\"case\",\"ins\":22,\"del\":0,\"isNew\":true}]}],\"flows\":[],\"role\":\"developer\",\"run\":0,\"model\":\"DeepSeek V4.1 Flash\",\"at\":\"2026-11-18T21:34:28.897Z\",\"head\":\"fa74d35\"}"
changes: "{\"base\":\"main\",\"ins\":22,\"del\":0,\"files\":1}"
commits: "[{\"hash\":\"fa74d35\",\"subject\":\"test(input): pin shared grab by two pointers\",\"when\":\"2026-11-18T22:33:58+01:00\"}]"
---

# Summary
Two pointers can hold the same die at the same time: heldBodies() then contains the body twice and both pointers drive it. The task #13 spec only says each pointer holds at most one die and is silent about one die held by two pointers, so the desired behavior needs a product decision.

# Specs
# Decision
- A die already held by one pointer may also be grabbed by a second pointer. Keep the current multi-touch behavior.
- Each pointer still holds at most one die. `heldBodies()` may therefore contain the same body more than once.
- While several pointers hold the same body, each held entry drives that body once per frame in pointer insertion order. The last held entry in that order determines the final drive for the frame.
- Releasing one pointer removes only that pointer's held entry. Every remaining pointer keeps its grab until its own release, and release order must not leave a stuck or prematurely released body.

# Implementation scope
- This is the desired existing behavior, not a request to add exclusive ownership or pointer stealing.
- Keep this shared-grab contract when the separate grabbed-face-point drag correction changes `src/input/pointer.js`. Do not deduplicate `heldBodies()`.
- Add or adjust focused pointer tests only if needed to pin this contract with the corrected drag behavior. Do not add an abstraction or a new multi-pointer coordination policy.

# Notes
## Live test report (usage test through the real browser UI)
Result: the shared-grab decision holds in the app. 20/20 usage checks passed against the merged commit `fa74d35`, driven with real multi-touch input (CDP touch events on Chromium, viewport 800x600, dpr 1, hasTouch, headless, rAF ≈ 25-30 fps). Die positions were tracked from rendered pixels (red-dominant silhouette centroid, read inside the rAF job), not from app internals. No product defect found; no defect cards filed.

Checks mapped to the Specs decision:
- Second pointer can grab a die already held by one pointer: PASS (finger 2 pressed on the held die at its position, no error, no ownership fight).
- Last held entry drives the frame (insertion order): PASS (A2: die follows finger 2's target; A3: moving finger 1 while finger 2 holds does not move the die; A4: with both moving, finger 2 wins).
- Releasing one pointer removes only that pointer's entry: PASS both orders (A5: lift finger 1, finger 2 still drives; B3: lift finger 2 first, finger 1 still holds and drives).
- No stuck or prematurely released body after release order games: PASS (B4: final release with no fling leaves the die exactly at rest, drift 0.0 px; A6: fling release sends the die flying and it settles afterwards).
- Each pointer still holds at most one die (baseline multi-touch untouched): PASS (C0b/C1/C3: two dice, one pointer each, each die follows its own finger to targets 424 px apart, both at rest after release).
- No page errors, no pointercancel leaks; pointerdown/up balanced 6/6 on the canvas across all scenarios.

Assumptions made while designing the usage tests:
- Emulated touch pointers in a real Chromium browser are representative for this pointer contract (same pointerdown/move/up path as real fingers).
- The panel −/+/Roll buttons are the user way to configure the dice set; reducing to one d6 makes pixel tracking of the shared grab unambiguous.
- Assertions use the rendered die silhouette centroid with 45-60 px tolerance, well inside the pick radius (~166 css px at this viewport), and drag targets stay away from walls (the die physically cannot reach within ~150 px of a wall).
- Headless SwiftShader runs ~25-30 fps with physics at ~0.5x wall speed (FIXED_DT 1/480, MAX_STEPS 16), so settle and follow waits are frame-count based, never wall-clock.

Behavior contradicting the task's stated assumptions: none observed.

Environment problem during the run (not a product issue): at 22:48, mid-run, the task worktree `.worktrees/feat/18-decide-whether-a` and its branch were deleted externally (task state also moved live-testing → done by the orchestrator). I restored the worktree from commit `fa74d35` in the parent repo and recreated the .kanban/TASK.md/AGENTS.md symlinks to finish the test. The worktree is left in place at `fa74d35`.

Test-harness difficulty solved during the run: CDP `Input.dispatchTouchEvent` type `touchEnd` lifts exactly the LISTED points (empty list lifts all) — the opposite of my first assumption. Two early false findings (A5/B3) came from this and were resolved with a pointer-event log; final run uses corrected semantics. Out-of-scope observation, pre-existing and not from this change: the dice-set panel covers a full-width strip at the bottom (y ≈ 408-584 at 800x600) and stops propagation, so a die resting behind the panel cannot be grabbed there.

# Open questions

