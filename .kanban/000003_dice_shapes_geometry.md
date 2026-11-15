---
name: "feat: dice polyhedra geometry d4 to d20 with face values and mass properties"
priority: "high"
state: "live-testing"
worktree: "feat/3-dice-shapes-geometry"
issuer: "user"
complexity: "moderate"
shortName: "dice-shapes-geometry"
blockedBy: ""
splitter: "done"
changes: "{\"base\":\"main\",\"ins\":589,\"del\":0,\"files\":2}"
commits: "[{\"hash\":\"b6f651c\",\"subject\":\"feat(dice): add d4 to d20 polyhedra with face values and mass properties\",\"when\":\"2026-11-15T19:10:17+01:00\"}]"
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
- Done: `src/dice/shapes.js` exports `DICE_TYPES` and `createShape(type, radius)`; `src/dice/shapes.test.js` holds the spec test set (48 tests, all pass).
- Faces are discovered generically by enumerating vertex triples whose plane leaves all other vertices behind (origin inside), then ordering each polygon counter-clockwise around the outward normal, so no face index tables are hard-coded.
- Vertices come from symmetric orbits (d6/d8/d12/d20) plus the die-shaped pentagonal trapezohedron (d10); volume, center of mass and inertia come from a signed tetrahedron decomposition, then re-centered and scaled so circumradius = `radius`.
- Face values are assigned by pairing each face with its most anti-parallel normal; pairs get `(first + i, first + n - 1 - i)` with `first = 0` for d10 and 1 otherwise, so opposite sums are 7/9/9/13/21. d4 exposes `vertexValues` 1..4 and each face takes the value of its missing vertex.
- Assumption: d10 uses the right-kite trapezohedron from published die geometry (all 12 vertices on the circumsphere, height/width 1.0056, kite angles 128.17/90/90/51.83; `r = sqrt(44+20*sqrt5)`, `z2 = 5+2*sqrt5`, `z1 = 1`). The polar dual of the uniform antiprism was rejected: height/width 1.81, too pointy for a real die.
- Assumption: d12 is the regular dodecahedron (12 pentagons) and d20 the regular icosahedron (20 triangles), following die naming rather than face count of the solid class.
- Assumption: vertices, normals and the 9-number inertia tensor are plain number arrays, not `Float32Array`, because the 1e-9 tolerances need doubles and typed arrays cannot be frozen; the tensor is symmetric so row-major and column-major layouts agree.
- Assumption: within an opposite pair the two values are assigned in normal-sorted order; the specs fix only the sum rule, so the exact face-to-value map is arbitrary.
- Assumption: `createShape` throws on unknown type and on non-finite or non-positive radius (trust boundary), and caches per `(type, radius)`.
- Verification: `npx vitest run src/dice/shapes.test.js` 48/48 pass; clean-room `git archive` copy with `npm ci && npm test` (93 tests) and `npm run build` passes, `dist/index.html` references `./assets/...`.
