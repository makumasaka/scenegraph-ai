# Example: prompt → command flow

**User prompt:** “Select the root, add a cube-shaped node named Props under it, then move it up by 2 units.”

**Agent plan (structured):**

1. Read the scene and selection so ids are grounded in real graph state.

   - Call `getScene()` → use `scene.rootId` as the parent for the new node.
   - Optionally `getSelection()` if the prompt referred to “current” selection.

2. Build a **validated** command sequence (each object must match `CommandSchema` / core `Command`):

   ```json
   { "type": "SET_SELECTION", "nodeId": "<rootId from getScene>" }
   ```

   ```json
   {
     "type": "ADD_NODE",
     "parentId": "<rootId>",
     "node": {
       "id": "props-1",
       "name": "Props",
       "children": [],
       "transform": {
         "position": [0, 0, 0],
         "rotation": [0, 0, 0],
         "scale": [1, 1, 1]
       }
     }
   }
   ```

   ```json
   {
     "type": "UPDATE_TRANSFORM",
     "nodeId": "props-1",
     "patch": { "position": [0, 2, 0] }
   }
   ```

3. **Preview** risky edits once:

   - `applyCommand(cmd, { dryRun: true })` → inspect `data.scene` and `data.changed` without mutating the session.

4. **Commit** each command when satisfied:

   - `applyCommand(cmd)` (omit `dryRun` or set `dryRun: false`).

5. **Export** for downstream tools:

   - `exportScene({ format: "json" })` or `{ format: "r3f", r3f: { includeStudioLights: true } }`.

**Rules this flow follows:** payloads are validated before the reducer runs; the agent never receives a live mutable scene reference from `getScene()` (only clones); optional dry-run prevents accidental session updates.
