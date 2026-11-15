---
name: "feat: dice polyhedra geometry d4 to d20 with face values and mass properties"
priority: "high"
state: "done"
worktree: "feat/3-dice-shapes-geometry"
issuer: "user"
complexity: "moderate"
shortName: "dice-shapes-geometry"
blockedBy: ""
splitter: "done"
changes: "{\"base\":\"main\",\"ins\":589,\"del\":0,\"files\":2}"
commits: "[{\"hash\":\"b6f651c\",\"subject\":\"feat(dice): add d4 to d20 polyhedra with face values and mass properties\",\"when\":\"2026-11-15T19:10:17+01:00\"}]"
map: "{\"files\":[{\"path\":\"src/dice/shapes.js\",\"symbols\":[{\"name\":\"DICE_TYPES\",\"kind\":\"class\",\"ins\":1,\"del\":0,\"isNew\":true},{\"name\":\"orbit\",\"kind\":\"fn\",\"ins\":14,\"del\":0,\"isNew\":true},{\"name\":\"d10Vertices\",\"kind\":\"fn\",\"ins\":21,\"del\":0,\"isNew\":true},{\"name\":\"VERTEX_BUILDERS\",\"kind\":\"class\",\"ins\":14,\"del\":0,\"isNew\":true},{\"name\":\"newell\",\"kind\":\"fn\",\"ins\":11,\"del\":0,\"isNew\":true},{\"name\":\"findFaceIndices\",\"kind\":\"fn\",\"ins\":31,\"del\":0,\"isNew\":true},{\"name\":\"orderPolygon\",\"kind\":\"fn\",\"ins\":17,\"del\":0,\"isNew\":true},{\"name\":\"buildFaces\",\"kind\":\"fn\",\"ins\":5,\"del\":0,\"isNew\":true},{\"name\":\"massProperties\",\"kind\":\"fn\",\"ins\":33,\"del\":0,\"isNew\":true},{\"name\":\"assignFaceValues\",\"kind\":\"fn\",\"ins\":30,\"del\":0,\"isNew\":true},{\"name\":\"buildEdges\",\"kind\":\"fn\",\"ins\":12,\"del\":0,\"isNew\":true},{\"name\":\"buildEdgeDirs\",\"kind\":\"fn\",\"ins\":15,\"del\":0,\"isNew\":true},{\"name\":\"unitRadiusFactor\",\"kind\":\"fn\",\"ins\":5,\"del\":0,\"isNew\":true},{\"name\":\"assemble\",\"kind\":\"fn\",\"ins\":31,\"del\":0,\"isNew\":true},{\"name\":\"freezeShape\",\"kind\":\"fn\",\"ins\":16,\"del\":0,\"isNew\":true},{\"name\":\"createShape\",\"kind\":\"fn\",\"ins\":25,\"del\":0,\"isNew\":true}]},{\"path\":\"src/dice/shapes.test.js\",\"symbols\":[{\"name\":\"planeDistance\",\"kind\":\"fn\",\"ins\":3,\"del\":0,\"isNew\":true},{\"name\":\"newellNormal\",\"kind\":\"fn\",\"ins\":11,\"del\":0,\"isNew\":true},{\"name\":\"faceAreaCentroid\",\"kind\":\"fn\",\"ins\":13,\"del\":0,\"isNew\":true},{\"name\":\"volumeAndCenterOfMass\",\"kind\":\"fn\",\"ins\":11,\"del\":0,\"isNew\":true},{\"name\":\"oppositePairs\",\"kind\":\"fn\",\"ins\":21,\"del\":0,\"isNew\":true},{\"name\":\"DICE_TYPES suite\",\"kind\":\"class\",\"ins\":5,\"del\":0,\"isNew\":true},{\"name\":\"per-type suite\",\"kind\":\"class\",\"ins\":109,\"del\":0,\"isNew\":true},{\"name\":\"d6 suite\",\"kind\":\"class\",\"ins\":21,\"del\":0,\"isNew\":true},{\"name\":\"d4 suite\",\"kind\":\"class\",\"ins\":17,\"del\":0,\"isNew\":true},{\"name\":\"createShape suite\",\"kind\":\"class\",\"ins\":19,\"del\":0,\"isNew\":true}]}],\"flows\":[],\"role\":\"developer\",\"run\":0,\"model\":\"DeepSeek V4.1 Flash\",\"at\":\"2026-11-15T18:14:32.805Z\",\"head\":\"edb7a8d\"}"
---

# Summary
Define the convex polyhedra for d4, d6, d8, d10 (pentagonal trapezohedron), d12 and d20: vertices, faces, normals, edges, standard face numbering, and volume and inertia tensor for a uniform density, for use by physics and rendering.

# Specs
## File
`src/dice/shapes.js` (+ `src/dice/shapes.test.js`). Uses `src/math/*`.

