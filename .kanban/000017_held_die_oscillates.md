---
name: "fix: held die oscillates around the pointer instead of following at hold height"
priority: "high"
state: "done"
worktree: "fix/17-held-die-oscillates"
issuer: "#13"
complexity: "simple"
map: "{\"files\":[{\"path\":\"src/input/pointer.js\",\"symbols\":[{\"name\":\"drive\",\"kind\":\"fn\",\"ins\":9,\"del\":0,\"isNew\":false},{\"name\":\"pump\",\"kind\":\"fn\",\"ins\":0,\"del\":10,\"isNew\":false},{\"name\":\"createPointer\",\"kind\":\"fn\",\"ins\":1,\"del\":2,\"isNew\":false},{\"name\":\"onDown\",\"kind\":\"fn\",\"ins\":0,\"del\":1,\"isNew\":false},{\"name\":\"destroy\",\"kind\":\"fn\",\"ins\":1,\"del\":2,\"isNew\":false}]},{\"path\":\"src/input/pointer.test.js\",\"symbols\":[{\"name\":\"makeDie\",\"kind\":\"fn\",\"ins\":8,\"del\":0,\"isNew\":true},{\"name\":\"dragWorld\",\"kind\":\"fn\",\"ins\":7,\"del\":0,\"isNew\":true},{\"name\":\"setup\",\"kind\":\"fn\",\"ins\":2,\"del\":5,\"isNew\":false},{\"name\":\"grabs the highest die under the point\",\"kind\":\"case\",\"ins\":3,\"del\":10,\"isNew\":false},{\"name\":\"drives the held die at hold height within one frame of a still pointer\",\"kind\":\"case\",\"ins\":9,\"del\":0,\"isNew\":true},{\"name\":\"keeps a still die at hold height at every frame rate\",\"kind\":\"case\",\"ins\":16,\"del\":0,\"isNew\":true},{\"name\":\"follows a pointer jump without overshoot at every frame rate\",\"kind\":\"case\",\"ins\":15,\"del\":0,\"isNew\":true},{\"name\":\"releases with the pointer velocity and lets go of the die\",\"kind\":\"case\",\"ins\":0,\"del\":0,\"isNew\":false}]},{\"path\":\"src/physics/world.js\",\"symbols\":[{\"name\":\"createWorld\",\"kind\":\"fn\",\"ins\":2,\"del\":0,\"isNew\":false},{\"name\":\"step\",\"kind\":\"fn\",\"ins\":1,\"del\":0,\"isNew\":false}]},{\"path\":\"src/physics/world.test.js\",\"symbols\":[{\"name\":\"beforeStep\",\"kind\":\"case\",\"ins\":16,\"del\":0,\"isNew\":true}]}],\"flows\":[],\"role\":\"developer\",\"run\":0,\"model\":\"DeepSeek V4.1 Flash\",\"at\":\"2026-11-15T18:52:35.232Z\",\"head\":\"cad2780\"}"
changes: "{\"base\":\"main\",\"ins\":96,\"del\":39,\"files\":4}"
commits: "[{\"hash\":\"e6acf18\",\"subject\":\"fix(input): drive held dice at the integration step so they follow the pointer\",\"when\":\"2026-11-15T19:51:35+01:00\"}]"
---

# Summary
During drag the held die does not settle at the pointer: drive velocity is computed per rAF frame but persists for the whole frame, overshooting about 8x, so the die limit-cycles around the target with an amplitude close to the die size instead of following at hold height z = D - 2*radius.

# Specs
Observed in a browser live test of task #13 (Chromium, 60 fps rAF, real Pointer Events, dice driven through src/physics/world.js):

- Desktop, still finger on a die: die z wanders up to 31.8 mm around hold height (holdZ 22.3 mm), so it repeatedly dips to z about -9.5 mm, through the floor plane z = 0. xy stays exactly at the pointer (no xy force at rest).
- Desktop, pointer jumps 344 mm: die xy error peaks at 26.9 mm and keeps oscillating (sim: sustained for seconds), z error peaks at 17.3 mm.
- Phone (390x844 @3x), two still fingers: z error peaks at 30.3 mm around holdZ 39.8 mm.
- Phone, fingers move 6.9 mm / 5.2 mm: xy error peaks at 23.1 mm / 24.8 mm, i.e. 3-5x the move distance.

Mechanism: src/input/pointer.js drive() sets v = (target - position) / FIXED_DT once per animation frame, but the world integrates that velocity for the whole frame (about 8 substeps of 1/480 s at 60 fps), so the die overshoots the target about 8x each frame. The MAX_DRAG_SPEED clamp turns the overshoot into a sustained limit cycle of roughly 2 m/s * 16.7 ms = 33 mm. An independent closed-loop simulation of world.js + pointer.js reproduces this exactly: about 30 mm z amplitude at 60 fps regardless of whether the pump runs before or after the world update, about 17 mm xy after motion, worse at 30 fps (about 65 mm). See /tmp/drag-loop-sim.js and /tmp/order-sim.js (session artifacts, may be gone).

