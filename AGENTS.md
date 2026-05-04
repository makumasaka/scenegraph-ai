# Diorama Agent Instructions

## Product intent
Diorama is an AI-native spatial canvas and deterministic scene-graph system.
Prioritize structured scene editing, deterministic commands, inspectable state,
and export to JSON + React Three Fiber.

## Architectural priorities
1. Schema first
2. Command system first
3. Viewport second
4. Transport/export third
5. Agent surface fourth
6. Polish last

## Core rules
- Never mutate scene state directly from UI code.
- All meaningful edits must flow through commands.
- Preserve deterministic behavior.
- Prefer small, typed, composable modules.
- Keep canonical scene state separate from render state.
- Avoid broad abstractions before the command model is stable.

## Code quality
- TypeScript only for new code.
- Zod schemas are the source of truth.
- Use pure reducers for scene state.
- Use Zustand only for app/view state.
- Add tests with each architecture-affecting change.

## Non-goals for MVP
- No full DCC feature creep
- No realtime collaboration
- No shader graph
- No broad format interoperability
- No hidden mutations