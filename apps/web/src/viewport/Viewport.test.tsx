import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { exportSceneToR3fJsx } from '@diorama/export-r3f';
import { getStarterScene, getWorldMatrix, type Scene } from '@diorama/core';
import { useSceneStore } from '../store/sceneStore';
import { Viewport } from './Viewport';

vi.mock('@react-three/fiber', async () => {
  const React = await import('react');
  const editorHelperTypes = new Set(['color', 'ambientLight', 'directionalLight']);

  return {
    Canvas: ({ children }: { children?: ReactNode }) => {
      const canonicalChildren = React.Children.toArray(children).filter(
        (child) =>
          !(
            React.isValidElement(child) &&
            typeof child.type === 'string' &&
            editorHelperTypes.has(child.type)
          ),
      );

      return <div data-testid="canvas">{canonicalChildren}</div>;
    },
  };
});

vi.mock('@react-three/drei', () => ({
  Grid: () => <div data-testid="viewport-grid" />,
  OrbitControls: () => <div data-testid="orbit-controls" />,
}));

vi.mock('./NodeMesh', async () => {
  const { useSceneStore } = await import('../store/sceneStore');

  return {
    NodeMesh: ({ nodeId, children }: { nodeId: string; children?: ReactNode }) => {
      const node = useSceneStore((s) => s.scene.nodes[nodeId]);
      if (!node || node.visible === false) return null;
      return (
        <div
          data-testid="scene-node"
          data-node-id={nodeId}
          data-position={node.transform.position.join(',')}
          data-rotation={node.transform.rotation.join(',')}
          data-scale={node.transform.scale.join(',')}
        >
          {children}
        </div>
      );
    },
  };
});

const replaceScene = (scene: Scene): void => {
  useSceneStore.getState().dispatch({ type: 'REPLACE_SCENE', scene });
};

const renderedNodeIds = (): string[] =>
  screen.getAllByTestId('scene-node').map((node) => node.dataset.nodeId ?? '');

const exportedNodeIds = (scene: Scene): string[] =>
  Array.from(exportSceneToR3fJsx(scene).matchAll(/\{\/\* ([^ ]+) - /g)).map(
    (match) => match[1]!,
  );

describe('Viewport scenegraph adapter', () => {
  beforeEach(() => {
    useSceneStore.getState().reset();
  });

  it('renders the canonical tree from the root node', () => {
    const scene = getStarterScene('default');
    replaceScene(scene);

    render(<Viewport />);

    expect(renderedNodeIds()[0]).toBe(scene.rootId);
    expect(renderedNodeIds()).toEqual(exportedNodeIds(scene));
    expect(screen.getByTestId('viewport-grid')).toBeInTheDocument();
    expect(screen.getByTestId('orbit-controls')).toBeInTheDocument();
  });

  it('applies non-identity root transforms through the root scene group', () => {
    const scene = getStarterScene('default');
    const root = scene.nodes[scene.rootId]!;
    const nextScene: Scene = {
      ...scene,
      nodes: {
        ...scene.nodes,
        [scene.rootId]: {
          ...root,
          transform: {
            position: [3, 2, 1],
            rotation: [0.1, 0.2, 0.3],
            scale: [2, 2, 2],
          },
        },
      },
    };
    replaceScene(nextScene);

    render(<Viewport />);

    const rootElement = screen.getAllByTestId('scene-node')[0]!;
    expect(rootElement).toHaveAttribute('data-node-id', nextScene.rootId);
    expect(rootElement).toHaveAttribute('data-position', '3,2,1');
    expect(rootElement).toHaveAttribute('data-rotation', '0.1,0.2,0.3');
    expect(rootElement).toHaveAttribute('data-scale', '2,2,2');
  });

  it('renders nested local transform hierarchy with expected world transform parity', () => {
    const scene: Scene = {
      rootId: 'root',
      selection: null,
      nodes: {
        root: {
          id: 'root',
          name: 'Root',
          type: 'root',
          children: ['parent'],
          transform: {
            position: [10, 0, 0],
            rotation: [0, 0, 0],
            scale: [1, 1, 1],
          },
          visible: true,
          metadata: {},
        },
        parent: {
          id: 'parent',
          name: 'Parent',
          type: 'group',
          children: ['child'],
          transform: {
            position: [0, 2, 0],
            rotation: [0, 0, 0],
            scale: [1, 1, 1],
          },
          visible: true,
          metadata: {},
        },
        child: {
          id: 'child',
          name: 'Child',
          type: 'mesh',
          children: [],
          transform: {
            position: [0, 0, 3],
            rotation: [0, 0, 0],
            scale: [1, 1, 1],
          },
          visible: true,
          metadata: {},
        },
      },
    };
    replaceScene(scene);

    render(<Viewport />);

    const [root, parent, child] = screen.getAllByTestId('scene-node');
    expect(root).toHaveAttribute('data-node-id', 'root');
    expect(parent).toHaveAttribute('data-node-id', 'parent');
    expect(child).toHaveAttribute('data-node-id', 'child');
    expect(root).toContainElement(parent!);
    expect(parent).toContainElement(child!);
    expect(parent).toHaveAttribute('data-position', '0,2,0');
    expect(child).toHaveAttribute('data-position', '0,0,3');

    const world = getWorldMatrix(scene, 'child');
    expect(world).not.toBeNull();
    expect(world!.elements[12]).toBe(10);
    expect(world!.elements[13]).toBe(2);
    expect(world!.elements[14]).toBe(3);
  });

  it('skips hidden subtrees to match export traversal semantics', () => {
    const scene = getStarterScene('default');
    const hiddenId = scene.nodes[scene.rootId]!.children[0]!;
    const hiddenNode = scene.nodes[hiddenId]!;
    const nextScene: Scene = {
      ...scene,
      nodes: {
        ...scene.nodes,
        [hiddenId]: {
          ...hiddenNode,
          visible: false,
        },
      },
    };
    replaceScene(nextScene);

    render(<Viewport />);

    expect(renderedNodeIds()).toEqual(exportedNodeIds(nextScene));
    expect(renderedNodeIds()).not.toContain(hiddenId);
  });
});
