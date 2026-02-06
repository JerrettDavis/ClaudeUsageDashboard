import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { eventBus } from './event-bus';
import { formatMessageAsTerminal } from './message-formatter';

interface FileState {
  path: string;
  lineCount: number;
  lastModified: number;
}

export class FileWatcherService {
  private isRunning = false;
  private watchPaths: { path: string; provider: string; scanFunc: (path: string) => Promise<string[]> }[] = [];
  private fileStates: Map<string, FileState> = new Map();
  private pollInterval: NodeJS.Timeout | null = null;
  private readonly POLL_INTERVAL_MS = 1000; // Poll every 1 second
  private seenSessions: Set<string> = new Set(); // Track sessions we've already emitted session:new for

  constructor() {
    const homeDir = process.env.HOME || process.env.USERPROFILE || '';
    
    // Claude Code sessions
    this.watchPaths.push({
      path: join(homeDir, '.claude', 'projects').replace(/\\/g, '/'),
      provider: 'claude',
      scanFunc: this.scanClaudeDir.bind(this),
    });
    
    // Clawdbot/OpenClaw sessions
    this.watchPaths.push({
      path: join(homeDir, '.clawdbot', 'agents').replace(/\\/g, '/'),
      provider: 'clawdbot',
      scanFunc: this.scanClawdbotDir.bind(this),
    });
  }

  async start() {
    if (this.isRunning) {
      console.log('[FileWatcher] Already running');
      return;
    }

    const activePaths = this.watchPaths.map(p => p.path).join(', ');
    console.log(`[FileWatcher] Starting manual polling on: ${activePaths}`);

    // Initial scan
    await this.scanAndInitialize();

    // Start polling
    this.pollInterval = setInterval(() => {
      this.pollForChanges().catch((error) => {
        console.error('[FileWatcher] Polling error:', error);
      });
    }, this.POLL_INTERVAL_MS);

    this.isRunning = true;
    console.log(`[FileWatcher] Polling started, tracking ${this.fileStates.size} files`);
  }

