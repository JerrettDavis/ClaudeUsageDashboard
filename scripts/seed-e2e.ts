import fs from 'node:fs/promises';
import path from 'node:path';

type Role = 'user' | 'assistant';

interface SeedMessage {
  id: string;
  role: Role;
  timestamp: string;
  tokens: number;
  content: string;
  toolCalls?: Array<{
    name: string;
    input: Record<string, unknown>;
    timestamp: string;
  }>;
  terminalContent?: unknown;
}

interface SeedSession {
  id: string;
  providerId: 'claude';
  projectName: string;
  projectPath: string;
  status: 'active' | 'completed' | 'error';
  startTime: string;
  endTime?: string;
  lastActivity: string;
  lastSummary: string;
  filesModified: string[];
  foldersAccessed: string[];
  messages: SeedMessage[];
}

const repoRoot = process.cwd();
const dataDir = path.join(repoRoot, 'data');
const databasePath = process.env.DATABASE_URL || path.join(dataDir, 'claude-dashboard.e2e.db');
const e2eHomeDir = path.join(dataDir, 'e2e-home');

const seededSessions: SeedSession[] = [
  {
    id: 'demo-session-active',
    providerId: 'claude',
    projectName: 'ClaudeUsageDashboard',
    projectPath: 'C:\\git\\ClaudeUsageDashboard',
    status: 'active',
    startTime: '2026-04-21T14:00:00.000Z',
    lastActivity: '2026-04-21T14:09:30.000Z',
    lastSummary:
      'Added a guides hub, expanded Playwright coverage, and prepared a static companion site for GitHub Pages.',
    filesModified: [
      'app/guides/page.tsx',
      'tests/e2e/dashboard.spec.ts',
      '.github/workflows/pages.yml',
    ],
    foldersAccessed: ['app/guides', 'tests/e2e', '.github/workflows'],
    messages: [
      {
        id: 'demo-active-msg-1',
        role: 'user',
        timestamp: '2026-04-21T14:00:00.000Z',
        tokens: 52,
        content: 'Add a guide page for new users and capture screenshots for the docs.',
        terminalContent: 'Add a guide page for new users and capture screenshots for the docs.',
      },
      {
        id: 'demo-active-msg-2',
        role: 'assistant',
        timestamp: '2026-04-21T14:01:20.000Z',
        tokens: 188,
        content: JSON.stringify([
          {
            type: 'tool_use',
            name: 'create',
            input: {
              path: 'app/guides/page.tsx',
              description: 'Create an onboarding hub that links guides and screenshots.',
            },
          },
          {
            type: 'text',
            text: 'I added a guides hub and wired it into the dashboard navigation.',
          },
        ]),
        toolCalls: [
          {
            name: 'create',
            input: {
              path: 'app/guides/page.tsx',
            },
            timestamp: '2026-04-21T14:01:20.000Z',
          },
        ],
        terminalContent: [
          {
            type: 'tool_use',
            name: 'create',
            input: {
              path: 'app/guides/page.tsx',
            },
          },
          {
            type: 'text',
            text: 'I added a guides hub and wired it into the dashboard navigation.',
          },
        ],
      },
      {
        id: 'demo-active-msg-3',
        role: 'user',
        timestamp: '2026-04-21T14:04:00.000Z',
        tokens: 47,
        content: 'Add browser coverage for the dashboard, sessions, and monitoring flows.',
        terminalContent: 'Add browser coverage for the dashboard, sessions, and monitoring flows.',
      },
      {
        id: 'demo-active-msg-4',
        role: 'assistant',
        timestamp: '2026-04-21T14:06:00.000Z',
        tokens: 216,
        content: JSON.stringify([
          {
            type: 'tool_use',
            name: 'edit',
            input: {
              path: 'tests/e2e/dashboard.spec.ts',
              assertion: 'cover dashboard metrics, session filters, and tiling monitor history',
            },
          },
          {
            type: 'tool_result',
            content:
              'Playwright coverage added for dashboard, session detail, guides, and monitoring.',
          },
          {
            type: 'text',
            text: 'The new e2e suite now covers the highest-value product flows.',
          },
        ]),
        toolCalls: [
          {
            name: 'edit',
            input: {
              path: 'tests/e2e/dashboard.spec.ts',
            },
            timestamp: '2026-04-21T14:06:00.000Z',
          },
        ],
        terminalContent: [
          {
            type: 'tool_use',
            name: 'edit',
            input: {
              path: 'tests/e2e/dashboard.spec.ts',
            },
          },
          {
            type: 'tool_result',
            content:
              'Playwright coverage added for dashboard, session detail, guides, and monitoring.',
          },
          {
            type: 'text',
            text: 'The new e2e suite now covers the highest-value product flows.',
          },
        ],
      },
    ],
  },
  {
    id: 'demo-session-completed',
    providerId: 'claude',
    projectName: 'API Playground',
    projectPath: 'C:\\git\\APIPlayground',
    status: 'completed',
    startTime: '2026-04-18T09:20:00.000Z',
    endTime: '2026-04-18T09:48:00.000Z',
    lastActivity: '2026-04-18T09:48:00.000Z',
    lastSummary:
      'Finished an API refactor and validated the router changes with unit tests and TypeScript.',
    filesModified: ['lib/trpc/routers/sessions.ts', 'tests/integration/trpc.test.ts'],
    foldersAccessed: ['lib/trpc/routers', 'tests/integration'],
    messages: [
      {
        id: 'demo-completed-msg-1',
        role: 'user',
        timestamp: '2026-04-18T09:20:00.000Z',
        tokens: 33,
        content: 'Refactor the sessions router and keep the tests green.',
        terminalContent: 'Refactor the sessions router and keep the tests green.',
      },
      {
        id: 'demo-completed-msg-2',
        role: 'assistant',
        timestamp: '2026-04-18T09:48:00.000Z',
        tokens: 144,
        content: JSON.stringify([
          {
            type: 'text',
            text: 'The router refactor is complete and the integration tests still pass.',
          },
        ]),
        terminalContent: [
          {
            type: 'text',
            text: 'The router refactor is complete and the integration tests still pass.',
          },
        ],
      },
    ],
  },
  {
    id: 'demo-session-error',
    providerId: 'claude',
    projectName: 'Docs Portal',
    projectPath: 'C:\\git\\DocsPortal',
    status: 'error',
    startTime: '2026-04-17T17:05:00.000Z',
    endTime: '2026-04-17T17:19:00.000Z',
    lastActivity: '2026-04-17T17:19:00.000Z',
    lastSummary:
      'Attempted a docs sync, but the output path was missing and the workflow failed fast.',
    filesModified: ['README.md', 'SCREENSHOTS.md'],
    foldersAccessed: ['docs', '.github/workflows'],
    messages: [
      {
        id: 'demo-error-msg-1',
        role: 'user',
        timestamp: '2026-04-17T17:05:00.000Z',
        tokens: 25,
        content: 'Publish the docs bundle to Pages after every release.',
        terminalContent: 'Publish the docs bundle to Pages after every release.',
      },
      {
        id: 'demo-error-msg-2',
        role: 'assistant',
        timestamp: '2026-04-17T17:19:00.000Z',
        tokens: 132,
        content: JSON.stringify([
          {
            type: 'tool_result',
            content: 'Error: output directory not found for GitHub Pages publish step.',
            is_error: true,
          },
          {
            type: 'text',
            text: 'The workflow needs a static site build before Pages can deploy successfully.',
          },
        ]),
        terminalContent: [
          {
            type: 'tool_result',
            content: 'Error: output directory not found for GitHub Pages publish step.',
            is_error: true,
          },
          {
            type: 'text',
            text: 'The workflow needs a static site build before Pages can deploy successfully.',
          },
        ],
      },
    ],
  },
];

