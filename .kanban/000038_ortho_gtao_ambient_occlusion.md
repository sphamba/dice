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

# Orthographic view vector
- The camera is orthographic, so the view vector is constant. In `litColor` for both the dice and the floor, use the constant direction from the surface toward the eye, `V = (0, 0, 1)`, instead of `normalize(uEye - vWorldPos)`. This removes the bright specular pool on the floor, which comes from the point-eye view vector and made the AO symmetry checks fail.
- Add a source check that no shader uses `uEye - vWorldPos`.

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
   - Upsample the AO: take the 2x2 AO texels around `gl_FragCoord.xy/viewport*aoSize - 0.5`. Weight each one by its bilinear weight times `1/(1e-4 + |zTexel - vWorldPos.z|)`, normalized by the sum of the weights.
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
- A source check that no shader contains `uShadowMap`, `uLightViewProj`, `shadowFactor` or `uEye - vWorldPos`.
- A JS copy of the slice integral with two checks: a flat floor with no occluder gives visibility 1.0, and a point at the base of a vertical wall inside the falloff reach gives about 0.5.
- A test that fails when the AO setup is never built (fake GL: the GTAO program compiles and its framebuffers are created, also after a context restore).

# Acceptance criteria
- `npx vitest run src/render`
- `npm test`
- `npm run build`
- Live check (browser): no console or GL errors. With one settled d6 at least 2 mm from every wall, the floor 2 mm from each of its four sides is darker than open floor, and the darkening is symmetric left/right and top/bottom within a small tolerance. Under a die held high, the floor is not darker than open floor. After a resize between phone and desktop sizes, the darkening stays centred on the dice. `WEBGL_lose_context` lose and restore renders again with AO.

# Notes
# Notes
# Notes
## PM steer — DONE
Applied the "Orthographic view vector" spec section, added the source check, reran the two raw symmetry checks: BOTH NOW PASS.

Changes (worktree feat/38-ortho-gtao-ambient-occlusion, uncommitted):
- src/render/shaders.js: litColor() now uses the constant toward-eye vector `vec3 viewDir = vec3(0.0, 0.0, 1.0)` (ortho top-down camera, toward-eye = +z, per spec sign note) instead of `normalize(uEye - vWorldPos)`; removed the now-unused `uniform vec3 uEye`.
- src/render/renderer.js: removed 'uEye' from LIGHT_UNIFORMS, the uEye upload, and the dead `eye` variable.
- src/render/ao.test.js: added 'uEye - vWorldPos' to the AO source-check token list.

Verification:
- `npx vitest run src/render`: 4 files / 19 tests PASS. `npm test`: 24 files / 257 tests PASS. `npm run build`: OK.
- Live check 2 (contact darkening, phone 675x1462): PASS on the FIRST settle (no re-rolls needed). Die at (8.9, -25.5) mm, 5.3 mm wall clearance. Open floor now perfectly uniform: all 35 open samples and every ring (r25-r47) read exactly 49.33 lum (spread 0) — the specular pool is gone. Floor 2 mm from each side: L 43.29 / R 41.72 / T 42.63 / B 42.83 => darker by 6.04 / 7.61 / 6.70 / 6.50, symLR 1.57, symTB 0.20. gl error 0.
- Live check 4 (resize to desktop 1200x800 via CDP metrics override, box 75x50x50 mm): PASS. Darker by 6.66 / 6.38 / 7.10 / 6.54, symLR 0.28, symTB 0.56; opens all 49.33. gl error 0.
- Console clean (only vite debug lines).

Confirmation of the mechanism: with V constant, the floor spec term is uniform: 0.22*0.65*(dot(n, normalize(V+toLight)))^40*255 = +9.1 lum, and the measured base moved 40.67 -> 49.33 = old base 40.2 + 9.1. Dice keep their face shading; GTAO contact darkening (6-7.6 lum at 2 mm, fading by ~13-15 mm from the die centre) now reads symmetrically everywhere on the floor.

Dev server for manual viewing is still running in the background: http://localhost:4178/ (log /tmp/dice-dev-4178.log). Harness scripts: /tmp/ao-acceptance2.js (full 6-check suite), /tmp/ao-acceptance4.js (checks 2+4 rerun), /tmp/ao-acceptance3.js (empty-floor probe + clean-settle), logs /tmp/ao-run*.log.
