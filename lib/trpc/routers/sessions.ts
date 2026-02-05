import { and, desc, eq, gte, lte } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { messages, sessions } from '@/lib/db/schema';
import { publicProcedure, router } from '../init';

export const sessionsRouter = router({
  list: publicProcedure
    .input(
      z.object({
        providerId: z.string().optional(),
        status: z.enum(['active', 'completed', 'error']).optional(),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ input }) => {
      const { providerId, status, startDate, endDate, limit, offset } = input;

      const conditions = [];
      if (providerId) conditions.push(eq(sessions.providerId, providerId));
      if (status) conditions.push(eq(sessions.status, status));
      if (startDate) conditions.push(gte(sessions.startTime, startDate));
      if (endDate) conditions.push(lte(sessions.startTime, endDate));

      const where = conditions.length > 0 ? and(...conditions) : undefined;

      return await db
        .select()
        .from(sessions)
        .where(where)
        .orderBy(desc(sessions.startTime))
        .limit(limit)
        .offset(offset);
    }),

  get: publicProcedure.input(z.object({ id: z.string() })).query(async ({ input }) => {
    const session = await db.select().from(sessions).where(eq(sessions.id, input.id)).limit(1);

    if (!session[0]) return null;

    const sessionMessages = await db
      .select()
      .from(messages)
      .where(eq(messages.sessionId, input.id))
      .orderBy(messages.timestamp);

    return {
      ...session[0],
      messages: sessionMessages,
    };
  }),

  count: publicProcedure
    .input(
      z.object({
        providerId: z.string().optional(),
        status: z.enum(['active', 'completed', 'error']).optional(),
      })
    )
    .query(async ({ input }) => {
      const { providerId, status } = input;

      const conditions = [];
      if (providerId) conditions.push(eq(sessions.providerId, providerId));
      if (status) conditions.push(eq(sessions.status, status));

      const where = conditions.length > 0 ? and(...conditions) : undefined;

      const result = await db.select().from(sessions).where(where);
      return result.length;
    }),
});
