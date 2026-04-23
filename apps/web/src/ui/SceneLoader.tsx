import { useRef, useState } from 'react';
import { getStarterScene, type StarterKitId } from '@diorama/core';
import { exportSceneToR3fJsx } from '@diorama/export-r3f';
import { useSceneStore } from '../store/sceneStore';

export function SceneLoader() {
  const dispatch = useSceneStore((s) => s.dispatch);
  const exportSceneJson = useSceneStore((s) => s.exportSceneJson);
  const importSceneJson = useSceneStore((s) => s.importSceneJson);
  const scene = useSceneStore((s) => s.scene);

  const [kit, setKit] = useState<StarterKitId>('default');
  const fileRef = useRef<HTMLInputElement>(null);
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

  const handleImportClick = () => fileRef.current?.click();

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
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

  const handleCopyR3f = async () => {
    const jsx = exportSceneToR3fJsx(scene, { includeLights: true });
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
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={handleFile}
      />
      <button type="button" onClick={handleCopyR3f} title="Copy JSX for React Three Fiber">
        R3F
      </button>
      {status ? <span className="scene-loader__status">{status}</span> : null}
    </div>
  );
}
