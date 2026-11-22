---
name: "fix: halve the ambient occlusion darkening"
priority: "medium"
state: "live-testing"
worktree: "fix/48-halve-ao-strength"
issuer: "user"
complexity: "simple"
shortName: "halve-ao-strength"
changes: "{\"base\":\"main\",\"ins\":26,\"del\":0,\"files\":2}"
commits: "[{\"hash\":\"fb6ea5b\",\"subject\":\"fix(render): halve the ambient occlusion darkening\",\"when\":\"2026-11-22T13:06:02+01:00\"}]"
---

# Summary
The GTAO contact darkening is too strong. Add an AO strength constant of 0.5 so the darkening is half of what it is now, with no other visual change.

# Specs
# Need
- Keep 50% of the current AO darkening. Now: about 6 lum at 2 mm from a flat-resting die and up to 13 lum under an edge-resting die. Target: about 3 and 6.5 lum.

# Change
- Add `AO_STRENGTH = 0.5` (constant in `src/render/renderer.js` or `src/render/shaders.js`, passed as a uniform if needed). In the forward pass, after the AO upsample, use `ao = mix(1.0, ao, AO_STRENGTH)` before the lighting formula.
- Do not change the GTAO pass, the blur, the radius, the falloff, `FINAL_POWER`, the lighting constants or the fallback.
- Keep the #46 mobile rules: no uniform-bounded loops, no `%` by a uniform, guard every division.

# Tests
- A unit test of the strength mix (JS mirror or exported helper): ao 1 stays 1, ao 0.4 becomes 0.7.
- A source check that the forward shader applies `AO_STRENGTH`.

# Acceptance criteria
- `npx vitest run src/render`
- `npm test`
- `npm run build`
- Live check (browser): the contact darkening next to a flat-resting d6 is about half of its value on main, it is still symmetric, and there are no console or GL errors.

# Notes
## Live-test progress (held at watch checkpoint #4)

**Scope unchanged:** live check only — 2 mm contact darkening next to a flat-resting d6 ≈ half of pre-fix, symmetric, no console/GL errors. No unit suites, no code edits.

**Design:** floor points only, positioned from the world quat: 4 near points 2 mm outside each die edge (10 mm from the die axis along the two horizontal body axes), 1 reference point beyond AO_RADIUS (16.63 mm) in the clearest direction, plus P95 floor luma as the unoccluded level L0. Flat-floor shading is affine in `ao` with globally constant unoccluded luma (measured P50==P95==49.333), so under the fix the exact relation `luma_head = 0.5*luma_base + 0.5*L0` and darkening ratio 0.5 hold at every floor point, wall AO included. Determinism (seed 20261122 + fixed `world.update(0.1)` rewrite) makes head and base scenes identical (R5 measured dPos=0.000 mm).

**Breakthrough since last checkpoint:**
- The decisive probe (probe2: full-frame PPM dump + raw 3x3/5x5 RGB grids) pinned the earlier "die centre reads as floor" bug: a coordinate-convention mismatch in MY readback helper, NOT a product defect. The die renders exactly at the world position (rendered css (445,707) vs mapped (446.5,709.3), ~2 px). No card needed. Driver now computes all sample points in css space (worldToCss) with the world-y offset sign flipped for css (y grows downward).
- FULL PAIRED RUN COMPLETED (full1.log). Core acceptance is GREEN where sample points were valid:
  - R1 darkening ratio per edge point: 0.494 / 0.497 / 0.500 (target ~0.5) on the 3 valid points.
  - R2 exact-halving residual: 0.093 / 0.037 / 0.001 lum (tolerance 0.75) on the same points.
  - R5 seeded head/base die positions identical (0.000 mm). R6 L0 equal (49.333 both). R7/R8 console+GL clean on both sides (only the harness-induced ReadPixels perf warning).
- Remaining FAILs are all one harness issue: the reference-point distance used `|px|`, collapsing the +x and −x directions to the worst side, so the ref point never validated (refOk=false in all 12 attempts), and invalid (−1) pairs polluted the R1 mean, R3 mean and R4 spread. Fixed both just now: signed per-axis wall distance for the ref direction, and PM-hint filtering (drop points that are not floor on both sides before averaging). Near points can legitimately be invalid when the die rests close to a wall (the 2 mm point falls outside the tray); those attempts still have other valid points.

**Next on release:** rerun MODE=full once (expect all R1-R8 green: R4 valid-point spread is 0.097 vs 0.5 limit). Then final notes + results table, no cards (no product defects found).