function encodeClaudeProjectPath(projectPath: string) {
  return projectPath.replace(':\\', '--').replace(/\\/g, '-');
}

async function resetEnvironment() {
  await fs.mkdir(dataDir, { recursive: true });
  await fs.rm(databasePath, { force: true });
  await fs.rm(e2eHomeDir, { recursive: true, force: true });
  await fs.mkdir(e2eHomeDir, { recursive: true });

  process.env.DATABASE_URL = databasePath;
  process.env.CLAUDE_USAGE_DASHBOARD_HOME = e2eHomeDir;
}

async function writeHistoryFiles() {
  for (const session of seededSessions) {
    const projectFolder = path.join(
      e2eHomeDir,
      '.claude',
      'projects',
      encodeClaudeProjectPath(session.projectPath)
    );

    await fs.mkdir(projectFolder, { recursive: true });

    const lines: string[] = [
      JSON.stringify({
        type: 'summary',
        leafUuid: session.id,
        summary: session.lastSummary,
      }),
      ...session.messages.map((message, index) =>
        JSON.stringify({
          type: message.role,
          uuid: message.id,
          parentUuid: index === 0 ? null : (session.messages[index - 1]?.id ?? null),
          sessionId: session.id,
          timestamp: message.timestamp,
          message: {
            role: message.role,
            content: message.terminalContent ?? message.content,
          },
        })
      ),
    ];

    await fs.writeFile(
      path.join(projectFolder, `${session.id}.jsonl`),
      `${lines.join('\n')}\n`,
      'utf8'
    );
  }
}

