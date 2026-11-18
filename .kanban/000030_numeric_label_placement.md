---
name: "fix: place every non-d6 face number inside its label atlas cell"
priority: "high"
state: "doing"
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
