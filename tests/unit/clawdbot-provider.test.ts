import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/lib/db/client';
import { messages, providers, sessions } from '@/lib/db/schema';
import { ClawdbotProvider } from '@/lib/providers/clawdbot';
import { buildOpenClawSessionId, OPENCLAW_PROVIDER_NAME } from '@/lib/providers/openclaw-paths';
import { type SyncProgress, syncStatusManager } from '@/lib/services/sync-status';
import type { SessionEvent } from '@/types';

interface SyncStatusManagerState {
  activeSyncs: Map<string, SyncProgress>;
  completedSyncs: SyncProgress[];
}

interface ClawdbotProviderState {
  watchers: Set<(event: SessionEvent) => void>;
}

interface ClawdbotScanState {
  scanSessionFiles: () => Promise<Array<{ filePath: string; agent: string }>>;
}

function createSessionFileContents(sessionId: string) {
  const userMessageId = `${sessionId}-msg-user`;
  const assistantMessageId = `${sessionId}-msg-assistant`;
  const toolMessageId = `${sessionId}-msg-tool`;
  const toolCallId = `${sessionId}-tool-1`;

  return [
    JSON.stringify({
      type: 'session',
      id: sessionId,
      cwd: 'C:\\projects\\demo-app',
      timestamp: '2026-01-01T00:00:00.000Z',
    }),
    JSON.stringify({
      type: 'message',
      id: userMessageId,
      timestamp: '2026-01-01T00:00:01.000Z',
      message: {
        role: 'user',
        content: 'Open the README',
        usage: {
          input: 10,
          output: 0,
          totalTokens: 10,
        },
      },
    }),
    JSON.stringify({
      type: 'message',
      id: assistantMessageId,
      parentId: userMessageId,
      timestamp: '2026-01-01T00:00:02.000Z',
      message: {
        role: 'assistant',
        content: [
          { type: 'text', text: 'Reading the file now.' },
          {
            type: 'toolCall',
            id: toolCallId,
            name: 'readFile',
            arguments: { path: 'README.md' },
          },
        ],
        usage: {
          input: 5,
          output: 15,
          totalTokens: 20,
          cost: {
            input: 0.01,
            output: 0.02,
            total: 0.03,
          },
        },
        provider: 'openclaw',
        model: 'gpt-4o-mini',
      },
    }),
    'this is not valid json',
    JSON.stringify({
      type: 'message',
      id: toolMessageId,
      parentId: assistantMessageId,
      timestamp: '2026-01-01T00:00:03.000Z',
      message: {
        role: 'toolResult',
        content: { ok: true, file: 'README.md' },
        usage: {
          input: 0,
          output: 1,
          totalTokens: 1,
        },
      },
    }),
  ].join('\n');
}

