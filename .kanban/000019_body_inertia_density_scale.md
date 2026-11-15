---
name: "fix: scale shape inertia by density instead of mass in body.js"
priority: "high"
state: "backlog"
worktree: ""
issuer: "#15"
complexity: "simple"
shortName: "body-inertia-density-scale"
blockedBy: "question"
---

# Summary
createBody scales the unit-density shape inertia tensor by mass instead of density, making invInertiaWorld about 1/volume (244,000x for a die) too large, so bodies spin essentially freely.

# Specs
# Context
`src/dice/shapes.js` builds `shape.inertia` with a `radius**5` scaling (shapes.js:316), i.e. the tensor is per unit density (I ∝ m·r², m = ρ·r³). `src/physics/body.js` `createBody` must therefore scale it by `density`.

# Defect
`src/physics/body.js:36`: `invInertiaBody: mat3.invert(mat(), scaleTensor(mat(), shape.inertia, mass))` scales by `mass` instead of `density`. Since `mass = density * volume`, the resulting inertia is `volume` times too small (factor 4.096e-6 for a 16 mm die) and `invInertiaWorld` is `1/volume ≈ 244,000` times too large.

# Evidence (measured in headless Chromium, d6 = 16 mm cube, density 1200)
- Actual `invInertiaWorld[8]` ≈ 1.16e12 (I ≈ 8.6e-13 kg·m²).
- Expected I = m·s²/6 = 4.9152e-3 · (0.016)² / 6 = 2.097152e-7 kg·m², so `invInertiaWorld[8]` = 4.76837158e6.
- Ratio actual/expected = 244,141 = 1/volume, exactly the mass-vs-density mix-up.

# Impact
Every dynamic body spins essentially freely: the contact solver's angular terms collapse, friction produces violent spins, and tumbling dice behave nothing like real dice. Found during #15 live testing; the solver itself was validated with a driver-side patch that set `invInertiaBody` to the closed-form cube inertia, after which all 37 checks passed.

# Fix
Scale by density: `scaleTensor(mat(), shape.inertia, density)` in `createBody`, and fix any unit tests that assert against the wrong inertia values.

# Notes

# Open questions
None. Fix is one token (mass → density) plus updating makeBody-based unit tests that assert against the wrong inertia.
