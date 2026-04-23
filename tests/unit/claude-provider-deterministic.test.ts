import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/lib/db/client';
import { messages, providers, sessions } from '@/lib/db/schema';
import { syncStatusManager, type SyncProgress } from '@/lib/services/sync-status';
import type { ParsedSession } from '@/lib/workers/parser.worker';
import type { SessionEvent } from '@/types';

const poolMocks = vi.hoisted(() => {
  const execute = vi.fn();
  const terminate = vi.fn().mockResolvedValue(undefined);
  const createParserPool = vi.fn(() => ({
    execute,
    terminate,
  }));

  return {
    execute,
    terminate,
    createParserPool,
  };
});

vi.mock('@/lib/workers/pool', () => ({
  createParserPool: poolMocks.createParserPool,
}));

import { ClaudeProvider } from '@/lib/providers/claude';

interface SyncStatusManagerState {
  activeSyncs: Map<string, SyncProgress>;
  completedSyncs: SyncProgress[];
}

interface ClaudeProviderState {
  watchers: Set<(event: SessionEvent) => void>;
}

const parsedSessionFixture: ParsedSession = {
  messages: [
    {
      uuid: 'msg_001',
      parentUuid: undefined,
      sessionId: 'test-session-001',
      type: 'user',
      timestamp: '2024-01-15T10:00:00.000Z',
      content: 'Hello, can you help me with a Python script?',
      tokens: 12,
    },
    {
      uuid: 'msg_002',
      parentUuid: 'msg_001',
      sessionId: 'test-session-001',
      type: 'assistant',
      timestamp: '2024-01-15T10:00:05.000Z',
      content: [{ type: 'text', text: 'Sure, here is a reader.' }],
      tokens: 24,
      toolCalls: [
        {
          id: 'tool_001',
          name: 'create',
          input: {
            path: 'reader.py',
            file_text: 'def read_file(filename):\n    with open(filename) as f:\n        return f.read()\n',
          },
          timestamp: '2024-01-15T10:00:05.000Z',
        },
      ],
    },
  ],
  summary: {
    leafUuid: 'test-session-001',
    summary: 'Test session for deterministic Claude provider tests',
  },
  summaries: [{ summary: 'Test session for deterministic Claude provider tests' }],
  fileSnapshots: [{ filePath: 'reader.py', timestamp: '2024-01-15T10:00:05.000Z' }],
  filesModified: ['reader.py'],
  foldersAccessed: ['C:\\git\\demo\\project'],
  toolCalls: [
    {
      id: 'tool_001',
      name: 'create',
      input: {
        path: 'reader.py',
      },
      timestamp: '2024-01-15T10:00:05.000Z',
    },
  ],
};

