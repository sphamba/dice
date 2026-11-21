---
name: "fix: drag dice by the grabbed face point with linear and angular damping"
priority: "high"
state: "live-testing"
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
Live test in progress (environment probe mostly done, no product findings yet).

Setup: serving the worktree `dist` (asset hashes match the approved review: index-CG-QCp7E.js) via python http.server on 127.0.0.1:4733; Playwright (chromium 147) from /home/phamba/repos/tarot/app; harness in /tmp/dice-lt33 (lib.mjs shared: screenshot->PNG->ImageMagick raw->red-die blob analysis with pip-hole fill + convex hull, CDP touch helpers, box math). No code edits; storage seeded once per fresh context with the app's own format `dice.set={"d6":1}`.

Probe facts pinned so far:
- Viewport 1280x800, dpr 1: box W=0.08 m, H=D=0.05 m, px/m=16000, die circumradius 221.7 px, face halfwidth 128 px, 2 mm = 32 px.
- Headless fps ~29.5 (SwiftShader); initial settle ~1.7 s; no console errors on load.
- Red-mask blob analysis isolates the die cleanly (area 65604 px, one blob); shadows/background/panel excluded.
- Mouse grab plumbing works end to end: off-center press + drag, die followed the pointer.
- CDP touch -> pointer events: touchStart yields pointerdown with pointerType=touch, pointerId 2 then 3 for a second simultaneous point. Hit a harness bug: each touch() call opened a NEW CDP session, so touchMove was rejected ("Must send a TouchStart first"). Fix planned: reuse one CDP session per page for the whole touch sequence, then finish pinning touchMove/touchEnd/touchCancel semantics.

Design assumptions for the usage tests (from reading src/input/pointer.js, main.js, physics/*):
- Camera is orthographic top-down: world z is invisible on screen, so hold height, vz=0 on release and drop behavior are only indirectly observable (XY tracking, occlusion, stacking outcomes). Numeric anchor tolerances (1 mm/2 mm, 30/60/144 fps) stay with the unit suite; live checks are behavioral.
- At 1280x800 hold height D-2r = 0.0223 m, so a held die genuinely hovers (bottom ~0.0084 m above floor): enables the hover-over-second-die scenario for nearest-surface pick + shared multi-pointer grab (#18).
- At phone viewport 390x844 the box depth (0.0225 m) is smaller than 2r (0.0277 m): a held die cannot lift there (drive z-target is below the floor and containBody clamps); drag still works. The spec preserves the D-2r formula, so this is an observation, not a defect.

Remaining plan: probe touch semantics (fixed CDP session), then scenario driver: off-center grab no center-snap + point-tracks-pointer drag; near-edge/vertex hold no slide; bounding-circle miss holds nothing (with positive control); roll -> mid-tumble grab calms to rest without forced upright; fling (direction, tumble, containment) + synthetic over-speed fling containment; panel Roll exclusion while held + d8 grab sanity; two-pointer shared grab (mouse + touch): last pointer wins, partial release, return to first pointer; pointercancel release. Report via kanban_create defect cards + Notes rewrite.
