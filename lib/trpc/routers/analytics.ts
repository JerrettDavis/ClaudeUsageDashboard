import { router, publicProcedure } from '../init';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { sessions, toolCalls, messages } from '@/lib/db/schema';
import { eq, and, gte, lte, sql, desc } from 'drizzle-orm';

export const analyticsRouter = router({
  usageStats: publicProcedure
    .input(
      z.object({
        providerId: z.string().optional(),
        startDate: z.date(),
        endDate: z.date(),
      })
    )
    .query(async ({ input }) => {
      const { providerId, startDate, endDate } = input;

      const conditions = [
        gte(sessions.startTime, startDate),
        lte(sessions.startTime, endDate),
      ];
      if (providerId) conditions.push(eq(sessions.providerId, providerId));

      const where = and(...conditions);

      // Get session aggregates
      const sessionStats = await db
        .select({
          totalSessions: sql<number>`count(*)`,
          totalTokensInput: sql<number>`sum(${sessions.tokensInput})`,
          totalTokensOutput: sql<number>`sum(${sessions.tokensOutput})`,
          totalCost: sql<number>`sum(${sessions.estimatedCost})`,
        })
        .from(sessions)
        .where(where);

      // Get tool usage breakdown
      const toolStats = await db
        .select({
          toolName: toolCalls.toolName,
          count: sql<number>`count(*)`,
        })
        .from(toolCalls)
        .innerJoin(messages, eq(toolCalls.messageId, messages.id))
        .innerJoin(sessions, eq(messages.sessionId, sessions.id))
        .where(where)
        .groupBy(toolCalls.toolName)
        .orderBy(desc(sql`count(*)`));

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
        totalTokens:
          Number(stats.totalTokensInput) + Number(stats.totalTokensOutput) || 0,
        estimatedCost: Number(stats.totalCost) || 0,
        toolUsageBreakdown: toolStats.reduce(
          (acc, tool) => {
            acc[tool.toolName] = Number(tool.count);
            return acc;
          },
          {} as Record<string, number>
        ),
      };
    }),

  dailyBreakdown: publicProcedure
    .input(
      z.object({
        providerId: z.string().optional(),
        startDate: z.date(),
        endDate: z.date(),
      })
    )
    .query(async ({ input }) => {
      const { providerId, startDate, endDate } = input;

      const conditions = [
        gte(sessions.startTime, startDate),
        lte(sessions.startTime, endDate),
      ];
      if (providerId) conditions.push(eq(sessions.providerId, providerId));

      const where = and(...conditions);

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

  topProjects: publicProcedure
    .input(
      z.object({
        providerId: z.string().optional(),
        startDate: z.date(),
        endDate: z.date(),
        limit: z.number().min(1).max(50).default(10),
      })
    )
    .query(async ({ input }) => {
      const { providerId, startDate, endDate, limit } = input;

      const conditions = [
        gte(sessions.startTime, startDate),
        lte(sessions.startTime, endDate),
      ];
      if (providerId) conditions.push(eq(sessions.providerId, providerId));

      const where = and(...conditions);

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
        .orderBy(desc(sql`count(*)`))
        .limit(limit);

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
