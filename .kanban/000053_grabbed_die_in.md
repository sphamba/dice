---
name: "test: lock the free-hang rest of a held die (the wall lean is physical)"
priority: "medium"
state: "doing"
worktree: "fix/53-grabbed-die-in"
issuer: "#50"
complexity: "simple"
blockedBy: ""
---

# Summary
When a grabbed die is held in the air with no contact (clearance > 0), the physics constraint can hold a tilted orientation in which the CoM rests 6-9.3 mm horizontally off the grab point instead of swinging directly below it. Intermittent: depends on the die's orientation at grab.

# Specs
# Decision
- A held die that leans on a side wall and cannot swing under the pointer is correct. The #45 user decision applies: contacts with the floor, walls, lid and other dice stay active while held. Do not keep held dice clear of walls and do not force any orientation.
- The free-hang path on main is correct (0/120 fails in a 0.2 m box). No production change.

# Evidence
- Live run 4 offsets of 6-9 mm were wall leans: the die's min-x vertex touched the side wall, the contact solver held v = 0, w = 0. All 31/120 failing cases in the 63.5 mm box are wall cases.

# Tests (`src/input/pointer.test.js`)
- Free hang, no contacts (box large enough that no vertex reaches a wall or the floor): for each die type, 20 seeded grab points and orientations, pointer still for 3 s of simulated time. The CoM xy is within 1 mm of the grab point and |w| < 0.1 rad/s in every case.
- The #45 and #52 hold tests stay green.

# Acceptance criteria
- `npx vitest run src/input src/physics`
- `npm test`

# Notes
## PM hint
- `|w| = 0.000` with a constant offset: the hint was that the step does not integrate the body. Wrong: the step does integrate and the wall contact solver pins it. Evidence below.

## State
- Root cause found: a **side-wall contact**, not sleep, not the drive, not the sleep gate. No code changed yet.
- Per-step trace of a failing case (d10, seed 1011): after the drive v = (-0.0146, 0.0007, 0.0188), w = (0.33, -2.75, 0.42); after gravity v_z = -0.0017; `detectContacts` reports 2 wall contacts (depth 8.4e-15 and 0); `solveContacts` returns v = 0, w = 0 exactly and the position does not move. A jammed lean, stable across steps.
- Geometry of the same case: the pointer at (-13.03, -17.35) mm, the CoM at (-22.39, -17.64) mm (offset 9.37 mm), and the die's min-x vertex at exactly -31.750 mm, the side wall. The free-hang clearance at that pointer is 7.6 mm, but swinging the CoM under the pointer pushes that vertex through the wall, so the die is geometrically jammed and cannot reach the free hang.
- Cause of the trigger: every failing case starts on an **asleep** die resting near a wall (lever 10.0-10.8 mm), which is then lifted up the wall and jams against it. All 31/120 failing cases in the 63.5 mm box are wall cases.
- Same sweep in a wide box (W = H = 0.2 m, same seeds, same 3 s hold, 24.2 and 60 fps): 0/120 fail, worst offset 0.00 mm. Grab at hold height in free hang: 0/120 fail. So the free-hang path on main is correct and needs no change.
- Repro (deterministic, per-case seeds): `/tmp/run53.mjs` (63.5 mm box, 31/120 fail), `/tmp/run53w.mjs` (wide box, 0/120), per-step diag `/tmp/diag53d.mjs`.

## Next action
- Write the card's regression test (`src/input/pointer.test.js`, no contacts, 20 seeded grab points and orientations per die type, 3 s hold, CoM xy < 1 mm, |w| < 0.1). It is green on main and locks the invariant.
- Then decide the wall case: it is physically correct (a real pendulum leaning on a wall while the pointer holds the grab point jams there), so no production change is in scope without forcing an orientation (#45 rule). Ask the PM in Open questions whether a held die leaning on a side wall is acceptable, or should be a separate task (for example wall friction for held bodies).
- No blockers.

# Open questions

