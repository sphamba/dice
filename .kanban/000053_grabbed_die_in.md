---
name: "test: lock the free-hang rest of a held die (the wall lean is physical)"
priority: "medium"
state: "live-testing"
worktree: "fix/53-grabbed-die-in"
issuer: "#50"
complexity: "simple"
blockedBy: ""
changes: "{\"base\":\"main\",\"ins\":76,\"del\":0,\"files\":1}"
commits: "[{\"hash\":\"2e2f752\",\"subject\":\"test(input): cover the free hang from 20 grabbed points and orientations per die\",\"when\":\"2026-11-22T14:44:08+01:00\"}]"
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
- This task changes tests only. Keep the live check to the two holds (open floor and wall lean) plus release. Budget 10 minutes, then the results table. File no card for a wall lean.

## Progress
- Harness /tmp/dice-lt53-live (port 8801), viewport 1100x1100 = 63.5 mm box, hold z 41.33 mm. No checks run yet.

# Open questions

