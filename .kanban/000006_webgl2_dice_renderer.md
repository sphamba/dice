---
name: "feat: WebGL2 renderer with orthographic top-down view, face labels and shadows"
priority: "high"
state: "reviewing"
worktree: "feat/6-webgl2-dice-renderer"
issuer: "user"
complexity: "complex"
shortName: "webgl2-dice-renderer"
blockedBy: ""
splitter: "done"
---

# Summary
Render the dice and the box floor with vanilla WebGL2: orthographic camera looking down through the lid, flat-shaded dice with numbers (d6 pips, d4 corner numbers), one color per dice type, directional light and a shadow map on the floor.

# Specs
## Context
- World conventions (task #4): meters, x right, y up on screen, z out of the screen. Box footprint `[-W/2, W/2] × [-H/2, H/2]`, floor `z = 0`, lid `z = D`. The canvas fills the screen and the box footprint maps exactly to the canvas.
- Shapes from task #3 `src/dice/shapes.js`: `vertices`, `faces[].indices/normal/value`, d4 `vertexValues`.
- Math from `src/math/*` (column-major, gl-matrix style).
- Vanilla WebGL2 only, no library. GLSL ES 3.00 (`#version 300 es`).

## Files
- `src/render/gl.js`: `compileProgram(gl, vsSource, fsSource)` with readable compile/link error logs, small helpers for buffers/VAOs/textures. Nothing else.
- `src/render/shaders.js`: GLSL sources as exported strings (dice, floor, shadow depth).
- `src/dice/labels.js`: builds the label texture atlas with Canvas 2D (`OffscreenCanvas` if available, else a `<canvas>`), and per-shape per-face UV coordinates:
  - Numbers in a bold, readable sans-serif, centered on each face, upright along a fixed face edge. 6 and 9 get an underline (all types).
  - d6: pips instead of numbers (classic layouts 1 to 6).
  - d10: values 0 to 9.
  - d4: each face shows 3 numbers, one near each corner, each number is the value of that corner's vertex (`vertexValues`) and is upright when that corner points up (classic d4).
  - Label color contrasts with the die color.
- `src/render/renderer.js`: `createRenderer(gl)` returns `{ resize(pixelW, pixelH, box), draw(bodies, lightOptions?) , dispose() }`.
  - Camera: `mat4.ortho` with left/right/bottom/top = box footprint, view looking down `-z` from above the lid, near/far covering `z ∈ [0, D]` with a margin.
  - One mesh (VAO) per dice type, built from the shape at `DIE_RADIUS` (expanded flat-shaded vertices, per-face normal, atlas UV). Draw each body with its model matrix from `position` and `orientation` (≤ 10 dice, no instancing needed).
  - One color per dice type (6 distinct colors, readable with the labels).
  - Lighting: one directional light tilted about 30° from `-z` (so shadows are visible from the top view), Lambert + ambient + mild Blinn-Phong specular.
  - Shadows: depth texture shadow map (2048², fall back to 1024² if `MAX_TEXTURE_SIZE` is small), light ortho frustum fitted to the box, 3×3 PCF, slope-scaled bias. Dice cast on the floor and on each other.
  - Floor: a plane at `z = 0` that covers the box, a matte tray color, receives shadows. Walls and lid are not drawn.
  - `resize` sets the viewport and camera when the screen or box changes.
  - Handle `webglcontextlost` / `webglcontextrestored` (rebuild GPU resources on restore).

## Tests
- `src/render/camera.test.js` (or a test beside the module that builds the matrices): the view-projection maps box footprint corners at `z = 0` and `z = D` to NDC x,y = ±1, and a higher z maps to a smaller NDC depth (closer).
- `src/dice/labels.test.js`: UV layout only (pure function, no canvas): every face of every type gets a UV rectangle inside [0,1]², rectangles of different labels do not overlap.

## Acceptance criteria
- `npx vitest run src/render src/dice` exits 0.
- `npm run build` exits 0.
- Manual: a temporary dev scene is NOT required. The live test is done after the integration task.

# Notes
- Implemented src/render/{camera,gl,shaders,renderer}.js and src/dice/labels.js plus camera.test.js (6) and labels.test.js (4); npx vitest run src/render src/dice = 64 passed, npm run build exits 0, committed b52bbed.
- Camera: eye at z = D + 0.05 (CAMERA_MARGIN), ortho footprint = clip square, near = margin/2, far = D + 2·margin; verified corners at z = 0 and z = D map to NDC ±1 and higher z gives smaller depth.
- Light: fixed default direction (-0.4, -0.3, -0.866) = exactly 30 deg from -z; frustum fitted to box corners with 0.01 pad; draw() accepts lightOptions {direction, ambient, intensity} and refits only when direction changes.
- Labels: one grid-cell atlas per dice type (1024², OffscreenCanvas with <canvas> fallback); d4 = 3 corner numbers rotated toward their corner (upright when that corner is apex), d6 = classic pip layouts, others centered numbers; underline only on labels "6"/"9" per spec (multi-digit values like 16/19 not underlined).
- Label ink chosen by luminance of the die color (dark ink on pale d4/d20, white on the rest); atlas uploaded with UNPACK_FLIP_Y_WEBGL so canvas-up = v-up; UVs and drawing share the same per-face 2D frame (right = first face edge, up = normal × right, origin = vertex centroid).
- Shadow: DEPTH_COMPONENT24 texture, 2048² with 1024 fallback on MAX_TEXTURE_SIZE, front-face rendering, slope-scaled bias max(0.0025·(1-ndotl), 0.0006) in [0,1] depth units, 3×3 PCF, out-of-frustum fragments treated as lit; floor is a unit strip scaled by uHalfExtents, walls/lid not drawn.
- Renderer draw() skips bodies whose shape.type has no mesh and no-ops before the first resize or while the context is lost; context-restored rebuilds all GPU resources; dispose removes listeners and deletes all GL objects.
- Verified renderer call flow with a throwaway mock-GL probe in /tmp (draw counts, viewport args, matrix payloads, disposal); atlas pixel output itself is only checked in the later live test.
