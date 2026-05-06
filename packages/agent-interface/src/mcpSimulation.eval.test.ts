import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { getStarterScene, type Command, type StarterKitId } from '@diorama/core';
import { parseSceneJson, serializeScene, type Scene } from '@diorama/schema';
import { createAgentSession } from './session';

type ExpectedError = {
  index: number;
  code: 'COMMAND_REJECTED';
  message: string;
};

type IntentFixture = {
  id: string;
  title: string;
  startingSceneId: StarterKitId;
  intent: string;
  commands: Command[];
  expectedSelection: string | null;
  expectedChangedNodeIds: string[];
  expectedNodeTransforms?: Record<string, { position?: [number, number, number] }>;
  expectedErrors: ExpectedError[];
  expectedWarnings: string[];
  exportChecks: {
    jsonNodeIds: string[];
    r3fContains: string[];
  };
  replaySafe: boolean;
};

const fixtureDir = new URL('../../../docs/evals/fixtures/m7/intents/', import.meta.url);

const readFixture = (fileName: string): IntentFixture =>
  JSON.parse(readFileSync(new URL(fileName, fixtureDir), 'utf8')) as IntentFixture;

const fixtures = readdirSync(fixtureDir)
  .filter((fileName) => fileName.endsWith('.json'))
  .sort()
  .map(readFixture);

const successFixtures = fixtures.filter((fixture) => fixture.expectedErrors.length === 0);
const rejectionFixtures = fixtures.filter((fixture) => fixture.expectedErrors.length > 0);

const expectOk = <T>(result: { ok: true; data: T } | { ok: false }): T => {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error('expected ok result');
  return result.data;
};

const applyFixture = (fixture: IntentFixture): Scene => {
  const session = createAgentSession(getStarterScene(fixture.startingSceneId));
  return expectOk(session.applyCommandBatch(fixture.commands)).scene;
};

describe('Milestone 7 MCP simulation eval', () => {
  it('loads deterministic intent fixtures', () => {
    expect(fixtures.map((fixture) => fixture.id)).toEqual([
      '001-gallery-3x3-grid',
      '002-showroom-duplicate-focus',
      '003-living-transform-export',
      '004-invalid-command-rejection',
    ]);
    for (const fixture of fixtures) {
      expect(fixture.intent.length).toBeGreaterThan(0);
      expect(fixture.commands.length).toBeGreaterThan(0);
    }
  });

  it.each(successFixtures)('%s dry-runs, applies, exports, and logs deterministically', (fixture) => {
    const session = createAgentSession(getStarterScene(fixture.startingSceneId));
    const before = expectOk(session.getScene()).scene;
    const selectionBefore = expectOk(session.getSelection()).selection;
    const preview = expectOk(session.dryRunCommandBatch(fixture.commands));

    expect(preview.dryRun).toBe(true);
    expect(preview.changed).toBe(true);
    expect(preview.errors).toEqual([]);
    expect(preview.warnings).toEqual(fixture.expectedWarnings);
    expect(expectOk(session.getScene()).scene).toEqual(before);
    expect(expectOk(session.getSelection()).selection).toBe(selectionBefore);
    expect(expectOk(session.getActionLog()).entries).toEqual([
      expect.objectContaining({
        type: 'command_batch',
        dryRun: true,
        changed: true,
      }),
    ]);

    const applied = expectOk(session.applyCommandBatch(fixture.commands));
    expect(applied.dryRun).toBe(false);
    expect(applied.changed).toBe(true);
    expect(applied.errors).toEqual([]);
    expect(applied.appliedCommandCount).toBe(fixture.commands.length);
    expect(expectOk(session.getSelection()).selection).toBe(fixture.expectedSelection);

    for (const nodeId of fixture.expectedChangedNodeIds) {
      expect(applied.scene.nodes[nodeId], `${fixture.id} missing ${nodeId}`).toBeDefined();
    }
    for (const [nodeId, transform] of Object.entries(fixture.expectedNodeTransforms ?? {})) {
      if (transform.position !== undefined) {
        expect(applied.scene.nodes[nodeId]?.transform.position).toEqual(transform.position);
      }
    }

    const log = expectOk(session.getCommandLog()).entries;
    expect(log).toHaveLength(2);
    expect(log[0]).toEqual(
      expect.objectContaining({
        sequence: 1,
        type: 'command_batch',
        dryRun: true,
        changed: true,
      }),
    );
    expect(log[1]).toEqual(
      expect.objectContaining({
        sequence: 2,
        type: 'command_batch',
        dryRun: false,
        changed: true,
      }),
    );

    const jsonExport = expectOk(session.exportScene({ format: 'json' }));
    const r3fExport = expectOk(
      session.exportScene({ format: 'r3f', r3f: { includeStudioLights: true } }),
    );
    const parsed = parseSceneJson(jsonExport.content);
    expect(parsed).not.toBeNull();
    expect(serializeScene(parsed!)).toBe(jsonExport.content);
    for (const nodeId of fixture.exportChecks.jsonNodeIds) {
      expect(parsed?.nodes[nodeId], `${fixture.id} export missing ${nodeId}`).toBeDefined();
    }
    for (const needle of fixture.exportChecks.r3fContains) {
      expect(r3fExport.content).toContain(needle);
    }
  });

  it.each(successFixtures)('%s replays to the same scene and JSON export', (fixture) => {
    expect(fixture.replaySafe).toBe(true);
    const first = applyFixture(fixture);
    const second = applyFixture(fixture);

    expect(second).toEqual(first);
    expect(serializeScene(second)).toBe(serializeScene(first));
  });

  it.each(rejectionFixtures)('%s rejects without mutation or log entries', (fixture) => {
    const session = createAgentSession(getStarterScene(fixture.startingSceneId));
    const before = expectOk(session.getScene()).scene;
    const preview = expectOk(session.dryRunCommandBatch(fixture.commands));
    const applied = expectOk(session.applyCommandBatch(fixture.commands));

    expect(preview.changed).toBe(false);
    expect(preview.errors).toEqual(fixture.expectedErrors);
    expect(preview.appliedCommandCount).toBe(0);
    expect(applied.changed).toBe(false);
    expect(applied.errors).toEqual(fixture.expectedErrors);
    expect(applied.appliedCommandCount).toBe(0);
    expect(expectOk(session.getScene()).scene).toEqual(before);
    expect(expectOk(session.getActionLog()).entries).toEqual([
      expect.objectContaining({
        type: 'command_batch',
        dryRun: true,
        changed: false,
        error: expect.objectContaining({ code: 'COMMAND_REJECTED' }),
      }),
      expect.objectContaining({
        type: 'command_batch',
        dryRun: false,
        changed: false,
        error: expect.objectContaining({ code: 'COMMAND_REJECTED' }),
      }),
    ]);
  });
});
