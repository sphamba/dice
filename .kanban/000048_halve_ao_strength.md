---
name: "fix: halve the ambient occlusion darkening"
priority: "medium"
state: "merging"
worktree: "fix/48-halve-ao-strength"
issuer: "user"
complexity: "simple"
shortName: "halve-ao-strength"
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
- Review outcome: approved. Diff is 26 added lines in `src/render/shaders.js` and `src/render/ao.test.js`; nothing else touched.
- `AO_STRENGTH = 0.5` exported from shaders.js and interpolated as a GLSL `const float` into `LIGHTING_FS`; the mix sits in `litColor` immediately after the upsample `sampleAo()` and before the lighting formula. Grep shows exactly one mix site; GTAO, blur, radius, falloff, `FINAL_POWER`, lighting constants and fallback untouched.
- Mobile rules intact: the added line has no loops, no `%`, no divisions.
- Tests match the spec: JS mirror asserts ao 1 stays 1 and ao 0.4 becomes 0.7 (via `toBeCloseTo(0.7, 12)`); source check asserts both forward fragment sources declare and apply `AO_STRENGTH`.
- Settled interpretation: GLSL interpolated const instead of a uniform is the spec's "passed as a uniform if needed" branch; developer's assumption is sound and recorded.
- Evidence at HEAD fb6ea5b: `npx vitest run src/render` 39/39 pass, `npm test` 317/317 pass, `npm run build` green.
- Deferred to live-tester: browser check that flat-resting darkening at 2 mm is about half of main, symmetry, and no console/GL errors.
