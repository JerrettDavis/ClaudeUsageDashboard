import { router } from './init';
import { analyticsRouter } from './routers/analytics';
import { providersRouter } from './routers/providers';
import { sessionsRouter } from './routers/sessions';
import { syncRouter } from './routers/sync';
import { syncStatusRouter } from './routers/sync-status';

export const appRouter = router({
  sessions: sessionsRouter,
  analytics: analyticsRouter,
  providers: providersRouter,
  sync: syncRouter,
  syncStatus: syncStatusRouter,
});

export type AppRouter = typeof appRouter;
