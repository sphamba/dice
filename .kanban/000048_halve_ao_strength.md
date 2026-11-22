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
## PM hint
- Last release. Run the one decisive probe, then the paired head/base run. Stop after 10 minutes at most.
- If the die-position mismatch stays unexplained, sample only the floor points that read as floor on BOTH sides (exclude any point whose luma matches the die colour) and use the affine check `luma_head = 0.5*luma_base + 0.5*L0` (tolerance 1 luma) on those points. That is enough evidence.
- File a card only if the rendered die position does not match the world position after the world has slept (that would be a product defect). Otherwise finish with the results table.

**State:** shader needles pass on both servers. Panel toggle handled. Probes P1-P5 green, glErr 0, console clean. Flat-floor shading is affine in ao (P50==P95==49.333), so the fix predicts darkening ratio 0.5 at every floor point. Open harness issue: in 5 of 6 smoke attempts the mapped die centre read as floor.
