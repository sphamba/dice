---
name: "feat: decide whether a die already held by one pointer may be grabbed by a second pointer"
priority: "low"
state: "backlog"
worktree: ""
issuer: "#13"
complexity: "trivial"
blockedBy: "question"
---

# Summary
Two pointers can hold the same die at the same time: heldBodies() then contains the body twice and both pointers drive it. The task #13 spec only says each pointer holds at most one die and is silent about one die held by two pointers, so the desired behavior needs a product decision.

# Specs
Observed in a browser live test of task #13 (phone emulation, two simultaneous CDP touch pointers pressed on the same die):

- heldBodies() returns the same die twice (e.g. [0, 0]), so consumers cannot rely on unique entries.
- While both pointers are down, each frame both held entries call drive() on the same body; the entry inserted later wins, so the die follows only one finger (map iteration order, not a documented rule).
- Lifting the fingers one by one releases cleanly (one held entry removed per pointerup, then the other); no crash, no stuck state.

The spec sentence "Multi-touch: each pointer holds at most one die" pins per-pointer behavior but not per-die exclusivity. If a die should be grabbable by only one pointer, onDown should skip bodies already in held (or steal the grab); if two-finger carry is intended, heldBodies() duplicates and the last-wins drive rule should be documented and tested.

# Notes

# Open questions
Should a die already held by one pointer be grabbable by a second one? Current behavior is yes (duplicate heldBodies entry, second pointer wins the drive each frame). Or should the second grab be ignored, or steal the die from the first pointer?
