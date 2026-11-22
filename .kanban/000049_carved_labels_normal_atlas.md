---
name: "feat: carve the numbers and pips with a baked normal-map atlas"
priority: "medium"
state: "live-testing"
worktree: "feat/49-carved-labels-normal-atlas"
issuer: "user"
complexity: "complex"
shortName: "carved-labels-normal-atlas"
blockedBy: ""
splitter: "done"
changes: "{\"base\":\"main\",\"ins\":548,\"del\":12,\"files\":6}"
commits: "[{\"hash\":\"6a22be8\",\"subject\":\"feat: carve labels into a baked normal-map atlas with cavity shading\",\"when\":\"2026-11-22T14:05:27+01:00\"}]"
---

# Summary
Make the numbers and pips look carved into the die with a round groove profile and painted insides. At load, bake a tangent-space normal-map atlas from a signed distance field of the label atlas, and apply it in the dice shader with the #39 tangent frame.

# Specs
# User decisions
- Method: a baked normal-map atlas (second RGBA8 texture, same cells and UVs as the label atlas), built once at load. No geometry change.
- Profile: round for everything. Numbers are grooves with a circular-arc cross-section. d6 pips (and any dot) are spherical dimples.
- Paint: keep the current label color inside the carving, plus a slight cavity darkening near the walls.
- Size: the carve depth scales with the dice (#50 shrinks every die to 80%).

# Facts (main at the time of filing)
- `src/dice/labels.js` draws the 1024² label atlas with Canvas2D or OffscreenCanvas, one grid cell per face (`faceRects`). `faceFrame` gives each face a 2D frame (origin at the face centroid, `right` along the first edge, `up = n x right`), `faceVertexUvs` maps the face circumcircle onto its cell. d6 shows pips, d4 has 3 numbers per face, the others one centred number.
- `src/render/gl.js` `createLabelTexture` uploads with FLIP_Y and LINEAR filtering, no mipmaps.
- The dice shader (#39) mixes `mix(uColor, label.rgb, label.a)` and builds the bevel normal in a T/B/N basis with `B = cross(N, T)`, from the face-2D position, the tangent `right` and the inset polygon. #46 rules apply: no uniform-bounded loops, no `%` by a uniform, guard every division.

# Bake (CPU, at load, new code next to the label atlas)
1. From the label atlas alpha (threshold 0.5), compute a signed distance field in atlas pixels with an exact linear-time Euclidean distance transform (Felzenszwalb-Huttenlocher, inside and outside).
2. Convert distances to metres per cell with the cell's pixels-per-metre scale from `faceVertexUvs`.
3. Height profile (inside the glyph only, 0 outside), depth `CARVE_DEPTH = 0.0289 * DIE_RADIUS` (0.4 mm at the old 13.86 mm radius, 0.32 mm after #50). Derive it from `DIE_RADIUS`, no hard-coded millimetres:
   - Number strokes: circular-arc groove across the stroke, `h(d) = -CARVE_DEPTH * sqrt(1 - (1 - min(d / W, 1))^2)`, with `W` the stroke half-width (measure it from the SDF maximum of each glyph, or use the font stroke half-width), so a stroke narrower than 2W has a fully round bottom.
   - Pips and dots: a spherical cap with its rim at the pip edge and depth `CARVE_DEPTH` at the centre (pip radius from the drawing code in `labels.js`).
4. Normal from the height gradient in the face frame: `n = normalize(-dh/dx, -dh/dy, 1)`, with x along `right` and y along `up`, then encode `n*0.5 + 0.5` in RGB. Outside the glyphs, `(0.5, 0.5, 1)`.
5. Cavity term in A: 1 on flat surface, down to `1 - CAVITY` (start `CAVITY = 0.25`) on the steepest wall.
6. Respect the FLIP_Y upload and the frame orientation, so that the normal at the right rim of a pip tilts toward the pip centre in world space on every face.

# Shader (`src/render/shaders.js`, dice program)
- Sample the normal atlas at the label UV. In the flat region of the face (where the bevel offset q is 0), use the carved tangent-space normal in the same T/B/N basis. In the bevel band, keep the bevel normal (the labels do not reach the band).
- Multiply the ambient term by the cavity value. Keep the label paint color as now.
- The AO prepass keeps the bevel normal only. Do not change the AO pass.
- One more sampler for the dice program. Linear filtering, no mipmaps, same as the label atlas.

# Constraints
- No visual change outside the numbers and pips. Numbers and pips stay readable at phone and desktop sizes.
- #46 mobile rules for every new shader line.

# Tests (vitest, node)
- Distance transform: on a synthetic disk of radius 40 px, the distance at every pixel is within 0.5 px of the exact value, inside and outside.
- Profile and normal: a synthetic pip gives `(0,0,1)` at its centre and outside it, and at the rim the normal tilts toward the centre. A synthetic stroke gives a symmetric groove normal across its width.
- Orientation: for one face of each die type, the decoded normal at a point right of a pip centre (in face-2D) tilts toward the pip centre after the T/B/N transform.
- `CARVE_DEPTH` equals `0.0289 * DIE_RADIUS`.
- Existing render, bevel, AO and #46 source-check tests stay green.

# Acceptance criteria
- `npx vitest run src/render src/dice`
- `npm test`
- `npm run build`
- Live check (browser, desktop and phone viewport): every die type shows carved, painted numbers or pips with round walls lit from the light direction, pips look like dimples, numbers stay readable, no console or GL errors, and the #46 error overlay does not appear.

# Notes
## PM hint
- Good find. Do not trace the NaN further. File the ONE defect card now with repro.mjs (341x512 mask, two 22 px disks, NaN at the lower disk centre), the in-page atlas evidence (lower-half glyphs bake flat in every cell), and the suspected entry point (INF = 1e20 arithmetic in edt1d). The developer of that card does the trace and the fix.
- The d10 wall-shading FAIL is probably the same defect. Name it in the same card. Do not file a second card.
- Then write the results table and finish.

## State
- Harness /tmp/dice-lt49. Env probe green, console clean, no #46 overlay, no GL errors.
- PASS: spawn, settle, roll, panel, values, label paint, both contexts.
- FAIL: d10 (phone) wall shading. LIVE FINDING: some d6 pips render flat. Root cause: signedDistance returns NaN in src/dice/carve.js, so buildCarveAtlas bakes flat normals for glyphs in the lower half of each cell.
