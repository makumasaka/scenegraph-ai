import './App.css';
import { CommandTimeline } from './ui/CommandTimeline';
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
      <div className="editor-body">
        <main className="main">
          <TreeView />
          <Viewport />
          <Inspector />
        </main>
        <CommandTimeline />
      </div>
    </div>
  );
}

export default App;
