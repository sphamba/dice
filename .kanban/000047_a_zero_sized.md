---
name: "fix: a zero-sized viewport resize permanently freezes dice at the box centre"
priority: "high"
state: "doing"
worktree: "fix/47-a-zero-sized"
issuer: "#38"
complexity: "simple"
---

# Summary
A resize observed while the viewport reports 0x0 makes applySize call setBox with a 0x0x0 box (boxFromViewport's MIN_BOX_EDGE guard only fires for shortest>0). containBody then drives every body to (0,0,0), the sleep gate freezes the dice half-buried at the box centre, and the state survives rolls and drags; the app stays broken until reload.

# Specs
# Evidence (live-test of #38)
- probe8/probe9/probe9b pages (3 occurrences, ~3-5 of ~25 fresh pages this session): on fresh load both dice rest at exactly (0,0,0), z=0 (centre on the floor plane = half-buried), asleep=true, with real random orientations. The state persists: a Roll changes orientations but not positions (observed in probe9b phase B); a drag grab-check passes but the die stays buried.
- The rendered frame matches the world (dice drawn half-buried at the canvas centre), so it is a world state, not a measurement artifact. Console clean, glErr 0. Could not be reproduced on demand: 20 later fresh pages all spawned and rested correctly.
- Root-cause path derived from source: applySize (src/main.js:147) rebuilds the box from live innerWidth/innerHeight on every resize event and on screen-orientation change. boxFromViewport (src/physics/box.js) returns W=H=D=0 exactly when shortest<=0 because the MIN_BOX_EDGE guard requires shortest>0. With a 0 box, containBody (src/physics/world.js:57) drives every body coordinate to 0 while zeroing the opposing velocity, the sleep gate sleeps the world, and step() then early-returns while asleep - containBody can never lift the die again.
- Likely trigger: a resize event observed while the viewport transiently reports 0 (window minimize, orientation change, page restore). No follow-up resize heals the box, so the state is permanent until reload. The same 0 box also gives a degenerate camera, so the canvas can stay empty.

# Change
- In applySize (or boxFromViewport), ignore a viewport with innerWidth==0 || innerHeight==0 (or a non-finite size): skip setBox and renderer.resize entirely, keep the last valid box, and let the next valid resize heal. If the first size at load is 0, wait for the first valid size before spawning dice and sizing the renderer.

# Tests
- `boxFromViewport` (or the new guard helper): a 0 or non-finite width or height gives no box (null) instead of a 0 box. Valid sizes are unchanged.
- A world-level test: a sequence of valid, 0-sized and valid resizes never sets a 0-dimension box, and dice settled before the storm rest at the floor (z > 0) after it.

# Acceptance criteria
- `npx vitest run src/physics`
- `npm test`
- `npm run build`

# Notes
