import { useEffect, useMemo, useState } from 'react';
import { exportSceneToR3fSyncModule } from '@diorama/export-r3f';
import { useSceneStore } from '../store/sceneStore';
import {
  fetchBridgeProjectInfo,
  postBridgeSyncCode,
  type BridgeProjectInfo,
} from '../bridge/bridgeClient';

export function CodePane() {
  const scene = useSceneStore((s) => s.scene);
  const bridgeConnected = useSceneStore((s) => s.bridgeConnected);
  const bridgeLastError = useSceneStore((s) => s.bridgeLastError);
  const [projectInfo, setProjectInfo] = useState<BridgeProjectInfo | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const codePreview = useMemo(
    () => exportSceneToR3fSyncModule(scene, { includeStudioLights: true }).code,
    [scene],
  );

  useEffect(() => {
    if (!bridgeConnected) return;
    let closed = false;
    void fetchBridgeProjectInfo()
      .then((result) => {
        if (closed) return;
        if (result.ok) setProjectInfo(result.data);
      })
      .catch(() => undefined);
    return () => {
      closed = true;
    };
  }, [bridgeConnected, scene]);

  const handleSync = (direction: 'toCode' | 'fromCode') => {
    setStatus(direction === 'toCode' ? 'Writing generated module' : 'Reading scene block');
    void postBridgeSyncCode(direction)
      .then((result) => {
        setStatus(result.ok ? 'Code sync complete' : result.error.message);
      })
      .catch((error) => {
        setStatus(error instanceof Error ? error.message : String(error));
      })
      .finally(() => window.setTimeout(() => setStatus(null), 2500));
  };

  return (
    <section className="code-pane" aria-label="Generated R3F code">
      <div className="code-pane__header">
        <div>
          <div className="code-pane__title">Generated R3F</div>
          <div className="code-pane__subtitle">
            {projectInfo?.generatedModulePath ?? 'Bridge generated module'}
          </div>
        </div>
        <div className="code-pane__actions">
          <button
            type="button"
            onClick={() => handleSync('toCode')}
            disabled={!bridgeConnected}
          >
            Sync
          </button>
          <button
            type="button"
            onClick={() => handleSync('fromCode')}
            disabled={!bridgeConnected}
          >
            Reload
          </button>
        </div>
      </div>
      <div className="code-pane__status">
        {status ?? (bridgeConnected ? 'Bridge connected' : bridgeLastError ?? 'Bridge offline')}
      </div>
      <pre className="code-pane__preview">{codePreview}</pre>
    </section>
  );
}
