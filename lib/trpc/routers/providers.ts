import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { providers } from '@/lib/db/schema';
import { publicProcedure, router } from '../init';

export const providersRouter = router({
  list: publicProcedure.query(async () => {
    return await db.select().from(providers);
  }),

  get: publicProcedure.input(z.object({ id: z.string() })).query(async ({ input }) => {
    const result = await db.select().from(providers).where(eq(providers.id, input.id)).limit(1);
    return result[0] || null;
  }),

  updateConfig: publicProcedure
    .input(
      z.object({
        id: z.string(),
        configPath: z.string().optional(),
        costPerInputToken: z.number().optional(),
        costPerOutputToken: z.number().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { id, ...updates } = input;
      await db.update(providers).set(updates).where(eq(providers.id, id));
      return { success: true };
    }),
});
