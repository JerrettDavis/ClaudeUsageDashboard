import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/lib/db/client';
import { messages, providers, sessions } from '@/lib/db/schema';
import { ClawdbotProvider } from '@/lib/providers/clawdbot';
import { type SyncProgress, syncStatusManager } from '@/lib/services/sync-status';
import type { SessionEvent } from '@/types';

interface SyncStatusManagerState {
  activeSyncs: Map<string, SyncProgress>;
  completedSyncs: SyncProgress[];
}

interface ClawdbotProviderState {
  watchers: Set<(event: SessionEvent) => void>;
}

const sessionFileContents = [
  JSON.stringify({
    type: 'session',
    id: 'test-session-001',
    cwd: 'C:\\projects\\demo-app',
    timestamp: '2026-01-01T00:00:00.000Z',
  }),
  JSON.stringify({
    type: 'message',
    id: 'msg-user',
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
    id: 'msg-assistant',
    parentId: 'msg-user',
    timestamp: '2026-01-01T00:00:02.000Z',
    message: {
      role: 'assistant',
      content: [
        { type: 'text', text: 'Reading the file now.' },
        {
          type: 'toolCall',
          id: 'tool-1',
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
    id: 'msg-tool',
    parentId: 'msg-assistant',
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

describe('ClawdbotProvider', () => {
  let tempRoot: string;
  let configDir: string;
  let provider: ClawdbotProvider;
  let sessionFilePath: string;

  beforeEach(async () => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'clawdbot-provider-'));
    configDir = path.join(tempRoot, '.clawdbot');
    provider = new ClawdbotProvider(configDir);
    sessionFilePath = createSessionFile(configDir, 'agent-alpha', 'test-session-001');

    await db
      .insert(providers)
      .values({
        id: 'clawdbot',
        name: 'Clawdbot / OpenClaw',
        configPath: configDir,
      })
      .onConflictDoNothing();

    resetSyncStatusState();
  });

  afterEach(async () => {
    await cleanupSession('clawdbot-agent-alpha-test-session-001');
    await cleanupSession('clawdbot-agent-beta-test-session-002');
    fs.rmSync(tempRoot, { recursive: true, force: true });
    vi.restoreAllMocks();
    resetSyncStatusState();
  });

  it('initializes against a detected config directory and exposes the config path', async () => {
    await expect(provider.initialize()).resolves.toBeUndefined();
    await expect(provider.detectInstallation()).resolves.toBe(true);
    expect(provider.getConfigPath()).toBe(configDir);
  });

  it('parses Clawdbot session files, including tool calls and usage totals', async () => {
    const parsed = await provider.parseSessionFile(sessionFilePath);

    expect(parsed.id).toBe('test-session-001');
    expect(parsed.cwd).toBe('C:\\projects\\demo-app');
    expect(parsed.messages).toHaveLength(3);
    expect(parsed.messages[0]).toMatchObject({
      uuid: 'msg-user',
      type: 'user',
    });
    expect(parsed.messages[1]).toMatchObject({
      uuid: 'msg-assistant',
      type: 'assistant',
      provider: 'openclaw',
      model: 'gpt-4o-mini',
      cost: 0.03,
    });
    expect(parsed.toolCalls).toEqual([
      {
        id: 'tool-1',
        name: 'readFile',
        input: { path: 'README.md' },
        timestamp: '2026-01-01T00:00:02.000Z',
      },
    ]);
    expect(parsed.tokensInput).toBe(15);
    expect(parsed.tokensOutput).toBe(16);
    expect(parsed.totalCost).toBeCloseTo(0.03, 6);
  });

  it('ingests sessions and can query them back out of the database', async () => {
    const parsed = await provider.parseSessionFile(sessionFilePath);
    const sessionId = await provider.ingestSession(sessionFilePath, parsed, 'agent-alpha');

    expect(sessionId).toBe('clawdbot-agent-alpha-test-session-001');

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
          parentUuid: 'msg-tool',
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
      .where(eq(sessions.id, 'clawdbot-agent-alpha-test-session-001'));

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
});

function createSessionFile(configPath: string, agent: string, sessionId: string) {
  const sessionsDir = path.join(configPath, 'agents', agent, 'sessions');
  fs.mkdirSync(sessionsDir, { recursive: true });

  const filePath = path.join(sessionsDir, `${sessionId}.jsonl`);
  fs.writeFileSync(filePath, sessionFileContents);
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
