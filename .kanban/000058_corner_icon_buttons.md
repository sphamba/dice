---
name: "feat: icon buttons in the corners for Roll and Show controls"
priority: "medium"
state: "merging"
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
- Outcome: approved. One commit 0ed5dc4 on feat/58-corner-icon-buttons, clean tree; diff touches src/style.css, src/ui/panel.js, src/ui/panel.test.js only.
- Spec mapping: Roll is a 48 px round button fixed lower-right with 16 px + env(safe-area-inset-*) offsets, inline SVG die face (rounded rect rx 4 + 5 pips), no visible text, aria-label="Roll dice", #4f6dff fill. Toggle is a 48 px round button fixed lower-left with an inline SVG sliders icon (3 lines + knobs), aria-label flips "Show controls"/"Hide controls" with state, aria-expanded and aria-controls="dice-rows" kept. Both SVGs aria-hidden="true", currentColor, focusable="false".
- Rows card: bottom 74 px (10 px above the toggle's 64 px top edge), left aligned with the toggle, right 80 px clears the Roll button; open/close behaviour and row DOM unchanged. Inner rows alignment changed center to flex-start, accepted as part of the left-alignment requirement.
- Focus ring (:focus-visible outline) and Space shortcut (document keydown, skipped on buttons) unchanged.
- Tests match the spec: aria-label checks replace the toggle text checks, one-svg/aria-hidden/currentColor/no-text assertion per button, Roll label kept, Space tests untouched, stub gained createElementNS.
- Grep clean: no leftover toggle/roll text assignments, "Show controls"/"Hide controls"/"Roll dice" exist only as aria-labels, index.html has no panel markup, buildIcon reaches both construction sites.
- Evidence: shim fix + `npx vitest run src/ui` = 19/19 passed; `npm run build` = 30 modules, assets emitted. Full suite not rerun per scoped-suite policy (developer recorded 348/348 in 28 files).
- For the live tester: check desktop 1280x800 and phone 393x852 corner placement, icon visibility, mouse/touch/keyboard operation, and that the rows open above the toggle without covering Roll.

# Open questions

