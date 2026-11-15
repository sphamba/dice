---
name: "fix: freeze edge element arrays in cached dice shapes"
priority: "low"
state: "backlog"
worktree: ""
issuer: "#3"
complexity: "trivial"
---

# Summary
createShape deep-freezes every nested array of the shape except the edge pair arrays. edges[0] (and the rest) stay mutable, so a consumer that mutates an edge silently corrupts the globally cached shape for all later callers.

# Specs
In src/dice/shapes.js, freezeShape(shape) freezes shape.edges (the outer array) but not its [i, j] elements, while vertices, face indices, face normals, edgeDirs, inertia and d4 vertexValues are all frozen element-wise. A consumer doing shape.edges[k][0] = x (easy to do accidentally while building SAT axis lists) mutates the shared cached object with no error and no way to repair it. Fix: Object.freeze each edge pair in freezeShape (or freeze inside buildEdges). Verified by live test: Object.isFrozen(createShape('d12', 1).edges[0]) === false while Object.isFrozen(createShape('d12', 1).vertices[0]) === true.

# Notes
