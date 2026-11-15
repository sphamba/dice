---
name: "feat: dice polyhedra geometry d4 to d20 with face values and mass properties"
priority: "high"
state: "backlog"
worktree: ""
issuer: "user"
complexity: "moderate"
shortName: "dice-shapes-geometry"
blockedBy: "#2"
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
