---
name: "feat: icon buttons in the corners for Roll and Show controls"
priority: "medium"
state: "reviewing"
worktree: "feat/58-corner-icon-buttons"
issuer: "user"
complexity: "moderate"
shortName: "corner-icon-buttons"
splitter: "done"
blockedBy: ""
---

# Summary
Make Roll a small round icon button in the lower-right corner, and the Show controls toggle a small round icon button in the lower-left corner. Keep the accessible names and the Space shortcut.

# Specs
# Facts (main)
- `src/ui/panel.js`: the toggle `<button class="panel-toggle">` shows "Show controls"/"Hide controls" text with `aria-expanded` and `aria-controls="dice-rows"`, and has no aria-label (:137-154). Roll is `<button class="panel-roll">` with the text "Roll" and `aria-label="Roll dice"` (:174-179). Order in a flex column: toggle, rows (hidden by default), Roll (:181). Space triggers Roll (:183-190).
- `src/style.css:44-136`: `.panel` sits bottom centre. Buttons are 44 px minimum. `.panel-roll` is 48 px high, `#4f6dff`.
- No icon system and no SVG in the project. No new dependency.
- `src/ui/panel.test.js` queries `panel-toggle` and `panel-roll` by class (:150,152) and checks the toggle text (:167,179,184).

# Change
- Roll: a round 48 px button fixed in the lower-right corner, with an inline SVG icon of a die face (rounded square with 5 pips) and no visible text. Keep `aria-label="Roll dice"` and the blue fill.
- Toggle: a round 48 px button fixed in the lower-left corner, with an inline SVG sliders icon and no visible text. Give it `aria-label` "Show controls"/"Hide controls" that follows the state. Keep `aria-expanded` and `aria-controls`.
- The dice rows open above the toggle, aligned to the left edge. Their content and behaviour do not change.
- Offset both buttons from the corners by 16 px plus `env(safe-area-inset-*)`. Keep a visible focus ring. The SVGs get `aria-hidden="true"` and use `currentColor`.
- Keep the Space shortcut.

# Tests (`src/ui/panel.test.js`)
- Replace the toggle text checks with `aria-label` checks ("Show controls", then "Hide controls").
- Each button contains one `svg` with `aria-hidden="true"` and has no visible text.
- Roll keeps `aria-label="Roll dice"`. The Space tests stay green.

# Acceptance criteria
- `npx vitest run src/ui`
- `npm test`
- `npm run build`
- Live check (desktop 1280x800, phone 393x852): Roll is in the lower-right corner, the toggle is in the lower-left corner, both show icons, both work with mouse, touch and keyboard, and the rows open above the toggle without covering the Roll button.

# Notes
- Roll is now a 48 px round icon button fixed in the lower-right corner: inline SVG die face (rounded square, 5 pips), `aria-label="Roll dice"` kept, blue `#4f6dff` fill, no visible text.
- The Show/Hide controls disclosure is a 48 px round icon button fixed in the lower-left corner with an inline SVG sliders icon; `aria-label` follows the state ("Show controls"/"Hide controls"), `aria-expanded` and `aria-controls="dice-rows"` unchanged, no visible text.
- The dice rows card left the old bottom-centre panel: it opens above the toggle, left-aligned, spanning between the corners (`left: 16px + safe-area`, `right: 80px + safe-area`, `bottom: 74px + safe-area`), so it cannot overlap the Roll button. Row content and behaviour unchanged.
- Both buttons use `16px + env(safe-area-inset-*)` offsets, sit in a now transparent full-viewport `.panel` wrapper with `pointer-events: none` on the wrapper and `auto` on the buttons and rows, and keep the existing `:focus-visible` ring. SVGs are `aria-hidden="true"` and use `currentColor`.
- Space shortcut unchanged (document keydown, ignored when the target is a button).
- Tests: `src/ui/panel.test.js` checks `aria-label` instead of the old toggle text, asserts one `aria-hidden` SVG with `currentColor` and no text per button, keeps the Roll label and Space tests. The stub document gained `createElementNS`.

# Verification
- Commit `0ed5dc4 feat: move Roll and Show controls into corner icon buttons` (clean tree at HEAD 0ed5dc4).
- `npx vitest run src/ui`: 19 tests passed.
- `npm test`: 348 tests in 28 files passed.
- `npm run build`: 30 modules, assets emitted; `dist/index.html` references `./assets/index-DWhYW3PH.js` and `./assets/index-IEdiEYU.css`.
- Live check, all 8 scenarios PASS, zero page and console errors: desktop 1280x800 Roll box {1216,736,48x48} radius 50% with 16 px right and bottom gaps, toggle {16,736,48x48} with 16 px left and bottom gaps; rows {16,656,1184x70} left-aligned with the toggle, 10 px above it, not intersecting Roll; toggle `aria-label` flips Show/Hide with `aria-expanded`; Roll click clean; keyboard Enter opens the rows and body Space preventDefaults and rolls (canvas render hash changed); phone 393x852 with touch, tap opens the rows {16,468,297x310} clear of Roll, no horizontal overflow (scrollWidth 393 = innerWidth). Screenshots: /tmp/live58-desktop.png, /tmp/live58-phone.png.

# Assumptions
- The old floating card styling (border, blur, shadow, padding) now belongs to the rows card only; the two corner buttons are standalone circles on the canvas.
- `.panel` stays as a full-viewport transparent wrapper so the canvas keeps receiving pointer events everywhere outside the buttons and rows.

# Blockers
- None.

# Open questions

