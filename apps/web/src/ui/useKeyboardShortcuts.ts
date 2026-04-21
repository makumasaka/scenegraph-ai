import { useEffect } from 'react';
import { useSceneStore } from '../store/sceneStore';

export function useKeyboardShortcuts(): void {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;

      const key = e.key.toLowerCase();
      const store = useSceneStore.getState();

      if (key === 'z' && !e.shiftKey) {
        e.preventDefault();
        store.undo();
        return;
      }

      if ((key === 'z' && e.shiftKey) || key === 'y') {
        e.preventDefault();
        store.redo();
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
}
