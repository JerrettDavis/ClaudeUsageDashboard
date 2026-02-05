import { z } from 'zod';
import { syncService } from '@/lib/services/sync';
import { publicProcedure, router } from '../init';

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
