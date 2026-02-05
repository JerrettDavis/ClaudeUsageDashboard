import { exec } from 'child_process';
import { promisify } from 'util';
import { eventBus } from './event-bus';

const execAsync = promisify(exec);

export interface RunningProcess {
  pid: number;
  command: string;
  cwd?: string;
  sessionId?: string;
  startTime: Date;
}

export class ProcessMonitorService {
  private isRunning = false;
  private interval: NodeJS.Timeout | null = null;
  private knownProcesses: Map<number, RunningProcess> = new Map();
  private pollIntervalMs = 2000;

  start() {
    if (this.isRunning) {
      console.log('[ProcessMonitor] Already running');
      return;
    }

    console.log('[ProcessMonitor] Starting...');
    this.isRunning = true;
    this.poll(); // Initial poll
    this.interval = setInterval(() => this.poll(), this.pollIntervalMs);
    console.log('[ProcessMonitor] Started');
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    this.isRunning = false;
    this.knownProcesses.clear();
    console.log('[ProcessMonitor] Stopped');
  }

  private async poll() {
    try {
      const processes = await this.detectClaudeProcesses();
      
      // Detect new processes
      for (const proc of processes) {
        if (!this.knownProcesses.has(proc.pid)) {
          console.log(`[ProcessMonitor] New process detected: PID ${proc.pid}`);
          this.knownProcesses.set(proc.pid, proc);
          
          eventBus.emitProcessEvent({
            type: 'process:start',
            pid: proc.pid,
            sessionId: proc.sessionId,
            cwd: proc.cwd,
            data: proc,
            timestamp: Date.now(),
          });
        } else {
          // Process still running
          eventBus.emitProcessEvent({
            type: 'process:running',
            pid: proc.pid,
            sessionId: proc.sessionId,
            cwd: proc.cwd,
            data: proc,
            timestamp: Date.now(),
          });
        }
      }

      // Detect ended processes
      const currentPids = new Set(processes.map((p) => p.pid));
      for (const [pid, proc] of this.knownProcesses.entries()) {
        if (!currentPids.has(pid)) {
          console.log(`[ProcessMonitor] Process ended: PID ${pid}`);
          this.knownProcesses.delete(pid);
          
          eventBus.emitProcessEvent({
            type: 'process:end',
            pid,
            sessionId: proc.sessionId,
            cwd: proc.cwd,
            data: proc,
            timestamp: Date.now(),
          });
        }
      }
    } catch (error) {
      console.error('[ProcessMonitor] Error during poll:', error);
    }
  }

  private async detectClaudeProcesses(): Promise<RunningProcess[]> {
    const isWindows = process.platform === 'win32';
    
    try {
      if (isWindows) {
        return await this.detectWindowsProcesses();
      } else {
        return await this.detectUnixProcesses();
      }
    } catch (error) {
      console.error('[ProcessMonitor] Error detecting processes:', error);
      return [];
    }
  }

  private async detectWindowsProcesses(): Promise<RunningProcess[]> {
    try {
      // Use Get-Process PowerShell command instead of wmic
      const { stdout } = await execAsync(
        'powershell -Command "Get-Process | Where-Object {$_.ProcessName -like \'*node*\' -or $_.ProcessName -like \'*claude*\' -or $_.ProcessName -like \'*copilot*\'} | Select-Object Id,ProcessName,Path | ConvertTo-Json"',
        { maxBuffer: 1024 * 1024 }
      );

      const processes: RunningProcess[] = [];
      
      if (!stdout.trim()) return processes;

      const procs = JSON.parse(stdout);
      const procArray = Array.isArray(procs) ? procs : [procs];

      for (const proc of procArray) {
        if (!proc.Id || !proc.Path) continue;

        processes.push({
          pid: proc.Id,
          command: proc.Path,
          cwd: undefined, // Will try to get from session file
          sessionId: undefined,
          startTime: new Date(),
        });
      }

      return processes;
    } catch (error) {
      console.error('[ProcessMonitor] Windows detection failed:', error);
      return [];
    }
  }

  private async detectUnixProcesses(): Promise<RunningProcess[]> {
    try {
      // Use ps to find Claude CLI processes
      const { stdout } = await execAsync(
        'ps aux | grep -E "(claude|copilot)" | grep -v grep',
        { maxBuffer: 1024 * 1024 }
      );

      const processes: RunningProcess[] = [];
      const lines = stdout.split('\n').filter((line) => line.trim());

      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        if (parts.length < 11) continue;

        const pid = parseInt(parts[1], 10);
        if (isNaN(pid)) continue;

        const command = parts.slice(10).join(' ');
        
        // Extract working directory (might need lsof or pwdx)
        let cwd: string | undefined;
        try {
          const { stdout: cwdOut } = await execAsync(`pwdx ${pid} 2>/dev/null || lsof -p ${pid} 2>/dev/null | grep cwd`);
          const cwdMatch = cwdOut.match(/:\s*(.+)/);
          if (cwdMatch) {
            cwd = cwdMatch[1].trim();
          }
        } catch {
          // CWD detection failed, ignore
        }

        processes.push({
          pid,
          command,
          cwd,
          sessionId: this.extractSessionIdFromCommand(command, cwd),
          startTime: new Date(),
        });
      }

      return processes;
    } catch (error) {
      console.error('[ProcessMonitor] Unix detection failed:', error);
      return [];
    }
  }

  private extractSessionIdFromCommand(command: string, cwd?: string): string | undefined {
    // Try to extract session ID from command line or working directory
    // Claude sessions typically have UUID-like identifiers
    const uuidRegex = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
    
    const commandMatch = command.match(uuidRegex);
    if (commandMatch) return commandMatch[0];
    
    if (cwd) {
      const cwdMatch = cwd.match(uuidRegex);
      if (cwdMatch) return cwdMatch[0];
    }
    
    return undefined;
  }

  getRunningProcesses(): RunningProcess[] {
    return Array.from(this.knownProcesses.values());
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      activeProcesses: this.knownProcesses.size,
      pollInterval: this.pollIntervalMs,
    };
  }
}

// Singleton instance
export const processMonitor = new ProcessMonitorService();
