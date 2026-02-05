import { z } from 'zod';
import { claudeProvider } from '@/lib/providers/claude';
import { syncStatusManager } from '@/lib/services/sync-status';
import { publicProcedure, router } from '../init';

export const syncStatusRouter = router({
  /**
   * Get current sync status
   */
  getStatus: publicProcedure.input(z.object({ id: z.string() })).query(({ input }) => {
    return syncStatusManager.getSync(input.id);
  }),

  /**
   * Get all active syncs
   */
  getActiveSyncs: publicProcedure.query(() => {
    return syncStatusManager.getActiveSyncs();
  }),

  /**
   * Get sync history
   */
  getHistory: publicProcedure
    .input(z.object({ limit: z.number().optional().default(10) }))
    .query(({ input }) => {
      return syncStatusManager.getCompletedSyncs(input.limit);
    }),

  /**
   * Get latest sync for provider
   */
  getLatestForProvider: publicProcedure
    .input(z.object({ providerId: z.string() }))
    .query(({ input }) => {
      return syncStatusManager.getLatestSync(input.providerId);
    }),

  /**
   * Start async sync (non-blocking)
   */
  startSync: publicProcedure
    .input(z.object({ providerId: z.string() }))
    .mutation(async ({ input }) => {
      const syncId = syncStatusManager.startSync(input.providerId);

      // Run sync in background without awaiting
      if (input.providerId === 'claude') {
        claudeProvider.fullSync(syncId).catch((err) => {
          console.error('Background sync failed:', err);
          syncStatusManager.completeSync(syncId, 'error');
        });
      }

      return { syncId };
    }),
});
