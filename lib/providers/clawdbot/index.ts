import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { and, desc, eq, gte, lte } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { messages, sessions, toolCalls } from '@/lib/db/schema';
import type {
  AIProvider,
  DateRange,
  Disposable,
  LaunchConfig,
  ProcessHandle,
  RunningProcess,
  Session,
  SessionDetail,
  SessionEvent,
  SessionFilter,
  TokenMetrics,
  Usage,
  UsageStats,
} from '@/types';

interface ClawdbotMessage {
  type: string;
  id: string;
  parentId?: string;
  timestamp: string;
  message?: {
    role: string;
    content: unknown;
    timestamp?: number;
    usage?: {
      input: number;
      output: number;
      cacheRead?: number;
      cacheWrite?: number;
      totalTokens?: number;
      cost?: {
        input: number;
        output: number;
        cacheRead?: number;
        cacheWrite?: number;
        total: number;
      };
    };
    provider?: string;
    model?: string;
  };
  cwd?: string;
  version?: number;
}

interface ParsedClawdbotSession {
  id: string;
  cwd?: string;
  messages: Array<{
    uuid: string;
    parentUuid?: string;
    type: 'user' | 'assistant' | 'toolResult';
    timestamp: string;
    content: unknown;
    tokens?: number;
    provider?: string;
    model?: string;
    cost?: number;
  }>;
  toolCalls: Array<{
    id: string;
    name: string;
    input: Record<string, unknown>;
    timestamp: string;
  }>;
  totalCost: number;
  tokensInput: number;
  tokensOutput: number;
}

/**
 * Clawdbot/OpenClaw Provider Implementation
 * Handles parsing and monitoring Clawdbot agent sessions
 */
export class ClawdbotProvider implements AIProvider {
  id = 'clawdbot';
  name = 'Clawdbot / OpenClaw';
  icon = '/icons/clawdbot.svg';

  private configPath: string;
  private watchers: Set<(event: SessionEvent) => void> = new Set();

  constructor(configPath?: string) {
    this.configPath = configPath || this.getDefaultConfigPath();
  }

  async initialize(): Promise<void> {
    if (!fs.existsSync(this.configPath)) {
      console.log(`Clawdbot config not found: ${this.configPath}`);
      return;
    }
    console.log(`✓ Clawdbot provider initialized (${this.configPath})`);
  }

  async detectInstallation(): Promise<boolean> {
    return fs.existsSync(this.configPath);
  }

  getConfigPath(): string {
    return this.configPath;
  }

  private getDefaultConfigPath(): string {
    const home = os.homedir();
    return path.join(home, '.clawdbot');
  }

  /**
   * Get agents directory path
   */
  private getAgentsPath(): string {
    return path.join(this.configPath, 'agents');
  }

  /**
   * Scan for all session files across all agents
   */
  private async scanSessionFiles(): Promise<Array<{ filePath: string; agent: string }>> {
    const agentsPath = this.getAgentsPath();

    if (!fs.existsSync(agentsPath)) {
      return [];
    }

    const sessionFiles: Array<{ filePath: string; agent: string }> = [];
    const agentDirs = fs.readdirSync(agentsPath, { withFileTypes: true });

    for (const agentDir of agentDirs) {
      if (!agentDir.isDirectory()) continue;

      const sessionsPath = path.join(agentsPath, agentDir.name, 'sessions');
      if (!fs.existsSync(sessionsPath)) continue;

      const files = fs.readdirSync(sessionsPath);

      for (const file of files) {
        if (file.endsWith('.jsonl')) {
          sessionFiles.push({
            filePath: path.join(sessionsPath, file),
            agent: agentDir.name,
          });
        }
      }
    }

    return sessionFiles;
  }

  /**
   * Parse a Clawdbot session file
   */
  async parseSessionFile(filePath: string): Promise<ParsedClawdbotSession> {
    const content = await fs.promises.readFile(filePath, 'utf-8');
    const lines = content.split('\n').filter((line) => line.trim());

    const parsed: ParsedClawdbotSession = {
      id: path.basename(filePath, '.jsonl'),
      messages: [],
      toolCalls: [],
      totalCost: 0,
      tokensInput: 0,
      tokensOutput: 0,
    };

    for (const line of lines) {
      try {
        const entry: ClawdbotMessage = JSON.parse(line);

        // Extract session metadata
        if (entry.type === 'session') {
          parsed.id = entry.id || parsed.id;
          parsed.cwd = entry.cwd;
        }

        // Extract messages
        if (entry.type === 'message' && entry.message) {
          const msg = entry.message;
          let msgType: 'user' | 'assistant' | 'toolResult' = 'user';

          if (msg.role === 'assistant') msgType = 'assistant';
          else if (msg.role === 'toolResult') msgType = 'toolResult';
          else if (msg.role === 'user') msgType = 'user';

          parsed.messages.push({
            uuid: entry.id,
            parentUuid: entry.parentId,
            type: msgType,
            timestamp: entry.timestamp,
            content: msg.content,
            tokens: msg.usage?.totalTokens,
            provider: msg.provider,
            model: msg.model,
            cost: msg.usage?.cost?.total,
          });

          // Accumulate costs and tokens
          if (msg.usage) {
            parsed.tokensInput += msg.usage.input || 0;
            parsed.tokensOutput += msg.usage.output || 0;
            if (msg.usage.cost?.total) {
              parsed.totalCost += msg.usage.cost.total;
            }
          }

          // Extract tool calls from assistant content
          if (msg.role === 'assistant' && Array.isArray(msg.content)) {
            for (const item of msg.content) {
              if (typeof item === 'object' && item !== null && 'type' in item) {
                const contentItem = item as { type: string; id?: string; name?: string; arguments?: Record<string, unknown> };
                if (contentItem.type === 'toolCall' && contentItem.id && contentItem.name) {
                  parsed.toolCalls.push({
                    id: contentItem.id,
                    name: contentItem.name,
                    input: contentItem.arguments || {},
                    timestamp: entry.timestamp,
                  });
                }
              }
            }
          }
        }
      } catch (e) {
        // Skip malformed lines
      }
    }

    return parsed;
  }

