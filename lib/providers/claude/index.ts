import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { and, desc, eq, gte, lte } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { messages, sessions, toolCalls } from '@/lib/db/schema';
import type { ParsedSession, ParseJobData } from '@/lib/workers/parser.worker';
import { createParserPool, type WorkerPool } from '@/lib/workers/pool';
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

/**
 * Claude AI Provider Implementation
 * Handles parsing, monitoring, and managing Claude Code sessions
 */
export class ClaudeProvider implements AIProvider {
  id = 'claude';
  name = 'Claude Code';
  icon = '/icons/claude.svg';

  private configPath: string;
  private parserPool: WorkerPool<ParseJobData, ParsedSession> | null = null;
  private watchers: Set<(event: SessionEvent) => void> = new Set();

  constructor(configPath?: string) {
    this.configPath = configPath || this.getDefaultConfigPath();
  }

  async initialize(): Promise<void> {
    // Lazy initialize parser pool
    if (!this.parserPool) {
      this.parserPool = createParserPool(4) as WorkerPool<ParseJobData, ParsedSession>;
    }

    // Ensure config directory exists
    if (!fs.existsSync(this.configPath)) {
      throw new Error(`Claude config directory not found: ${this.configPath}`);
    }

    console.log(`✓ Claude provider initialized (${this.configPath})`);
  }

  async detectInstallation(): Promise<boolean> {
    return fs.existsSync(this.configPath);
  }

  getConfigPath(): string {
    return this.configPath;
  }

  private getDefaultConfigPath(): string {
    const home = os.homedir();
    return path.join(home, '.claude');
  }

  /**
   * Get projects directory path
   */
  private getProjectsPath(): string {
    return path.join(this.configPath, 'projects');
  }

  /**
   * Scan for all session files
   */
  private async scanSessionFiles(): Promise<string[]> {
    const projectsPath = this.getProjectsPath();

    if (!fs.existsSync(projectsPath)) {
      return [];
    }

    const sessionFiles: string[] = [];
    const projectDirs = fs.readdirSync(projectsPath, { withFileTypes: true });

    for (const projectDir of projectDirs) {
      if (!projectDir.isDirectory()) continue;

      const projectPath = path.join(projectsPath, projectDir.name);
      const files = fs.readdirSync(projectPath);

      for (const file of files) {
        if (file.endsWith('.jsonl')) {
          sessionFiles.push(path.join(projectPath, file));
        }
      }
    }

    return sessionFiles;
  }

  /**
   * Parse a session file using worker pool
   */
  async parseSessionFile(filePath: string): Promise<ParsedSession> {
    if (!this.parserPool) {
      throw new Error('Parser pool not initialized');
    }

    const job = {
      id: randomUUID(),
      data: { sessionPath: filePath },
    };

    return await this.parserPool.execute(job);
  }

  /**
   * Extract project info from file path
   */
  private extractProjectInfo(filePath: string): { name: string; path: string } {
    const projectsPath = this.getProjectsPath();
    const relativePath = path.relative(projectsPath, filePath);

    // Get the first directory name (the project folder)
    // Claude stores paths like "C--git-myproject" for "C:/git/myproject"
    const projectDirName = relativePath.split(path.sep)[0];

    // Restore the actual path: replace -- with : and - with /
    const restoredPath = projectDirName.replace(/--/g, ':\\').replace(/-/g, '\\');

    // Project name is just the last part of the path
    const projectName = path.basename(restoredPath);

    return {
      name: projectName, // Just the project folder name
      path: restoredPath, // Full restored path (C:\git\myproject)
    };
  }

  /**
   * Extract session ID from filename
   */
  private extractSessionId(filePath: string): string {
    const filename = path.basename(filePath, '.jsonl');
    return filename;
  }