This violates the task #13 spec: "Drag: the held die follows the pointer at hold height z = D - 2*radius". The Notes claim "a still finger keeps the die up" only holds loosely: the die stays near hold height but wobbles about the die's own diameter (27.7 mm). The unit test checks a single drive step and cannot catch this closed-loop, frame-rate-dependent behavior.

# Notes
Live test done. 16/16 checks passed, no defects found. The held die follows the pointer at hold height at 60 fps and ~30 fps, with mouse and two-finger touch; the defect's limit cycle is gone.

## How it was tested
- Same approach as the #13 live test: main.js still does not wire the world (integration is task #8), so an untracked harness page (live-harness/, deleted after the test) wired createPointer to createWorld/createBody with createShape('d6', DIE_RADIUS) using the exact Spec mapping, and ran world.update in a rAF loop. Chromium (Playwright 1.59), real trusted input: mouse on desktop, two CDP touch points on phone.
- Contexts: desktop 1280x800 dpr 1 (mouse) at 60 fps; same page at ~30 fps (harness ran world.update every 2nd rAF with the full 33 ms dt, measured ~32 updates/s); phone 390x844 dpr 3 hasTouch (multi-touch). rAF frame dt 15.5-16.7 ms in all contexts.
- Sampled every body at every fixed step (480 Hz) via a world.step wrapper that does not change physics; follow error measured against the pointer target timeline logged from the module's own toWorld. Expected values (mpp, box D, holdZ, px<->world mapping) from an independent Node reference; it reproduces the defect report numbers (desktop holdZ 22.287 mm with the 0.05 m guard, phone 39.828 mm).
- Environment constraint (not a finding of this task): collision detection is not wired yet, nothing populates world.contacts, so dice have no floor or walls. The harness placed each die at hold height right before grabbing (as in the #13 test). Release checks therefore verify "lets go" as heldBodies empty plus free fall, not a floor landing. Initial probe run showed dice falling through the floor; diagnosed as the missing contact population, not a drive bug.

## Results (all errors in mm, hold z = D - 2*radius)
| Check | Result |
| --- | --- |
| Desktop still hold 2.5 s | settles 33 ms after press, then steady z error 0.043 mm (matches closed form g*FIXED_DT^2), xy error 0.000 mm, zero z-error sign flips, min z 20.63 vs hold 22.29. Defect was +/-31.8 mm wander with dips to -9.5 mm. |
| Desktop jump 40 mm (single move event) | settled 15 ms, overshoot 0.001 mm, z peak 0.180 mm, then exactly 0. Defect was 26.9 mm xy and 17.3 mm z, sustained for seconds. |
| Desktop drag 16 mm at 40 mm/s (8 events) | post-step lag 0.000 mm; per-event 2 mm target increments are consumed within one fixed step; z peak 0.043 mm. |
| Desktop release | heldBodies empty, die falls freely with the fling velocity. |
| 30 fps hold still / jump | steady z error 0.043 mm, jump settles 33 ms, overshoot 0.001 mm. The defect sim predicted ~65 mm amplitude at 30 fps. |
| Phone two fingers still 2.5 s | both dice: xy error 0.001 mm, z within 1.53 mm of hold 39.83 in the window (that peak is the raise tail from the press position, monotone, no flips); steady 0.043 mm. Defect was 30.3 mm z error. |
| Phone two fingers move 6.9 / 5.2 mm | lag peaks 1.150 / 0.868 mm, exactly the per-event target increments. Defect was 23.1 / 24.8 mm. |
| Phone release both | heldBodies empty, both dice fall. |
| Pick/multi-touch sanity | one mouse press holds 1 die; two touchStarts hold 2 dice (pointerIds 2 and 3, matched to dice geometrically); 12 trusted pointermove events arrived for 12 dispatched touchMoves. |
| Page health | no console or page errors in any context. |

## Assumptions
- Frame-loop caller pattern per the task Notes: world.update runs every animation frame with the rAF dt. The 30 fps variant emulates a 30 Hz caller (update every 2nd rAF). 144 fps was not exercised live (headless display link is not controllable); the unit suite covers it closed-loop.
- Dice are real d6 shapes at the 16 mm die size (circumscribed radius DIE_RADIUS); gravity stays the default (0, 0, -9.81) since device-motion gravity (#12) is not wired in a harness.
- Hold height target z = D - 2*radius and MAX_DRAG_SPEED 2 m/s unchanged, per the task Notes.
- CDP touch point ids are not pointerIds (observed in #13); checks match pointers to dice by geometry, not by id.
- The measured press-time transients (up to 5.8 mm below hold height on desktop, 1.5 mm on phone) come from the harness placing dice milliseconds before the grab while gravity is unsupported; they converge monotonically and do not indicate oscillation.
