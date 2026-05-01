import { readFileSync } from 'node:fs';
import path from 'node:path';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getStarterScene, parseSceneJson, type Command } from '@diorama/core';
import App from './App';
import { useSceneStore } from './store/sceneStore';

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
  TransformControls: () => <div data-testid="transform-controls" />,
}));

vi.mock('./viewport/Viewport', async () => vi.importActual('./viewport/Viewport'));

vi.mock('./viewport/NodeMesh', async () => {
  const { useSceneStore } = await import('./store/sceneStore');

  return {
    NodeMesh: ({ nodeId, children }: { nodeId: string; children?: ReactNode }) => {
      const node = useSceneStore((s) => s.scene.nodes[nodeId]);
      const select = useSceneStore((s) => s.select);
      if (!node || node.visible === false) return null;
      return (
        <div
          data-testid={`viewport-node-${nodeId}`}
          data-position={node.transform.position.join(',')}
          onClick={(event) => {
            event.stopPropagation();
            select(nodeId);
          }}
        >
          {node.name}
          {children}
        </div>
      );
    },
  };
});

type IntentFixture = {
  startingSceneId: 'default' | 'showroom' | 'gallery' | 'living';
  commands: Command[];
  expectedSelection: string | null;
};

const fixture = JSON.parse(
  readFileSync(
    path.join(
      process.cwd(),
      '../../docs/evals/fixtures/m7/intents/003-living-transform-export.json',
    ),
    'utf8',
  ),
) as IntentFixture;

describe('Milestone 7 Loop C canvas editing eval', () => {
  beforeEach(() => {
    useSceneStore.getState().reset();
    vi.restoreAllMocks();
  });

  it('loads, selects, edits, updates viewport and log, undo/redoes, then exports canonical scene', async () => {
    const user = userEvent.setup();
    const createObjectURL = vi.fn().mockReturnValue('blob:loop-c-json');
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: createObjectURL,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: revokeObjectURL,
    });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    render(<App />);

    await user.selectOptions(screen.getByRole('combobox'), 'default');
    await user.click(screen.getByRole('button', { name: 'Load kit' }));
    await user.click(screen.getByTestId('viewport-node-default-cube-1'));

    const inspector = screen.getByRole('complementary');
    const spinbuttons = within(inspector).getAllByRole('spinbutton');
    await user.clear(spinbuttons[0]!);
    await user.type(spinbuttons[0]!, '2.5');
    await user.tab();

    const commandLog = screen.getByRole('region', { name: /command timeline/i });
    await waitFor(() => {
      expect(within(commandLog).getAllByText('UPDATE_TRANSFORM').length).toBeGreaterThan(0);
    });
    expect(useSceneStore.getState().commandLog.at(-1)?.command).toEqual({
      type: 'UPDATE_TRANSFORM',
      nodeId: 'default-cube-1',
      patch: { position: [2.5, 0.5, 0] },
    });
    expect(screen.getByTestId('viewport-node-default-cube-1')).toHaveAttribute(
      'data-position',
      '2.5,0.5,0',
    );

    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(screen.getByTestId('viewport-node-default-cube-1')).toHaveAttribute(
      'data-position',
      '0,0.5,0',
    );

    await user.click(screen.getByRole('button', { name: 'Redo' }));
    expect(screen.getByTestId('viewport-node-default-cube-1')).toHaveAttribute(
      'data-position',
      '2.5,0.5,0',
    );

    await user.click(screen.getByRole('button', { name: 'JSON' }));
    const blob = createObjectURL.mock.calls[0]?.[0] as Blob;
    const parsed = parseSceneJson(await blob.text());
    expect(parsed?.nodes['default-cube-1']?.transform.position).toEqual([
      2.5,
      0.5,
      0,
    ]);

    await user.click(screen.getByRole('button', { name: 'R3F' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    expect(writeText.mock.calls[0]?.[0]).toContain('position={[2.5, 0.5, 0]}');
  });

  it('shows a fixture-driven command batch through tree, inspector, and export paths', () => {
    render(<App />);

    act(() => {
      useSceneStore.getState().dispatch({
        type: 'REPLACE_SCENE',
        scene: getStarterScene(fixture.startingSceneId),
      });
      for (const command of fixture.commands) {
        useSceneStore.getState().dispatch(command);
      }
    });

    expect(screen.getByRole('button', { name: /Coffee table/i })).toBeInTheDocument();
    const inspector = screen.getByRole('complementary');
    expect(within(inspector).getByTitle('living-table')).toBeInTheDocument();
    expect(useSceneStore.getState().scene.selection).toBe(fixture.expectedSelection);
    expect(useSceneStore.getState().commandLog.map((entry) => entry.command.type)).toEqual([
      'UPDATE_TRANSFORM',
    ]);

    const parsed = parseSceneJson(useSceneStore.getState().exportSceneJson());
    expect(parsed?.nodes['living-table']?.transform.position).toEqual([0.95, 0.32, 0.1]);
    expect(parsed?.selection).toBe('living-table');
  });
});
