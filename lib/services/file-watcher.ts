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
  private watchPath: string;
  private fileStates: Map<string, FileState> = new Map();
  private pollInterval: NodeJS.Timeout | null = null;
  private readonly POLL_INTERVAL_MS = 1000; // Poll every 1 second
  private seenSessions: Set<string> = new Set(); // Track sessions we've already emitted session:new for

  constructor(claudeDir?: string) {
    const homeDir = process.env.HOME || process.env.USERPROFILE || '';
    const basePath = claudeDir || join(homeDir, '.claude', 'projects');
    this.watchPath = basePath.replace(/\\/g, '/');
  }

  async start() {
    if (this.isRunning) {
      console.log('[FileWatcher] Already running');
      return;
    }

    console.log(`[FileWatcher] Starting manual polling on: ${this.watchPath}`);

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
      watchPath: this.watchPath,
      watchedFiles: this.fileStates.size,
    };
  }

  private async scanAndInitialize() {
    try {
      const projectDirs = await readdir(this.watchPath.replace(/\//g, '\\'));
      console.log(`[FileWatcher] Scanning ${projectDirs.length} project directories`);

      for (const dir of projectDirs) {
        const dirPath = join(this.watchPath.replace(/\//g, '\\'), dir);
        try {
          const files = await readdir(dirPath);
          const jsonlFiles = files.filter((f) => f.endsWith('.jsonl'));

          for (const file of jsonlFiles) {
            const filePath = join(dirPath, file).replace(/\\/g, '/');
            await this.initializeFile(filePath);
          }
        } catch (_error) {
          // Skip directories we can't read
        }
      }

      console.log(`[FileWatcher] Initialized ${this.fileStates.size} files`);
    } catch (error) {
      console.error('[FileWatcher] Error scanning directories:', error);
    }
  }

  private async initializeFile(filePath: string) {
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

      console.log(`[FileWatcher] 📝 Tracking ${filePath.split('/').pop()} (${lines.length} lines)`);

      // Mark this session as seen so we can detect new sessions later
      const sessionId = this.extractSessionId(filePath);
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

  private extractSessionId(filePath: string): string | null {
    // Extract filename without .jsonl extension
    const filename = filePath.split('/').pop();
    if (!filename) return null;
    return filename.replace(/\.jsonl$/, '');
  }
}

// Singleton instance
export const fileWatcher = new FileWatcherService();
