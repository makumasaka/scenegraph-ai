# Milestone 7 Fixtures

These fixtures prove the future code -> canvas -> code loop without running a
real MCP server. Tests should load these files, run them through
`createAgentSession()`, dry-run first, apply only after successful dry-run, then
export and replay.

## Intent Fixture Shape

Each file in `intents/` uses this shape:

- `id`: stable scenario id.
- `title`: short human-readable title.
- `startingSceneId`: starter kit id from `@diorama/core`.
- `intent`: natural-language request an external agent might receive.
- `commands`: deterministic command batch compiled from the intent.
- `expectedSelection`: expected final selection after successful apply, or
  `null`.
- `expectedChangedNodeIds`: node ids expected to be created or changed.
- `expectedNodeTransforms`: optional transform checks for final scene state.
- `expectedErrors`: structured command errors expected for rejected scenarios.
- `expectedWarnings`: non-fatal warnings expected from dry-run/apply.
- `exportChecks`: substrings or node ids expected in JSON/R3F exports.
- `replaySafe`: must be `true` for success fixtures.

## Determinism Rules

- Do not call an LLM in tests.
- Do not call real MCP transport in tests.
- `DUPLICATE_NODE` commands must include a complete deterministic `idMap`.
- Rejected scenarios must prove no session mutation and no action log entry.
- Successful scenarios must replay from the same initial scene to the same final
  scene and JSON export.
