import { describe, it, expect } from 'vitest';
import { appRouter } from '@/lib/trpc/root';
import { createCallerFactory } from '@/lib/trpc/init';

describe('tRPC Providers Router', () => {
  const createCaller = createCallerFactory(appRouter);
  const caller = createCaller({});

  it('should list providers', async () => {
    const providers = await caller.providers.list();
    expect(providers).toBeDefined();
    expect(Array.isArray(providers)).toBe(true);
  });

  it('should get provider by id', async () => {
    const provider = await caller.providers.get({ id: 'claude' });
    // May be null if not seeded yet, just checking it doesn't throw
    expect(provider === null || typeof provider === 'object').toBe(true);
  });
});

describe('tRPC Sessions Router', () => {
  const createCaller = createCallerFactory(appRouter);
  const caller = createCaller({});

  it('should list sessions with default params', async () => {
    const sessions = await caller.sessions.list({});
    expect(sessions).toBeDefined();
    expect(Array.isArray(sessions)).toBe(true);
  });

  it('should count sessions', async () => {
    const count = await caller.sessions.count({});
    expect(typeof count).toBe('number');
    expect(count).toBeGreaterThanOrEqual(0);
  });
});

describe('tRPC Analytics Router', () => {
  const createCaller = createCallerFactory(appRouter);
  const caller = createCaller({});

  const dateRange = {
    startDate: new Date('2024-01-01'),
    endDate: new Date(),
  };

  it('should get usage stats', async () => {
    const stats = await caller.analytics.usageStats(dateRange);
    expect(stats).toBeDefined();
    expect(stats).toHaveProperty('totalSessions');
    expect(stats).toHaveProperty('totalTokensInput');
    expect(stats).toHaveProperty('totalTokensOutput');
    expect(stats).toHaveProperty('estimatedCost');
  });

  it('should get daily breakdown', async () => {
    const daily = await caller.analytics.dailyBreakdown(dateRange);
    expect(daily).toBeDefined();
    expect(Array.isArray(daily)).toBe(true);
  });

  it('should get top projects', async () => {
    const projects = await caller.analytics.topProjects(dateRange);
    expect(projects).toBeDefined();
    expect(Array.isArray(projects)).toBe(true);
  });
});
