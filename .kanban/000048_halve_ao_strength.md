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
## Live-test progress (held at watch checkpoint #2)

**Scope unchanged:** live check only — 2 mm contact darkening next to a flat-resting d6 ≈ half of pre-fix, symmetric, no console/GL errors. No unit suites, no code edits.

**Done since last checkpoint:**
- `node --check` clean on harness + driver. Smoke run (MODE=smoke) completed green on mechanics: dual servers up, HTTP 200 ×6, createWorld spy + seeded PRNG + fixed-dt rewrite applied, panel click worked, world settled asleep, single-rAF full-canvas readback OK, glErr=0, console clean except a harness-induced `GPU stall due to ReadPixels` performance warning, fps 19.3, floor P50==P95==49.33 lum (flat floor confirmed), 2 dice spawned by default.
- Smoke exposed two harness bugs, both diagnosed:
  1. Shader needles wrong: the served shaders.js contains the template literal `const float AO_STRENGTH = ${AO_STRENGTH};`, so the evaluated `= 0.5;` never appears literally. Correct needles: `export const AO_STRENGTH = 0.5;` and `ao = mix(1.0, ao, AO_STRENGTH);`. The baseline needle also wrongly matched the pre-existing `mix(1.0, ao, uDirectAo)` lighting line. Baseline worktree /tmp/dice-base-48 verified genuinely at b798ac2 — servers are fine, only the check strings were wrong. Fix queued.
  2. Red-die mask geometry mismatch in the smoke analyze: expected die 0 centre at GL px (447,190) (world −0.2,−15.0,8.0 mm; z=8 mm = exactly half the 16 mm edge → die 0 is flat-resting), but the red mask centroid came out (275,356) with redCount 22491 (a full 16 mm die at 17.32 px/mm should be ~277 px wide, ~76k px). Cause not yet identified — the frame capture probe was written to get raw evidence.
- Frame probe: first attempt failed (`Buffer` is not defined in-page — page context has no Node globals); fixed with chunked `btoa`. Second attempt captured the full 900×900 frame to /tmp/dice-lt48/probe-frame.png (PNG_OK); it crashed only afterwards printing die pixels (`sample()` returns single-body `p`/`q`, not a `bodies` array — probe bug only). Next step: inspect the PNG to see actual die size/colour/position and fix the mask expectations.

**Findings so far:** no product defects yet; all issues so far are harness bugs (needles, mask expectations, probe script). No console/GL errors from the app itself.

**Next on release:** inspect probe-frame.png, fix the mask model in harness.mjs + driver needles, rerun smoke, then the full paired head/base run.
