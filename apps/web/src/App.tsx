import './App.css';
import { Inspector } from './ui/Inspector';
import { Toolbar } from './ui/Toolbar';
import { TreeView } from './ui/TreeView';
import { useKeyboardShortcuts } from './ui/useKeyboardShortcuts';
import { Viewport } from './viewport/Viewport';

function App() {
  useKeyboardShortcuts();

  return (
    <div className="app">
      <Toolbar />
      <main className="main">
        <TreeView />
        <Viewport />
        <Inspector />
      </main>
    </div>
  );
}

export default App;
