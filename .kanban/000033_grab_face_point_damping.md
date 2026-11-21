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
Live test #33, driver run3 finished page 1 and is in S8/page-2. Setup changed for cause: the served worktree `dist` was STALE — fresh `npx vite build` of HEAD (507cf53) produces index-CvbZh8Pv.js (46.03 kB) while the served index-CG-QCp7E.js (45.5 kB) lacks the panel disclosure button (no `panel-toggle`/`Show controls` strings) and the Add/Remove aria-labels of current src. The approved-review hash predates parts of HEAD. Harness now serves /tmp/dice-lt33/dist-check (fresh HEAD build). Environment finding, not a product defect in the grab code; flagged for the merger pipeline.

Results so far (run3, page 1, all on fresh build):
- PASS S1: off-center press at +60px holds with zero centroid drift and zero offset-vector drift for 2.5 s; die center never snaps under pointer.
- PASS S3: grab 154 px from center (near hull vertex, silhouette halfwidth 128) — no slide, die follows.
- PASS S4: press inside bounding circle (140 px from center) but outside silhouette holds nothing (centroid moved 0.0 px) + positive control grab right after works.
- PASS S5 (fallback path): held die calms to static ~1.1 s after grab; grabbed-point vector drift 0.0 px; mask-angle drift 0.0 deg over last 0.9 s (damped, not forced upright); grab live after calm. Mid-tumble catch window was missed again — slow-phase window is a few ms wide at 30 fps headless; converting S5 to a retry-press loop next run.
- PASS S6: fling departs +x 320 px in first flight frame; stays inside walls. Tumble check FAIL is a harness measurement bug: pitch tumble keeps the 2D principal-axis angle constant; switching to bbox aspect-ratio spread.
- PASS S6b: slow release = no fling (0 px). PASS S6c movement: over-speed synthetic fling moves die 336 px. S6c containment FAIL is a harness margin bug: die legitimately rests against the wall at the viewport edge (center clamp 1058.3 + circumradius 221.7 = exactly 1280); fixing tolerance to [0, W-1].
- PASS S9: Roll excludes held die (0.0 px drift, held via touch while mouse clicks panel); expanded panel measured (y=602,h=182); held die undisturbed while d8 spawns and settles; (d8 grab check pending in log).
- S2 FAIL = harness expected-value bug (die correctly lands at press+240-off = die.cx+240; my formula added off twice). Behavior correct (offset vector exactly preserved).
- S8 (run3, pending full-log analysis): after real touchCancel, Roll tumbled something (scene diff 337) but the die-region around the touch-grabbed die shows diff=11 — either a stuck hold after pointercancel (possible product defect) or a harness identification bug; two die-region diffs 11 and 8 px both FAIL. Analyzing with pev event log and the grabbed-die identity next; will re-run S8 in isolation with a known single die before filing any card.

No product defect card filed yet. Next: fix 4 harness checks (S2 expected, S6 tumble via aspect, S6c/S6 containment margin, S5 retry-press catch), rerun, analyze S8 in isolation, then page-2 S7 shared-grab tests.
