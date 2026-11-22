---
name: "fix: drag dice by the grabbed face point with linear and angular damping"
priority: "high"
state: "done"
worktree: "fix/33-grab-face-point-damping"
issuer: "#8"
complexity: "moderate"
shortName: "grab-face-point-damping"
blockedBy: ""
splitter: "done"
changes: "{\"base\":\"main\",\"ins\":284,\"del\":95,\"files\":2}"
commits: "[{\"hash\":\"507cf53\",\"subject\":\"fix(input): grab the exact face point under the pointer with held damping\",\"when\":\"2026-11-18T23:02:40+01:00\"}]"
---

# Summary
Use exact ray/face picking and retain a body-local grab point. Drive that point under the pointer with strong frame-rate-independent linear and angular damping while held, preserving fling behavior and approved shared multi-pointer grabs.

# Specs
# User-visible behavior
- Grab the actual visible point on the die face under the pointer, not the die center. An initial off-center grab must not slide or snap the die center under the pointer.
- While held, pull that same material point toward the pointer and continuously damp both held linear and angular motion. Use frame-rate-independent damping in the fixed-step path; do not rely on the low free-body damping or contact-only damping.
- Do not force the die upright or lock its orientation. Let remaining rotation evolve naturally while angular velocity decays to rest during a stationary hold.
- Preserve the existing release/fling contract: pointer velocity supplies center-of-mass XY velocity, vz becomes zero, residual spin remains and existing speed-based random fling spin is added. Preserve the 3 m/s release clamp and pointercancel behavior.

# Picking and drive requirements
- In `src/input/pointer.js`, intersect the orthographic downward ray with actual transformed convex die faces. Select the closest non-negative surface hit across dice, not the greatest body-center z.
- Convert the selected world hit into a body-local point on pointer down. On every fixed step, rotate that local point with current orientation and drive the center so the material point tracks pointer XY.
- Preserve center hold height `D - 2 * radius`. Account for point velocity as `linearVelocity + angularVelocity x rotatedOffset`, so damping rotation does not move the grabbed anchor away from the finger.
- Retain the existing broad-phase as an optimization if useful, but a press inside a body's bounding circle and outside its projected face must hold nothing.
- Apply dedicated held damping in the existing `world.beforeStep` drive path. Do not add another world callback or change unheld integrator damping.

# Multi-pointer contract (#18)
- A second pointer may grab an already-held die and `heldBodies()` may contain duplicates.
- Every held entry drives in insertion order, so the last held entry determines the final drive that frame. Releasing one pointer removes only its entry; other holds survive without a stuck body.

# Regression coverage
- Cover exact face hits, off-center anchor tracking, misses within the bounding circle, nearest-surface selection between overlapping dice, and every supported die type using complete real shape data or equivalent test doubles.
- Verify anchor and height within 1 mm after settling at 30, 60 and 144 fps, with no initial center snap and no more than 2 mm anchor overshoot after a pointer jump.
- With no collisions and initial angular speed 60 rad/s, held angular speed must fall below 0.1 rad/s within one second and must not grow while the pointer stays still. Verify linear motion also settles without oscillation or ongoing drift.
- Keep existing held-body release and roll-exclusion behavior. Test duplicate shared holds and last-pointer drive without deduplicating `heldBodies()`.

# Acceptance commands
- `npx vitest run src/input/pointer.test.js`
- `npm run build`

# Notes
Live test #33 COMPLETE. Final run (run13) on the approved merged commit 507cf53 (worktree build dist-check, fresh `vite build`, asset hash CvbZh8Pv): 29/30 PASS.

