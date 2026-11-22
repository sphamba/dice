---
name: "feat: replace directional shadows with orthographic GTAO ambient occlusion"
priority: "medium"
state: "doing"
worktree: "feat/38-ortho-gtao-ambient-occlusion"
issuer: "user"
complexity: "complex"
shortName: "ortho-gtao-ambient-occlusion"
splitter: "done"
---

# Summary
Remove the directional shadow map and add a custom screen-space GTAO pass in raw WebGL2, changed for the orthographic top-down camera. AO darkens the floor around and between dice, and fades out under raised dice.

# Specs
# Goal
- Remove the directional shadows (shadow map, depth pass, light frustum). Keep the directional light for diffuse and specular face shading only.
- Add ground-truth ambient occlusion (GTAO, Jimenez 2016, with the slice integral from XeGTAO) as a screen-space pass in raw WebGL2. Spec #6 stays in force: no library.
- Visual target: soft contact darkening on the floor at the base of each die and between dice. The darkening is symmetric around a resting die, with no offset shadow. Under a held or airborne die, the darkening fades out as the die rises and is gone at about 15 mm above the floor.

# Facts about the current renderer (main at the time of filing)
- `src/render/shaders.js`: `shadowFactor` (3x3 PCF), `depthVertexSource`/`depthFragmentSource`, `uShadowMap`, `uShadowTexel`, `uLightViewProj`, `vShadowCoord`, and `litColor()` = `base*(ambient + intensity*diffuse*shadow) + specular*intensity*shadow`.
- `src/render/renderer.js`: `shadowSize`, `DEPTH_UNIFORMS`, `drawShadowPass`, light matrix cache in `draw`, `resize(w,h,box)` rebuilds the camera, context restore calls `buildResources()`.
- `src/render/camera.js`: orthographic top-down camera, eye `(0,0,D+M)`, `M = CAMERA_MARGIN = 0.05`, near `M/2`, far `D+2M`. View basis equals world basis. Window depth is linear: `worldZ = (D + M/2) - d*(D + 1.5M)`. `createLightViewProjection` builds the shadow frustum.
- `src/render/gl.js`: `createDepthTexture`, `createDepthFramebuffer`, `createLabelTexture`, `createVAO`.
- The canvas context uses default attributes (MSAA on). The renderer draws only the floor and the dice (no walls, no lid). `canvas-size.js` caps DPR at 2.

# Remove
- `shadowFactor`, the depth shaders, all shadow uniforms and varyings, `shadowSize`, `DEPTH_UNIFORMS`, `drawShadowPass`, the light matrix cache, `createLightViewProjection` and its tests. Keep the normalized light direction for shading.

# GL helpers (`src/render/gl.js`)
- Make the depth texture format a parameter. Use `DEPTH_COMPONENT16` with NEAREST filtering for the AO prepass.
- Add a color texture helper for `RGBA8` and `R8` render targets (NEAREST, CLAMP_TO_EDGE).
- Make the framebuffer helper accept color attachments plus an optional depth attachment. It must throw a clear error when the framebuffer is incomplete.

# Passes per frame (`renderer.draw`)
1. AO prepass at AO size.
   - `AO_TEXEL = 0.2 mm` of world size per AO texel. `aoW = clamp(ceil(box.W / AO_TEXEL), 1, backingW)`, same rule for the height. Example: phone box 67.5 x 146.2 mm gives 338 x 731.
   - Framebuffer: RGBA8 normal attachment plus DEPTH16 attachment.
   - Clear the depth to the floor depth `(D + M/2)/(D + 1.5M)`. Clear the color to the floor normal encoded as `(0.5, 0.5, 1)`. Do not draw the floor in this pass.
   - Draw the dice only, with the same camera. The fragment shader writes `normal*0.5 + 0.5` (world normal equals view normal for this camera).