describe('ClaudeProvider (deterministic)', () => {
  let tempRoot: string;
  let configDir: string;
  let sessionFilePath: string;
  let provider: ClaudeProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-provider-deterministic-'));
    configDir = path.join(tempRoot, '.claude');
    sessionFilePath = createSessionFile(configDir, 'C--git-demo-project', 'test-session-001');
    provider = new ClaudeProvider(configDir);
    poolMocks.execute.mockResolvedValue(structuredClone(parsedSessionFixture));
    resetSyncStatusState();
  });

  afterEach(async () => {
    await cleanupSession('test-session-001');
    await cleanupSession('test-session-002');
    fs.rmSync(tempRoot, { recursive: true, force: true });
    resetSyncStatusState();
  });

  it('initializes the parser pool and upserts the provider record', async () => {
    await provider.initialize();

    expect(poolMocks.createParserPool).toHaveBeenCalledWith(4);
    expect(provider.getConfigPath()).toBe(configDir);
    expect(await provider.detectInstallation()).toBe(true);

    const storedProvider = await db.select().from(providers).where(eq(providers.id, 'claude')).limit(1);
    expect(storedProvider).toHaveLength(1);
    expect(storedProvider[0]).toMatchObject({
      id: 'claude',
      name: 'Claude Code',
      installed: true,
    });
  });

  it('throws from initialize when the Claude config directory is missing', async () => {
    const missingProvider = new ClaudeProvider(path.join(tempRoot, 'missing-.claude'));

    await expect(missingProvider.initialize()).rejects.toThrow('Claude config directory not found');
  });

  it('parses session files through the worker pool and can ingest/query them', async () => {
    await provider.initialize();

    const parsed = await provider.parseSessionFile(sessionFilePath);
    const sessionId = await provider.ingestSession(sessionFilePath, parsed);

    expect(poolMocks.execute).toHaveBeenCalledOnce();
    expect(sessionId).toBe('test-session-001');

    const storedSession = await db.select().from(sessions).where(eq(sessions.id, sessionId)).limit(1);
    expect(storedSession).toHaveLength(1);
    expect(storedSession[0]).toMatchObject({
      providerId: 'claude',
      projectName: 'project',
      projectPath: 'C:\\git\\demo\\project',
      messageCount: 2,
      tokensInput: 12,
      tokensOutput: 24,
      fileCount: 1,
      toolUsageCount: 1,
      lastSummary: 'Test session for deterministic Claude provider tests',
    });

    const storedMessages = await db.select().from(messages).where(eq(messages.sessionId, sessionId));
    expect(storedMessages).toHaveLength(2);

    const listedSessions = await provider.listSessions({
      projectPath: 'C:\\git\\demo\\project',
      dateRange: {
        start: new Date('2024-01-01T00:00:00.000Z'),
        end: new Date('2024-02-01T00:00:00.000Z'),
      },
    });
    expect(listedSessions.map((session) => session.id)).toContain(sessionId);

    const detailedSession = await provider.getSession(sessionId);
    expect(detailedSession.messages).toHaveLength(2);
    expect(detailedSession.fileSnapshots).toEqual([]);
    expect(detailedSession.errors).toEqual([]);
  });

  it('supports watcher disposal and utility methods', async () => {
    await provider.initialize();

    const callback = vi.fn();
    const disposable = provider.watchSessions(callback);
    const providerState = provider as unknown as ClaudeProviderState;

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
    expect(provider.getCostEstimate({ inputTokens: 1000, outputTokens: 2000 })).toBeCloseTo(
      0.033,
      6
    );
    await expect(provider.detectRunningProcesses()).resolves.toEqual([]);
    await expect(
      provider.launchSession({
        providerId: 'claude',
        projectPath: 'C:\\git\\demo\\project',
      })
    ).rejects.toThrow('Not implemented yet');
  });

  it('fullSync scans, parses, ingests, and records completion state', async () => {
    createSessionFile(configDir, 'C--git-demo-project', 'test-session-002');
    await provider.initialize();

    const result = await provider.fullSync();

    expect(result).toEqual({ processed: 2, errors: 0 });
    expect(syncStatusManager.getCompletedSyncs(5)[0]).toMatchObject({
      providerId: 'claude',
      status: 'completed',
      totalFiles: 2,
      processedFiles: 2,
      successCount: 2,
    });
  });

  it('fullSync records ingestion errors and terminate tears down the worker pool', async () => {
    createSessionFile(configDir, 'C--git-demo-project', 'test-session-002');
    await provider.initialize();

    const originalIngest = provider.ingestSession.bind(provider);
    const ingestSpy = vi.spyOn(provider, 'ingestSession');
    ingestSpy.mockImplementationOnce(originalIngest);
    ingestSpy.mockImplementationOnce(async () => {
      throw new Error('forced Claude ingest failure');
    });

    const result = await provider.fullSync();

    expect(result).toEqual({ processed: 1, errors: 1 });
    expect(syncStatusManager.getCompletedSyncs(5)[0]).toMatchObject({
      providerId: 'claude',
      status: 'error',
      processedFiles: 2,
      successCount: 1,
      errorCount: 1,
    });

    await provider.terminate();
    expect(poolMocks.terminate).toHaveBeenCalledOnce();
  });
});

function createSessionFile(configPath: string, projectFolder: string, sessionId: string) {
  const projectsDir = path.join(configPath, 'projects', projectFolder);
  fs.mkdirSync(projectsDir, { recursive: true });

  const filePath = path.join(projectsDir, `${sessionId}.jsonl`);
  fs.writeFileSync(filePath, JSON.stringify({ type: 'summary', summary: 'placeholder' }));
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