  stop() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    this.isRunning = false;
    this.fileStates.clear();
    console.log('[FileWatcher] Stopped');
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      watchPaths: this.watchPaths.map(p => p.path),
      watchedFiles: this.fileStates.size,
    };
  }

  private async scanAndInitialize() {
    for (const watchConfig of this.watchPaths) {
      try {
        const files = await watchConfig.scanFunc(watchConfig.path);
        console.log(`[FileWatcher] Found ${files.length} ${watchConfig.provider} session files`);
        
        for (const filePath of files) {
          await this.initializeFile(filePath, watchConfig.provider);
        }
      } catch (error) {
        console.log(`[FileWatcher] ${watchConfig.provider} path not accessible: ${watchConfig.path}`);
      }
    }
    console.log(`[FileWatcher] Initialized ${this.fileStates.size} total files`);
  }

  // Scan Claude Code project directories
  private async scanClaudeDir(basePath: string): Promise<string[]> {
    const files: string[] = [];
    const projectDirs = await readdir(basePath.replace(/\//g, '\\'));
    
    for (const dir of projectDirs) {
      const dirPath = join(basePath.replace(/\//g, '\\'), dir);
      try {
        const dirFiles = await readdir(dirPath);
        const jsonlFiles = dirFiles.filter((f) => f.endsWith('.jsonl'));
        
        for (const file of jsonlFiles) {
          files.push(join(dirPath, file).replace(/\\/g, '/'));
        }
      } catch (_error) {
        // Skip directories we can't read
      }
    }
    return files;
  }

  // Scan Clawdbot agent session directories
  private async scanClawdbotDir(basePath: string): Promise<string[]> {
    const files: string[] = [];
    const agentDirs = await readdir(basePath.replace(/\//g, '\\'));
    
    for (const agent of agentDirs) {
      const sessionsPath = join(basePath.replace(/\//g, '\\'), agent, 'sessions');
      try {
        const sessionFiles = await readdir(sessionsPath);
        const jsonlFiles = sessionFiles.filter((f) => f.endsWith('.jsonl'));
        
        for (const file of jsonlFiles) {
          files.push(join(sessionsPath, file).replace(/\\/g, '/'));
        }
      } catch (_error) {
        // Skip if sessions dir doesn't exist
      }
    }
    return files;
  }

  private async initializeFile(filePath: string, provider: string = 'claude') {
    try {
      const normalizedPath = filePath.replace(/\//g, '\\');
      const stats = await stat(normalizedPath);
      const content = await readFile(normalizedPath, 'utf-8');
      const lines = content.split('\n').filter((line) => line.trim());

      this.fileStates.set(filePath, {
        path: filePath,
        lineCount: lines.length,
        lastModified: stats.mtimeMs,
      });

      console.log(`[FileWatcher] 📝 [${provider}] Tracking ${filePath.split('/').pop()} (${lines.length} lines)`);

      // Mark this session as seen so we can detect new sessions later
      const sessionId = this.extractSessionId(filePath, provider);
      if (sessionId) {
        this.seenSessions.add(sessionId);
      }
    } catch (error) {
      console.error(`[FileWatcher] Error initializing ${filePath}:`, error);
    }
  }

  private async pollForChanges() {
    for (const [filePath, state] of this.fileStates.entries()) {
      try {
        const normalizedPath = filePath.replace(/\//g, '\\');
        const stats = await stat(normalizedPath);

        // Check if file was modified
        if (stats.mtimeMs > state.lastModified) {
          console.log(`[FileWatcher] 🔥 Change detected: ${filePath.split('/').pop()}`);
          await this.handleFileChanged(filePath, state);
        }
      } catch (_error) {
        // File might have been deleted
        this.fileStates.delete(filePath);
      }
    }
  }

  private async handleFileChanged(filePath: string, state: FileState) {
    try {
      const normalizedPath = filePath.replace(/\//g, '\\');
      const stats = await stat(normalizedPath);
      const content = await readFile(normalizedPath, 'utf-8');
      const lines = content.split('\n').filter((line) => line.trim());

      const newLineCount = lines.length;
      const oldLineCount = state.lineCount;

      if (newLineCount <= oldLineCount) {
        // No new lines
        state.lastModified = stats.mtimeMs;
        return;
      }

      const newLines = lines.slice(oldLineCount);
      console.log(`[FileWatcher] ✓ ${newLines.length} new lines in ${filePath.split('/').pop()}`);

      // Update state
      state.lineCount = newLineCount;
      state.lastModified = stats.mtimeMs;

      // Extract session ID
      const sessionId = this.extractSessionId(filePath);
      if (!sessionId) {
        console.log(`[FileWatcher] Could not extract session ID from ${filePath}`);
        return;
      }

      // Emit session:new if this is the first time we see this session with activity
      if (!this.seenSessions.has(sessionId)) {
        this.seenSessions.add(sessionId);
        console.log(`[FileWatcher] 🆕 New session detected: ${sessionId}`);
        eventBus.emitSessionEvent({
          type: 'session:new',
          sessionId,
          data: {},
          timestamp: Date.now(),
        });
      }

      // Parse and emit new lines
      let hasEndMarker = false;
      for (const line of newLines) {
        try {
          const entry = JSON.parse(line);

          // Check for session end markers
          if (entry.type === 'end' || entry.event === 'end' || entry.status === 'completed') {
            hasEndMarker = true;
          }

          // Format message as terminal output
          const terminalLines = formatMessageAsTerminal(entry);

          if (terminalLines.length > 0) {
            console.log(
              `[FileWatcher] ✓ Emitting ${entry.type} message with ${terminalLines.length} terminal lines`
            );

            eventBus.emitMessageEvent({
              type: 'message:new',
              sessionId,
              message: entry,
              terminalOutput: terminalLines,
              timestamp: Date.now(),
            });
          }
        } catch (parseError) {
          console.error(`[FileWatcher] Failed to parse line:`, parseError);
        }
      }

      // Emit session:end if we detected an end marker
      if (hasEndMarker) {
        console.log(`[FileWatcher] 🏁 Session ended: ${sessionId}`);
        eventBus.emitSessionEvent({
          type: 'session:ended',
          sessionId,
          data: {},
          timestamp: Date.now(),
        });
        this.seenSessions.delete(sessionId);
      } else {
        // Otherwise emit session:update
        eventBus.emitSessionEvent({
          type: 'session:update',
          sessionId,
          data: {},
          timestamp: Date.now(),
        });
      }
    } catch (error) {
      console.error(`[FileWatcher] Error handling file change for ${filePath}:`, error);
    }
  }

  private extractSessionId(filePath: string, provider: string = 'claude'): string | null {
    // Extract filename without .jsonl extension
    const filename = filePath.split('/').pop();
    if (!filename) return null;
    const baseId = filename.replace(/\.jsonl$/, '');
    
    // Prefix with provider for clawdbot to differentiate
    if (provider === 'clawdbot') {
      // Extract agent name from path (e.g., .clawdbot/agents/main/sessions/xxx.jsonl -> main)
      const parts = filePath.split('/');
      const agentsIdx = parts.findIndex(p => p === 'agents');
      const agent = agentsIdx >= 0 && parts[agentsIdx + 1] ? parts[agentsIdx + 1] : 'unknown';
      return `clawdbot-${agent}-${baseId}`;
    }
    
    return baseId;
  }
}

// Singleton instance
export const fileWatcher = new FileWatcherService();