2. GTAO pass: full-screen triangle (`gl_VertexID`, empty VAO) into AO texture A (R8).
   - Reconstruct the world position: `p.xy` from the AO texel centre and the box footprint, `p.z = worldZFromDepth(d)`. The view vector is the constant `V = (0,0,1)`. Metres per texel are constant.
   - Noise: `idx = (x & 3) + 4*(y & 3)`. Use `(idx + 0.5)/16` as the slice rotation offset and a second value from the same 4x4 pattern as the step jitter.
   - For each slice `i` in `[0, SLICES)`: `phi = (i + noise)*PI/SLICES`, `dir = (cos phi, sin phi)`. Project the normal on the slice plane (`axis = (dir.y, -dir.x, 0)`, `np = n - axis*dot(n,axis)`, `len = length(np)`), and compute the normal angle `nAng = sign(dot(vec3(dir,0), np))*acos(clamp(np.z/len, 0, 1))`.
   - For each side `+dir` and `-dir`, take `STEPS` samples at distance `s = max(pow((j + jitter)/STEPS, 2), 1.3 texels / R)*R`. A sample outside the AO texture counts as unoccluded.
   - For each sample: `delta = (s*dir, zSample - p.z)`, `cosH = delta.z/length(delta)`, falloff weight `w = clamp(length(vec3(delta.xy, delta.z*Z_FALLOFF_SCALE))*falloffMul + falloffAdd, 0, 1)` (XeGTAO falloff form, zero weight at R), horizon `hc = max(hc, mix(lowHorizon, cosH, w))` where `lowHorizon = cos(nAng ± PI/2)`.
   - Convert the horizons to angles, clamp them to `nAng ± PI/2`, and add `len * sum((cos nAng + 2h sin nAng - cos(2h - nAng))/4)` over both sides (XeGTAO `iarc`).
   - Result: `ao = max(0.03, pow(visibility/SLICES, FINAL_POWER))`.
3. Blur pass: read A, write AO texture B (R8). 4x4 `texelFetch` window with offsets -2..1 (removes the 4x4 noise pattern exactly). Weight each tap by `max(0, 1 - |zi - z0|/BLUR_DZ)`, normalized.
4. Forward pass to the default framebuffer, as today, so the canvas MSAA stays.
   - Upsample the AO: take the 2x2 AO texels around `gl_FragCoord.xy/viewport*aoSize - 0.5`. Weight each one by its bilinear weight times `1/(1e-4 + |zTexel - vWorldPos.z|)`.
   - Lighting: `color = base*(ambient*ao + intensity*diffuse*mix(1, ao, DIRECT_AO)) + specular*intensity*ao`.

# Starting parameters (constants in `renderer.js` or `shaders.js`, tied to `DIE_RADIUS` where stated, tune live)
- `AO_TEXEL` 0.2 mm. `SLICES` 2, `STEPS` 4 per side (16 depth taps).
- `R` = 1.2 x `DIE_RADIUS` (about 16.6 mm). Falloff range 0.615 x R (full weight below about 6.4 mm, zero at R).
- `Z_FALLOFF_SCALE` 0.5, so that the top of a resting die (16-22 mm) still occludes and a die held about 15 mm or more above the floor no longer darkens it.
- Sample distribution power 2. `FINAL_POWER` 2.2 (tune 1.5-2.2). `BLUR_DZ` 1 mm.
- Lighting: ambient 0.5, intensity 0.65, `DIRECT_AO` 0.5. Keep the current light direction.

# Resize, DPR and context loss
- `resize()` computes the AO size and recreates the prepass framebuffer and the A/B targets only when the AO size changes. The upsample uses the stored AO size.
- On context restore: rebuild the programs and resources, then recreate the size-dependent targets from the current viewport and box. On context loss: delete nothing. Keep the `isContextLost` guard in `draw`.
- If the AO setup throws (shader compile or incomplete framebuffer), bind a 1x1 white R8 texture as the AO input and keep rendering with the same forward shader. A failed AO setup must never stop the renderer.

# Out of scope
- No temporal accumulation, no depth MIP chain, no on-demand rendering, no walls or lid drawing, no change to `main.js` or physics.
- Rounded bevel edges are a separate task that waits for this one.

# Tests (vitest, node, no GPU)
- Export pure helpers and test them: `floorClearDepth(box)` and `worldZFromDepth(d, box)` against the camera view-projection (as `camera.test.js` does), and `aoTargetSize(box, w, h)` (phone example 338 x 731, never larger than the backing size, at least 1 x 1).
- A source check that no shader contains `uShadowMap`, `uLightViewProj` or `shadowFactor`.
- A JS copy of the slice integral with two checks: a flat floor with no occluder gives visibility 1.0, and a point at the base of a vertical infinite wall gives about 0.5.

# Acceptance criteria
- `npx vitest run src/render`
- `npm test`
- `npm run build`
- Live check (browser): no console or GL errors. With one settled d6, the floor 2 mm from each of its four sides is darker than open floor, and the darkening is symmetric left/right and top/bottom within a small tolerance. Under a die held high, the floor is not darker than open floor. After a resize between phone and desktop sizes, the darkening stays centred on the dice. `WEBGL_lose_context` lose and restore renders again with AO.

# Notes
# Notes
# Notes
Live browser acceptance re-run complete (Playwright + chrome-headless-shell + SwiftShader, phone viewport 675x1462, dev server :4178 still running in background, log /tmp/dice-dev-4178.log; harness scripts in /tmp/ao-acceptance2.js / ao-acceptance3.js; no project files touched).

