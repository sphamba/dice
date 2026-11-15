---
name: "feat: synthesized impact sounds with plate modes, and haptics"
priority: "medium"
state: "backlog"
worktree: ""
issuer: "user"
complexity: "simple"
shortName: "modal-sound-haptics"
blockedBy: "#27, #28"
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
