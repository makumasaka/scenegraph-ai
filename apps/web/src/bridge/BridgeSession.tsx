import { useEffect } from 'react';
import { useSceneStore } from '../store/sceneStore';
import { BRIDGE_URL, fetchBridgeScene, type BridgeSceneEvent } from './bridgeClient';

const shouldConnectBridge =
  import.meta.env.MODE !== 'test' && import.meta.env.VITE_DIORAMA_BRIDGE_ENABLED !== 'false';

export function BridgeSession() {
  const applyBridgeScene = useSceneStore((s) => s.applyBridgeScene);
  const setBridgeStatus = useSceneStore((s) => s.setBridgeStatus);

  useEffect(() => {
    if (!shouldConnectBridge) return;
    let closed = false;

    void fetchBridgeScene()
      .then((result) => {
        if (closed) return;
        if (result.ok) {
          applyBridgeScene(result.data.scene);
          setBridgeStatus(true, null);
        } else {
          setBridgeStatus(false, result.error.message);
        }
      })
      .catch((error) => {
        if (!closed) {
          setBridgeStatus(false, error instanceof Error ? error.message : String(error));
        }
      });

    if (typeof EventSource === 'undefined')
      return () => {
        closed = true;
    };

    const events = new EventSource(`${BRIDGE_URL}/events`);
    events.onopen = () => {
      if (!closed) setBridgeStatus(true, null);
    };
    events.addEventListener('scene', (event) => {
      if (closed) return;
      const data = JSON.parse((event as MessageEvent<string>).data) as BridgeSceneEvent;
      applyBridgeScene(data.scene, data.command);
      setBridgeStatus(true, null);
    });
    events.onerror = () => {
      if (!closed) setBridgeStatus(false, 'Bridge event stream disconnected.');
    };

    return () => {
      closed = true;
      events.close();
    };
  }, [applyBridgeScene, setBridgeStatus]);

  return null;
}
