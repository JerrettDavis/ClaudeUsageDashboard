import { and, desc, eq, gte, lte, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { messages, sessions, toolCalls } from '@/lib/db/schema';
import { publicProcedure, router } from '../init';

const analyticsRangeSchema = z.object({
  providerId: z.string().optional(),
  startDate: z.date(),
  endDate: z.date(),
});

const hotspotsInputSchema = analyticsRangeSchema.extend({
  limit: z.number().min(1).max(25).default(8),
});

type AnalyticsWhere = ReturnType<typeof and> | undefined;
type SessionRow = {
  id: string;
  status: 'active' | 'completed' | 'error';
  projectPath: string;
  projectName: string;
  startTime: Date;
  endTime: Date | null;
  messageCount: number | null;
  tokensInput: number | null;
  tokensOutput: number | null;
  toolUsageCount: number | null;
  filesModified: string | null;
  foldersAccessed: string | null;
  estimatedCost: number | null;
};

export const analyticsRouter = router({
  usageStats: publicProcedure.input(analyticsRangeSchema).query(async ({ input }) => {
    const where = buildAnalyticsWhere(input);

    const [sessionStats, toolStats, sessionRows] = await Promise.all([
      db
        .select({
          totalSessions: sql<number>`count(*)`,
          totalTokensInput: sql<number>`sum(${sessions.tokensInput})`,
          totalTokensOutput: sql<number>`sum(${sessions.tokensOutput})`,
          totalCost: sql<number>`sum(${sessions.estimatedCost})`,
        })
        .from(sessions)
        .where(where),
      db
        .select({
          toolName: toolCalls.toolName,
          count: sql<number>`count(*)`,
        })
        .from(toolCalls)
        .innerJoin(messages, eq(toolCalls.messageId, messages.id))
        .innerJoin(sessions, eq(messages.sessionId, sessions.id))
        .where(where)
        .groupBy(toolCalls.toolName)
        .orderBy(desc(sql`count(*)`)),
      fetchSessionRows(where),
    ]);

    const stats = sessionStats[0] || {
      totalSessions: 0,
      totalTokensInput: 0,
      totalTokensOutput: 0,
      totalCost: 0,
    };

    return {
      totalSessions: Number(stats.totalSessions) || 0,
      totalTokensInput: Number(stats.totalTokensInput) || 0,
      totalTokensOutput: Number(stats.totalTokensOutput) || 0,
      totalTokens: Number(stats.totalTokensInput || 0) + Number(stats.totalTokensOutput || 0),
      estimatedCost: Number(stats.totalCost) || 0,
      activeTime: Math.round(sumSessionMinutes(sessionRows)),
      toolUsageBreakdown: toolStats.reduce(
        (acc, tool) => {
          acc[tool.toolName] = Number(tool.count);
          return acc;
        },
        {} as Record<string, number>
      ),
    };
  }),

  overview: publicProcedure.input(analyticsRangeSchema).query(async ({ input }) => {
    const where = buildAnalyticsWhere(input);
    const [sessionRows, toolStats] = await Promise.all([
      fetchSessionRows(where),
      db
        .select({
          toolName: toolCalls.toolName,
          count: sql<number>`count(*)`,
        })
        .from(toolCalls)
        .innerJoin(messages, eq(toolCalls.messageId, messages.id))
        .innerJoin(sessions, eq(messages.sessionId, sessions.id))
        .where(where)
        .groupBy(toolCalls.toolName)
        .orderBy(desc(sql`count(*)`))
        .limit(1),
    ]);

    const totalSessions = sessionRows.length;
    const completedSessions = sessionRows.filter(
      (session) => session.status === 'completed'
    ).length;
    const activeSessions = sessionRows.filter((session) => session.status === 'active').length;
    const errorSessions = sessionRows.filter((session) => session.status === 'error').length;
    const totalMessages = sessionRows.reduce(
      (sum, session) => sum + Number(session.messageCount || 0),
      0
    );
    const totalTokens = sessionRows.reduce(
      (sum, session) => sum + Number(session.tokensInput || 0) + Number(session.tokensOutput || 0),
      0
    );
    const totalToolCalls = sessionRows.reduce(
      (sum, session) => sum + Number(session.toolUsageCount || 0),
      0
    );
    const activeProjects = new Set(sessionRows.map((session) => session.projectPath)).size;
    const totalActiveMinutes = sumSessionMinutes(sessionRows);
    const hourlyCounts = buildHourlyCounts(sessionRows);
    const dailyCounts = buildDailyCounts(sessionRows);
    const topTool = toolStats[0]
      ? {
          name: toolStats[0].toolName,
          count: Number(toolStats[0].count),
        }
      : null;

    const busiestDayEntry = [...dailyCounts.entries()].sort((a, b) => b[1] - a[1])[0];
    const busiestProjectEntry = [
      ...countValues(sessionRows.map((session) => session.projectName)).entries(),
    ].sort((a, b) => b[1] - a[1])[0];

    return {
      totalSessions,
      completedSessions,
      activeSessions,
      errorSessions,
      activeProjects,
      completionRate: totalSessions > 0 ? roundTo((completedSessions / totalSessions) * 100, 1) : 0,
      errorRate: totalSessions > 0 ? roundTo((errorSessions / totalSessions) * 100, 1) : 0,
      averageMessagesPerSession: totalSessions > 0 ? roundTo(totalMessages / totalSessions, 1) : 0,
      averageTokensPerSession: totalSessions > 0 ? Math.round(totalTokens / totalSessions) : 0,
      averageToolCallsPerSession:
        totalSessions > 0 ? roundTo(totalToolCalls / totalSessions, 1) : 0,
      averageSessionDurationMinutes:
        completedSessions > 0
          ? roundTo(
              sumSessionMinutes(sessionRows.filter((session) => session.status === 'completed')) /
                completedSessions,
              1
            )
          : 0,
      totalActiveMinutes: Math.round(totalActiveMinutes),
      mostActiveHour: pickBusiestHour(hourlyCounts),
      busiestDay: busiestDayEntry
        ? {
            date: busiestDayEntry[0],
            sessions: busiestDayEntry[1],
          }
        : null,
      busiestProject: busiestProjectEntry
        ? {
            projectName: busiestProjectEntry[0],
            sessions: busiestProjectEntry[1],
          }
        : null,
      topTool,
    };
  }),

  dailyBreakdown: publicProcedure.input(analyticsRangeSchema).query(async ({ input }) => {
    const where = buildAnalyticsWhere(input);

    const daily = await db
      .select({
        date: sql<string>`date(${sessions.startTime}, 'unixepoch')`,
        sessions: sql<number>`count(*)`,
        tokens: sql<number>`sum(${sessions.tokensInput} + ${sessions.tokensOutput})`,
        cost: sql<number>`sum(${sessions.estimatedCost})`,
      })
      .from(sessions)
      .where(where)
      .groupBy(sql`date(${sessions.startTime}, 'unixepoch')`)
      .orderBy(sql`date(${sessions.startTime}, 'unixepoch')`);

    return daily.map((day) => ({
      date: day.date,
      sessions: Number(day.sessions),
      tokens: Number(day.tokens),
      cost: Number(day.cost),
    }));
  }),

  statusBreakdown: publicProcedure.input(analyticsRangeSchema).query(async ({ input }) => {
    const where = buildAnalyticsWhere(input);

    const result = await db
      .select({
        status: sessions.status,
        sessions: sql<number>`count(*)`,
      })
      .from(sessions)
      .where(where)
      .groupBy(sessions.status)
      .orderBy(desc(sql`count(*)`));

    return result.map((item) => ({
      status: item.status,
      sessions: Number(item.sessions),
    }));
  }),

  toolBreakdown: publicProcedure.input(analyticsRangeSchema).query(async ({ input }) => {
    const where = buildAnalyticsWhere(input);

    const result = await db
      .select({
        toolName: toolCalls.toolName,
        count: sql<number>`count(*)`,
      })
      .from(toolCalls)
      .innerJoin(messages, eq(toolCalls.messageId, messages.id))
      .innerJoin(sessions, eq(messages.sessionId, sessions.id))
      .where(where)
      .groupBy(toolCalls.toolName)
      .orderBy(desc(sql`count(*)`))
      .limit(12);

    return result.map((tool) => ({
      toolName: tool.toolName,
      count: Number(tool.count),
    }));
  }),

  activityByHour: publicProcedure.input(analyticsRangeSchema).query(async ({ input }) => {
    const sessionRows = await fetchSessionRows(buildAnalyticsWhere(input));
    const hourlyCounts = buildHourlyCounts(sessionRows);

    return Array.from({ length: 24 }, (_, hour) => ({
      hour,
      sessions: hourlyCounts.get(hour) || 0,
    }));
  }),

  hotspots: publicProcedure.input(hotspotsInputSchema).query(async ({ input }) => {
    const sessionRows = await fetchSessionRows(buildAnalyticsWhere(input));
    const fileCounts = new Map<string, number>();
    const folderCounts = new Map<string, number>();

    for (const session of sessionRows) {
      for (const filePath of parseStringArray(session.filesModified)) {
        incrementMap(fileCounts, filePath);
      }

      for (const folderPath of parseStringArray(session.foldersAccessed)) {
        incrementMap(folderCounts, folderPath);
      }
    }

    return {
      topFiles: mapToSortedList(fileCounts, input.limit),
      topFolders: mapToSortedList(folderCounts, input.limit),
    };
  }),

  topProjects: publicProcedure
    .input(
      analyticsRangeSchema.extend({
        limit: z.number().min(1).max(50).default(10),
      })
    )
    .query(async ({ input }) => {
      const where = buildAnalyticsWhere(input);

      const projects = await db
        .select({
          projectName: sessions.projectName,
          projectPath: sessions.projectPath,
          sessions: sql<number>`count(*)`,
          tokens: sql<number>`sum(${sessions.tokensInput} + ${sessions.tokensOutput})`,
          cost: sql<number>`sum(${sessions.estimatedCost})`,
          lastActive: sql<number>`max(${sessions.startTime})`,
        })
        .from(sessions)
        .where(where)
        .groupBy(sessions.projectPath)
        .orderBy(desc(sql`sum(${sessions.tokensInput} + ${sessions.tokensOutput})`))
        .limit(input.limit);

      return projects.map((project) => ({
        projectName: project.projectName,
        projectPath: project.projectPath,
        sessions: Number(project.sessions),
        tokens: Number(project.tokens),
        cost: Number(project.cost),
        lastActive: new Date(Number(project.lastActive) * 1000),
      }));
    }),
});

function buildAnalyticsWhere(input: z.infer<typeof analyticsRangeSchema>): AnalyticsWhere {
  const conditions = [
    gte(sessions.startTime, input.startDate),
    lte(sessions.startTime, input.endDate),
  ];
  if (input.providerId) {
    conditions.push(eq(sessions.providerId, input.providerId));
  }

  return and(...conditions);
}

function fetchSessionRows(where: AnalyticsWhere) {
  return db
    .select({
      id: sessions.id,
      status: sessions.status,
      projectPath: sessions.projectPath,
      projectName: sessions.projectName,
      startTime: sessions.startTime,
      endTime: sessions.endTime,
      messageCount: sessions.messageCount,
      tokensInput: sessions.tokensInput,
      tokensOutput: sessions.tokensOutput,
      toolUsageCount: sessions.toolUsageCount,
      filesModified: sessions.filesModified,
      foldersAccessed: sessions.foldersAccessed,
      estimatedCost: sessions.estimatedCost,
    })
    .from(sessions)
    .where(where);
}

function sumSessionMinutes(sessionRows: SessionRow[]) {
  return sessionRows.reduce((sum, session) => {
    if (!session.endTime) {
      return sum;
    }

    return sum + Math.max(0, (session.endTime.getTime() - session.startTime.getTime()) / 60000);
  }, 0);
}

function buildHourlyCounts(sessionRows: SessionRow[]) {
  const hourlyCounts = new Map<number, number>();

  for (const session of sessionRows) {
    incrementMap(hourlyCounts, session.startTime.getUTCHours());
  }

  return hourlyCounts;
}

function buildDailyCounts(sessionRows: SessionRow[]) {
  const dailyCounts = new Map<string, number>();

  for (const session of sessionRows) {
    const day = session.startTime.toISOString().slice(0, 10);
    incrementMap(dailyCounts, day);
  }

  return dailyCounts;
}

function countValues(values: string[]) {
  const counts = new Map<string, number>();
  for (const value of values) {
    incrementMap(counts, value);
  }
  return counts;
}

function incrementMap(map: Map<string, number>, key: string): void;
function incrementMap(map: Map<number, number>, key: number): void;
function incrementMap(map: Map<string | number, number>, key: string | number) {
  map.set(key, (map.get(key) || 0) + 1);
}

function parseStringArray(value: string | null) {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string')
      : [];
  } catch {
    return [];
  }
}

function mapToSortedList(map: Map<string, number>, limit: number) {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name, count]) => ({ name, count }));
}

function pickBusiestHour(hourlyCounts: Map<number, number>) {
  const busiestEntry = [...hourlyCounts.entries()].sort((a, b) => b[1] - a[1])[0];
  return busiestEntry ? busiestEntry[0] : null;
}

function roundTo(value: number, places: number) {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}
