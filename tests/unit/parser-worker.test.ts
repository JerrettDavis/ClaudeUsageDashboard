import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { parseJSONL, parseMessage } from '@/lib/workers/parser-core';

describe('parser.worker', () => {
  const tempFiles: string[] = [];

  afterEach(() => {
    for (const filePath of tempFiles.splice(0)) {
      fs.rmSync(filePath, { force: true });
    }
  });

  it('parses real Claude-style transcript metadata, tools, and hotspots', async () => {
    const filePath = createTempJsonl([
      {
        type: 'permission-mode',
        permissionMode: 'bypassPermissions',
        sessionId: 'parser-test-session',
      },
      {
        type: 'summary',
        leafUuid: 'parser-test-session',
        summary: 'Refined the analytics dashboard and validated the charts.',
      },
      {
        type: 'user',
        uuid: 'msg-user',
        sessionId: 'parser-test-session',
        timestamp: '2026-04-22T23:40:51.241Z',
        cwd: 'C:\\git\\ClaudeUsageDashboard',
        gitBranch: 'master',
        version: '2.1.117',
        message: {
          role: 'user',
          content: 'Build a better analytics view for the dashboard.',
        },
      },
      {
        type: 'assistant',
        uuid: 'msg-assistant',
        parentUuid: 'msg-user',
        sessionId: 'parser-test-session',
        timestamp: '2026-04-22T23:44:13.839Z',
        cwd: 'C:\\git\\ClaudeUsageDashboard',
        gitBranch: 'master',
        version: '2.1.117',
        message: {
          id: 'assistant-message-id',
          type: 'message',
          role: 'assistant',
          model: 'claude-opus-4-7',
          content: [
            {
              type: 'tool_use',
              id: 'toolu_001',
              name: 'Edit',
              input: {
                path: 'app/analytics/page.tsx',
              },
            },
            {
              type: 'tool_use',
              id: 'toolu_002',
              name: 'Bash',
              input: {
                command: 'npm run test:e2e',
                cwd: 'C:\\git\\ClaudeUsageDashboard',
              },
            },
            {
              type: 'text',
              text: 'The analytics view is now wired up.',
            },
          ],
          usage: {
            input_tokens: 321,
            output_tokens: 654,
          },
        },
      },
      {
        type: 'file-history-snapshot',
        snapshot: {
          timestamp: '2026-04-22T23:44:15.000Z',
          trackedFileBackups: {
            'app/analytics/page.tsx': {},
            'lib/trpc/routers/analytics.ts': {},
          },
        },
      },
      'not valid json at all',
    ]);

    const parsed = await parseJSONL(filePath, 0);

    expect(parsed.metadata).toMatchObject({
      cwd: 'C:\\git\\ClaudeUsageDashboard',
      gitBranch: 'master',
      version: '2.1.117',
      permissionMode: 'bypassPermissions',
    });
    expect(parsed.summary).toMatchObject({
      leafUuid: 'parser-test-session',
      summary: 'Refined the analytics dashboard and validated the charts.',
    });
    expect(parsed.summaries).toHaveLength(1);
    expect(parsed.messages).toHaveLength(2);
    expect(parsed.messages[1]).toMatchObject({
      uuid: 'msg-assistant',
      type: 'assistant',
      model: 'claude-opus-4-7',
      inputTokens: 321,
      outputTokens: 654,
      tokens: 654,
    });
    expect(parsed.toolCalls).toEqual([
      {
        id: 'toolu_001',
        messageUuid: 'msg-assistant',
        name: 'Edit',
        input: {
          path: 'app/analytics/page.tsx',
        },
        timestamp: '2026-04-22T23:44:13.839Z',
      },
      {
        id: 'toolu_002',
        messageUuid: 'msg-assistant',
        name: 'Bash',
        input: {
          command: 'npm run test:e2e',
          cwd: 'C:\\git\\ClaudeUsageDashboard',
        },
        timestamp: '2026-04-22T23:44:13.839Z',
      },
    ]);
    expect(parsed.filesModified).toEqual(
      expect.arrayContaining([
        'app/analytics/page.tsx',
        'app/analytics/page.tsx',
        'lib/trpc/routers/analytics.ts',
      ])
    );
    expect(parsed.foldersAccessed).toEqual(
      expect.arrayContaining(['app/analytics', 'lib/trpc/routers', 'C:\\git\\ClaudeUsageDashboard'])
    );
  });

  it('falls back to estimated tokens when usage metadata is absent', () => {
    const message = parseMessage({
      type: 'assistant',
      uuid: 'msg-assistant',
      sessionId: 'parser-test-session',
      timestamp: '2026-04-22T23:44:13.839Z',
      message: {
        role: 'assistant',
        content: [{ type: 'text', text: 'Plain text response' }],
      },
    });

    expect(message).toMatchObject({
      uuid: 'msg-assistant',
    });
    expect(message?.tokens).toBeGreaterThan(0);
  });

  function createTempJsonl(lines: Array<Record<string, unknown> | string>) {
    const filePath = path.join(os.tmpdir(), `parser-worker-${Date.now()}-${Math.random()}.jsonl`);
    fs.writeFileSync(
      filePath,
      `${lines
        .map((line) => (typeof line === 'string' ? line : JSON.stringify(line)))
        .join('\n')}\n`,
      'utf8'
    );
    tempFiles.push(filePath);
    return filePath;
  }
});
