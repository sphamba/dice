---
name: "feat: WebGL2 renderer with orthographic top-down view, face labels and shadows"
priority: "high"
state: "to-live-test"
worktree: "feat/6-webgl2-dice-renderer"
issuer: "user"
complexity: "complex"
shortName: "webgl2-dice-renderer"
blockedBy: ""
splitter: "done"
map: "{\"files\":[{\"path\":\"src/dice/labels.js\",\"symbols\":[{\"name\":\"faceRects\",\"kind\":\"fn\",\"ins\":16,\"del\":0,\"isNew\":true},{\"name\":\"faceFrame\",\"kind\":\"fn\",\"ins\":14,\"del\":0,\"isNew\":true},{\"name\":\"toFace2D\",\"kind\":\"fn\",\"ins\":4,\"del\":0,\"isNew\":true},{\"name\":\"faceInradius2D\",\"kind\":\"fn\",\"ins\":11,\"del\":0,\"isNew\":true},{\"name\":\"faceVertexUvs\",\"kind\":\"fn\",\"ins\":15,\"del\":0,\"isNew\":true},{\"name\":\"luminance\",\"kind\":\"fn\",\"ins\":3,\"del\":0,\"isNew\":true},{\"name\":\"inkFor\",\"kind\":\"fn\",\"ins\":4,\"del\":0,\"isNew\":true},{\"name\":\"makeCanvas\",\"kind\":\"fn\",\"ins\":4,\"del\":0,\"isNew\":true},{\"name\":\"buildLabelAtlas\",\"kind\":\"fn\",\"ins\":12,\"del\":0,\"isNew\":true},{\"name\":\"drawFaceLabel\",\"kind\":\"fn\",\"ins\":37,\"del\":0,\"isNew\":true},{\"name\":\"drawPips\",\"kind\":\"fn\",\"ins\":8,\"del\":0,\"isNew\":true},{\"name\":\"drawText\",\"kind\":\"fn\",\"ins\":24,\"del\":0,\"isNew\":true}]},{\"path\":\"src/dice/labels.test.js\",\"symbols\":[{\"name\":\"overlap\",\"kind\":\"fn\",\"ins\":8,\"del\":0,\"isNew\":true},{\"name\":\"packs one rectangle per face inside the unit square\",\"kind\":\"case\",\"ins\":15,\"del\":0,\"isNew\":true},{\"name\":\"never overlaps two rectangles of the same atlas\",\"kind\":\"case\",\"ins\":10,\"del\":0,\"isNew\":true},{\"name\":\"gives every face of every type one rectangle and corner UVs inside it\",\"kind\":\"case\",\"ins\":25,\"del\":0,\"isNew\":true},{\"name\":\"maps different faces to non-overlapping rectangles\",\"kind\":\"case\",\"ins\":10,\"del\":0,\"isNew\":true}]},{\"path\":\"src/render/camera.js\",\"symbols\":[{\"name\":\"createCamera\",\"kind\":\"fn\",\"ins\":10,\"del\":0,\"isNew\":true},{\"name\":\"createLightViewProjection\",\"kind\":\"fn\",\"ins\":36,\"del\":0,\"isNew\":true}]},{\"path\":\"src/render/camera.test.js\",\"symbols\":[{\"name\":\"near\",\"kind\":\"fn\",\"ins\":1,\"del\":0,\"isNew\":true},{\"name\":\"toNdc\",\"kind\":\"fn\",\"ins\":4,\"del\":0,\"isNew\":true},{\"name\":\"depth\",\"kind\":\"fn\",\"ins\":1,\"del\":0,\"isNew\":true},{\"name\":\"maps the floor footprint corners to the clip square edges\",\"kind\":\"case\",\"ins\":15,\"del\":0,\"isNew\":true},{\"name\":\"maps the box center to the clip center\",\"kind\":\"case\",\"ins\":5,\"del\":0,\"isNew\":true},{\"name\":\"gives higher points a smaller depth\",\"kind\":\"case\",\"ins\":7,\"del\":0,\"isNew\":true},{\"name\":\"keeps z in [0, D] inside the near/far range\",\"kind\":\"case\",\"ins\":7,\"del\":0,\"isNew\":true},{\"name\":\"fits the whole box into the light frustum\",\"kind\":\"case\",\"ins\":14,\"del\":0,\"isNew\":true},{\"name\":\"normalizes the light direction and keeps frustum axes orthogonal\",\"kind\":\"case\",\"ins\":7,\"del\":0,\"isNew\":true}]},{\"path\":\"src/render/gl.js\",\"symbols\":[{\"name\":\"compileShader\",\"kind\":\"fn\",\"ins\":11,\"del\":0,\"isNew\":true},{\"name\":\"compileProgram\",\"kind\":\"fn\",\"ins\":16,\"del\":0,\"isNew\":true},{\"name\":\"createBuffer\",\"kind\":\"fn\",\"ins\":6,\"del\":0,\"isNew\":true},{\"name\":\"createVAO\",\"kind\":\"fn\",\"ins\":18,\"del\":0,\"isNew\":true},{\"name\":\"deleteVAO\",\"kind\":\"fn\",\"ins\":5,\"del\":0,\"isNew\":true},{\"name\":\"createDepthTexture\",\"kind\":\"fn\",\"ins\":10,\"del\":0,\"isNew\":true},{\"name\":\"createLabelTexture\",\"kind\":\"fn\",\"ins\":12,\"del\":0,\"isNew\":true},{\"name\":\"createDepthFramebuffer\",\"kind\":\"fn\",\"ins\":12,\"del\":0,\"isNew\":true}]},{\"path\":\"src/render/renderer.js\",\"symbols\":[{\"name\":\"uniformMap\",\"kind\":\"fn\",\"ins\":5,\"del\":0,\"isNew\":true},{\"name\":\"buildDieMesh\",\"kind\":\"fn\",\"ins\":24,\"del\":0,\"isNew\":true},{\"name\":\"buildFloorMesh\",\"kind\":\"fn\",\"ins\":5,\"del\":0,\"isNew\":true},{\"name\":\"createRenderer\",\"kind\":\"fn\",\"ins\":170,\"del\":0,\"isNew\":true}]},{\"path\":\"src/render/shaders.js\",\"symbols\":[{\"name\":\"LIGHTING_FS\",\"kind\":\"class\",\"ins\":39,\"del\":0,\"isNew\":true},{\"name\":\"depthVertexSource\",\"kind\":\"class\",\"ins\":10,\"del\":0,\"isNew\":true},{\"name\":\"depthFragmentSource\",\"kind\":\"class\",\"ins\":5,\"del\":0,\"isNew\":true},{\"name\":\"diceVertexSource\",\"kind\":\"class\",\"ins\":23,\"del\":0,\"isNew\":true},{\"name\":\"diceFragmentSource\",\"kind\":\"class\",\"ins\":16,\"del\":0,\"isNew\":true},{\"name\":\"floorVertexSource\",\"kind\":\"class\",\"ins\":19,\"del\":0,\"isNew\":true},{\"name\":\"floorFragmentSource\",\"kind\":\"class\",\"ins\":14,\"del\":0,\"isNew\":true}]}],\"flows\":[],\"role\":\"developer\",\"run\":0,\"model\":\"DeepSeek V4.1 Flash\",\"at\":\"2026-11-15T18:56:54.769Z\",\"head\":\"b52bbed\"}"
changes: "{\"base\":\"main\",\"ins\":899,\"del\":0,\"files\":7}"
commits: "[{\"hash\":\"be7545e\",\"subject\":\"feat(render): add WebGL2 renderer with ortho top view, face labels and shadow map\",\"when\":\"2026-11-15T19:51:40+01:00\"}]"
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
Review of b52bbed against Specs: approved, no fixes needed. Scoped vitest run = 64 passed, npm run build exits 0.

