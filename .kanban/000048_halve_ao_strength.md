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
## Live-test progress (held at watch checkpoint #3)

**Scope unchanged:** live check only — 2 mm contact darkening next to a flat-resting d6 ≈ half of pre-fix, symmetric, no console/GL errors. No unit suites, no code edits.

**Design updated per PM hint (small check, no mask model):** floor points only, positioned from the world quat: 4 near points 2 mm outside each die edge (10 mm from the die axis along the two horizontal body axes), 1 reference point beyond AO_RADIUS (16.63 mm) in the clearest direction, plus P95 floor luma as the unoccluded level L0. Key simplification found: flat-floor shading is affine in `ao` with globally constant unoccluded luma (smoke measured P50==P95==49.333), so under the fix the exact relation `luma_head = 0.5*luma_base + 0.5*L0` and darkening ratio 0.5 hold at every floor point, wall AO included. Determinism (seed 20261122 + fixed `world.update(0.1)` rewrite) makes head and base scenes identical, so pairing is exact.

**Progress since last checkpoint:**
- Shader needles fixed and passing on both servers (`export const AO_STRENGTH = 0.5;` + `ao = mix(1.0, ao, AO_STRENGTH);` present on HEAD, absent on baseline).
- Found the panel is collapsed by default: `Remove d6` lives inside hidden `.panel-rows` behind a `.panel-toggle` ("Show controls") button. Driver now clicks the toggle first (real user flow).
- Smoke run then completed mechanically: probe P1-P5 all green (webgl2, alpha:false antialias:true, backing 900x900 dpr1, fps ~23, glErr 0), single-d6 state reached, flat check via app quat passes (mz=1.0, z=8.00 mm = half the 16 mm edge), console clean except the harness-induced ReadPixels stall warning.
- NEW harness bug under diagnosis: in 5 of 6 smoke attempts the 3x3 patch at the mapped die centre read as floor (49.333), i.e. the sampled points did not land on the rendered die, while attempt 6 (after 5 rolls) matched exactly (screenshot confirms the die at the mapped position css 155,500 = GL 155,399). The mapping itself was validated earlier against a captured frame (die at css 445,707 vs world-predicted 447,709). Suspects: panel-toggle/Remove clicks interacting with pointer grab, or a stale-asleep state — not yet identified.
- No product defects so far; all issues are harness-side.

**Next on release:** one decisive probe in the exact attempt-1 state (settle, toggle, remove, settle, sample, full-frame PPM dump + raw 3x3 RGB at mapped centre/near points) to pin the offset cause, fix the driver, then the paired head/base run (10-minute budget per PM).