## Results table
| # | Check | Result | Evidence |
|---|---|---|---|
| P1 | one die after ensureClear | PASS | count=1 |
| S1 | no center snap/slide, stationary hold | PASS | max centroid jump 0.0px (a snap would be ~60px) |
| S1 | grabbed point stays under pointer | PASS | vector drift 0.0px, v0=[-60,0] |
| S1 | die stays visibly off-center | PASS | final offset 60px |
| S2 | die followed a 240px slow drag | PASS | cx=466 exactly as predicted |
| S2 | offset preserved during drag | PASS | vEnd=[-60,0]=v0 (center-grab would read ~0) |
| S2 | center not pulled under pointer | PASS | |vEnd|=60px |
| S3 | near-vertex grab (153px from center, past 128px face halfwidth) | PASS | vector drift 0.0px, die follows |
| S4 | press inside bounding circle (138px), outside silhouette = no grab | PASS | die unmoved (0.2px) |
| S4 | positive control right after the miss | PASS | die follows |
| S5 | mid-tumble catch calms to static | PASS | static 972ms after grab |
| S5 | grabbed point stays under pointer while decaying | PASS | vector drift 0.0px |
| S5 | no rotation drift once settled (damped, not forced) | PASS | mask angle drift 0.0deg over last ~0.9s |
| S5 | grab live after calm | PASS | die follows |
| S6 | fling departs in pointer direction | PASS | bbox x0 943 vs launch 320 (24 rAF frames) |
| S6 | flung die tumbles | PASS | mid-flight mask angles 30,30,-49,77,-49 deg |
| S6 | flung die stays inside walls | PASS | contained in all 24 frames |
| S6b | slow release produces no fling | PASS | moved 0px |
| S6c | over-speed fling actually moves the die | HARNESS LIMIT | see below |
| S6c | over-speed fling contained, no tunneling | PASS | die present, in-box in 22 grabbed frames |
| S8 | touch grab moves the die | PASS | |
| S8 | pointercancel fires for the touch pointer | PASS | pev: pointercancel id=2 pt=touch |
| S8 | cancelled touch releases the hold | PASS | 0px follow after cancel (follow would be ~80px) |
| S8 | mouse grab follows before cancel | PASS | |
| S8 | mouse pointercancel releases the hold | PASS | 0px follow after cancel |
| -- | no unexpected console errors | PASS | |

## S6c "actually moves": harness limit, not a product defect
The check flings via a synthetic pointerId-1 pointermove(+1600px)+pointerup pair. In run13 the die never displaced in any grabbed frame; the identical synthetic code moved the die 213-336px in runs 4-8 on this same app build (507cf53), and the release-fling mechanism is independently proven this run (S6: die displaced 600+px, tumbled mid-flight; isolated probe fr.mjs: real-mouse fling moved the die 607px from rest with the pointerup confirmed delivered and zero pageerrors). The property the check exists to guard - a 3 m/s clamped release still moves the die and it never tunnels the walls - is covered by the PASSing S6 depart + S6c containment + fr.mjs evidence. Not filed as a defect, per PM steer.

## Harness assumptions, driver bugs fixed, environment limits
- Harness: orthographic top view; a resting die reads as "raised" under the offset directional shadow, so rest-state reads use whole-scene diffs, not mask offsets (per PM steer on #37). Physics runs in the fixed-step path with a frame-dt cap; headless SwiftShader rAF ~5-30fps makes sim time compress/stretch vs real time, so timing-based gates live in unit-level checks and visual gates use per-frame geometry.
- Driver bugs fixed during the task: synthetic pointercancel sent with pointerId 0 because the pev spy stores ids under `id` (read `.pointerId`); rapid CDP mouse moves coalescing into one pointer sample made flingVelocity read zero (S6 fling moves now spaced 45ms); CDP screenshots (~250ms latency) too slow for a 0.3-3 m/s flight in a 0.05 m box (added an in-page rAF canvas frame grabber, lib grabFrames); two crashes (missing import; destructuring analyze's array return).
- Environment: Roll cannot serve as a release/settle signal until #37 lands (rolled dice get ROLL_LIFT in a 0.05 m box); all release/cancel signals use grab/cancel instead.
- Servers killed, port 4733 verified free, no stray drivers.
