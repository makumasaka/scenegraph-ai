# Dioramai Agent Instructions

## Product intent

Dioramai is a visual runtime orchestration layer for AI-native React Three Fiber
applications.

Prioritize live code <-> runtime synchronization, deterministic commands,
stable node identity, inspectable canonical scene state, and app-ready R3F code
emission inside developer repositories.

## Architectural priorities

1. Schema first
2. Command system first
3. R3F runtime bridge third
4. Export/code sync fourth
5. Agent/MCP control plane fifth
6. UI polish last

## Core rules

- Never mutate canonical scene state directly from UI or runtime code.
- All meaningful edits must flow through commands.
- Preserve deterministic behavior and stable node IDs.
- Keep canonical scene state separate from render state, R3F refs, and Zustand
  app state.
- R3F refs are runtime projections only; they are never source of truth.
- Prefer small, typed, composable modules.
- Avoid broad abstractions before the command and code-sync model is stable.

## Code quality

- TypeScript only for new code.
- Zod schemas are the source of truth.
- Use pure reducers for scene state.
- Use Zustand only for web app/view state.
- Add tests with each architecture-affecting change.

## MVP scope

- Local project/repo sync only.
- Local GLB/GLTF registration only.
- Deterministic generated R3F module output.
- Code -> runtime sync through the generated `dioramaiScene` block.
- Deployment happens through the developer repo and Vercel, not Dioramai cloud.

## Non-goals for MVP

- No full DCC feature creep
- No realtime collaboration
- No shader graph or material graph
- No animation authoring, rigging, skinning, physics, or ECS
- No text-to-3D/image-to-3D asset generation orchestration
- No Meshy/Tripo/World Labs integration in the MVP path
- No cloud publishing
- No hidden mutations