async function seedDatabase() {
  const [{ initializeDatabase, db, closeDatabase }, schema] = await Promise.all([
    import('../lib/db/client'),
    import('../lib/db/schema'),
  ]);

  initializeDatabase();

  await db.insert(schema.providers).values({
    id: 'claude',
    name: 'Claude Code',
    configPath: path.join(e2eHomeDir, '.claude'),
    installed: true,
    costPerInputToken: 0.000003,
    costPerOutputToken: 0.000015,
  });

  for (const session of seededSessions) {
    const sessionTokensInput = session.messages
      .filter((message) => message.role === 'user')
      .reduce((total, message) => total + message.tokens, 0);
    const sessionTokensOutput = session.messages
      .filter((message) => message.role === 'assistant')
      .reduce((total, message) => total + message.tokens, 0);

    await db.insert(schema.sessions).values({
      id: session.id,
      providerId: session.providerId,
      projectName: session.projectName,
      projectPath: session.projectPath,
      status: session.status,
      startTime: new Date(session.startTime),
      endTime: session.endTime ? new Date(session.endTime) : null,
      lastActivity: new Date(session.lastActivity),
      lastSummary: session.lastSummary,
      filesModified: JSON.stringify(session.filesModified),
      foldersAccessed: JSON.stringify(session.foldersAccessed),
      fileCount: session.filesModified.length,
      toolUsageCount: session.messages.flatMap((message) => message.toolCalls ?? []).length,
      messageCount: session.messages.length,
      tokensInput: sessionTokensInput,
      tokensOutput: sessionTokensOutput,
      estimatedCost: sessionTokensInput * 0.000003 + sessionTokensOutput * 0.000015,
    });

    for (const message of session.messages) {
      await db.insert(schema.messages).values({
        id: message.id,
        sessionId: session.id,
        parentId: null,
        role: message.role,
        content: message.content,
        timestamp: new Date(message.timestamp),
        tokens: message.tokens,
      });

      if (message.toolCalls?.length) {
        await db.insert(schema.toolCalls).values(
          message.toolCalls.map((toolCall) => ({
            messageId: message.id,
            toolName: toolCall.name,
            parameters: JSON.stringify(toolCall.input),
            success: true,
            timestamp: new Date(toolCall.timestamp),
          }))
        );
      }
    }
  }

  closeDatabase();
}

async function main() {
  await resetEnvironment();
  await writeHistoryFiles();
  await seedDatabase();
  console.log(`Seeded e2e database at ${databasePath}`);
}

main().catch((error) => {
  console.error('Failed to seed e2e environment:', error);
  process.exit(1);
});
