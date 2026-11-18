---
name: "feat: decide whether a die already held by one pointer may be grabbed by a second pointer"
priority: "low"
state: "to-merge"
worktree: "feat/18-decide-whether-a"
issuer: "#13"
complexity: "trivial"
blockedBy: ""
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
## Deliverable
- Decision applied as-is: a die already held by one pointer may be grabbed by a second pointer. No production change was needed, `src/input/pointer.js` already stores holds per `pointerId` in a `Map` and never deduplicates `heldBodies()`.
- Added one focused test in `src/input/pointer.test.js`: two pointers grab the same die, `heldBodies()` returns the body twice, the later held entry decides the frame drive (insertion order), releasing one pointer removes only its entry so the other grab still drives, releasing the last pointer empties `heldBodies()`.
- Commit `fa74d35`.

## Verification
- `npm test -- src/input/pointer.test.js` → 10 passed.
- Contract pinned for the upcoming grabbed-face-point drag correction: it must keep one `held` entry per pointer and must not deduplicate `heldBodies()`.

## Assumptions
- The current multi-touch behavior is the desired behavior, so the deliverable is a pinned contract test and not a new ownership policy.
- No new abstraction or multi-pointer coordination code was added, per the implementation scope.

## Blockers
- None.

## Manual checks left to other roles
- None.

# Open questions

