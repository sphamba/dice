---
name: "fix: a zero-sized viewport resize permanently freezes dice at the box centre"
priority: "high"
state: "to-do"
worktree: "fix/47-a-zero-sized"
issuer: "#38"
complexity: "simple"
---

# Summary
A resize observed while the viewport reports 0x0 makes applySize call setBox with a 0x0x0 box (boxFromViewport's MIN_BOX_EDGE guard only fires for shortest>0). containBody then drives every body to (0,0,0), the sleep gate freezes the dice half-buried at the box centre, and the state survives rolls and drags; the app stays broken until reload.

# Specs
# Evidence (live-test of #38)
- probe8/probe9/probe9b pages (3 occurrences, ~3-5 of ~25 fresh pages this session): on fresh load both dice rest at exactly (0,0,0), z=0 (centre on the floor plane = half-buried), asleep=true, with real random orientations. The state persists: a Roll changes orientations but not positions (observed in probe9b phase B); a drag grab-check passes but the die stays buried.
- The rendered frame matches the world (dice drawn half-buried at the canvas centre), so it is a world state, not a measurement artifact. Console clean, glErr 0. Could not be reproduced on demand: 20 later fresh pages all spawned and rested correctly (probe12 8/8, probe13 2/2, probe14 4/4, probe16e 3/3, probe16f 3/3).
- Root-cause path derived from source: applySize (src/main.js:147) rebuilds the box from live innerWidth/innerHeight on every resize event and on screen-orientation change. boxFromViewport (src/physics/box.js) returns W=H=D=0 exactly when shortest<=0 because the MIN_BOX_EDGE guard requires shortest>0. With a 0 box, containBody (src/physics/world.js:57) computes push=-2*p per axis and drives every body coordinate to 0 while zeroing the opposing velocity, so the die reads v=0, the sleep gate (fastestPoint < SLEEP_SPEED, 0.5 s) legally sleeps it, and step() then early-returns while asleep && !moving - containBody can never lift the die again. Roll writes velocities but positions do not integrate (observed).
- Likely trigger: a resize event observed while the viewport transiently reports 0 (mid-load emulation switch in the test harness; plausibly window minimize or orientation change for real users). After the bad applySize there is no follow-up resize to heal the box, so the state is permanent until reload.

# Fix direction
- In applySize (or boxFromViewport), ignore a viewport with innerWidth==0 || innerHeight==0: skip setBox and renderer.resize entirely, keeping the last valid box, and let the next valid resize heal. Alternatively clamp shortest>0 in boxFromViewport, but skipping is safer because a 0 viewport is never a real layout.
- Acceptance: no sequence of resize/orientation events (including 0-sized ones) leaves the world with a 0-dimension box; dice never rest at (0,0,0) half-buried; after any resize storm the dice either stay put in the last valid box or re-settle normally; a following valid resize restores normal spawn/rest behaviour.

# Notes
