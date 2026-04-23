import { useEffect } from 'react';
import { useSceneStore } from '../store/sceneStore';

const isTextInputTarget = (e: EventTarget | null): boolean => {
  if (e == null || !(e instanceof Element)) return false;
  if (e instanceof HTMLInputElement || e instanceof HTMLTextAreaElement) return true;
  return (e as HTMLElement).isContentEditable;
};

export function useKeyboardShortcuts(): void {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();
      const store = useSceneStore.getState();

      if (mod) {
        if (key === 'z' && !e.shiftKey) {
          e.preventDefault();
          store.undo();
          return;
        }

        if ((key === 'z' && e.shiftKey) || key === 'y') {
          e.preventDefault();
          store.redo();
        }
        return;
      }

      if (isTextInputTarget(e.target)) return;
      if (e.repeat) return;

      if (key === 't' || key === 'r' || key === 's') {
        e.preventDefault();
        if (key === 't') store.setGizmoMode('translate');
        if (key === 'r') store.setGizmoMode('rotate');
        if (key === 's') store.setGizmoMode('scale');
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
}
