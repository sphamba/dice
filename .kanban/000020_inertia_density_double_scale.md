---
name: "fix: body.js scales per-unit-density shape inertia by mass a second time"
priority: "critical"
state: "to-review"
worktree: "fix/20-inertia-density-double-scale"
issuer: "#14"
complexity: "simple"
shortName: "inertia-density-double-scale"
---

# Summary
shape.inertia is per unit density (edge^5/6) but body.js multiplies it by mass again, making invInertia 2.44e5 too large and collapsing all solver impulses; dice free-fall through every surface in world.update flows.

# Specs
Found during live testing of #14. src/dice/shapes.js returns inertia tensors per unit density: d6 inertia = edge^5/6, asserted by shapes.test.js ('has the inertia tensor of a cube of the same edge length', expected = edge ** 5 / 6). src/physics/body.js createBody computes invInertiaBody = 1 / (inertia * mass), i.e. it treats shape.inertia as the absolute tensor and applies density*voume again; body.test.js only covers this convention with a fake shape. With density 1200 the real invInertia is 2.44e5 times too large, so contact solver normal/angular masses collapse (impulses ~1e-11) and dice fall through every surface in world.update flows.

Evidence: shapes.test.js asserts edge^5/6 (unit density); body.test.js asserts 1/(2e-5 * m) (absolute scaled by mass); numeric trace shows solver net impulse ~0 and contacts oscillating while detection output is exactly to spec.

Options: either body.js divides by density only (1/I = inv(inertia) * (1/density)), or shapes.js multiplies inertia by density at creation. Pick one convention, align both test files, and check every consumer of shape.inertia (renderer, #15 solver) before changing.

# Notes
- Fixed in src/physics/body.js: invInertiaBody = inverse(shape.inertia * density), shape.inertia stays per unit density (d6 = edge^5/6, confirmed by shapes.test.js).
- body.test.js updated to the density convention and gains a real d6 shape check against mass * edge^2 / 6.
- world.test.js gains a drop regression: a real d6 die dropped from mid-box rests on the floor within 1 s (fails before the fix, passes after).
- Assumptions: shape.inertia is per unit density everywhere (only consumer is createBody); no renderer or solver code reads shape.inertia directly.
- Verification: scoped suites green (124 tests), build green, clean-room archive + npm ci + npm test (175 tests) + build green with relative asset paths.
