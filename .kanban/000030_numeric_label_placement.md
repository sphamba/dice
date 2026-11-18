---
name: "fix: place every non-d6 face number inside its label atlas cell"
priority: "high"
state: "to-merge"
worktree: "fix/30-numeric-label-placement"
issuer: "#8"
complexity: "simple"
shortName: "numeric-label-placement"
---

# Summary
Non-d6 numerals omit the current atlas-cell origin and are drawn at the global canvas origin. Correct d4 corner labels and centered d8/d10/d12/d20 labels while preserving the working d6 pips.

# Specs
# User-visible defect
Only d6 markings are readable. d4, d8, d10, d12 and d20 faces have no usable numbers.

# Root cause and scope
- In `src/dice/labels.js`, `drawFaceLabel()` computes the current atlas-cell `px()`/`py()` mappings but passes them only to the d6 pip path.
- d4 corner numbers and centered d8/d10/d12/d20 values use `drawText()` without the cell origin. `drawText()` translates only by local face coordinates, so text is drawn at or beyond the global canvas origin rather than inside the current face cell.
- Fix this shared label-drawing path. Reuse existing shapes, face values, UVs, colors and atlas layout. Do not rewrite the renderer or geometry.

# Required labels
- d4: exactly three values per face, one at each corresponding corner, oriented upright when that corner points up.
- d6: preserve the current correct pip layouts 1-6.
- d8/d10/d12/d20: the complete correct face value centered inside every face cell.
- Keep all numerals contrasting, unclipped and isolated from neighboring cells. Preserve underlines that distinguish standalone 6 and 9.

# Regression coverage
- Add drawing tests for d4 and d8/d10/d12/d20, not only UV-layout tests.
- Check the recorded text transforms or resulting atlas pixels so every allocated cell contains its intended ink and numeric ink is not stranded at the global canvas origin.
- Cover centered one- and two-digit values and all three d4 corner positions. Keep the d6 tests passing.
- Browser live test: orient every face of every die type toward the camera and confirm its correct readable label at desktop and phone sizes.

# Acceptance commands
- `npx vitest run src/dice/labels.test.js`
- `npm run build`

# Notes
- Deliverable: `src/dice/labels.js` `drawText()` now translates by the caller's atlas `px()`/`py()` cell mapping, so d4 corner numerals and centered d8/d10/d12/d20 values draw inside their own cell instead of at the canvas origin. d6 pip path untouched.
- Verification: `npx vitest run src/dice/labels.test.js` 10 passed; `npx vitest run src/dice src/render` 72 passed; `npm run build` green with `dist/index.html` referencing `assets/index-B46EH-Ci.js` and `assets/index-DasNQWd4.css`. Live Chromium atlas pixel scan and desktop/phone roll screenshots: all six types PASS, 0 stranded pixels outside cells, 0 ink in the origin block, no console errors.
- New tests in `src/dice/labels.test.js` record real `fillText`/`fillRect` transforms through a fake 2D context and assert per-cell positions for d4 (three distinct corner values), centered values for d8/d10/d12/d20, one- and two-digit coverage, and the 6/9 underlines inside their cells.
- Commit `6d68aaa`.
- Assumptions: the retained `angle = atan2(-x, y)` on d4 corners already satisfies "upright when that corner points up"; the fake-context `measureText` width (56 px per character at 100 px) only feeds font sizing, not asserted ink extents.
- Blockers: none.
- Manual checks left to other roles: none.
