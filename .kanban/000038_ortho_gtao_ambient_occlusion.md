---
name: "feat: replace directional shadows with orthographic GTAO ambient occlusion"
priority: "medium"
state: "merging"
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
# Notes
- Outcome: approved (re-review of main...HEAD: 6e66e05, cec943f, b040085, 6272387; no changes needed).
- Spec sweep, all bullets mapped to diff or test evidence: Remove list fully gone (grep: zero shadow/uEye references outside the source-check test; createLightViewProjection and its tests deleted, light direction kept). Shared LIGHTING_FS uses constant viewDir (0,0,1); dice and floor share it; uEye removed. GL helpers as specced (depth format parameter, createColorTexture RGBA8/R8 NEAREST+CLAMP, createFramebuffer with color+optional depth and incomplete-FBO throw). All four passes match the spec formulas line-by-line: prepass clear color/depth and dice-only draw, AO size rule (phone 338x731), 4x4 noise with permuted jitter, s = max(u^2, 1.3 texel/R)*R, XeGTAO falloff + nAng±PI/2 clamp + iarc, max(0.03, pow(vis/slices, 2.2)), blur offsets -2..1 with depth weights (center tap keeps weights >= 1), depth-aware normalized 2x2 upsample, lighting = base*(ambient*ao + intensity*diffuse*mix(1,ao,DIRECT_AO)) + spec*intensity*ao. Depth math verified: worldZFromDepth = (D+M/2) - d*(D+1.5M) matches the camera VP; falloff endpoints land at 6.4 mm full weight and R zero; fallback white R8 texture yields ao = 1 with no division by zero. Constants all at spec values (DIE_RADIUS 13.86 mm -> R 16.6 mm); light direction unchanged from main; resize/restore/context-loss/white-fallback as specced; main.js and physics untouched.
- Tests: all spec-required tests present (depth helpers vs camera VP, aoTargetSize clamps, source check, JS slice-integral mirror 1.0/≈0.5, fake-GL wiring incl. restore). Evidence rerun in this review: npx vitest run src/render 21/21, npm test 259/259, npm run build green.
- Accepted interpretations (documented, non-blocking): wall test uses a 10 mm wall because the falloff deliberately cuts samples beyond R (an infinite wall is out of reach by design); the JS mirror tests the raw slice integral without FINAL_POWER, matching the spec's "about 0.5" reading. Non-blocking flag: ensureAoTargets leaks partially created textures/FBOs if createFramebuffer throws mid-sequence (bounded, at most once per context, only on devices where AO already failed; renderer still keeps rendering per spec).
- Guidance: map every Spec formula to its diff hunk before requesting review; a line-by-line self-check against the spec text catches transcription slips cheaply.