## API
- `export const DICE_TYPES = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20']`.
- `export function createShape(type, radius)` returns a frozen shape object, centered on its center of mass, scaled so the circumscribed-sphere radius equals `radius`:
  - `type`, `radius`
  - `vertices`: array of vec3
  - `faces`: array of `{ indices: number[] (counter-clockwise seen from outside), normal: vec3 (unit, outward), value: number }`
  - `edges`: unique undirected edges `[i, j]`
  - `edgeDirs`: unique edge directions (unit, parallel duplicates removed), for SAT edge-edge axes
  - `volume`, `inertia`: body-frame inertia tensor for unit density as mat3 (the caller multiplies by density); compute from the polyhedron (tetrahedron decomposition), do not hard-code
  - d4 only: `vertexValues: number[]` (value of each vertex; the result is the value of the top vertex)
- Shapes are cached per `(type, radius)`.

## Face values (standard dice)
- d6: opposite faces sum to 7.
- d8: opposite faces sum to 9.
- d10: pentagonal trapezohedron (10 kite faces). Values 0 to 9, opposite faces sum to 9. Height/shape like a real d10 (the kite plane must be planar).
- d12: opposite faces sum to 13.
- d20: opposite faces sum to 21.
- d4: vertices have values 1 to 4. Each face carries no single value (`value` = the value of the vertex opposite the face, which is the top vertex when that face is down).

## Tests (minimum, for every type)
- Face count (4, 6, 8, 10, 12, 20), Euler characteristic `V - E + F = 2`.
- Every face is planar (all its vertices within 1e-6 of the face plane), the normal points outward, all vertices lie on or behind every face plane (convex).
- Max vertex distance to origin equals `radius` within 1e-9. Center of mass at origin within 1e-9.
- Face values are a permutation of the expected set and the opposite-face sum rule holds (opposite = face whose normal is the most anti-parallel).
- Inertia is symmetric positive definite. For d6 with edge `a`, unit density: `I = a^5/6 · Identity` within 1e-9 relative.
- d4: `vertexValues` is a permutation of 1..4 and `faces[k].value` equals the value of the vertex not in face k.

## Acceptance criteria
- `npx vitest run src/dice/shapes.test.js` exits 0.
- `npm run build` exits 0.

# Notes
Live test done (worktree commit b6f651c). The module is not imported by any app code yet, so I tested it through its real interface: a consumer imports createShape and uses the data the way physics (inertia, volume, edgeDirs, edges) and rendering (vertices, faces, winding, normals) will. I ran a consumer script in Node (242 checks) and a browser ESM smoke test in headless Chromium served over HTTP (8 checks).

Test design assumptions:
- Expectations come from an independent reference, not from the module: published polyhedron coordinates, my own face discovery, my own signed tetrahedron decomposition. I cross validated the reference against closed forms before use: d4 V = a^3/(6 sqrt2) and I = V a^2/20, d6 V = a^3 and I = a^5/6, d8 V = 4/3 and I = 4/15 (unit circumradius), d12 and d20 volume formulas. Agreement 1e-12 or better.
- All six dice are regular or centrally symmetric, so I checked that every vertex lies on the circumsphere (stronger than the spec max check) and that d10 opposite face normals are exactly anti parallel (central symmetry).
- d10 shape properties (right kite angles 128.17/90/90/51.83, height/width 1.0056) follow the task's stated published die assumption and were checked as geometry properties.
- Strict mode (ESM) so frozen mutation attempts must throw.
- Cache identity, trust boundary throws, plain number arrays, and scaling (radius 2.5 and 0.37, volume r^3, inertia r^5) tested through the public API.

Results: 241 of 242 checks pass, 8 of 8 browser checks pass, no console errors. Detail per type: face, vertex and edge counts and Euler match. Vertex sets match published coordinates within 1e-9. All vertices on the circumsphere at exactly radius. Faces planar (max deviation 6e-17), normals unit and outward, winding CCW, meshes convex. Volume and inertia match the independent reference within about 1e-13 relative. Inertia symmetric and positive definite for all types. d10 inertia is isotropic in x and y with Izz larger, as D5d symmetry requires. Opposite faces sum to 7/9/9/13/21 with an exact anti parallel partner for each face. d4 vertexValues are 1 to 4 and each face carries the value of its missing vertex. d10 kites measure 51.83/90/90/128.17 degrees and height/width 1.00562. EdgeDirs are unit, parallel unique, and cover all edge directions. Cache returns identical objects per (type, radius). Unknown types and bad radii (0, negative, NaN, Infinity, null, undefined, string) throw in Node and in the browser. Scaling follows r^3 and r^5.

Findings:
- #16 (low): createShape deep freezes every nested array except the edge pair arrays. Object.isFrozen(shape.edges[0]) is false, so a consumer can silently corrupt the globally cached shape. Everything else (vertices, face indices, normals, edgeDirs, inertia, vertexValues) is frozen.

Environment notes: a stale python http.server from an earlier session held port 8641 and served a foreign directory, I killed it by port before testing. Browser test used playwright Chromium from another repo's node_modules with python http.server 8642, stopped and verified after. The repo test suite and build were not run (acceptance criteria are the doer's verification). Reference and live test scripts are in /tmp/dice_ref.mjs, /tmp/dice_live.mjs, /tmp/dice_browser.cjs with expectations in /tmp/dice_expectations.json.
