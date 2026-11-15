---
name: "fix: held die oscillates around the pointer instead of following at hold height"
priority: "high"
state: "doing"
worktree: "fix/17-held-die-oscillates"
issuer: "#13"
complexity: "simple"
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
