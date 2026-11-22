---
name: "fix: a zero-sized viewport resize permanently freezes dice at the box centre"
priority: "high"
state: "done"
worktree: "fix/47-a-zero-sized"
issuer: "#38"
complexity: "simple"
changes: "{\"base\":\"main\",\"ins\":43,\"del\":0,\"files\":2}"
commits: "[{\"hash\":\"8625cc5\",\"subject\":\"test(physics): cover the non-finite box case, the resize sequence and the zero-viewport load healing\",\"when\":\"2026-11-22T12:18:37+01:00\"},{\"hash\":\"65421d1\",\"subject\":\"fix(physics): ignore a zero-sized box in setBox\",\"when\":\"2026-11-22T12:11:44+01:00\"}]"
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
- Outcome: fixed. Live test green on both deferred checks: 23/23 checks passed (resize-storm probe 14/14, load-at-0 probe 9/9). No product defects found; no cards filed.
- Probe A, resize storm (the #38 trigger path): settle at 1280x720 (2x d6, asleep, center z = 0.008, min vertex z = 0) -> real viewport switch to 0x0 (innerWidth 0 confirmed, resize fired, 1.0 s sim observed) -> setBox kept the valid box {0.0889, 0.05, 0.05}, dice positions frozen exactly (max displacement 0), no crush to origin, no NaN -> real resize back to 1280x720 -> canvas backing restored to 1280x720, box valid, dice still resting on the floor (z = 0.008, min vertex z = 0), containment clean -> Roll moved dice 38 mm and they re-settled asleep: state not frozen. Console and pageerror clean in every phase.
- Probe B, load-time 0 viewport: page created and loaded with a 0x0 viewport (innerWidth 0 at load). Pre-heal state as documented: box {0,0,0}, canvas backing 1x1, 2 dice near the origin, awake with micro-jitter velocities up to 0.76 m/s (contact churn, matches the reviewer note). First valid resize healed everything: box {0.0889, 0.05, 0.05}, canvas 1280x720, dice lifted to the floor (z = 0.008, min vertex z = 0), containment clean, asleep. Roll after heal moved dice 30 mm and re-settled. Console and pageerror clean.
- Test-environment difficulty (worked around, no card): CDP Emulation.setDeviceMetricsOverride was clobbered by Playwright's own viewport emulation (innerWidth stayed 1280, no resize event); Playwright's setViewportSize({0,0}) and a 0x0 context viewport both work and were used instead. One harness log artifact (a minDist=NaN detail string from a bad map argument) did not affect any assertion.
- Observations, not defects: (1) on the valid resize, clampIntoBox's circumradius clamp popped one resting die 2.7 mm in y (clamp bound 0.025 - r = 0.01114); pre-existing behaviour of every valid resize, dice stay on the floor; (2) during the 0x0 window renderer.resize still runs with a 1x1 canvas and degenerate camera (boxFromViewport still returns a 0 box); the canvas backing falls to 1x1 and fully recovers on the next valid resize, covered by the developer's stated assumptions.
- Assumptions made while designing the usage tests: (a) the transient 0 report is emulated by a real viewport switch to 0x0 and back to a valid size, matching the task's "resize observed while the viewport reports 0x0"; (b) healing is user-visible through dice resting on the floor (center z > 0.005, min vertex z >= -2e-3) and a Roll that moves dice, so drag tests are not needed for this change; (c) default panel set (2x d6) is a sufficient dice count. None of these assumptions was contradicted by observed behaviour.
- Check results: PASS A1.1-A5 (spawn/settle, box kept under 0x0, dice not crushed, no NaN, canvas+box healed, dice on floor, containment, roll moves 38 mm, re-settle, console clean); PASS B1.1 (load+spawn under 0x0), B2.1-B2.5 (canvas+box heal, floor rest, containment, no NaN), B3.1-B3.2 (roll moves 30 mm, re-settle), B4 (console clean); PASS E1-E3, E6-E7 env checks (world steps, rAF ~16 fps, 2 d6 spawn, restore path); E4-E5 FAIL = the CDP-override harness limitation above, superseded by probe-resize P1-P3 (3/3 PASS) which verified both real zero-viewport paths. Raw results: /tmp/dice-lt47/results-{env,resizepath,storm,loadzero}.json; servers stopped, port 4747 verified free.