  /**
   * Extract project info from session
   */
  private extractProjectInfo(parsed: ParsedClawdbotSession, agent: string): { name: string; path: string } {
    const cwd = parsed.cwd || '';
    const projectName = cwd ? path.basename(cwd) : agent;

    return {
      name: projectName,
      path: cwd || agent,
    };
  }

  /**
   * Ingest parsed session into database
   */
  async ingestSession(filePath: string, parsed: ParsedClawdbotSession, agent: string): Promise<string> {
    const projectInfo = this.extractProjectInfo(parsed, agent);
    const sessionId = `clawdbot-${agent}-${parsed.id}`;

    // Get file modification time
    const fileStats = await fs.promises.stat(filePath);
    const lastActivity = fileStats.mtime;
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    const isRecentlyModified = lastActivity.getTime() > fiveMinutesAgo;

    // Check if session already exists
    const existing = await db.select().from(sessions).where(eq(sessions.id, sessionId)).limit(1);

    const timestamps = parsed.messages
      .map((m) => new Date(m.timestamp).getTime())
      .filter((t) => !Number.isNaN(t));

    const startTime = timestamps.length > 0 ? new Date(Math.min(...timestamps)) : new Date();
    const endTime = timestamps.length > 0 ? new Date(Math.max(...timestamps)) : undefined;

    const sessionData = {
      endTime,
      lastActivity,
      status: (isRecentlyModified ? 'active' : 'completed') as 'active' | 'completed' | 'error',
      messageCount: parsed.messages.length,
      tokensInput: parsed.tokensInput,
      tokensOutput: parsed.tokensOutput,
      estimatedCost: parsed.totalCost,
      cwd: parsed.cwd || null,
      toolUsageCount: parsed.toolCalls.length,
      updatedAt: new Date(),
    };

    if (existing.length > 0) {
      await db.update(sessions).set(sessionData).where(eq(sessions.id, sessionId));
    } else {
      await db.insert(sessions).values({
        id: sessionId,
        providerId: this.id,
        projectPath: projectInfo.path,
        projectName: projectInfo.name,
        startTime,
        ...sessionData,
      });
    }

    // Batch insert messages (chunks of 100)
    if (parsed.messages.length > 0) {
      const messageChunks = this.chunkArray(parsed.messages, 100);
      for (const chunk of messageChunks) {
        const messageValues = chunk.map((msg) => ({
          id: randomUUID(),
          sessionId,
          parentId: msg.parentUuid || null,
          role: msg.type,
          content: JSON.stringify(msg.content),
          timestamp: new Date(msg.timestamp),
          tokens: msg.tokens || 0,
        }));

        try {
          await db.insert(messages).values(messageValues);
        } catch (_err) {
          // Ignore duplicate errors
        }
      }
    }

    // Batch insert tool calls
    if (parsed.toolCalls.length > 0) {
      const toolChunks = this.chunkArray(parsed.toolCalls, 100);
      for (const chunk of toolChunks) {
        const toolValues = chunk.map((tool) => ({
          messageId: sessionId,
          toolName: tool.name,
          parameters: JSON.stringify(tool.input),
          success: true,
          timestamp: new Date(tool.timestamp),
        }));

        try {
          await db.insert(toolCalls).values(toolValues);
        } catch (_err) {
          // Ignore duplicate errors
        }
      }
    }

    return sessionId;
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  async listSessions(filter?: SessionFilter): Promise<Session[]> {
    const conditions = [eq(sessions.providerId, this.id)];

    if (filter?.status) {
      conditions.push(eq(sessions.status, filter.status));
    }
    if (filter?.projectPath) {
      conditions.push(eq(sessions.projectPath, filter.projectPath));
    }
    if (filter?.dateRange) {
      conditions.push(gte(sessions.startTime, filter.dateRange.start));
      conditions.push(lte(sessions.startTime, filter.dateRange.end));
    }

    const where = and(...conditions);

    return await db
      .select()
      .from(sessions)
      .where(where)
      .orderBy(desc(sessions.startTime))
      .limit(100);
  }

  async getSession(id: string): Promise<SessionDetail> {
    const session = await db.select().from(sessions).where(eq(sessions.id, id)).limit(1);

    if (!session[0]) {
      throw new Error(`Session not found: ${id}`);
    }

    const sessionMessages = await db
      .select()
      .from(messages)
      .where(eq(messages.sessionId, id))
      .orderBy(messages.timestamp);

    const sessionToolCalls = await db
      .select()
      .from(toolCalls)
      .innerJoin(messages, eq(toolCalls.messageId, messages.id))
      .where(eq(messages.sessionId, id));

    return {
      ...session[0],
      messages: sessionMessages,
      toolCalls: sessionToolCalls.map((tc) => tc.tool_calls),
      fileSnapshots: [],
      errors: [],
    };
  }

  watchSessions(callback: (event: SessionEvent) => void): Disposable {
    this.watchers.add(callback);
    return {
      dispose: () => {
        this.watchers.delete(callback);
      },
    };
  }

  async getUsageStats(_range: DateRange): Promise<UsageStats> {
    return {
      totalSessions: 0,
      totalTokensInput: 0,
      totalTokensOutput: 0,
      totalTokens: 0,
      estimatedCost: 0,
      activeTime: 0,
      toolUsageBreakdown: {},
      dailyBreakdown: [],
      topProjects: [],
    };
  }

  async getTokenMetrics(): Promise<TokenMetrics> {
    return {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      averagePerSession: 0,
      peakUsage: { date: new Date(), tokens: 0 },
    };
  }

  getCostEstimate(usage: Usage): number {
    // Use actual costs from the session data, or estimate
    const INPUT_COST_PER_TOKEN = 0.000003;
    const OUTPUT_COST_PER_TOKEN = 0.000015;
    return usage.inputTokens * INPUT_COST_PER_TOKEN + usage.outputTokens * OUTPUT_COST_PER_TOKEN;
  }

  async detectRunningProcesses(): Promise<RunningProcess[]> {
    return [];
  }

  async launchSession(_config: LaunchConfig): Promise<ProcessHandle> {
    throw new Error('Not implemented');
  }

  /**
   * Full sync: scan and ingest all sessions
   */
  async fullSync(syncId?: string): Promise<{ processed: number; errors: number }> {
    const { syncStatusManager } = await import('@/lib/services/sync-status');

    const trackingId = syncId || syncStatusManager.startSync(this.id);

    try {
      syncStatusManager.updateSync(trackingId, {
        phase: 'scanning',
        currentStep: 'Scanning Clawdbot sessions...',
      });

      const sessionFiles = await this.scanSessionFiles();

      syncStatusManager.updateSync(trackingId, {
        totalFiles: sessionFiles.length,
        currentStep: `Found ${sessionFiles.length} sessions`,
      });
      syncStatusManager.addLog(trackingId, 'info', `Found ${sessionFiles.length} Clawdbot session files`);

      let processed = 0;
      let errors = 0;

      syncStatusManager.updateSync(trackingId, {
        phase: 'parsing',
        currentStep: 'Processing sessions...',
      });

      for (const { filePath, agent } of sessionFiles) {
        const fileName = path.basename(filePath);

        try {
          syncStatusManager.updateSync(trackingId, {
            currentStep: `Parsing ${agent}/${fileName}...`,
          });

          const parsed = await this.parseSessionFile(filePath);

          syncStatusManager.updateSync(trackingId, {
            phase: 'ingesting',
            currentStep: `Ingesting ${agent}/${fileName}...`,
          });

          await this.ingestSession(filePath, parsed, agent);
          processed++;

          syncStatusManager.updateSync(trackingId, {
            processedFiles: processed,
            successCount: processed,
          });
        } catch (error: any) {
          console.error(`Error processing ${filePath}:`, error);
          syncStatusManager.addError(trackingId, fileName, error.message);
          errors++;

          syncStatusManager.updateSync(trackingId, {
            processedFiles: processed + errors,
          });
        }
      }

      syncStatusManager.addLog(
        trackingId,
        'info',
        `Clawdbot sync complete: ${processed} processed, ${errors} errors`
      );

      if (!syncId) {
        syncStatusManager.completeSync(trackingId, errors === 0 ? 'completed' : 'error');
      }

      return { processed, errors };
    } catch (error: any) {
      syncStatusManager.addLog(trackingId, 'error', `Clawdbot sync failed: ${error.message}`);
      if (!syncId) {
        syncStatusManager.completeSync(trackingId, 'error');
      }
      throw error;
    }
  }
}

// Export singleton instance
export const clawdbotProvider = new ClawdbotProvider();
