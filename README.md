# Diorama

Diorama is a **deterministic spatial canvas** built around a typed scene graph. You edit a 3D layout through **explicit commands**, inspect canonical state as JSON, and export to **React Three Fiber** for reuse in applications.

The project targets **AI-assisted authoring** and **automation**: natural language (or agents) map to the same command surface as the UI, so edits stay replayable, testable, and diffable.

## What Diorama is

- A **schema-first** scene model (Zod): nodes, transforms, hierarchy, optional assets/materials/lights.
- A **pure command reducer** (`applyCommand`): every meaningful edit is a small, typed `Command` applied to `Scene`.
- A **web viewport** (React + R3F) for visualization and direct manipulation that still dispatches commands rather than mutating graph state ad hoc.
- **Serialization** with stable key ordering and a versioned `diorama-scene` document wrapper.
- **Export** to JSX for R3F pipelines.
- Growing **agent-facing** packages (`@diorama/agent-interface`, `@diorama/mcp`) so external tools can load scenes and emit validated commands.

## What Diorama is not

- Not a full **DCC** (Blender/Maya-class modeling, animation timelines, shader graphs).
- Not **realtime collaborative** editing.
- Not a broad **interchange hub** for arbitrary 3D formats; scope stays narrow until the command model and export path are solid.
- Not a place for **hidden imperative mutations** of scene state from UI code—the graph should remain the single source of truth behind the reducer.

## Why command-based scene editing matters

1. **Determinism** — Same initial scene + same command sequence yields the same result. That enables tests, bisection, and reproducible agent runs.
2. **Inspectability** — Commands are a log you can print, validate with Zod, and store. JSON export reflects canonical state, not whatever the renderer happened to cache.
3. **Automation** — Agents, scripts, and MCP tools speak the same language as the editor: structured patches, not brittle DOM or internal APIs.
4. **Diffs and review** — Scene JSON and command logs are reviewable artifacts for humans and CI.

## Repository layout

| Path | Role |
|------|------|
| `packages/schema` | Scene types and validation |
| `packages/core` | Commands, reducer, fixtures, layout helpers |
| `packages/export-r3f` | Scene → R3F JSX |
| `packages/agent-interface` | Command/session contracts for agents |
| `packages/mcp` | MCP server surface (evolving) |
| `packages/examples` | Placeholder for shared examples/fixtures |
| `apps/web` | Vite + React + R3F editor |

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

Starter graphs ship as TypeScript fixtures in `@diorama/core` and can be loaded from the web UI (**Default**, **Showroom**, **Gallery**). You can also import/export versioned JSON. Details: [docs/EXAMPLE_SCENES.md](docs/EXAMPLE_SCENES.md).

## Contributing

Contributions are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) for workflow, testing expectations, and scope. The [Code of Conduct](CODE_OF_CONDUCT.md) applies in all project spaces.

Ideas that fit early contributions: [docs/GOOD_FIRST_ISSUES.md](docs/GOOD_FIRST_ISSUES.md).

## Roadmap (current direction)

Priorities follow a deliberate stack: **schema → commands → viewport → transport/export → agent surface → polish** (see `AGENTS.md`).

Near term:

- Harden **command schema** and **agent-interface** so external tools can rely on stable contracts.
- Flesh out **`packages/examples`** with checked-in JSON scenes and regression fixtures (see package TODO).
- Improve **export-r3f** coverage and roundtrip tests as the scene model grows.
- Evolve **MCP** and documentation so “load scene → plan → apply commands” is straightforward for integrators.

Longer term stays bounded by product guardrails: deterministic editing, inspectability, and code-to-canvas-to-code loops—not feature parity with general-purpose 3D suites.

## License

MIT — see [LICENSE](LICENSE).
