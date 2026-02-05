import { router, publicProcedure } from '../init';
import { z } from 'zod';
import { syncService } from '@/lib/services/sync';

export const syncRouter = router({
  syncProvider: publicProcedure
    .input(z.object({ providerId: z.string() }))
    .mutation(async ({ input }) => {
      return await syncService.syncProvider(input.providerId);
    }),

  syncAll: publicProcedure.mutation(async () => {
    return await syncService.syncAll();
  }),

  checkInstallations: publicProcedure.query(async () => {
    return await syncService.checkInstallations();
  }),
});
