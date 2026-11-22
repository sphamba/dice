---
name: "fix: halve the ambient occlusion darkening"
priority: "medium"
state: "done"
worktree: ""
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
## Live test #48: GREEN (final record)

**Scope:** live check only — 2 mm contact darkening next to a flat-resting d6 is about half of pre-fix, symmetric, no console/GL errors. No unit suites, no code edits. Served HEAD = merged fix commit (AO_STRENGTH 0.5 mix in shaders.js), baseline = pre-fix main.

**Method:** dual vite servers (8841 HEAD, 8842 baseline), isolated Playwright contexts, identical seed 20261122 and a fixed-dt `world.update(0.1)` rewrite on both sides, so the scenes are bit-identical in placement (R5: dPos=0.000 mm). One flat d6 via the real UI flow (Show controls → Remove d6), settle to world sleep, then floor luma sampled by GL readPixels inside the app's rAF at 4 points 2 mm outside each die edge (10 mm from the die axis along the two horizontal body axes, positions from the world quat) plus 1 reference point 28 mm out (beyond AO_RADIUS 16.63 mm) and P95 floor luma L0. Key property used (measured, P50==P95==49.333): flat-floor shading is affine in `ao` with a globally constant unoccluded luma, so the fix predicts exactly `luma_head = 0.5*luma_base + 0.5*L0` at every floor point, wall AO included.

**Results (run id lt48-full2, full log /tmp/dice-lt48/full2.log):**

| Check | Result | Evidence |
|---|---|---|
| HTTP 200 page+modules, both servers | PASS | 6/6 status 200 |
| Served HEAD shader applies AO_STRENGTH mix | PASS | needles in served /src/render/shaders.js |
| Served baseline shader has no AO_STRENGTH mix | PASS | needles absent |
| P1-P5 environment probe (webgl2, alpha:false antialias:true, backing 900x900 dpr1, fps ~16, glErr 0) | PASS | |
| Single flat clear d6 in scene, both sides | PASS | attempt 1/6, mz=1.0, z=8.00 mm, 3x3 patch at die centre non-floor |
| R1 darkening ratio head/base per edge point ~ 0.5 | PASS | ratios 0.508/0.497/0.512/0.496, mean 0.503, n=4/4 (limits 0.35-0.65) |
| R2 exact halving residual <= 0.75 lum | PASS | residuals -0.111/0.038/-0.167/0.056 lum |
| R3 baseline darkening present | PASS | meanDb=13.78 lum -> meanDh=6.93 lum |
| R4 head 4-side spread <= 0.5 of mean | PASS | spread 0.075; opposite-face diffs 0.52/0.04 lum |
| R5 seeded head/base scenes identical | PASS | dPos=0.000 mm |
| R6 L0 equal across sides | PASS | 49.333 both |
| R7/R8 console + GL clean | PASS | glErr=0; only vite-connect debug and the harness-induced ReadPixels perf warning |

**Observations (no defects):**
- Absolute darkening (meanDb 13.8 vs the spec's ~6 for an isolated die) is higher because the seeded die rests 3 mm from a tray wall and wall GTAO adds to the pool; the exact per-point halving (R2, residual <= 0.17 lum) covers the wall contribution too, so the acceptance property holds everywhere. Head-side mean 6.9 lum.
- The die's rendered position matches the world position after sleep within ~2 px (probe2 full-frame dump, rendered css (445,707) vs mapped (446.5,709.3)) — checked explicitly because an earlier harness coordinate bug mimicked a mismatch.

**Cards filed:** none. All issues found were harness-side (readback coordinate convention, ref-direction sign, panel toggle flow) and were fixed in the harness, not the product.

**Artifacts:** /tmp/dice-lt48/ (driver.mjs, harness.mjs, full2.log, results-full.json, head/base scene screenshots, probe2.png). Servers stopped, ports 8841/8842 verified closed.
