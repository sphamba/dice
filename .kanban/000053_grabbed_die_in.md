---
name: "test: lock the free-hang rest of a held die (the wall lean is physical)"
priority: "medium"
state: "to-merge"
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
## Review
- Outcome: approved. Test-only change (HEAD 2e2f752), no production code touched, as the Decision bullet requires.
- Spec mapping: new test in `src/input/pointer.test.js` loops all 6 DICE_TYPES x 20 trials with seededRandom(53), holds 3 s at 60 fps in a 0.2 m wide box, asserts CoM xy < 1 mm from the initial grab point and |w| < 0.1 rad/s; grab points come from up-facing faces (world normal z > 0.3), so the grab convention assumption in the old Notes matches the code.
- No-contact premise verified geometrically: with DIE_RADIUS ~ 11.1 mm and the hold pin at D - 2*radius (pointer.js line 193), floor clearance is >= ~24 mm and wall clearance ~70 mm. Probe: the same 120 seeded cases run in the standard 68.1 mm BOX produce 0 violations (worst offset 0.0000), so the seed cannot flake into the declared-correct wall-lean path.
- Teeth verified by mutation A/B: setting swingDecay = 0 in pointer.js drive (freezes the tilted hold mid-air without contacts) makes the new test fail on the 1 mm assert; production restored, tree clean. A first mutant (zeroed horizontal drive) survived because the pin target xy equals the initial grab xy in a no-move hold; recorded so nobody reads that as test weakness.
- Verification: `npx vitest run src/input src/physics` 10 files / 142 tests passed (16.4 s); `npm test` 28 files / 343 tests passed (17.2 s); `npm run build` ok, dist assets match the claimed hashes.
- Developer-claimed live numbers (31/120 fails in a 63.5 mm box) were not reproduced; re-measured instead: 0/120 fails with this seed at 68.1 mm, which is consistent with the wide-box scope and does not gate the verdict.

## Manual checks left to other roles
- Live: hold a die near a side wall and confirm the lean is accepted; hold in open floor space and confirm the CoM settles below the pointer.

# Open questions

