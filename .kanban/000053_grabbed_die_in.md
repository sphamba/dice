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
## Live test report (task #53)

Scope: the two manual checks from the task (hold near a side wall, confirm the lean is accepted; hold in open floor space, confirm the CoM settles below the pointer) plus release behavior. Change under test is test-only (HEAD 2e2f752); the vitest suites named in acceptance were run by the reviewer, not here.

Method: real pointer interaction in headless Chromium (SwiftShader WebGL2, ~30 fps), vite served from this worktree, viewport 1100x1100 dpr 1 = 63.5 mm cube box (the box family from the defect report). World access through a createWorld spy + beforeStep wrapper; all waits Node-side on sim time; pointer input via Playwright mouse, moves >= 60 ms apart, >= 80 ms pause before release (zero fling).

### Result: 28/28 checks passed (final full run, /tmp/dice-lt53-live/results-driver.json)

Env: 7/7 (box matches source scale 63.5 mm, sample schema, canvas backing = client * dpr, sim clock advances, event injection works, no console errors).

Free hang, hold 4.5 s sim at box center:
- Grab point held at pointer: err 0.21 mm (unit test asserts 1 mm on the same path).
- CoM xy settles below the pointer: offset 0.00 mm (gate < 2 mm).
- |w| and |v| = 0.0000 over the last second; the swing calms (|w| < 0.1 rad/s) by t = 2.2-3.7 s of the hold across draws.
- The die rests tilted while held (lever 70-73 deg from vertical) with the CoM exactly under the pointer: the accepted free-hang path, no orientation forced.
- Hangs in the air: 20.2 mm min all-plane clearance, CoM z 32.4 mm (hold z 41.3 mm).
- Release drops the die, settles contained and finite, world sleeps again.

Wall lean, hold 5 s sim with the die held 3 mm from the left wall (hang extent >= 6.4 mm inradius forces wall contact):
- The lean is accepted: min-x vertex pinned exactly at the wall (clearance 0.000 mm) while held; CoM leans 4.96-5.02 mm off the pointer (same order as the reported 6-9.3 mm); lever tilted ~34 deg; held stable (|v|, |w| = 0.0000); CoM z stays ~34 mm, in the air, not dropped, not snapped upright.
- Grab point stays at the pointer through the lean: err 0.24-0.26 mm.
- Release drops the die at the wall, settles contained and finite, world sleeps.

### Observations (no defect)
- Grab-point sag under a deeper lean: one draw reached equilibrium with the grab point 11.78 mm off the hold target (wall pin vs hold drive conflict); the next draws held a shallower lean with the grab point at the target (0.24-0.26 mm). Both leans stable and accepted. The specs name grab-point accuracy only for the no-contact free hang, so this is recorded as behavior of the accepted lean path, not a defect.
- Both draws agree with the physics: CoM x = wall + wall-side vertex extent (7.95 mm measured), exactly what a wall-pinned hang predicts.

### Assumptions made in the test design
- "Open floor space" = hold at the box center; the no-contact premise holds by construction (press xy = center; measured clearance 20.2 mm).
- "Near a side wall" = drag the held die to 3 mm from the wall and hold, which forces the lean deterministically. A release-then-regrab setup never produced a wall-touching rest in 3 attempts (landed 1.5-9.5 mm short) and was replaced by the drag-while-held setup.
- The default d6 stands in for the die types; per-type coverage lives in the new unit test.
- Live tolerances: free-hang CoM offset < 2 mm (unit test 1 mm), stability |v| < 0.01 m/s and |w| < 0.1 rad/s (the unit test's rotation bound) over the last second of each hold.

### Defects found
None. No cards filed (per PM hint, no card for a wall lean).

### Harness notes (technical difficulties, resolved)
- Zero-fling drops near the wall always landed 1.5-9.5 mm short of touching; replaced with the drag-while-held setup.
- Dropping the die at the center after a drag bounced it 24 mm off center; replaced with holding the drag at the center (no intermediate drop).

# Open questions

