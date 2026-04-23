import { describe, expect, it, beforeEach, vi } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { useSceneStore } from './store/sceneStore';

vi.mock('./viewport/Viewport', () => ({
  Viewport: () => <div data-testid="viewport-stub" />,
}));

const treeCubeButton = (): HTMLElement => {
  const btn = screen
    .getAllByRole('button')
    .find(
      (b) =>
        (b.textContent ?? '').includes('Cube 1') &&
        !(b.textContent ?? '').includes('(copy)'),
    );
  if (!btn) throw new Error('expected default tree row for Cube 1');
  return btn;
};

describe('App — core editing flows (component)', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    useSceneStore.getState().reset();
  });

  it('loads showroom kit, selects a nested node, reparents to root, undoes', async () => {
    render(<App />);

    await user.selectOptions(screen.getByRole('combobox'), 'showroom');
    await user.click(screen.getByRole('button', { name: 'Load kit' }));

    const pedestal = screen.getByRole('button', { name: /Pedestal West/i });
    await user.click(pedestal);
    expect(useSceneStore.getState().scene.selection).toBe('showroom-pedestal-west');

    const toRoot = screen.getByRole('button', { name: 'To root' });
    expect(toRoot).not.toBeDisabled();
    await user.click(toRoot);

    let scene = useSceneStore.getState().scene;
    expect(scene.nodes[scene.rootId]?.children).toContain('showroom-pedestal-west');

    await user.click(screen.getByRole('button', { name: 'Undo' }));
    scene = useSceneStore.getState().scene;
    expect(scene.nodes['showroom-floor']?.children).toContain('showroom-pedestal-west');
  });

  it('selects default cube and edits position from the inspector', async () => {
    render(<App />);

    await user.click(treeCubeButton());

    const inspector = screen.getByRole('complementary');
    const spinbuttons = within(inspector).getAllByRole('spinbutton');
    expect(spinbuttons.length).toBeGreaterThanOrEqual(3);

    await user.clear(spinbuttons[0]!);
    await user.type(spinbuttons[0]!, '2.25');
    await user.tab();

    const cube = useSceneStore.getState().scene.nodes['default-cube-1'];
    expect(cube?.transform.position[0]).toBeCloseTo(2.25, 2);
  });

  it('duplicates the selected non-root node', async () => {
    render(<App />);

    await user.click(treeCubeButton());
    await user.click(screen.getByRole('button', { name: 'Dup' }));

    const names = Object.values(useSceneStore.getState().scene.nodes).map((n) => n.name);
    expect(names.filter((n) => n.includes('copy')).length).toBeGreaterThanOrEqual(1);
  });

  it('shows command log rows for structural edits but not selection', async () => {
    render(<App />);

    const root = useSceneStore.getState().scene.rootId;
    await user.click(treeCubeButton());
    const commandLog = screen.getByRole('region', { name: /command log/i });
    expect(within(commandLog).getByText('No commands yet.')).toBeInTheDocument();

    await act(() => {
      useSceneStore.getState().dispatch({
        type: 'UPDATE_TRANSFORM',
        nodeId: useSceneStore.getState().scene.nodes[root]!.children[0]!,
        patch: { position: [0, 0.9, 0] },
      });
    });
    await waitFor(() => {
      expect(within(commandLog).queryByText('No commands yet.')).not.toBeInTheDocument();
      expect(within(commandLog).getByText('UPDATE_TRANSFORM')).toBeInTheDocument();
    });
  });
});