  /**
   * Ingest parsed session into database with batch inserts
   */
  async ingestSession(filePath: string, parsed: ParsedSession): Promise<string> {
    const projectInfo = this.extractProjectInfo(filePath);
    const sessionId = this.extractSessionId(filePath);

    // Get file modification time for active status detection
    const fileStats = await fs.promises.stat(filePath);
    const lastActivity = fileStats.mtime;
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    const isRecentlyModified = lastActivity.getTime() > fiveMinutesAgo;

    // Check if session already exists
    const existing = await db.select().from(sessions).where(eq(sessions.id, sessionId)).limit(1);

    const stats = this.calculateSessionStats(parsed);

    // Extract metadata from parsed data
    const metadata: Record<string, unknown> = {};
    const lastSummary =
      parsed.summaries && parsed.summaries.length > 0
        ? parsed.summaries[parsed.summaries.length - 1].summary
        : null;

    const sessionData = {
      endTime: stats.endTime,
      lastActivity,
      status: isRecentlyModified ? 'active' : stats.status,
      messageCount: stats.messageCount,
      tokensInput: stats.tokensInput,
      tokensOutput: stats.tokensOutput,
      estimatedCost: stats.estimatedCost,
      cwd: (metadata.cwd as string) || null,
      gitBranch: (metadata.gitBranch as string) || null,
      version: (metadata.version as string) || null,
      lastSummary,
      filesModified: JSON.stringify(parsed.filesModified || []),
      foldersAccessed: JSON.stringify(parsed.foldersAccessed || []),
      fileCount: parsed.filesModified?.length || 0,
      toolUsageCount: parsed.toolCalls.length,
      updatedAt: new Date(),
    };

    if (existing.length > 0) {
      // Update existing session
      await db.update(sessions).set(sessionData).where(eq(sessions.id, sessionId));
    } else {
      // Insert new session
      await db.insert(sessions).values({
        id: sessionId,
        providerId: this.id,
        projectPath: projectInfo.path, // Full Windows path (C:\git\project)
        projectName: projectInfo.name, // Just the project folder name
        startTime: stats.startTime,
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

        // Insert batch, ignore conflicts
        try {
          await db.insert(messages).values(messageValues);
        } catch (_err) {
          // Ignore duplicate errors
          console.warn(`Some messages already exist for session ${sessionId}`);
        }
      }
    }

    // Batch insert tool calls (chunks of 100)
    if (parsed.toolCalls.length > 0) {
      const toolChunks = this.chunkArray(parsed.toolCalls, 100);
      for (const chunk of toolChunks) {
        const toolValues = chunk.map((tool) => ({
          messageId: sessionId, // Note: we don't have message ID from worker
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

  private calculateSessionStats(parsed: ParsedSession) {
    const timestamps = parsed.messages
      .map((m) => new Date(m.timestamp).getTime())
      .filter((t) => !Number.isNaN(t));

    const startTime = timestamps.length > 0 ? new Date(Math.min(...timestamps)) : new Date();
    const endTime = timestamps.length > 0 ? new Date(Math.max(...timestamps)) : undefined;

    const messageCount = parsed.messages.length;

    let tokensInput = 0;
    let tokensOutput = 0;

    for (const msg of parsed.messages) {
      if (msg.type === 'user') {
        tokensInput += msg.tokens || 0;
      } else {
        tokensOutput += msg.tokens || 0;
      }
    }

    const estimatedCost = this.getCostEstimate({
      inputTokens: tokensInput,
      outputTokens: tokensOutput,
    });

    return {
      startTime,
      endTime,
      status: (endTime ? 'completed' : 'active') as 'active' | 'completed' | 'error',
      messageCount,
      tokensInput,
      tokensOutput,
      estimatedCost,
    };
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
    // This will be implemented with analytics service
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
    // Claude 3.5 Sonnet pricing (as of design)
    const INPUT_COST_PER_TOKEN = 0.000003; // $3 per million
    const OUTPUT_COST_PER_TOKEN = 0.000015; // $15 per million

    return usage.inputTokens * INPUT_COST_PER_TOKEN + usage.outputTokens * OUTPUT_COST_PER_TOKEN;
  }

  async detectRunningProcesses(): Promise<RunningProcess[]> {
    // Will be implemented in Phase 4 with process monitor
    return [];
  }

  async launchSession(_config: LaunchConfig): Promise<ProcessHandle> {
    // Will be implemented in Phase 7
    throw new Error('Not implemented yet');
  }

  /**
   * Full sync: scan and ingest all sessions with progress tracking
   */
  async fullSync(syncId?: string): Promise<{ processed: number; errors: number }> {
    const { syncStatusManager } = await import('@/lib/services/sync-status');

    // Create sync tracking if ID not provided
    const trackingId = syncId || syncStatusManager.startSync(this.id);

    try {
      // Phase 1: Scanning
      syncStatusManager.updateSync(trackingId, {
        phase: 'scanning',
        currentStep: 'Scanning session files...',
      });

      const sessionFiles = await this.scanSessionFiles();

      syncStatusManager.updateSync(trackingId, {
        totalFiles: sessionFiles.length,
        currentStep: `Found ${sessionFiles.length} sessions`,
      });
      syncStatusManager.addLog(trackingId, 'info', `Found ${sessionFiles.length} session files`);

      let processed = 0;
      let errors = 0;

      // Phase 2: Parsing and Ingesting
      syncStatusManager.updateSync(trackingId, {
        phase: 'parsing',
        currentStep: 'Processing sessions...',
      });

      for (const filePath of sessionFiles) {
        const fileName = path.basename(filePath);

        try {
          syncStatusManager.updateSync(trackingId, {
            currentStep: `Parsing ${fileName}...`,
          });

          const parsed = await this.parseSessionFile(filePath);

          syncStatusManager.updateSync(trackingId, {
            phase: 'ingesting',
            currentStep: `Ingesting ${fileName}...`,
          });

          await this.ingestSession(filePath, parsed);
          processed++;

          syncStatusManager.updateSync(trackingId, {
            processedFiles: processed,
            successCount: processed,
          });

          if (processed % 10 === 0) {
            syncStatusManager.addLog(
              trackingId,
              'info',
              `Processed ${processed}/${sessionFiles.length} sessions`
            );
          }
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
        `Sync complete: ${processed} processed, ${errors} errors`
      );

      if (!syncId) {
        syncStatusManager.completeSync(trackingId, errors === 0 ? 'completed' : 'error');
      }

      return { processed, errors };
    } catch (error: any) {
      syncStatusManager.addLog(trackingId, 'error', `Sync failed: ${error.message}`);
      if (!syncId) {
        syncStatusManager.completeSync(trackingId, 'error');
      }
      throw error;
    }
  }

  async terminate() {
    if (this.parserPool) {
      await this.parserPool.terminate();
    }
  }
}

// Export singleton instance
export const claudeProvider = new ClaudeProvider();

// Types for worker
interface ParsedMessage {
  uuid: string;
  parentUuid?: string;
  sessionId: string;
  type: 'user' | 'assistant';
  timestamp: string;
  content: unknown;
  tokens?: number;
  toolCalls?: Array<{
    id: string;
    name: string;
    input: Record<string, unknown>;
    timestamp: string;
  }>;
}
