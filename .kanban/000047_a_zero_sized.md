---
name: "fix: a zero-sized viewport resize permanently freezes dice at the box centre"
priority: "high"
state: "live-testing"
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
- Outcome so far: fixed in live testing so far; both deferred live checks in progress, probe A (resize storm) fully green, probe B (load at 0 viewport) written and queued.
- Method: vite dev server on :4747 from this worktree, headless Chromium + SwiftShader (fps ~16, dpr 1), createWorld route-spy for world observation, real viewport switches via Playwright setViewportSize (CDP setDeviceMetricsOverride was clobbered by Playwright's viewport emulation, so not used). Zero-viewport emulation verified to report innerWidth 0 and fire resize. Settle detection = world asleep; floor thresholds from source constants: settled d6 center z = 0.008 (half edge), box at 1280x720 dpr1 = {W:0.0889, H:0.05, D:0.05} (MIN_BOX_EDGE guard raises m/px to 0.05/720).
- Probe A (settled at 1280x720 -> 0x0 viewport event -> real resize): 14/14 PASS. During 0x0 (innerWidth 0 confirmed, 1.0 s sim): setBox kept the valid box {0.0889, 0.05, 0.05}, dice positions frozen exactly (maxDp = 0), no origin crush, no NaN. After restore to 1280x720: canvas backing restored to 1280x720, box valid, dice still on the floor (z = 0.008, min vertex z = 0), containment clean. Roll after the storm moved dice 38 mm and they re-settled asleep: state not frozen. Console and pageerror clean throughout.
- Probe B (load with a 0x0 viewport, then first valid resize): driver written (/tmp/dice-lt47/probeB.mjs), run pending.
- Observations, not defects: (1) on the valid resize, clampIntoBox's circumradius clamp popped one resting die 2.7 mm in y (y -0.01385 -> -0.01114, clamp bound 0.025 - r) - pre-existing behaviour of every valid resize, dice stay on the floor; (2) during the 0x0 window renderer.resize still runs with a 1x1 canvas and degenerate camera (boxFromViewport still returns a 0 box), canvas backing falls to 1x1 and recovers on the next valid resize, as covered by the developer's stated assumptions.
- Assumptions made while designing the usage tests: (a) the transient 0 report is emulated by a real viewport switch to 0x0 and back to a valid size, matching the task's "resize observed while the viewport reports 0x0"; (b) healing is user-visible through dice resting on the floor (center z > 0.005, min vertex z >= -2e-3) and a Roll that moves dice, so drag tests are not needed for this change; (c) default panel set (2x d6) is a sufficient dice count.
- Harness + raw results: /tmp/dice-lt47/ (harness.mjs, probe-env.mjs, probe-resize.mjs, probeA.mjs, probeB.mjs, results-*.json). Env probe: WebGL2 world steps, rAF ~16 fps, 2 d6 spawn, whole sample JSON printed before consumption.
