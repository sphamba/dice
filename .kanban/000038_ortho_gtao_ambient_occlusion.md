---
name: "feat: replace directional shadows with orthographic GTAO ambient occlusion"
priority: "medium"
state: "done"
worktree: "feat/38-ortho-gtao-ambient-occlusion"
issuer: "user"
complexity: "complex"
shortName: "ortho-gtao-ambient-occlusion"
splitter: "done"
changes: "{\"base\":\"main\",\"ins\":623,\"del\":149,\"files\":7}"
commits: "[{\"hash\":\"d99928f\",\"subject\":\"test(render): cover AO pipeline wiring with a fake GL context\",\"when\":\"2026-11-22T10:16:55+01:00\"},{\"hash\":\"8459161\",\"subject\":\"fix: use the constant ortho view vector for specular shading\",\"when\":\"2026-11-22T02:49:02+01:00\"},{\"hash\":\"23506b7\",\"subject\":\"fix: build the AO setup at startup so the GTAO pipeline renders\",\"when\":\"2026-11-22T01:37:37+01:00\"},{\"hash\":\"eaeca6c\",\"subject\":\"feat: replace directional shadows with orthographic GTAO ambient occlusion\",\"when\":\"2026-11-22T00:51:18+01:00\"}]"
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
Live-testing #38 COMPLETE. Worktree feat/38-ortho-gtao-ambient-occlusion, merged commit d99928f. All servers killed (port 8841 verified free). Harness /tmp/dice-lt38/, artifacts p16a/p16g/p16e/p16h PNGs + probe logs.

== RESULTS TABLE (every check -> pass / harness limit / card) ==
1. Directional shadows removed (shadow map, depth pass for light, light frustum); directional light kept for diffuse+specular face shading: PASS (static: no shadow/frustum code remains; the only depth texture is the AO pass's own input, renderer.js:208; uLightDir drives diffuse + specular only, shaders.js:41-51).
2. GTAO screen-space pass in raw WebGL2, no library (spec #6): PASS (renderer.js builds the full AO pipeline with own shaders; no external deps; draw fully stateless per probe11).
3. Soft contact darkening at the base of each resting die, symmetric, no offset: PASS x3 pages (probe16g grids: ring cells 28-45 vs open 49-50 on all sides, hugging the silhouette, fading to open by ~10-12mm; probe16h A: 35-46 vs 49-50; earlier probe12/probe6b/driver4 agree). Screenshots p16a-0/p16g-* show the halos visually.
4. Darkening between dice: PASS (driver4 P2 seam 42.8 vs open 50.1; multi-die grids in probe16g/16h show both dice's rings plus overlap zones).
5. Darkening fades with height, gone at ~15mm: PASS with harness limit. Measured: present at rest (centre z=8mm); fully open under a held die at hold=39.8mm (probe15 hold@390: 16mm ring = 50.1 = open; driver2 P2 agrees) and at 22.5mm hold. Sub-22.3mm holds are unreachable: the drive holds at box.D - 27.7mm and box.D >= 50mm (MIN_BOX_EDGE scale guard, box.js). Data is consistent with "gone at ~15mm"; the 15-22mm band itself unmeasurable via the pointer drive.
6. Roll: shadows reappear at the new rest positions: PASS (probe9b phase F grids; driver2 P3).
7. Drag: shadow follows the die; fades while held; returns on release: PASS (driver2 P1/P2/P4b; probe15 grab/hold/release).
8. Panel restore/remove-re-add leaves AO bit-exact: PASS (earlier P7: restored patches bit-exact vs baseline, ~0.5s restore, glErr clean).
9. AO persists across live resizes (700x900 <-> 390x844, canvas bitmap 780<->1400): PASS (probe16h B/C grids: symmetric ring preserved with the rebuilt projection; clampIntoBox correctly pulled the die into the shrunken box).
10. Console + GL errors: PASS (0 product console messages, glErr=0 in every instrumented page this session).
11. Dice frozen half-buried at (0,0,0) after some loads, unrecoverable by Roll: PRODUCT DEFECT -> filed card #47 (3 occurrences; mechanism: applySize accepts a 0x0 viewport, boxFromViewport returns a 0-box, containBody pins bodies to (0,0,0), sleep gate freezes; ~3-5 of ~25 pages, unreproducible on demand).

== DEFECTS FILED ==
- #47 fix: a zero-sized viewport resize permanently freezes dice at the box centre (high). The only product defect found; unrelated to AO correctness.

== HARNESS NOTES (for future runs on this repo) ==
- gl.readPixels is only valid inside a rAF that follows the app's draw (preserveDrawingBuffer=false); off-rAF reads return black; 145 readPixels calls in one rAF produced partial garbage - one readPixels per region, slice in-page.
- The canvas bitmap is dpr-capped at 2 (780x1688 on a 3x context); scale patches with src.width/src.clientWidth, world-to-CSS is innerWidth/box.W (5.78 px/mm at 390px width) - px-per-METRE vs px-per-MM mixed them up once (probe16d crash, my bug, not the app's).
- Patches at a fixed lateral distance are unreliable for measuring the contact ring: a tilted die's silhouette reaches 11.3mm; use the 12x12 grid with die-cell marking instead. This contamination caused the false "missing contact AO" readings in probe15/16a.
- setViewportSize after goto can protocol-error on a maximized window; set the viewport before goto (probe16h pattern).
