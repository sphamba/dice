---
name: "fix: body.js scales per-unit-density shape inertia by mass a second time"
priority: "critical"
state: "live-testing"
worktree: "fix/20-inertia-density-double-scale"
issuer: "#14"
complexity: "simple"
shortName: "inertia-density-double-scale"
map: "{\"files\":[{\"path\":\"src/physics/body.js\",\"symbols\":[{\"name\":\"scaleTensor\",\"kind\":\"fn\",\"ins\":2,\"del\":2,\"isNew\":false},{\"name\":\"createBody\",\"kind\":\"fn\",\"ins\":1,\"del\":1,\"isNew\":false}]},{\"path\":\"src/physics/body.test.js\",\"symbols\":[{\"name\":\"inverts the unit density inertia tensor and scales it by the density\",\"kind\":\"fn\",\"ins\":6,\"del\":5,\"isNew\":false},{\"name\":\"uses the absolute tensor of a real dice shape\",\"kind\":\"fn\",\"ins\":13,\"del\":0,\"isNew\":true},{\"name\":\"rotates the inertia tensor into the world frame\",\"kind\":\"fn\",\"ins\":3,\"del\":4,\"isNew\":false},{\"name\":\"spins the body with the world frame lever arm cross impulse\",\"kind\":\"fn\",\"ins\":1,\"del\":1,\"isNew\":false}]},{\"path\":\"src/physics/world.test.js\",\"symbols\":[{\"name\":\"rests a dropped die on the floor of the box\",\"kind\":\"fn\",\"ins\":12,\"del\":0,\"isNew\":true}]}],\"flows\":[],\"role\":\"developer\",\"run\":0,\"model\":\"DeepSeek V4.1 Flash\",\"at\":\"2026-11-15T19:32:24.656Z\",\"head\":\"ef08eee\"}"
changes: "{\"base\":\"main\",\"ins\":42,\"del\":13,\"files\":3}"
commits: "[{\"hash\":\"ef08eee\",\"subject\":\"fix(physics): scale per-unit-density shape inertia by density, not mass\",\"when\":\"2026-11-15T20:31:00+01:00\"}]"
---

# Summary
shape.inertia is per unit density (edge^5/6) but body.js multiplies it by mass again, making invInertia 2.44e5 too large and collapsing all solver impulses; dice free-fall through every surface in world.update flows.

# Specs
Found during live testing of #14. src/dice/shapes.js returns inertia tensors per unit density: d6 inertia = edge^5/6, asserted by shapes.test.js ('has the inertia tensor of a cube of the same edge length', expected = edge ** 5 / 6). src/physics/body.js createBody computes invInertiaBody = 1 / (inertia * mass), i.e. it treats shape.inertia as the absolute tensor and applies density*voume again; body.test.js only covers this convention with a fake shape. With density 1200 the real invInertia is 2.44e5 times too large, so contact solver normal/angular masses collapse (impulses ~1e-11) and dice fall through every surface in world.update flows.

Evidence: shapes.test.js asserts edge^5/6 (unit density); body.test.js asserts 1/(2e-5 * m) (absolute scaled by mass); numeric trace shows solver net impulse ~0 and contacts oscillating while detection output is exactly to spec.

Options: either body.js divides by density only (1/I = inv(inertia) * (1/density)), or shapes.js multiplies inertia by density at creation. Pick one convention, align both test files, and check every consumer of shape.inertia (renderer, #15 solver) before changing.

# Notes
Live test of the merged commit (ef08eee) in headless Chromium against the served worktree. No product defects found; 24/24 checks passed.

## How it was tested
- The app page (index.html + src/main.js) does not wire the physics world yet (canvas setup only), so the world.update flows were exercised in-page in the real app via `await import` of the served modules (src/dice/shapes.js, src/physics/body.js, src/physics/world.js). This is a test limitation, not a defect of this change.
- Scenario values mirror the repo's own flows: tray box W=0.0681, H=0.1476, D=0.0681 (pointer tests), d6 radius = DIE_RADIUS = 0.013856, density 1200 (default), 60 fps `world.update(1/60)` frame loop.
- Expected values from an independent Node reference script (closed-form cube inertia 6/(m*e^2) cross-check, rest-height band edge/2..radius, free-fall time).

## Results
- invInertiaBody diag = 4.768e6 = 6/(density*e^5), matching reference to 1e-15; buggy convention would read 1.164e12 (ratio 244140.6x, matching the task's 2.44e5 claim). Off-diagonals exactly 0; invInertiaWorld equals invInertiaBody for tilted orientations (cube is isotropic).
- Drop: d6 from z=0.0738 rests at z=0.008 (exactly face-down edge/2) by 0.4 s, |v| < 2e-6 m/s at 2 s. Never below z=0.008, no NaN, 18 impact events fired. Matches world.test.js drop regression through the frame-driven update path.
- Two dice dropped together: both rest at z=0.008, settled, stay inside the walls, and OBB SAT (engine orientation bases) shows 4.7e-3 m separation, no overlap.
- Fling from held height (0.25/0.15 m/s + spin): no tunneling (min z=0.008), stays in the tray, settles face-down.
- No console or page errors in the browser run.

## Observation (out of scope, no defect filed)
- After the first floor impact the die rebounds to z=0.056 (apex ~48 mm above the floor from a 73.8 mm drop, effective restitution ~0.86 vs RESTITUTION_BOX 0.3), likely Baumgarte bias stacking across multiple corner contacts. It never exceeds the drop height and settles by 0.4 s, so the fix's acceptance holds; restitution/bias tuning belongs to the solver task, not this one.

## Assumptions
- The tray dims, die radius, density and 60 fps loop above represent the intended app usage (taken from the repo's pointer/world tests).
- Bounce height/restitution behavior is not part of this fix's acceptance (dice must rest, not fall through); it was only recorded.
