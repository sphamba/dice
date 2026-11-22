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
## Live-test progress (held at watch checkpoint)

**Scope fixed from TASK.md:** live check only — contact darkening at 2 mm next to a flat-resting d6 is about half of its pre-fix value, still symmetric, no console/GL errors. No unit suites run. No code edited.

**Inspection done (one pass):**
- Fix already merged: main and this worktree are both at fb6ea5b, so the pre-fix baseline is the parent commit b798ac2. Diff verified: `AO_STRENGTH = 0.5` (src/render/shaders.js:4), GLSL const in LIGHTING_FS, `ao = mix(1.0, ao, AO_STRENGTH)` in `litColor` right after `sampleAo()`; only shaders.js + ao.test.js touched. Reviewer Notes confirmed accurate.
- App flow: vite + canvas `#view`, panel with `aria-label` buttons (`Remove d6`, `Add d6`, `Roll dice`), `DEFAULT_SET = {d6: 2}` red dice, orthographic top-down camera, tray 51.95 mm at 900×900 dpr1 (17.323 px/mm; 2 mm ≈ 34.6 px), `AO_RADIUS` ≈ 16.63 mm, `MAX_FRAME_DT = 0.1`, `FIXED_DT = 1/480`, `MAX_STEPS = 16`.
- Precedent harnesses reused: /tmp/dice-lt46 (readback + baseline-worktree pattern), /tmp/dice-lt47.

**Test design (state so far):** one shared harness /tmp/dice-lt48/harness.mjs + driver.mjs written (not yet run). Dual vite servers :8841 (HEAD worktree) and :8842 (baseline temp worktree at b798ac2). Determinism by test-only rewrite of the SERVED main.js: createWorld spy + seeded PRNG (mulberry32, seed 20261122) + fixed physics step `world.update(0.1)`, so head and base simulate identical scenes. Measurement per side: panel-driven removal to exactly 1 d6, settle, flat check via the app's own `quat.rotateVec3` (body axis vs world z ≥ 0.995), single-rAF full-canvas `gl.readPixels`, 24-direction ray march to the red-die silhouette, floor patch mean luma at 2 mm (near) and 17 mm (reference, beyond AO radius), unoccluded floor luma = P95. Checks: paired per-direction head/base darkening ratio in 0.35–0.65, opposite-direction symmetry ≤ 0.5 of mean darkening, scale-chain calibration (max silhouette ray vs 11.31 mm half-diagonal, ±5%), die centroid match ≤ 2 px between sides, console + `gl.getError` clean on both sides.

**Findings so far:** none yet — no browser run executed before the checkpoint.

**Next on release:** `node --check` both files, smoke run (MODE=smoke), then full paired run, results table, defects (if any) via kanban_create, final Notes rewrite.
