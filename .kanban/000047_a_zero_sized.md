---
name: "fix: a zero-sized viewport resize permanently freezes dice at the box centre"
priority: "high"
state: "to-review"
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
- Deliverable: `world.setBox` now ignores a box with any edge <= 0, keeping the last valid box, so a 0x0 viewport resize (boxFromViewport returns W=H=D=0 when shortest<=0) can no longer crush bodies to (0,0,0) and sleep them there.
- Verification: HEAD 65421d1. Red first: `npx vitest run src/physics/world.test.js -t 'zero-sized'` failed on the zero box; after the guard, `npx vitest run src/physics/world.test.js src/physics/world.e2e.test.js` 46 passed, `npm run build` green with asset grep on dist/index.html.
- Regression test: "ignores a zero-sized box and keeps the last valid one" in src/physics/world.test.js (box kept, position untouched, real d6 body still rests above z=0 after one simulated second).
- Assumption: main.js applySize still forwards the degenerate box to renderer.resize for that one 0-viewport event. The frame is invisible (canvas 0 wide) and the next valid resize rebuilds the camera cleanly, so no main.js skip was added.
- Assumption: a world created on a 0 viewport starts with a 0 box and is healed by the first valid resize, because setBox then clamps the bodies inside and wakes them.
- Blockers: none.
- Manual checks left to other roles: a live page under a 0-size viewport emulation switch, then a real resize, to confirm dice re-settle instead of staying at the box centre.
