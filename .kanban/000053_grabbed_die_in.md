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
## Live test progress (checkpoint 2)

Harness /tmp/dice-lt53-live (port 8801, viewport 1100x1100 = 63.5 mm cube box, hold z 41.33 mm).

### Env probe: 7/7 PASS
Box matches source scale (63.5 mm), sample schema complete, canvas backing 1100x1100 = client * dpr, sim clock advances, fps 30, event injection works, no console errors.

### First full run: 26/31 checks passed
- Free hang (open floor): all substance PASS. Grab point held at pointer (err 0.19 mm), CoM xy settles 0.02 mm below pointer (< 2 mm gate, unit test uses 1 mm), |w| and |v| calm to 0.0000, hangs in the air (4.1 mm min all-plane clearance), release drops the die (vz -0.326 m/s), settles contained and finite, world sleeps again.
- Wall hold: grab holds (0.19 mm), held stable (|v|, |w| = 0.0000), not dropped and not snapped upright (CoM z 32.4 mm through hold), release drops, settles, sleeps. All PASS.

### The 5 failures are my test setup, not the app
- Freehang: my zero-fling drop after dragging to center bounced the die 24 mm off center, so the press landed 12.6 mm from a wall (< my 15 mm no-contact premise gate). Behavior itself stayed clean (no contact happened).
- Wall: my rest-position gate wrongly allowed the die to stop 20 mm short of the wall; it stopped 14 mm short, press landed 27 mm from the wall, so the hanging die (extent 6.4-11.1 mm) could never touch the wall: clearance 11.85 mm, CoM offset 0.01 mm. The wall lean was never exercised in this run.
- No product defect observed so far; no cards filed.

### Fixes applied to the driver (not yet re-run)
- Freehang: grab the die and drag it to the box center while held (no intermediate drop); press xy is (0,0) by construction, so the no-contact premise is guaranteed.
- Wall: retry loop (3 attempts, zero-fling releases at 5/4/3 mm from the wall) until the die rests touching the wall (|gap| <= 2 mm), then press 1.5-5 mm from the wall (guaranteed >= 0.4 mm hang penetration against the >= 6.4 mm inradius extent).

### Still to do after release
Re-run freehang + wall phases, then the release checks; results table; final Notes rewrite. The wall-lean acceptance is the one manual check not yet demonstrated.

# Open questions