- Verified camera math per spec: ortho footprint = clip square at z = 0 and z = D, near/far cover [0, D] with margin, higher z gives smaller depth (camera.test.js covers all three claims).
- Verified light: default direction is exactly 30 deg from -z; frustum fitted to all 8 box corners + pad (tested); 2048² DEPTH_COMPONENT24 map with MAX_TEXTURE_SIZE fallback, 3x3 PCF, slope-scaled bias, dice cast onto floor and each other; floor-only draw (no walls/lid).
- Verified label math numerically: glyph-up points from face centroid toward the label's own corner, so a d4 number is upright exactly when its corner is the apex; centered labels upright along the fixed first-edge frame. Atlas drawing and faceVertexUvs share one face frame (FLIP_Y upload accounted), so UVs always sample their own cell.
- Verified integration points: shape winding is CCW from outside and matches cullFace(BACK); math arrays are Float32Array so uniform calls are WebGL-safe; body.position/orientation/shape.type and box {W,H,D} match the physics/world modules; context lost/restored rebuilds GPU resources; dispose removes listeners and deletes GL objects; main.js untouched (dev scene correctly omitted per spec).
- Accepted interpretations (developer-documented, sound): underline only on single-digit labels "6"/"9" (inverted 16/19 read 91/61, not valid face values, so no ambiguity); camera.js split out of renderer.js as the matrix module the Tests section anticipates.
- Deferred to the later live test per spec: atlas pixel appearance, shadow acne tuning, visual color/label readability.
