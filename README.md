# Diorama

Diorama is a visual runtime orchestration layer for AI-native React Three Fiber
applications.

It is repo-first, runtime-first, and code-first. Diorama runs inside or
alongside an existing developer project, keeps a validated canonical scene graph
as source of truth, projects that scene into an R3F viewport, and synchronizes
deterministic visual edits back into generated R3F code.

The closest product analogy is Paper.design for interactive 3D web apps: a live
visual layer that helps developers and AI coding agents keep runtime spatial
composition, semantic scene identity, and app-ready R3F modules aligned.

## MVP Focus

The MVP is live code <-> runtime synchronization.

1. Open an R3F project with Diorama running beside it.
2. Register GLB assets that already live in the project.
3. Select and transform scene nodes in the Diorama viewport.
4. Diorama applies commands to the canonical scene.
5. Diorama regenerates a deterministic R3F scene module in the project.
6. The app hot reloads from that module.
7. Editing the embedded `dioramaScene` block in the generated module reloads the
   canonical scene and updates the runtime again.

Diorama does not host or publish projects. Deployment stays in the developer
repo through Cursor, Codex, Claude, Vercel, or the project's normal deploy
workflow.

## Canonical Model

The Diorama scene schema is the source of truth.

Not canonical:

- Three.js objects
- React Three Fiber refs
- viewport state
- editor state
- runtime object transforms

All meaningful edits flow through:

```text
runtime interaction
  -> command
  -> canonical scene
  -> export/code sync
  -> runtime refresh
```

## Product Boundaries

Diorama is not:

- a general-purpose 3D editor
- a browser game engine
- Unity or Blender in the browser
- a model generation platform
- a DCC for mesh authoring, animation, rigging, UVs, or shader graphs
- a cloud publishing system

Generated assets can be created elsewhere, committed into the developer repo as
GLB/GLTF files, and then registered with Diorama.

## Repository Layout

| Path | Role |
|------|------|
| `packages/schema` | Zod scene schemas, validation, JSON serialization |
| `packages/core` | Pure command reducer, scene helpers, deterministic transforms |
| `packages/r3f-bridge` | R3F runtime projection, selection, registry, transform command translation |
| `packages/export-r3f` | Deterministic R3F module export and generated scene metadata parsing |
| `packages/local-bridge` | Local-only project bridge; the only filesystem/repo/asset-aware layer |
| `packages/cli` | Thin `diorama` CLI for `init`, `dev`, `export`, and `validate` |
| `packages/mcp` | MCP bridge proxy with a narrow safe tool surface |
| `packages/agent-interface` | Deferred legacy command/session experiments, outside the P0 bridge path |
| `packages/ingestion` | Local GLB/GLTF registration helpers |
| `apps/web` | Vite runtime debug shell for viewport, hierarchy, inspector, code sync status |
| `apps/demo-export` | Sample generated R3F app used for local preview |

Generation packages are retained only as deferred historical experiments and are
not part of the runtime-sync MVP path.

## Run Locally

```bash
npm install
npm run dev
```

Useful scripts:

| Command | Purpose |
|---------|---------|
| `npm run test` | Run MVP package and app tests |
| `npm run typecheck` | Typecheck MVP packages |
| `npm run build` | Build the Diorama web shell |
| `npm run bridge:dev` | Start the local Diorama project bridge |
| `npm run mcp:stdio` | Start the narrow local MCP adapter |

For project sync, start the bridge with a project root:

```bash
npx diorama init --projectRoot /path/to/r3f-app
npx diorama dev --projectRoot /path/to/r3f-app
```

The bridge prints a pairing token. Open the local or hosted shell with
`?bridgeToken=<token>` so browser requests can pair with the local bridge.

Default generated output:

- `src/generated/DioramaScene.generated.tsx`
- `src/generated/diorama.scene.json`
- `public/assets/models/*`

## More Docs

- [Architecture](docs/ARCHITECTURE.md)
- [Runtime Sync MVP](docs/MVP_RUNTIME_SYNC.md)
- [R3F Export](docs/EXPORT.md)
- [MCP Tool Contract](docs/mcp-tools.md)

## License

MIT - see [LICENSE](LICENSE).