describe('ClawdbotProvider', () => {
  let tempRoot: string;
  let configDir: string;
  let provider: ClawdbotProvider;
  let sessionFilePath: string;

  beforeEach(async () => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'openclaw-provider-'));
    configDir = path.join(tempRoot, '.openclaw');
    provider = new ClawdbotProvider(configDir);
    sessionFilePath = createSessionFile(configDir, 'agent-alpha', 'test-session-001');

    await db
      .insert(providers)
      .values({
        id: 'clawdbot',
        name: OPENCLAW_PROVIDER_NAME,
        configPath: configDir,
      })
      .onConflictDoNothing();

    resetSyncStatusState();
  });

  afterEach(async () => {
    await cleanupSession(buildOpenClawSessionId('agent-alpha', 'test-session-001'));
    await cleanupSession(buildOpenClawSessionId('agent-beta', 'test-session-002'));
    await cleanupSession(buildOpenClawSessionId('agent-gamma', 'fallback-session'));
    fs.rmSync(tempRoot, { recursive: true, force: true });
    vi.restoreAllMocks();
    resetSyncStatusState();
  });

  it('initializes against a detected config directory and exposes the config path', async () => {
    await expect(provider.initialize()).resolves.toBeUndefined();
    await expect(provider.detectInstallation()).resolves.toBe(true);
    expect(provider.getConfigPath()).toBe(configDir);
  });

  it('returns early from initialize when the OpenClaw config directory is missing', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const missingProvider = new ClawdbotProvider(path.join(tempRoot, 'missing-openclaw'));

    await expect(missingProvider.initialize()).resolves.toBeUndefined();
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('OpenClaw config not found:'));
  });

  it('scans only agent session directories and jsonl files', async () => {
    const agentsDir = path.join(configDir, 'agents');
    fs.writeFileSync(path.join(agentsDir, 'README.txt'), 'ignore');
    fs.mkdirSync(path.join(agentsDir, 'agent-empty'), { recursive: true });
    const mixedSessionsDir = path.join(agentsDir, 'agent-beta', 'sessions');
    fs.mkdirSync(mixedSessionsDir, { recursive: true });
    fs.writeFileSync(path.join(mixedSessionsDir, 'notes.txt'), 'ignore');
    const secondSession = path.join(mixedSessionsDir, 'test-session-002.jsonl');
    fs.writeFileSync(secondSession, createSessionFileContents('test-session-002'));

    const discovered = await (provider as unknown as ClawdbotScanState).scanSessionFiles();

    expect(discovered).toEqual(
      expect.arrayContaining([
        { filePath: sessionFilePath, agent: 'agent-alpha' },
        { filePath: secondSession, agent: 'agent-beta' },
      ])
    );
    expect(discovered.some((entry) => entry.filePath.endsWith('notes.txt'))).toBe(false);
  });

  it('parses OpenClaw session files, including tool calls and usage totals', async () => {
    const parsed = await provider.parseSessionFile(sessionFilePath);

    expect(parsed.id).toBe('test-session-001');
    expect(parsed.cwd).toBe('C:\\projects\\demo-app');
    expect(parsed.messages).toHaveLength(3);
    expect(parsed.messages[0]).toMatchObject({
      uuid: 'test-session-001-msg-user',
      type: 'user',
    });
    expect(parsed.messages[1]).toMatchObject({
      uuid: 'test-session-001-msg-assistant',
      type: 'assistant',
      provider: 'openclaw',
      model: 'gpt-4o-mini',
      cost: 0.03,
    });
    expect(parsed.toolCalls).toEqual([
      {
        id: 'test-session-001-tool-1',
        messageUuid: 'test-session-001-msg-assistant',
        name: 'readFile',
        input: { path: 'README.md' },
        timestamp: '2026-01-01T00:00:02.000Z',
      },
    ]);
    expect(parsed.tokensInput).toBe(15);
    expect(parsed.tokensOutput).toBe(16);
    expect(parsed.totalCost).toBeCloseTo(0.03, 6);
  });

  it('falls back for incomplete session metadata and ingests stale sessions as completed', async () => {
    const fallbackSessionPath = createSessionFile(configDir, 'agent-gamma', 'fallback-session');
    fs.writeFileSync(
      fallbackSessionPath,
      [
        JSON.stringify({
          type: 'session',
          cwd: '',
          timestamp: '2026-01-03T00:00:00.000Z',
        }),
        JSON.stringify({
          type: 'message',
          id: 'fallback-user',
          timestamp: '2026-01-03T00:00:01.000Z',
          message: {
            role: 'system',
            content: { text: 'unexpected role' },
          },
        }),
        JSON.stringify({
          type: 'message',
          id: 'fallback-assistant',
          timestamp: '2026-01-03T00:00:02.000Z',
          message: {
            role: 'assistant',
            content: [{ type: 'toolCall', arguments: { path: 'README.md' } }],
          },
        }),
      ].join('\n')
    );
    const staleTime = new Date('2025-01-01T00:00:00.000Z');
    fs.utimesSync(fallbackSessionPath, staleTime, staleTime);

    const parsed = await provider.parseSessionFile(fallbackSessionPath);
    expect(parsed.id).toBe('fallback-session');
    expect(parsed.cwd).toBe('');
    expect(parsed.toolCalls).toEqual([]);

    const sessionId = await provider.ingestSession(fallbackSessionPath, parsed, 'agent-gamma');
    const storedSession = await db
      .select()
      .from(sessions)
      .where(eq(sessions.id, sessionId))
      .limit(1);

    expect(storedSession[0]).toMatchObject({
      projectPath: 'agent-gamma',
      projectName: 'agent-gamma',
      status: 'completed',
      messageCount: 2,
      toolUsageCount: 0,
    });
    expect(storedSession[0].tokensInput).toBe(0);
    expect(storedSession[0].tokensOutput).toBe(0);
  });

  it('ingests sessions and can query them back out of the database', async () => {
    const parsed = await provider.parseSessionFile(sessionFilePath);
    const sessionId = await provider.ingestSession(sessionFilePath, parsed, 'agent-alpha');

    expect(sessionId).toBe(buildOpenClawSessionId('agent-alpha', 'test-session-001'));

    const storedSession = await db
      .select()
      .from(sessions)
      .where(eq(sessions.id, sessionId))
      .limit(1);
    expect(storedSession).toHaveLength(1);
    expect(storedSession[0]).toMatchObject({
      providerId: 'clawdbot',
      messageCount: 3,
      tokensInput: 15,
      tokensOutput: 16,
      toolUsageCount: 1,
    });
    expect(storedSession[0].projectPath).toBe('C:\\projects\\demo-app');
    expect(storedSession[0].projectName).toMatch(/demo-app$/);

    const storedMessages = await db
      .select()
      .from(messages)
      .where(eq(messages.sessionId, sessionId));
    expect(storedMessages).toHaveLength(3);
    expect(storedMessages.some((message) => message.role === 'assistant')).toBe(true);

    const listedSessions = await provider.listSessions({
      projectPath: 'C:\\projects\\demo-app',
      status: 'active',
      dateRange: {
        start: new Date('2025-12-31T00:00:00.000Z'),
        end: new Date('2026-01-02T00:00:00.000Z'),
      },
    });
    expect(listedSessions.map((session) => session.id)).toContain(sessionId);

    const detailedSession = await provider.getSession(sessionId);
    expect(detailedSession.messages).toHaveLength(3);
    expect(detailedSession.errors).toEqual([]);

    await expect(provider.getSession('missing-session')).rejects.toThrow(
      'Session not found: missing-session'
    );
  });

  it('updates an existing ingested session instead of inserting a duplicate', async () => {
    const parsed = await provider.parseSessionFile(sessionFilePath);
    await provider.ingestSession(sessionFilePath, parsed, 'agent-alpha');

    const updatedParsed = {
      ...parsed,
      messages: [
        ...parsed.messages,
        {
          uuid: 'msg-followup',
          parentUuid: 'test-session-001-msg-tool',
          type: 'assistant' as const,
          timestamp: '2026-01-01T00:00:04.000Z',
          content: 'Done',
          tokens: 7,
          provider: 'openclaw',
          model: 'gpt-4o-mini',
          cost: 0.01,
        },
      ],
      tokensOutput: parsed.tokensOutput + 7,
      totalCost: parsed.totalCost + 0.01,
    };

    await provider.ingestSession(sessionFilePath, updatedParsed, 'agent-alpha');

    const storedSessions = await db
      .select()
      .from(sessions)
      .where(eq(sessions.id, buildOpenClawSessionId('agent-alpha', 'test-session-001')));

    expect(storedSessions).toHaveLength(1);
    expect(storedSessions[0].messageCount).toBe(4);
    expect(storedSessions[0].tokensOutput).toBe(23);
  });

  it('supports watcher disposal and utility methods', async () => {
    const callback = vi.fn();
    const disposable = provider.watchSessions(callback);
    const providerState = provider as unknown as ClawdbotProviderState;

    expect(providerState.watchers.size).toBe(1);

    disposable.dispose();

    expect(providerState.watchers.size).toBe(0);
    await expect(provider.getUsageStats({ start: new Date(), end: new Date() })).resolves.toEqual({
      totalSessions: 0,
      totalTokensInput: 0,
      totalTokensOutput: 0,
      totalTokens: 0,
      estimatedCost: 0,
      activeTime: 0,
      toolUsageBreakdown: {},
      dailyBreakdown: [],
      topProjects: [],
    });
    await expect(provider.getTokenMetrics()).resolves.toMatchObject({
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      averagePerSession: 0,
    });
    expect(
      provider.getCostEstimate({
        inputTokens: 1000,
        outputTokens: 2000,
      })
    ).toBeCloseTo(0.033, 6);
    await expect(provider.detectRunningProcesses()).resolves.toEqual([]);
    await expect(
      provider.launchSession({
        providerId: 'clawdbot',
        projectPath: 'C:\\projects\\demo-app',
      })
    ).rejects.toThrow('Not implemented');
  });

  it('fullSync ingests discovered session files and records sync status', async () => {
    createSessionFile(configDir, 'agent-beta', 'test-session-002');

    const result = await provider.fullSync();

    expect(result).toEqual({ processed: 2, errors: 0 });
    expect(syncStatusManager.getCompletedSyncs(5)[0]).toMatchObject({
      providerId: 'clawdbot',
      status: 'completed',
      totalFiles: 2,
      processedFiles: 2,
      successCount: 2,
    });
  });

  it('fullSync records per-file ingestion errors without aborting the whole run', async () => {
    createSessionFile(configDir, 'agent-beta', 'test-session-002');
    const originalIngest = provider.ingestSession.bind(provider);
    const ingestSpy = vi.spyOn(provider, 'ingestSession');

    ingestSpy.mockImplementationOnce(originalIngest);
    ingestSpy.mockImplementationOnce(async () => {
      throw new Error('forced ingest failure');
    });

    const result = await provider.fullSync();

    expect(result).toEqual({ processed: 1, errors: 1 });
    expect(syncStatusManager.getCompletedSyncs(5)[0]).toMatchObject({
      providerId: 'clawdbot',
      status: 'error',
      processedFiles: 2,
      successCount: 1,
      errorCount: 1,
    });
  });

  it('supports empty sync scans and leaves explicit tracking ids open on fatal failures', async () => {
    const emptyProvider = new ClawdbotProvider(path.join(tempRoot, 'empty-openclaw'));
    fs.mkdirSync(emptyProvider.getConfigPath(), { recursive: true });

    const emptyResult = await emptyProvider.fullSync();
    expect(emptyResult).toEqual({ processed: 0, errors: 0 });

    const trackingId = syncStatusManager.startSync('clawdbot-external');
    vi.spyOn(
      provider as unknown as { scanSessionFiles: () => Promise<unknown[]> },
      'scanSessionFiles'
    ).mockRejectedValueOnce(new Error('forced openclaw scan failure'));

    await expect(provider.fullSync(trackingId)).rejects.toThrow('forced openclaw scan failure');

    expect(syncStatusManager.getCompletedSyncs(5)[0]).toMatchObject({
      providerId: 'clawdbot',
      status: 'completed',
      totalFiles: 0,
    });
    expect(syncStatusManager.getSync(trackingId)).toMatchObject({
      id: trackingId,
      status: 'running',
    });
    expect(
      syncStatusManager
        .getSync(trackingId)
        ?.logs.some((entry) => entry.message.includes('forced openclaw scan failure'))
    ).toBe(true);
  });

  it('marks internally tracked syncs as errored when fullSync fails before scanning completes', async () => {
    await provider.initialize();
    vi.spyOn(
      provider as unknown as { scanSessionFiles: () => Promise<unknown[]> },
      'scanSessionFiles'
    ).mockRejectedValueOnce(new Error('forced internal openclaw scan failure'));

    await expect(provider.fullSync()).rejects.toThrow('forced internal openclaw scan failure');

    expect(syncStatusManager.getCompletedSyncs(1)[0]).toMatchObject({
      providerId: 'clawdbot',
      status: 'error',
    });
  });
});

function createSessionFile(configPath: string, agent: string, sessionId: string) {
  const sessionsDir = path.join(configPath, 'agents', agent, 'sessions');
  fs.mkdirSync(sessionsDir, { recursive: true });

  const filePath = path.join(sessionsDir, `${sessionId}.jsonl`);
  fs.writeFileSync(filePath, createSessionFileContents(sessionId));
  return filePath;
}

async function cleanupSession(sessionId: string) {
  await db.delete(sessions).where(eq(sessions.id, sessionId));
}

function resetSyncStatusState() {
  const state = syncStatusManager as unknown as SyncStatusManagerState;
  state.activeSyncs.clear();
  state.completedSyncs.length = 0;
}
