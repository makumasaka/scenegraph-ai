# Diorama

Diorama is a deterministic spatial control system for building, editing, and exporting 3D scenes.

Diorama treats a scene as a structured spatial system: a scene graph plus
commands. The canvas visualizes state, the API exposes a programmable interface,
and every meaningful change flows through deterministic command execution.

## How it works

- **Scene graph**: Zod-validated nodes, hierarchy, transforms, visibility,
  optional assets/materials/lights, and metadata.
- **Command system**: every persistent change is a typed command applied to the
  scene graph.
- **Deterministic updates**: the same starting scene plus the same command
  sequence produces the same result.
- **Serialization and export**: scenes export as stable `diorama-scene` JSON and
  readable React Three Fiber JSX.

## Dual Interface

Diorama exposes two equal interfaces over the same scene graph + commands:

- **Canvas for humans**: the web canvas visualizes the scene and turns user
  actions into commands.
- **API for agents**: the agent interface and future MCP layer let tools read
  scenes and submit validated commands.

Neither interface owns scene state. Both use the same schemas, reducers, and
export paths.

## AI Workflow

1. AI reads the current scene.
2. AI generates structured commands.
3. Diorama validates and applies those commands deterministically.
4. The canvas updates from the new scene graph.
5. The user inspects, replays, exports, or continues editing.

AI does not directly mutate the scene. It compiles intent into commands.

## Philosophy

- **Explicit over implicit**: scene state and changes are structured data.
- **Inspectable**: commands, JSON, and exports can be reviewed by humans and CI.
- **Replayable**: command sequences can be tested and reproduced.
- **Agent-compatible**: humans and AI agents operate through the same system
  boundary.

## Non-goals

Diorama is not:

- Blender
- a DCC
- a renderer
- generative AI
- a broad 3D format interchange pipeline
- a shader graph or animation timeline

## Repository layout

| Path | Role |
|------|------|
| `packages/schema` | Scene types and validation |
| `packages/core` | Commands, reducer, fixtures, layout helpers |
| `packages/export-r3f` | Scene to R3F JSX |
| `packages/agent-interface` | Command/session contracts for agents |
| `packages/mcp` | Future MCP adapter surface |
| `packages/examples` | Shared JSON examples and fixtures |
| `apps/web` | Vite + React + R3F canvas |

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for a deeper overview.

## Requirements

- **Node.js** 20+ (LTS recommended)
- **npm** 10+

## Run locally

```bash
git clone https://github.com/<org-or-user>/diorama.git
cd diorama
npm install
npm run dev
```

Then open the URL Vite prints (typically `http://localhost:5173`).

Other useful scripts:

| Command | Purpose |
|---------|---------|
| `npm run test` | Unit tests (core, export, agent-interface, web) |
| `npm run typecheck` | Build/typecheck workspace packages |
| `npm run lint` | ESLint (web app) |
| `npm run build` | Production build of the web app |
| `npm run preview` | Preview production build |

## Example scenes and kits

Starter graphs ship as TypeScript fixtures in `@diorama/core` and can be loaded
from the web canvas (**Default**, **Showroom**, **Gallery**, **Living**). You can
also import/export versioned JSON. Details:
[docs/EXAMPLE_SCENES.md](docs/EXAMPLE_SCENES.md).

## Export Loop

Diorama exports reloadable `diorama-scene` JSON and deterministic React Three
Fiber JSX. JSON is the canonical exchange format; R3F JSX is a readable code
view with nested groups, local transforms, primitive mesh placeholders, simple
lights, and documented limitations. Details: [docs/EXPORT.md](docs/EXPORT.md).

## Contributing

Contributions are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) for workflow, testing expectations, and scope. The [Code of Conduct](CODE_OF_CONDUCT.md) applies in all project spaces.

Ideas that fit early contributions: [docs/GOOD_FIRST_ISSUES.md](docs/GOOD_FIRST_ISSUES.md).

## Roadmap (current direction)

Priorities follow a deliberate stack: **schema -> commands -> canvas ->
transport/export -> agent surface -> polish** (see `AGENTS.md`).

Near term:

- Harden **command schema** and **agent-interface** so external tools can rely on stable contracts.
- Expand **`packages/examples`** with checked-in JSON scenes and regression fixtures.
- Improve **export-r3f** coverage and roundtrip tests as the scene model grows.
- Evolve **MCP** and documentation so "load scene -> plan -> apply commands" is
  straightforward for integrators.

Longer term stays bounded by product guardrails: deterministic spatial updates,
inspectability, and code-to-canvas-to-code loops, not feature parity with
general-purpose 3D suites.

## License

MIT - see [LICENSE](LICENSE).