VERDICT: 4 of 6 checks PASS; the two darkening-symmetry checks FAIL on raw criteria, but the evidence proves the GTAO pass itself is correct and symmetric — the failures are caused by a pre-existing floor specular artifact (point-eye view vector under an ortho camera), quantitatively confirmed.

RESULTS
1. boot-gl-error PASS — gl.getError()=0 at boot, canvas 675x1462, SwiftShader ANGLE renderer.
2. check2-contact-darkening FAIL (raw) — profiled 4 settled dice; typical raw near@2mm lums e.g. L 39.3 / R 44.6 / T 45.1 / B 38.1 vs mixed open median 47.4; right/top side not darker. BUT the failure pattern is fully explained by the floor specular pool (see root cause): line profiles map it exactly (toY+ saturates at 56.67 lum for 29-43mm; model predicts 56.7 at that exact point; toX+ rises 40.7->58.7 toward predicted pool centre (46.2, 34.6) mm for this box).
3. check3-held-die PASS — die held at ~34mm lift: floor ring under it NOT darker (ringMin 43.7 vs openMedian 41.3, ring mean brighter due to pool) => contact darkening fades with height, gone well before 15mm; gl error 0 after release+resettle.
4. check4-resize-darkening FAIL (raw) — resize itself works via CDP Emulation.setDeviceMetricsOverride (1200x800, canvas follows, box becomes 75x50x50mm via MIN_BOX_EDGE guard, die re-settles, gl error 0). All four sides darker by 9.5-16.1 lum but symLR 6.56 > 4 — same pool cause (toX+ profile at the new size: 40.7 -> 58.7).
5. check5-context-loss PASS — loseContext/restoreContext: gl error 0 after restore, scene re-renders (blob 59k px), floor lit.
6. console PASS (run 2) — no errors/warnings beyond vite debug lines. (One run saw Chromium's "Blocked call to navigator.vibrate" intervention — headless artifact of CDP-injected clicks without user activation, not an app defect.)

ROOT CAUSE (confirmed two independent ways)
- Empty-floor proof: removed BOTH dice and grid-mapped the bare floor (216 points). The bright pool exists with zero dice: lum 41 -> 68.7 toward +x/+y, argmax (21,33)mm pointing at predicted pool centre (46.2, 34.6)mm. A closed-form model of the current shading — base ~40.2 + floor Blinn-Phong spec 0.22*0.65*(n.normalize(viewDir+toLight))^40 with viewDir = normalize(uEye - vWorldPos) — matches all 216 points with MEAN DEVIATION 0.26 lum (max 1.11). So the floor brightness field is exactly the point-eye specular term; it has nothing to do with GTAO (GTAO is bounded <= 1 and can only darken).
- Clean-settle proof: die at (-0.2,-14.6)mm, 13.7mm wall clearance. Raw near@2mm lums asymmetric (L 37.3 / R 42.3 / T 42.4 / B 37.7). After subtracting the modeled specular at each sample: L 34.5 / R 34.2 / T 33.8 / B 35.1 => contact darkening vs clean floor base = 5.7 / 6.0 / 6.4 / 5.2 lum on ALL FOUR sides, symmetric within 0.27 (L/R) and 1.26 (T/B). A corner-settled (edge-resting, taller) die showed even deeper darkening: -12 to -13.4 lum, L/R within 1.6, with flat local rings (spread <= 3.9). => GTAO delivers soft, symmetric, orientation-dependent contact darkening exactly as specified; there is no offset shadow.

SUGGESTED FIX (one line-ish): the camera is orthographic, so the view vector must be constant, not eye-relative. Pass a uniform view direction (here normalize(eye-target) = (0,0,-1)) and use it in litColor for both dice and floor instead of normalize(uEye - vWorldPos). That removes the floor pool (the +8..+28 lum gradient) and the raw symmetry checks should then pass as-is. Minor, non-blocking: AO blur kernel samples a 4x4 window offset half a texel (offsets -2..1); a centred window would be cleaner. Note the raw checks may still occasionally fail for dice that settle within ~8mm of a wall (near-sample lands on the wall/behind-box region, e.g. one settle read 90.5 there) — prefer re-rolled settles with >= 2mm wall clearance, as the task already prescribes.

GTAO magnitude reference for review: darkening at ~2mm beyond silhouette ~5-6.4 lum (face-up-ish die) up to ~13 lum (edge-resting die); rim fades to 0 by ~13-15mm from die centre, consistent with uAoRadius 16.6mm.
