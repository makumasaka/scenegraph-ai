# MCP-Lite Eval Loop

This eval proves the library-level agent workflow before Diorama adds a real MCP
transport.

## Flow

1. Create `createMcpLiteRuntime()` (or start from `showroomScene` / `REPLACE_SCENE` load).
2. Read `getScene()`, `getSemanticGroups()`, and `getBehaviors()`.
3. Dry-run `structureScene({ preset: "showroom" })`.
4. Apply `structureScene({ preset: "showroom" })`.
5. Dry-run `makeInteractive({ targetRole: "product" })`.
6. Apply `makeInteractive({ targetRole: "product" })`.
7. Dry-run and apply an `arrangeNodes()` helper payload (`nodeIds` and/or `role` + `layout`).
8. Inspect semantic groups and behavior definitions.
9. Export JSON with `exportJSON()` and parse with `parseSceneJson`.
10. Export R3F module code with `exportR3F({ mode: "module" })`.

## Test Coverage

Primary loop tests: `packages/agent-interface/src/mcpLite.test.ts`.

Extended MCP-lite agent runtime (read safety, semantic commands, batch policy, demo workflow, replay, API surface): `packages/agent-interface/src/mcpLite.agentRuntime.test.ts`.

Related session contract (clone semantics, batch atomics, replay, safety): `packages/agent-interface/src/runtimeContract.test.ts` and `packages/agent-interface/src/agentInterface.test.ts`.

| Loop | Test expectation | Pass criteria |
|------|------------------|---------------|
| Read loop | `getScene()` returns a clone; group and behavior helpers reflect current scene state. | Tampering with returned data does not mutate runtime state. |
| Structure loop | `structureScene()` supports dry-run and apply. | Dry-run previews `semanticGroups`; apply persists groups and node semantics. |
| Interaction loop | `makeInteractive()` supports dry-run and apply. | Dry-run previews behavior definitions; apply persists behavior refs and definitions. |
| Batch loop | Command batches validate and run atomically. | Failed batch does not partially commit; valid batch commits all commands. |
| Arrange loop | `arrangeNodes()` compiles to `ARRANGE_NODES`. | Dry-run previews transform changes; apply persists them. |
| Export loop | JSON and R3F module exports use the same runtime scene. | JSON parses; module contains semantic components and behavior handlers. |
| Replay loop | Same command batch from the same initial scene twice. | Exported JSON is byte-identical; R3F module snapshot stable (`mcpLite.agentRuntime.test.ts`). |
| Safety loop | Invalid helper inputs return `VALIDATION_ERROR`; unsafe metadata is not executable output. | No filesystem, shell, Zustand, R3F object, code mutation, action log, command log, or file URL leakage. |

## Validation Commands

Run the focused MCP-lite loop first:

```shell
npm run test -w @diorama/agent-interface -- mcpLite.test.ts
npm run test -w @diorama/agent-interface -- mcpLite.agentRuntime.test.ts
```

Then run package and workspace gates when practical:

```shell
npm run test -w @diorama/agent-interface
npm run test -w @diorama/export-r3f
npm run typecheck
```

## Real MCP Gate

Real MCP is allowed only after these evals prove the command-first path:

- Agent reads never share mutable scene references.
- Agent writes always validate with `CommandSchema`.
- Helper writes compile to commands and use dry-run before apply.
- R3F and JSON exports are derived read models.
- Export output excludes command logs, action logs, local paths, raw URLs, and
  arbitrary executable JavaScript.
