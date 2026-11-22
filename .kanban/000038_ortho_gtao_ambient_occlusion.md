---
name: "feat: replace directional shadows with orthographic GTAO ambient occlusion"
priority: "medium"
state: "to-review"
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

## Deliverable
- Shadow mapping removed entirely: shadow shaders (depth pass, shadowFactor, PCF), light frustum (createLightViewProjection + tests), shadowSize, drawShadowPass, light matrix cache, and all shadow uniforms. Directional light kept for diffuse and specular face shading.
- GTAO screen-space pass in raw WebGL2 (no library): AO prepass at AO resolution (RGBA8 normal + DEPTH_COMPONENT16, dice only, cleared to the floor plane state), GTAO slice-integral pass (XeGTAO convention: 4x4 tile jitter, quadratic sample distribution, z-scaled falloff, nAng±PI/2 horizon clamp, iarc integral, 2 slices x 4 steps), edge-aware 4x4 blur, depth-aware bilinear upsample into forward lighting (ambient and specular scaled by ao, direct diffuse mixed by DIRECT_AO 0.5).
- camera.js: createLightViewProjection removed; worldZFromDepth(d, box) and floorClearDepth(box) added. createCamera and the frustum unchanged from main.
- gl.js: createColorTexture (RGBA8/R8), createFramebuffer with color + optional depth attachments and a clear incomplete-FBO error, depth format parameter on createDepthTexture.
- renderer.js: AO constants (AO_TEXEL 0.2 mm, AO_SLICES 2, AO_STEPS 4, AO_RADIUS 1.2 x DIE_RADIUS, AO_FALLOFF_RANGE 0.615, AO_Z_FALLOFF_SCALE 0.5, AO_FINAL_POWER 2.2, AO_BLUR_DZ 1 mm, DIRECT_AO 0.5), aoTargetSize export (phone box 67.5x146.2 mm gives 338x731), resize recreates AO targets only when the AO size changes, context restore rebuilds programs/resources and retries the AO setup, AO setup failure falls back to a 1x1 white R8 texture without stopping rendering. Lighting: ambient 0.5, intensity 0.65 (spec starting values).

## Verification
- HEAD b040085: 6e66e05 (feature), cec943f, b040085 (live-check fixes). npx vitest run src/render 19/19; npm test 257/257; npm run build green + asset check.
- Live checks (headless chrome-headless-shell, swiftshader, all acceptance criteria): no console/page/GL errors across boot, roll, hold, resize, context loss. Settled d6: floor 2 mm from all four sides darker than open floor by 6.0-8.0 RGB units, symmetric (LR <= 1.6, TB <= 0.6). Held die (lifted to z = 39.8 mm, bottom 25.9 mm up): floor at the old footprint equals the open-floor median exactly (delta 0.00). Resize phone to desktop: darkening stays centred (symLR 0.28, symTB 0.56). WEBGL_lose_context lose/restore: getError 0, scene re-renders with identical AO.
- Two defects found by live checks and fixed: (1) the AO setup was never built at startup, so the pipeline rendered the white fallback (cec943f); (2) a perspective leftover normalize(uEye - vWorldPos) put a position-dependent specular pool on the floor that masked AO symmetry; fixed with the constant ortho view vector (0,0,1) (b040085).

## Assumptions
- XeGTAO convention verified against upstream src/integration/xeGTAO.fs.glsl: side-1 horizon angle negated (h0 = -acos(horizonCos1)), falloff mul/add = -1/(range*R) and (1-range)/range+1; a flat floor gives exactly 1.0. The mirror wall test uses a 10 mm wall (inside the falloff reach) because a truly infinite wall is cut by the falloff by design.
- AO upsample weights are normalized by their sum (the spec formula without normalization diverges on open floor).
- Constant ortho view vector (0,0,1) for specular: correct for this camera; the floor now shows uniform specular instead of main's position-dependent pool (visible baseline change, measured +9.1 luminance uniformly).

## Blockers
- None.

## Manual checks left to other roles
- Visual tuning on a real device: AO strength/falloff look at the spec starting constants (FINAL_POWER 2.2, BLUR_DZ 1 mm, radius 1.2 x DIE_RADIUS, SLICES 2 / STEPS 4); raise SLICES/STEPS if banding shows.
