import path from 'node:path';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { db } from '@/lib/db/client';
import { messages, sessions } from '@/lib/db/schema';
import { ClaudeProvider } from '@/lib/providers/claude';

describe('ClaudeProvider', () => {
  let provider: ClaudeProvider;
  const testFixturePath = path.join(process.cwd(), 'tests/fixtures/sample-session.jsonl');

  beforeAll(async () => {
    // Use in-memory database for tests
    provider = new ClaudeProvider();
  });

  afterAll(async () => {
    await provider.terminate();
  });

  describe('parseSessionFile', () => {
    it('should parse a valid JSONL file', async () => {
      const result = await provider.parseSessionFile(testFixturePath);

      expect(result).toBeDefined();
      expect(result.messages).toBeDefined();
      expect(Array.isArray(result.messages)).toBe(true);
    });

    it('should extract messages correctly', async () => {
      const result = await provider.parseSessionFile(testFixturePath);

      // Should have 6 messages (3 user, 3 assistant)
      expect(result.messages.length).toBe(6);

      // First message should be user
      const firstMsg = result.messages[0];
      expect(firstMsg.type).toBe('user');
      expect(firstMsg.uuid).toBe('msg_001');
      expect(firstMsg.parentUuid).toBeNull();
    });

    it('should extract tool calls from assistant messages', async () => {
      const result = await provider.parseSessionFile(testFixturePath);

      // Find message with tool call
      const msgWithTool = result.messages.find((m) => m.uuid === 'msg_004');
      expect(msgWithTool).toBeDefined();
      expect(msgWithTool?.toolCalls).toBeDefined();
      expect(msgWithTool?.toolCalls?.length).toBeGreaterThan(0);

      const toolCall = msgWithTool?.toolCalls?.[0];
      expect(toolCall?.name).toBe('create');
      expect(toolCall?.input).toHaveProperty('path');
    });

    it('should extract file snapshots', async () => {
      const result = await provider.parseSessionFile(testFixturePath);

      expect(result.fileSnapshots).toBeDefined();
      expect(result.fileSnapshots.length).toBeGreaterThan(0);

      const snapshot = result.fileSnapshots[0];
      expect(snapshot.filePath).toBe('reader.py');
    });

    it('should extract summary', async () => {
      const result = await provider.parseSessionFile(testFixturePath);

      expect(result.summary).toBeDefined();
      expect(result.summary?.leafUuid).toBe('test-session-001');
    });

    it('should estimate tokens for messages', async () => {
      const result = await provider.parseSessionFile(testFixturePath);

      for (const msg of result.messages) {
        expect(msg.tokens).toBeGreaterThan(0);
      }
    });
  });

  describe('ingestSession', () => {
    it('should ingest parsed session into database', async () => {
      const parsed = await provider.parseSessionFile(testFixturePath);
      const sessionId = await provider.ingestSession(testFixturePath, parsed);

      expect(sessionId).toBeDefined();

      // Verify session was inserted
      const session = await db.select().from(sessions).where(eq(sessions.id, sessionId)).limit(1);

      expect(session.length).toBe(1);
      expect(session[0].providerId).toBe('claude');
    });

    it('should insert all messages', async () => {
      const parsed = await provider.parseSessionFile(testFixturePath);
      const sessionId = await provider.ingestSession(testFixturePath, parsed);

      const sessionMessages = await db
        .select()
        .from(messages)
        .where(eq(messages.sessionId, sessionId));

      expect(sessionMessages.length).toBe(parsed.messages.length);
    });

    it('should calculate session statistics', async () => {
      const parsed = await provider.parseSessionFile(testFixturePath);
      const sessionId = await provider.ingestSession(testFixturePath, parsed);

      const session = await db.select().from(sessions).where(eq(sessions.id, sessionId)).limit(1);

      expect(session[0].messageCount).toBeGreaterThan(0);
      expect(session[0].tokensInput).toBeGreaterThan(0);
      expect(session[0].tokensOutput).toBeGreaterThan(0);
      expect(session[0].estimatedCost).toBeGreaterThan(0);
    });
  });

  describe('getCostEstimate', () => {
    it('should calculate cost correctly', () => {
      const cost = provider.getCostEstimate({
        inputTokens: 1000,
        outputTokens: 2000,
      });

      // $3 per million input + $15 per million output
      const expected = 1000 * 0.000003 + 2000 * 0.000015;
      expect(cost).toBeCloseTo(expected, 6);
    });

    it('should handle zero tokens', () => {
      const cost = provider.getCostEstimate({
        inputTokens: 0,
        outputTokens: 0,
      });

      expect(cost).toBe(0);
    });
  });

  describe('detectInstallation', () => {
    it('should return boolean', async () => {
      const installed = await provider.detectInstallation();
      expect(typeof installed).toBe('boolean');
    });
  });

  describe('getConfigPath', () => {
    it('should return a valid path', () => {
      const configPath = provider.getConfigPath();
      expect(configPath).toBeDefined();
      expect(typeof configPath).toBe('string');
      expect(configPath.length).toBeGreaterThan(0);
    });
  });
});
