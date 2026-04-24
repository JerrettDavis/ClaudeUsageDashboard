import { inArray } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/lib/db/client';
import { messages, providers, sessions } from '@/lib/db/schema';
import { createCallerFactory } from '@/lib/trpc/init';
import { appRouter } from '@/lib/trpc/root';

const createCaller = createCallerFactory(appRouter);
const caller = createCaller({});

const providerId = 'claude';
const sessionIds = ['router-session-1', 'router-session-2', 'router-session-3'] as const;
const messageIds = ['router-message-1', 'router-message-2', 'router-message-3'] as const;

describe('router branch coverage', () => {
  beforeEach(async () => {
    await db
      .insert(providers)
      .values({
        id: providerId,
        name: 'Claude Code',
      })
      .onConflictDoNothing();

    await db.insert(sessions).values([
      {
        id: sessionIds[0],
        providerId,
        projectName: 'Router Alpha',
        projectPath: 'C:\\git\\RouterAlpha',
        status: 'completed',
        startTime: new Date('2026-03-01T10:00:00.000Z'),
        endTime: new Date('2026-03-01T10:30:00.000Z'),
        messageCount: 2,
        tokensInput: 10,
        tokensOutput: 20,
        estimatedCost: 0.01,
      },
      {
        id: sessionIds[1],
        providerId,
        projectName: 'Router Alpha',
        projectPath: 'C:\\git\\RouterAlpha',
        status: 'error',
        startTime: new Date('2026-03-02T10:00:00.000Z'),
        endTime: new Date('2026-03-02T10:05:00.000Z'),
        messageCount: 1,
        tokensInput: 5,
        tokensOutput: 10,
        estimatedCost: 0.005,
      },
      {
        id: sessionIds[2],
        providerId,
        projectName: 'Router Beta',
        projectPath: 'C:\\git\\RouterBeta',
        status: 'active',
        startTime: new Date('2026-03-03T12:00:00.000Z'),
        endTime: null,
        messageCount: 3,
        tokensInput: 15,
        tokensOutput: 30,
        estimatedCost: 0.02,
      },
    ]);

    await db.insert(messages).values([
      {
        id: messageIds[0],
        sessionId: sessionIds[0],
        role: 'assistant',
        content: JSON.stringify([{ type: 'text', text: 'First message' }]),
        timestamp: new Date('2026-03-01T10:02:00.000Z'),
      },
      {
        id: messageIds[1],
        sessionId: sessionIds[0],
        role: 'user',
        content: JSON.stringify([{ type: 'text', text: 'Second message' }]),
        timestamp: new Date('2026-03-01T10:01:00.000Z'),
      },
      {
        id: messageIds[2],
        sessionId: sessionIds[2],
        role: 'assistant',
        content: JSON.stringify([{ type: 'text', text: 'Third message' }]),
        timestamp: new Date('2026-03-03T12:03:00.000Z'),
      },
    ]);
  });

  afterEach(async () => {
    await db.delete(messages).where(inArray(messages.id, [...messageIds]));
    await db.delete(sessions).where(inArray(sessions.id, [...sessionIds]));
  });

  it('updates provider config and returns null for unknown providers', async () => {
    await expect(caller.providers.get({ id: 'missing-provider' })).resolves.toBeNull();

    await expect(
      caller.providers.updateConfig({
        id: providerId,
        configPath: 'C:\\Users\\jd\\.claude',
        costPerInputToken: 0.123,
      })
    ).resolves.toEqual({ success: true });

    await expect(caller.providers.get({ id: providerId })).resolves.toMatchObject({
      id: providerId,
      configPath: 'C:\\Users\\jd\\.claude',
      costPerInputToken: 0.123,
    });
  });

  it('applies session filters, offsets, and ordered message loading', async () => {
    const filteredSessions = await caller.sessions.list({
      providerId,
      status: 'completed',
      startDate: new Date('2026-03-01T00:00:00.000Z'),
      endDate: new Date('2026-03-02T00:00:00.000Z'),
      limit: 1,
      offset: 0,
    });

    expect(filteredSessions).toHaveLength(1);
    expect(filteredSessions[0]?.id).toBe(sessionIds[0]);

    await expect(
      caller.sessions.count({
        providerId,
        status: 'error',
      })
    ).resolves.toBe(1);

    await expect(caller.sessions.get({ id: 'missing-session' })).resolves.toBeNull();

    const session = await caller.sessions.get({ id: sessionIds[0] });
    expect(session?.messages.map((message) => message.id)).toEqual([messageIds[1], messageIds[0]]);
  });
});
