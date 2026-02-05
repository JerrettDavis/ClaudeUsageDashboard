import { EventEmitter } from 'node:events';

export interface SyncProgress {
  id: string;
  providerId: string;
  status: 'running' | 'completed' | 'error';
  phase: 'scanning' | 'parsing' | 'ingesting' | 'complete';
  currentStep: string;
  totalFiles: number;
  processedFiles: number;
  successCount: number;
  errorCount: number;
  startTime: Date;
  endTime?: Date;
  errors: Array<{ file: string; error: string; timestamp: Date }>;
  logs: Array<{ level: 'info' | 'warn' | 'error'; message: string; timestamp: Date }>;
}

/**
 * Sync Status Manager - tracks ongoing sync operations
 */
class SyncStatusManager extends EventEmitter {
  private activeSyncs = new Map<string, SyncProgress>();
  private completedSyncs: SyncProgress[] = [];
  private maxCompletedHistory = 50;

  /**
   * Start tracking a new sync
   */
  startSync(providerId: string): string {
    const id = `${providerId}-${Date.now()}`;
    const progress: SyncProgress = {
      id,
      providerId,
      status: 'running',
      phase: 'scanning',
      currentStep: 'Initializing...',
      totalFiles: 0,
      processedFiles: 0,
      successCount: 0,
      errorCount: 0,
      startTime: new Date(),
      errors: [],
      logs: [{ level: 'info', message: 'Sync started', timestamp: new Date() }],
    };

    this.activeSyncs.set(id, progress);
    this.emit('sync:start', progress);
    return id;
  }

  /**
   * Update sync progress
   */
  updateSync(id: string, updates: Partial<SyncProgress>) {
    const progress = this.activeSyncs.get(id);
    if (!progress) return;

    Object.assign(progress, updates);
    this.emit('sync:progress', progress);
  }

  /**
   * Add log entry
   */
  addLog(id: string, level: 'info' | 'warn' | 'error', message: string) {
    const progress = this.activeSyncs.get(id);
    if (!progress) return;

    progress.logs.push({ level, message, timestamp: new Date() });
    this.emit('sync:log', { id, level, message });
  }

  /**
   * Add error
   */
  addError(id: string, file: string, error: string) {
    const progress = this.activeSyncs.get(id);
    if (!progress) return;

    progress.errors.push({ file, error, timestamp: new Date() });
    progress.errorCount++;
    this.addLog(id, 'error', `Error processing ${file}: ${error}`);
  }

  /**
   * Complete sync
   */
  completeSync(id: string, status: 'completed' | 'error') {
    const progress = this.activeSyncs.get(id);
    if (!progress) return;

    progress.status = status;
    progress.phase = 'complete';
    progress.endTime = new Date();

    const duration = progress.endTime.getTime() - progress.startTime.getTime();
    this.addLog(id, 'info', `Sync ${status} in ${(duration / 1000).toFixed(1)}s`);

    this.activeSyncs.delete(id);
    this.completedSyncs.unshift(progress);

    // Keep only last N completed syncs
    if (this.completedSyncs.length > this.maxCompletedHistory) {
      this.completedSyncs = this.completedSyncs.slice(0, this.maxCompletedHistory);
    }

    this.emit('sync:complete', progress);
  }

  /**
   * Get sync status
   */
  getSync(id: string): SyncProgress | undefined {
    return this.activeSyncs.get(id) || this.completedSyncs.find((s) => s.id === id);
  }

  /**
   * Get all active syncs
   */
  getActiveSyncs(): SyncProgress[] {
    return Array.from(this.activeSyncs.values());
  }

  /**
   * Get completed syncs
   */
  getCompletedSyncs(limit = 10): SyncProgress[] {
    return this.completedSyncs.slice(0, limit);
  }

  /**
   * Get latest sync for provider
   */
  getLatestSync(providerId: string): SyncProgress | undefined {
    // Check active first
    for (const sync of this.activeSyncs.values()) {
      if (sync.providerId === providerId) return sync;
    }
    // Then completed
    return this.completedSyncs.find((s) => s.providerId === providerId);
  }
}

export const syncStatusManager = new SyncStatusManager();
