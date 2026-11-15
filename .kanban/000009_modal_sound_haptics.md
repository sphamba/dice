---
name: "feat: synthesized impact sounds with plate modes, and haptics"
priority: "medium"
state: "merging"
worktree: "feat/9-modal-sound-haptics"
issuer: "user"
complexity: "simple"
shortName: "modal-sound-haptics"
blockedBy: ""
splitter: "done"
---

# Summary
Verification pass for the modal sound and haptics split. Subtasks #27 (src/audio/modes.js plate/die modes plus tests) and #28 (src/audio/sound.js, src/audio/haptics.js, main.js wiring) built the pieces in parallel against a pinned mode contract. Check the integrated result once both have landed.

# Specs
## Verification scope
- `npx vitest run src/audio` exits 0.
- `npm run build` exits 0.
- Manual: impacts make sounds after the first tap; a die on the glass lid (phone face-down) sounds different from the floor; a hit near the plate center sounds different from a hit near an edge; Android vibrates on strong hits.
- No mute toggle exists and no audio files were added; audio starts only after the first user gesture.

# Notes
## Deliverable
- Verification pass on the integrated modal sound build at HEAD a968634 (`feat(audio): play modal synthesis impact sounds and haptics`). No code change, no commit.

## Verification
- `npx vitest run src/audio`: 3 files, 26 tests passed, exit 0.
- `npm run build`: vite build green (`✓ built in 169ms`), 28 modules transformed.
- `dist/index.html` assets: `src="./assets/index-BWOSxVib.js"`, `href="./assets/index-DasNQWd4.css"`.
- Spec greps: no mute toggle, no audio files in the tree, `main.js:53` wires `sound.resume()` through `onFirstGesture`, `haptics.js` gates `navigator.vibrate` on `typeof === 'function'`.

## Assumptions
- Audio start is tied only to the first user gesture; a page that never sees a gesture stays silent by design.
- Browser features are gated on function presence, so behaviour under partial test globals differs from real browsers only by absence.
- Vibrate presence is Android-only in practice; other platforms get a silent false return.

## Blockers
- None. Manual checks (each material and impact point sounding distinct, Android vibration on strong hits) are left to the live-test role.
