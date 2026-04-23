import { inArray } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/lib/db/client';
import { messages, providers, sessions, toolCalls } from '@/lib/db/schema';
import { createCallerFactory } from '@/lib/trpc/init';
import { appRouter } from '@/lib/trpc/root';

const createCaller = createCallerFactory(appRouter);
const caller = createCaller({});

const sessionIds = [
  'analytics-it-session-1',
  'analytics-it-session-2',
  'analytics-it-session-3',
] as const;

const messageIds = [
  'analytics-it-message-1',
  'analytics-it-message-2',
  'analytics-it-message-3',
] as const;

describe('analytics router', () => {
  beforeEach(async () => {
    await db
      .insert(providers)
      .values({
        id: 'claude',
        name: 'Claude Code',
      })
      .onConflictDoNothing();

    await db.insert(sessions).values([
      {
        id: sessionIds[0],
        providerId: 'claude',
        projectName: 'Analytics Alpha',
        projectPath: 'C:\\git\\AnalyticsAlpha',
        status: 'completed',
        startTime: new Date('2026-02-01T10:00:00.000Z'),
        endTime: new Date('2026-02-01T10:30:00.000Z'),
        messageCount: 4,
        tokensInput: 100,
        tokensOutput: 300,
        estimatedCost: 0.02,
        toolUsageCount: 2,
        filesModified: JSON.stringify(['src/analytics.ts', 'src/chart.tsx']),
        foldersAccessed: JSON.stringify(['src', 'tests']),
      },
      {
        id: sessionIds[1],
        providerId: 'claude',
        projectName: 'Analytics Beta',
        projectPath: 'C:\\git\\AnalyticsBeta',
        status: 'error',
        startTime: new Date('2026-02-02T14:00:00.000Z'),
        endTime: new Date('2026-02-02T14:15:00.000Z'),
        messageCount: 2,
        tokensInput: 50,
        tokensOutput: 150,
        estimatedCost: 0.01,
        toolUsageCount: 1,
        filesModified: JSON.stringify(['README.md']),
        foldersAccessed: JSON.stringify(['docs']),
      },
      {
        id: sessionIds[2],
        providerId: 'claude',
        projectName: 'Analytics Alpha',
        projectPath: 'C:\\git\\AnalyticsAlpha',
        status: 'active',
        startTime: new Date('2026-02-03T10:00:00.000Z'),
        endTime: null,
        messageCount: 3,
        tokensInput: 70,
        tokensOutput: 200,
        estimatedCost: 0.015,
        toolUsageCount: 3,
        filesModified: JSON.stringify(['src/analytics.ts']),
        foldersAccessed: JSON.stringify(['src']),
      },
    ]);

    await db.insert(messages).values([
      {
        id: messageIds[0],
        sessionId: sessionIds[0],
        role: 'assistant',
        content: JSON.stringify([{ type: 'text', text: 'Applied the router changes.' }]),
        timestamp: new Date('2026-02-01T10:05:00.000Z'),
      },
      {
        id: messageIds[1],
        sessionId: sessionIds[1],
        role: 'assistant',
        content: JSON.stringify([{ type: 'text', text: 'The docs build failed.' }]),
        timestamp: new Date('2026-02-02T14:05:00.000Z'),
      },
      {
        id: messageIds[2],
        sessionId: sessionIds[2],
        role: 'assistant',
        content: JSON.stringify([{ type: 'text', text: 'Added new analytics widgets.' }]),
        timestamp: new Date('2026-02-03T10:03:00.000Z'),
      },
    ]);

    await db.insert(toolCalls).values([
      {
        messageId: messageIds[0],
        toolName: 'Edit',
        parameters: JSON.stringify({ path: 'src/analytics.ts' }),
        timestamp: new Date('2026-02-01T10:06:00.000Z'),
      },
      {
        messageId: messageIds[0],
        toolName: 'Read',
        parameters: JSON.stringify({ path: 'src/chart.tsx' }),
        timestamp: new Date('2026-02-01T10:07:00.000Z'),
      },
      {
        messageId: messageIds[1],
        toolName: 'Bash',
        parameters: JSON.stringify({ command: 'npm run build' }),
        timestamp: new Date('2026-02-02T14:06:00.000Z'),
      },
      {
        messageId: messageIds[2],
        toolName: 'Edit',
        parameters: JSON.stringify({ path: 'src/analytics.ts' }),
        timestamp: new Date('2026-02-03T10:04:00.000Z'),
      },
      {
        messageId: messageIds[2],
        toolName: 'Search',
        parameters: JSON.stringify({ query: 'analytics card' }),
        timestamp: new Date('2026-02-03T10:05:00.000Z'),
      },
    ]);
  });

  afterEach(async () => {
    await db.delete(sessions).where(inArray(sessions.id, [...sessionIds]));
  });

  it('computes overview, tool breakdown, hotspots, and activity timing', async () => {
    const range = {
      startDate: new Date('2026-02-01T00:00:00.000Z'),
      endDate: new Date('2026-02-04T00:00:00.000Z'),
    };

    const [
      usageStats,
      overview,
      dailyBreakdown,
      statusBreakdown,
      toolBreakdown,
      activityByHour,
      hotspots,
      topProjects,
    ] = await Promise.all([
      caller.analytics.usageStats(range),
      caller.analytics.overview(range),
      caller.analytics.dailyBreakdown(range),
      caller.analytics.statusBreakdown(range),
      caller.analytics.toolBreakdown(range),
      caller.analytics.activityByHour(range),
      caller.analytics.hotspots({ ...range, limit: 5 }),
      caller.analytics.topProjects({ ...range, limit: 5 }),
    ]);

    expect(usageStats).toMatchObject({
      totalSessions: 3,
      totalTokensInput: 220,
      totalTokensOutput: 650,
      totalTokens: 870,
      estimatedCost: 0.045,
    });
    expect(usageStats.activeTime).toBe(45);
    expect(usageStats.toolUsageBreakdown).toMatchObject({
      Edit: 2,
      Read: 1,
      Bash: 1,
      Search: 1,
    });

    expect(overview).toMatchObject({
      totalSessions: 3,
      completedSessions: 1,
      activeSessions: 1,
      errorSessions: 1,
      activeProjects: 2,
      completionRate: 33.3,
      errorRate: 33.3,
      averageMessagesPerSession: 3,
      averageTokensPerSession: 290,
      averageToolCallsPerSession: 2,
      averageSessionDurationMinutes: 30,
      totalActiveMinutes: 45,
      mostActiveHour: 10,
      busiestProject: {
        projectName: 'Analytics Alpha',
        sessions: 2,
      },
      topTool: {
        name: 'Edit',
        count: 2,
      },
    });
    expect(overview.busiestDay).toEqual({
      date: '2026-02-01',
      sessions: 1,
    });

    expect(dailyBreakdown).toHaveLength(3);
    expect(statusBreakdown).toEqual(
      expect.arrayContaining([
        { status: 'completed', sessions: 1 },
        { status: 'active', sessions: 1 },
        { status: 'error', sessions: 1 },
      ])
    );
    expect(toolBreakdown[0]).toEqual({ toolName: 'Edit', count: 2 });

    const tenOClock = activityByHour.find((entry) => entry.hour === 10);
    const fourteenOClock = activityByHour.find((entry) => entry.hour === 14);
    expect(tenOClock).toEqual({ hour: 10, sessions: 2 });
    expect(fourteenOClock).toEqual({ hour: 14, sessions: 1 });

    expect(hotspots.topFiles[0]).toEqual({ name: 'src/analytics.ts', count: 2 });
    expect(hotspots.topFolders[0]).toEqual({ name: 'src', count: 2 });

    expect(topProjects[0]).toMatchObject({
      projectName: 'Analytics Alpha',
      projectPath: 'C:\\git\\AnalyticsAlpha',
      sessions: 2,
      tokens: 670,
      cost: 0.035,
    });
  });
});
