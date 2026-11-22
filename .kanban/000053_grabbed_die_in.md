---
name: "test: lock the free-hang rest of a held die (the wall lean is physical)"
priority: "medium"
state: "to-review"
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
## Deliverable
- Root cause of the 6-9 mm rests: a die jammed against a **side wall** while held, not sleep, not the pointer drive, and not a speed gate. PM confirmed the behaviour is correct (#45 rule: contacts stay active while held), so no production change.
- Added a regression test in `src/input/pointer.test.js` ('hangs from 20 grabbed points and orientations per die type without a contact'): seeded, 20 grab points and initial orientations per die type, 3 s hold in a 0.2 m box with no contact of any kind, asserting the CoM xy within 1 mm of the grab point and |w| < 0.1 rad/s.
- HEAD 2e2f752, test-only change.

## Verification
- `npx vitest run src/input src/physics`: 10 files, 142 tests passed.
- `npm test`: 28 files, 343 tests passed.
- `npm run build`: built, `dist/index.html` references `./assets/index-CEHgI89T.js` and `./assets/index-DFCdjPSa.css`.
- Evidence for the free hang: `/tmp/run53w.mjs` wide box 0/120 fail, worst 0.00 mm at 24.2 and 60 fps; `/tmp/run53.mjs` 63.5 mm box 31/120 fail, every failure with a wall contact.
- Per-step trace (`/tmp/diag53d.mjs`): drive sets v = (-0.0146, 0.0007, 0.0188), then gravity, then two wall contacts at depth ~0, then `solveContacts` returns v = 0 and w = 0 with the pose unchanged.

## Assumptions
- The grab convention for the new test is a random up-facing face point toward a vertex, with a unit-length random axis for the initial orientation.
- The free-hang invariant only binds with no contact; a held die that leans on a wall, the lid, or another die keeps that contact.

## Blockers
- None.

## Manual checks left to other roles
- Optional live re-check: hold a die near a side wall and confirm the lean is accepted; hold in open floor space and confirm the CoM settles below the pointer.

# Open questions

