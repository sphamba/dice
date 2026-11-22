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
## Live test progress (checkpoint)

Task #53 live test started. Progress so far:

- Task file read. Change under test is test-only (HEAD 2e2f752, `src/input/pointer.test.js`); the manual checks left to live testing are: (1) hold a die near a side wall and confirm the lean is accepted, (2) hold in open floor space and confirm the CoM settles below the pointer.
- Inspection pass done: hold mechanics read from `src/input/pointer.js` (grab point pulled to pointer xy at hold z = D - 2*radius, line 193; HOLD_DAMPING 120 1/s, HOLD_SWING_DAMPING 12 1/s, FLING_WINDOW 80 ms), box scale from `src/physics/box.js` (mpp = 0.0254/440, D = min(W,H)), default set {d6: 2} from `src/ui/panel.js`.
- Plan: viewport 1100x1100 dpr 1 gives a 63.5 mm cube (the box from the defect report). Derived: hold z = 41.33 mm, free-hang floor clearance >= ~19 mm, center-hold wall clearance >= ~14 mm, wall press p mm from wall gives expected lean offset ~= vertex extent (6.4-11.1 mm) - p.
- Harness built at /tmp/dice-lt53-live (copied from the #52 precedent, port 8801, CWD retargeted to this worktree, world spy + event log + trace + panel helpers reused, one new helper chooseGrabNear for center and wall-side press points). Syntax checked.
- No checks have run yet; no defects found so far.

Next: env probe, then free-hang hold at box center (CoM xy < 2 mm of pointer xy, |w| < 0.1 rad/s, floor clearance > 5 mm), then wall-lean hold near the left wall (wall clearance ~0, CoM offset > 0.5 mm, held stable), then release from both holds drops and settles.

# Open questions

