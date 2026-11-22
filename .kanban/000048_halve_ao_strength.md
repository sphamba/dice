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
- Keep the check small. This is a one-constant change. Do not build a full mask model.
- Use one simple measure: with one flat d6 at rest, read floor luma at fixed sample points 2 mm outside each of the 4 die edges (use the die centre and quat from the world, not a colour mask), and one reference point beyond AO_RADIUS. Compare head vs base darkening ratio (0.35-0.65) and the 4-side spread.
- If the paired run is not green within 10 minutes, report what you measured and finish. File a card only for a real product defect.

**State:** smoke run green on mechanics (dual servers, seeded world, readback, glErr 0, console clean). Harness bugs found and diagnosed: shader needles (use `export const AO_STRENGTH = 0.5;` and `ao = mix(1.0, ao, AO_STRENGTH);`) and the red-mask expectations. No product defects so far.
