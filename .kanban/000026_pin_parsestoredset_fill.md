---
name: "fix: pin parseStoredSet fill for missing keys (DEFAULT_SET vs 0)"
priority: "low"
state: "backlog"
worktree: ""
issuer: "#24"
complexity: "trivial"
blockedBy: "question"
---

# Summary
parseStoredSet inherits DEFAULT_SET values for keys missing from stored JSON, while the #24 Notes record the assumption that missing keys fill with 0. A decision is needed on which behavior is correct, then the code or the docs must move.

# Specs
Evidence (live test of #24, headless Chromium, worktree feat/24-app-integration-panel-ui, commit acd71bd): with localStorage dice.set = '{"d8":1}' the panel renders d6=2 (counts 0,2,1,0,0,0), and the next change persists {"d4":1,"d6":2,"d8":1,"d10":0,"d12":0,"d20":0}. The task Notes state the assumption "parseStoredSet fills missing type keys with 0", so observed behavior contradicts the recorded assumption. The specs do not pin this case. Practical impact today is low because the panel always writes a full 6-key set, so partial sets only appear from external edits or an older schema. Root cause: src/ui/panel.js parseStoredSet seeds the result with {...DEFAULT_SET} and only overrides keys present in the stored object. Fix direction: either seed with zeros for missing keys or update the assumption and specs to match the current behavior. Acceptance: partial stored sets behave per the pinned rule, covered by a unit case in src/ui/panel.test.js.

# Notes

# Open questions
Should parseStoredSet fill missing type keys with 0, or inherit the DEFAULT_SET values (d6=2) as implemented today? The task Notes record the assumption "fills missing type keys with 0", the code keeps DEFAULT_SET values. Pick one and pin it in the specs.
