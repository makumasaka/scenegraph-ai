import { useRef, useState } from 'react';
import { getStarterScene, type StarterKitId } from '@dioramai/core';
import { exportSceneToR3fJsx } from '@dioramai/export-r3f';
import { useSceneStore } from '../store/sceneStore';
import { postBridgeImportGlbAsset } from '../bridge/bridgeClient';

export function SceneLoader() {
  const dispatch = useSceneStore((s) => s.dispatch);
  const exportSceneJson = useSceneStore((s) => s.exportSceneJson);
  const importSceneJson = useSceneStore((s) => s.importSceneJson);
  const scene = useSceneStore((s) => s.scene);
  const applyBridgeScene = useSceneStore((s) => s.applyBridgeScene);
  const setBridgeStatus = useSceneStore((s) => s.setBridgeStatus);

  const [kit, setKit] = useState<StarterKitId>('default');
  const sceneFileRef = useRef<HTMLInputElement>(null);
  const glbFileRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string | null>(null);

  const loadKit = () => {
    dispatch({
      type: 'REPLACE_SCENE',
      scene: getStarterScene(kit),
    });
    setStatus(`Loaded ${kit}`);
    window.setTimeout(() => setStatus(null), 2000);
  };

  const handleExportJson = () => {
    const blob = new Blob([exportSceneJson()], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'scene.json';
    a.click();
    URL.revokeObjectURL(url);
    setStatus('Exported scene.json');
    window.setTimeout(() => setStatus(null), 2000);
  };

  const handleImportClick = () => sceneFileRef.current?.click();

  const handleImportGlbClick = () => glbFileRef.current?.click();

  const handleSceneFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? '');
      const ok = importSceneJson(text);
      setStatus(ok ? 'Imported scene' : 'Invalid JSON');
      window.setTimeout(() => setStatus(null), 2500);
    };
    reader.readAsText(file);
  };

  const handleGlbFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setStatus('Importing GLB');
    void postBridgeImportGlbAsset(file, { importMode: 'shallow' })
      .then((result) => {
        if (result.ok) {
          applyBridgeScene(result.data.scene);
          setBridgeStatus(true, null);
          setStatus(`Imported ${file.name}`);
          return;
        }
        setBridgeStatus(false, result.error.message);
        setStatus('Import GLB failed');
      })
      .catch((error) => {
        setBridgeStatus(false, error instanceof Error ? error.message : String(error));
        setStatus('Import GLB failed');
      })
      .finally(() => window.setTimeout(() => setStatus(null), 2500));
  };

  const handleCopyR3f = async () => {
    const jsx = exportSceneToR3fJsx(scene, { includeStudioLights: true });
    try {
      await navigator.clipboard.writeText(jsx);
      setStatus('Copied R3F JSX');
    } catch {
      setStatus('Copy failed');
    }
    window.setTimeout(() => setStatus(null), 2000);
  };

  return (
    <div className="scene-loader">
      <label className="scene-loader__label">
        <span className="scene-loader__muted">Kit</span>
        <select
          value={kit}
          onChange={(e) => setKit(e.target.value as StarterKitId)}
        >
          <option value="default">Default</option>
          <option value="showroom">Showroom</option>
          <option value="gallery">Gallery</option>
          <option value="living">Living space</option>
        </select>
      </label>
      <button type="button" onClick={loadKit}>
        Load kit
      </button>
      <div className="scene-loader__divider" aria-hidden="true" />
      <button type="button" onClick={handleExportJson}>
        JSON
      </button>
      <button type="button" onClick={handleImportClick}>
        Import
      </button>
      <input
        ref={sceneFileRef}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={handleSceneFile}
      />
      <button type="button" onClick={handleImportGlbClick}>
        Import GLB
      </button>
      <input
        ref={glbFileRef}
        type="file"
        accept=".glb,.gltf,model/gltf-binary,model/gltf+json"
        hidden
        onChange={handleGlbFile}
      />
      <button type="button" onClick={handleCopyR3f} title="Copy JSX for React Three Fiber">
        R3F
      </button>
      {status ? <span className="scene-loader__status">{status}</span> : null}
    </div>
  );
}
