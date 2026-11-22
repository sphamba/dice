---
name: "feat: icon buttons in the corners for Roll and Show controls"
priority: "medium"
state: "doing"
worktree: "feat/58-corner-icon-buttons"
issuer: "user"
complexity: "moderate"
shortName: "corner-icon-buttons"
splitter: "done"
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
