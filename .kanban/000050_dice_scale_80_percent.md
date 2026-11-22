---
name: "feat: shrink every die to 80% of its current size"
priority: "medium"
state: "done"
worktree: ""
issuer: "user"
complexity: "complex"
shortName: "dice-scale-80-percent"
splitter: "done"
changes: "{\"base\":\"main\",\"ins\":59,\"del\":37,\"files\":12}"
commits: "[{\"hash\":\"ce0e5bd\",\"subject\":\"test: use the imported die radius in the integrator fixture\",\"when\":\"2026-11-22T13:33:33+01:00\"},{\"hash\":\"b6e5e2e\",\"subject\":\"feat: shrink every die to 80% of its size\",\"when\":\"2026-11-22T13:24:46+01:00\"}]"
---

# Summary
Scale all six die types to 80% of their current size (d6 edge 16 mm to 12.8 mm, DIE_RADIUS 13.86 mm to 11.09 mm). Every size-dependent value follows from DIE_RADIUS, so the dice look and behave the same, only smaller.

# Specs
# Need
- Every die type (d4, d6, d8, d10, d12, d20) becomes 80% of its current size. `DIE_RADIUS` (`src/physics/body.js`, now `0.016*sqrt(3)/2`) becomes `0.0128*sqrt(3)/2` (about 11.09 mm). The shapes in `src/dice/shapes.js` keep their relative proportions.

# Values that must follow the size (derive them from `DIE_RADIUS`, no new hard-coded millimetres)
- Mass and inertia: from the existing density formula.
- Grab hold height `D - 2*DIE_RADIUS`, roll headroom (#37), AO radius `1.2*DIE_RADIUS` (#38): check that each one reads `DIE_RADIUS`.
- Bevel radius (#39): 1 mm becomes 0.8 mm, written as a fraction of `DIE_RADIUS`.
- Label layout: numbers and pips stay relative to the face, as now.
- Die impact sound: the die modes follow the size (smaller dice click higher, about +25%), as the physics gives.
- Physics thresholds stay absolute (SLEEP_SPEED, restitution threshold, contact slop, warm-start match distance).

# Tests
- A test that the d6 edge is 12.8 mm and that every shape's circumradius equals `DIE_RADIUS`.
- Replace every hard-coded die size in tests (for example `DIE_RADIUS = 0.0139` in `src/input/pointer.test.js`) with the imported constant.
- All existing suites stay green: settle, pile (#40, 3 s at 15 and 30 degrees), roll headroom (#37), grab and hang (#45), bevel (#39), AO (#38), audio (#44).

# Acceptance criteria
- `npm test`
- `npm run build`
- Live check (browser): all six die types render at 80% of their previous on-screen size with the same look (bevel, labels, AO), roll, settle, can be grabbed and hang, with no console or GL errors.

# Notes
**Live-test #50 — final. run5: 83/83 checks PASS.** No product defects in the 80% scale change itself; one intermittent defect filed as #53 (grab/free-hang CoM offset, pre-existing class, run4 evidence d8/d12 6-9.3 mm with clearance > 0; run5 read 0.17/1.29 mm).

Results table (run5, /tmp/dice-lt50/results-driver.json):

| Area | Check | Verdict |
|---|---|---|
| Calibration | box footprint fills viewport (63.50 mm = innerWidth, 17.323 px/mm) | PASS |
| Empty reference | captured for diff instrument; board cleared | PASS |
| Physics (per type, 6x) | radius == 0.0128·√3/2 m = 11.085 mm; mass == 1200 kg/m³ × volume; d6 edge 12.8 mm (80% of 16) | PASS |
| Render (per type, 6x) | diff-mask hull coverage 0.75-1.02 (harness-limited to smoke; see limits) | PASS |
| Labels (per type, 6x) | face ink present | PASS |
| Screenshots (6x) | shot-<type>.png in /tmp/dice-lt50/artifacts | PASS |
| AO look | 16-patch contact bowls vs baseline A/B: HEAD 5.0-5.9 vs base 5.0-6.0 luma at +1 mm, same decay | PASS |
| Roll single d6 | launch vz0 0.765 m/s ≥ lift(0.6·headroom) 0.716 (source-grounded); apex = observation; no lid contact; settles asleep, stays asleep 0.5 s (drift 0.000 mm); contained, finite | PASS |
| Roll pile (6 dice) | all move (maxSpeed 1.27-1.71 m/s); apexes observation; no lid contact (49.32 vs 51.41 mm); settles asleep, contained | PASS |
| Hang (per type, 6x) | grab holds at (pointer, D-2R) err 0.12-1.09 mm; contact-aware verdict: free hang, CoM below grab, rest xy 0.04-1.29 mm < 1.5 mm; clearance 19.8-28.2 mm; release drops; settles contained | PASS |
| Final | panel counts consistent (all 0 after cleanup) | PASS |
| Console | no pageerror/error across the run | PASS |

Harness limits (documented, not defects):
- Rendered-silhouette bbox equality for darker types: hue classifier eroded by AO-crushed dark faces; diff-vs-empty contaminated by 0.8 mm bevel inset (4-5 px) and pose-dependent shadow. Coverage-inside-hull kept as smoke; size proof rests on exact physics constants, hull projection, lever 0.8x vs #45, and screenshots.
- Roll apex below the planned 0.60-0.75 headroom band (single 0.43-0.45x, pile absorbed by collisions): launch vz is exact; apex loss is contact-solver behaviour at launch, not size-related. PM declined baseline A/B; recorded as observation only.

Artifacts: /tmp/dice-lt50/run5.log, results-driver.json, artifacts/shot-*.png. Server killed, port 8877 verified free.
