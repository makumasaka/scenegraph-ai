import { summarizeCommand } from '@diorama/core';
import { useSceneStore, type CommandLogEntry } from '../store/sceneStore';

const formatTime = (ts: number): string => {
  const d = new Date(ts);
  return d.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
};

function LogRow({ entry }: { entry: CommandLogEntry }) {
  const { title, detail } = summarizeCommand(entry.command);
  return (
    <div className="command-log__row">
      <span className="command-log__time">{formatTime(entry.ts)}</span>
      <span className="command-log__type">{entry.command.type}</span>
      <div className="command-log__text">
        <div className="command-log__title">{title}</div>
        <div className="command-log__detail">{detail}</div>
        <details className="command-log__payload">
          <summary>Payload</summary>
          <pre>{JSON.stringify(entry.command, null, 2)}</pre>
        </details>
      </div>
    </div>
  );
}

export function CommandLog() {
  const log = useSceneStore((s) => s.commandLog);
  const reversed = [...log].reverse();

  return (
    <section className="command-log" aria-label="Command log">
      <div className="command-log__header">Command log</div>
      <div className="command-log__body">
        {reversed.length === 0 ? (
          <div className="command-log__empty">No commands yet.</div>
        ) : (
          reversed.map((entry) => <LogRow key={entry.id} entry={entry} />)
        )}
      </div>
    </section>
  );
}
