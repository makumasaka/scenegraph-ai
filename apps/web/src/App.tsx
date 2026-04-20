import './App.css';
import { Toolbar } from './ui/Toolbar';
import { TreeView } from './ui/TreeView';
import { Viewport } from './viewport/Viewport';

function App() {
  return (
    <div className="app">
      <Toolbar />
      <main className="main">
        <TreeView />
        <Viewport />
      </main>
    </div>
  );
}

export default App;
