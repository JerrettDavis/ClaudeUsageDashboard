import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/lib/db/client';
import { messages, providers, sessions } from '@/lib/db/schema';
import { type SyncProgress, syncStatusManager } from '@/lib/services/sync-status';
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

interface ClaudeScanState {
  scanSessionFiles: () => Promise<string[]>;
}

function createParsedSessionFixture(sessionId: string): ParsedSession {
  const userMessageId = `${sessionId}-msg-001`;
  const assistantMessageId = `${sessionId}-msg-002`;
  const toolCallId = `${sessionId}-tool-001`;

  return {
    metadata: {
      cwd: 'C:\\git\\demo\\project',
      gitBranch: 'main',
      version: '2.1.117',
      permissionMode: 'bypassPermissions',
    },
    messages: [
      {
        uuid: userMessageId,
        parentUuid: undefined,
        sessionId,
        type: 'user',
        timestamp: '2024-01-15T10:00:00.000Z',
        content: 'Hello, can you help me with a Python script?',
        tokens: 12,
      },
      {
        uuid: assistantMessageId,
        parentUuid: userMessageId,
        sessionId,
        type: 'assistant',
        timestamp: '2024-01-15T10:00:05.000Z',
        content: [{ type: 'text', text: 'Sure, here is a reader.' }],
        tokens: 24,
        inputTokens: 12,
        outputTokens: 24,
        toolCalls: [
          {
            id: toolCallId,
            messageUuid: assistantMessageId,
            name: 'create',
            input: {
              path: 'reader.py',
              file_text:
                'def read_file(filename):\n    with open(filename) as f:\n        return f.read()\n',
            },
            timestamp: '2024-01-15T10:00:05.000Z',
          },
        ],
      },
    ],
    summary: {
      leafUuid: sessionId,
      summary: 'Test session for deterministic Claude provider tests',
    },
    summaries: [
      {
        leafUuid: sessionId,
        summary: 'Test session for deterministic Claude provider tests',
      },
    ],
    fileSnapshots: [{ filePath: 'reader.py', timestamp: '2024-01-15T10:00:05.000Z' }],
    filesModified: ['reader.py'],
    foldersAccessed: ['C:\\git\\demo\\project'],
    toolCalls: [
      {
        id: toolCallId,
        messageUuid: assistantMessageId,
        name: 'create',
        input: {
          path: 'reader.py',
        },
        timestamp: '2024-01-15T10:00:05.000Z',
      },
    ],
  };
}

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
    poolMocks.execute.mockImplementation(async (job: { data: { sessionPath: string } }) =>
      createParsedSessionFixture(path.basename(job.data.sessionPath, '.jsonl'))
    );
    resetSyncStatusState();
  });

  afterEach(async () => {
    await cleanupSession('test-session-001');
    await cleanupSession('test-session-002');
    await cleanupSession('test-session-003');
    fs.rmSync(tempRoot, { recursive: true, force: true });
    resetSyncStatusState();
  });

  it('initializes the parser pool and upserts the provider record', async () => {
    await provider.initialize();

    expect(poolMocks.createParserPool).toHaveBeenCalledWith(4);
    expect(provider.getConfigPath()).toBe(configDir);
    expect(await provider.detectInstallation()).toBe(true);

    const storedProvider = await db
      .select()
      .from(providers)
      .where(eq(providers.id, 'claude'))
      .limit(1);
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

  it('requires initialization before parseSessionFile can use the worker pool', async () => {
    await expect(provider.parseSessionFile(sessionFilePath)).rejects.toThrow(
      'Parser pool not initialized'
    );
  });

  it('scans only project directories and JSONL session files', async () => {
    const projectsDir = path.join(configDir, 'projects');
    fs.writeFileSync(path.join(projectsDir, 'root-note.txt'), 'ignore me');
    const projectDir = path.join(projectsDir, 'C--git-mixed-project');
    fs.mkdirSync(projectDir, { recursive: true });
    fs.writeFileSync(path.join(projectDir, 'notes.txt'), 'not a session');
    const nestedSession = path.join(projectDir, 'test-session-003.jsonl');
    fs.writeFileSync(nestedSession, '{"type":"summary","summary":"ok"}\n');

    const scannedFiles = await (provider as unknown as ClaudeScanState).scanSessionFiles();

    expect(scannedFiles).toEqual(expect.arrayContaining([sessionFilePath, nestedSession]));
    expect(scannedFiles.some((filePath) => filePath.endsWith('notes.txt'))).toBe(false);
    expect(scannedFiles.some((filePath) => filePath.endsWith('root-note.txt'))).toBe(false);
  });

  it('parses session files through the worker pool and can ingest/query them', async () => {
    await provider.initialize();

    const parsed = await provider.parseSessionFile(sessionFilePath);
    const sessionId = await provider.ingestSession(sessionFilePath, parsed);

    expect(poolMocks.execute).toHaveBeenCalledOnce();
    expect(sessionId).toBe('test-session-001');

    const storedSession = await db
      .select()
      .from(sessions)
      .where(eq(sessions.id, sessionId))
      .limit(1);
    expect(storedSession).toHaveLength(1);
    expect(storedSession[0]).toMatchObject({
      providerId: 'claude',
      cwd: 'C:\\git\\demo\\project',
      gitBranch: 'main',
      version: '2.1.117',
      projectPath: 'C:\\git\\demo\\project',
      messageCount: 2,
      tokensInput: 12,
      tokensOutput: 24,
      fileCount: 1,
      toolUsageCount: 1,
      lastSummary: 'Test session for deterministic Claude provider tests',
    });
    expect(storedSession[0].projectName).toMatch(/project$/);

    const storedMessages = await db
      .select()
      .from(messages)
      .where(eq(messages.sessionId, sessionId));
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

  it('supports status filtering, missing session errors, and empty fullSync scans', async () => {
    await provider.initialize();

    const parsed = await provider.parseSessionFile(sessionFilePath);
    const sessionId = await provider.ingestSession(sessionFilePath, parsed);

    const filteredSessions = await provider.listSessions({
      status: 'active',
    });
    expect(filteredSessions.map((session) => session.id)).toContain(sessionId);

    await expect(provider.getSession('missing-session')).rejects.toThrow(
      'Session not found: missing-session'
    );

    const emptyRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-provider-empty-'));
    const emptyConfigDir = path.join(emptyRoot, '.claude');
    fs.mkdirSync(emptyConfigDir, { recursive: true });
    const emptyProvider = new ClaudeProvider(emptyConfigDir);
    try {
      await emptyProvider.initialize();
      await expect(emptyProvider.fullSync()).resolves.toEqual({ processed: 0, errors: 0 });
    } finally {
      await emptyProvider.terminate();
      fs.rmSync(emptyRoot, { recursive: true, force: true });
    }
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

  it('updates existing ingested sessions and rewrites their message rows', async () => {
    await provider.initialize();

    const parsed = await provider.parseSessionFile(sessionFilePath);
    await provider.ingestSession(sessionFilePath, parsed);

    const updatedParsed: ParsedSession = {
      ...parsed,
      summary: undefined,
      summaries: [],
      messages: [
        ...parsed.messages,
        {
          uuid: 'test-session-001-msg-003',
          parentUuid: 'test-session-001-msg-002',
          sessionId: 'test-session-001',
          type: 'assistant',
          timestamp: '2024-01-15T10:00:10.000Z',
          content: 'Follow-up response',
          tokens: 10,
          inputTokens: 5,
          outputTokens: 10,
        },
      ],
      filesModified: ['reader.py', 'writer.py'],
      foldersAccessed: ['C:\\git\\demo\\project'],
      toolCalls: parsed.toolCalls,
    };

    await provider.ingestSession(sessionFilePath, updatedParsed);

    const storedSession = await db
      .select()
      .from(sessions)
      .where(eq(sessions.id, 'test-session-001'))
      .limit(1);
    expect(storedSession[0]).toMatchObject({
      messageCount: 3,
      tokensInput: 17,
      tokensOutput: 34,
      fileCount: 2,
      lastSummary: null,
    });

    const storedMessages = await db
      .select()
      .from(messages)
      .where(eq(messages.sessionId, 'test-session-001'));
    expect(storedMessages).toHaveLength(3);
  });

  it('ingests sessions without metadata or usage details using fallback summary and token logic', async () => {
    await provider.initialize();
    const fallbackSessionPath = createSessionFile(
      configDir,
      'C--git-demo-project',
      'test-session-003'
    );
    const staleTime = new Date('2024-01-01T00:00:00.000Z');
    fs.utimesSync(fallbackSessionPath, staleTime, staleTime);
    const parsed: ParsedSession = {
      messages: [
        {
          uuid: 'msg-user-fallback',
          sessionId: 'test-session-003',
          type: 'user',
          timestamp: '2024-01-15T11:00:00.000Z',
          content: 'short prompt',
          tokens: 3,
        },
        {
          uuid: 'msg-assistant-fallback',
          parentUuid: 'msg-user-fallback',
          sessionId: 'test-session-003',
          type: 'assistant',
          timestamp: '2024-01-15T11:00:03.000Z',
          content: { done: true },
          tokens: 0,
        },
      ],
      summary: {
        summary: 'Fallback summary only',
      },
      summaries: [],
      fileSnapshots: [],
      toolCalls: [],
    };

    const sessionId = await provider.ingestSession(fallbackSessionPath, parsed);
    const storedSession = await db
      .select()
      .from(sessions)
      .where(eq(sessions.id, sessionId))
      .limit(1);
    const storedMessages = await db
      .select()
      .from(messages)
      .where(eq(messages.sessionId, sessionId));

    expect(storedSession[0]).toMatchObject({
      status: 'completed',
      cwd: null,
      gitBranch: null,
      version: null,
      lastSummary: 'Fallback summary only',
      fileCount: 0,
      toolUsageCount: 0,
      tokensInput: 3,
      tokensOutput: 0,
    });
    expect(storedMessages).toHaveLength(2);
    expect(storedMessages.find((message) => message.id === 'msg-assistant-fallback')?.tokens).toBe(
      0
    );
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

  it('logs intermediate progress every 10 processed sessions', async () => {
    for (let index = 2; index <= 10; index++) {
      createSessionFile(
        configDir,
        'C--git-demo-project',
        `test-session-${String(index).padStart(3, '0')}`
      );
    }
    await provider.initialize();

    const result = await provider.fullSync();

    expect(result).toEqual({ processed: 10, errors: 0 });
    expect(
      syncStatusManager
        .getCompletedSyncs(1)[0]
        ?.logs.some((entry) => entry.message.includes('Processed 10/10 sessions'))
    ).toBe(true);
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

  it('keeps externally tracked syncs active when fullSync fails before completion', async () => {
    await provider.initialize();
    const trackingId = syncStatusManager.startSync('claude-external');
    vi.spyOn(
      provider as unknown as { scanSessionFiles: () => Promise<string[]> },
      'scanSessionFiles'
    ).mockRejectedValueOnce(new Error('forced scan failure'));

    await expect(provider.fullSync(trackingId)).rejects.toThrow('forced scan failure');

    expect(syncStatusManager.getCompletedSyncs(5)).toEqual([]);
    expect(syncStatusManager.getSync(trackingId)).toMatchObject({
      id: trackingId,
      status: 'running',
    });
    expect(
      syncStatusManager
        .getSync(trackingId)
        ?.logs.some((entry) => entry.message.includes('forced scan failure'))
    ).toBe(true);
  });

  it('marks internally tracked syncs as errored when fullSync fails before scanning completes', async () => {
    await provider.initialize();
    vi.spyOn(
      provider as unknown as { scanSessionFiles: () => Promise<string[]> },
      'scanSessionFiles'
    ).mockRejectedValueOnce(new Error('forced internal scan failure'));

    await expect(provider.fullSync()).rejects.toThrow('forced internal scan failure');

    expect(syncStatusManager.getCompletedSyncs(1)[0]).toMatchObject({
      providerId: 'claude',
      status: 'error',
    });
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
