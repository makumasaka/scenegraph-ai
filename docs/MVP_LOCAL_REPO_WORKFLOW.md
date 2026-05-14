# MVP Local Repo Workflow

Diorama's MVP workflow is local-repo first. The Vercel app is a static shell;
the local bridge is the only process that can touch a project folder.

## 1. Prepare An R3F Project

Open your target React Three Fiber project in Cursor. Add a minimal
`diorama.config.json` at the project root:

```json
{
  "projectRoot": ".",
  "assetDir": "public/assets/models",
  "generatedSceneFile": "src/generated/DioramaScene.generated.tsx",
  "publicAssetBase": "/assets/models",
  "sceneJsonFile": "src/generated/diorama.scene.json"
}
```

Put GLB or GLTF files under the configured asset directory, for example:

```text
public/assets/models/chair.glb
```

## 2. Start The Local Bridge

From the Diorama repo:

```bash
npm run bridge:dev -- --projectRoot /absolute/path/to/r3f-project
```

On Windows PowerShell:

```powershell
npm run bridge:dev -- --projectRoot D:\Web\my-r3f-project
```

The bridge listens on `http://127.0.0.1:7777` by default.

Useful checks:

```bash
curl http://127.0.0.1:7777/project-status
curl http://127.0.0.1:7777/scene
```

## 3. Open Diorama

Use either local web dev or the deployed static shell.

Local shell:

```bash
npm run dev -w web
```

The shell connects to `http://127.0.0.1:7777` unless
`VITE_DIORAMA_BRIDGE_ENABLED=false` is set. For a custom bridge URL, build or run
with:

```bash
VITE_DIORAMA_BRIDGE_URL=http://127.0.0.1:7777
```

## 4. Register A GLB Asset

Through MCP/Cursor or bridge HTTP, register a project-relative asset:

```json
{
  "path": "public/assets/models/chair.glb",
  "name": "Chair",
  "semanticRole": "product",
  "importMode": "single"
}
```

HTTP example:

```bash
curl -X POST http://127.0.0.1:7777/tools/import_glb_asset \
  -H "content-type: application/json" \
  -d "{\"path\":\"public/assets/models/chair.glb\",\"name\":\"Chair\",\"semanticRole\":\"product\",\"importMode\":\"single\"}"
```

Diorama will:

- validate the path stays inside the explicit project root
- register an asset with `REGISTER_ASSET`
- create an asset-backed scene node with `ADD_NODE`
- reference the asset by `/assets/models/chair.glb`
- write the generated R3F module and scene JSON

## 5. Edit Runtime And Code

Runtime to code:

1. Select the object in the Diorama viewport.
2. Move, rotate, or scale it.
3. Diorama emits `UPDATE_TRANSFORM`.
4. The bridge writes `src/generated/DioramaScene.generated.tsx`.

Code to runtime:

1. Edit the embedded `dioramaScene` block in
   `src/generated/DioramaScene.generated.tsx`, or edit
   `src/generated/diorama.scene.json`.
2. In the Diorama code pane, press Reload, or call:

```bash
curl -X POST http://127.0.0.1:7777/tools/reload_scene_from_file \
  -H "content-type: application/json" \
  -d "{}"
```

The bridge validates the scene before replacing canonical state.

## 6. Use The Generated Module

In the target app:

```tsx
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { DioramaScene } from './generated/DioramaScene.generated';

export function App() {
  return (
    <Canvas>
      <OrbitControls />
      <DioramaScene />
    </Canvas>
  );
}
```

Then run the target app normally:

```bash
npm run dev
npm run build
```

For the included sample app:

```bash
npm run bridge:dev -- --projectRoot apps/demo-export
npm run dev -w demo-export
npm run build -w demo-export
```

## MCP Tools

The MVP MCP surface is intentionally narrow:

- `get_project_status`
- `get_scene`
- `load_scene`
- `register_asset`
- `import_glb_asset`
- `update_transform`
- `write_scene_to_file`
- `reload_scene_from_file`
- `export_r3f`
- `sync_code`

If the MCP server needs to start its own embedded bridge, set the same explicit
project root first:

```bash
DIORAMA_PROJECT_ROOT=/absolute/path/to/r3f-project npm run mcp:stdio
```

On Windows PowerShell:

```powershell
$env:DIORAMA_PROJECT_ROOT = "D:\Web\my-r3f-project"
npm run mcp:stdio
```

No shell tools, arbitrary file browsing, code execution, or cloud publishing are
part of the MVP bridge.

## Current Limits

- The generated file is Diorama-owned. Put app customization in wrapper files.
- Code-to-runtime sync parses the embedded scene block or scene JSON, not
  arbitrary JSX.
- GLB hierarchy import is shallow and optional.
- The deployed shell can connect to a local bridge, but the bridge must be
  running on the user's machine.
