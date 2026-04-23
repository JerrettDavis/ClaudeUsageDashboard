import { beforeEach, describe, expect, it, vi } from 'vitest';
import { syncStatusManager, type SyncProgress } from '@/lib/services/sync-status';

interface SyncStatusManagerState {
  activeSyncs: Map<string, SyncProgress>;
  completedSyncs: SyncProgress[];
  maxCompletedHistory: number;
}

function getManagerState() {
  return syncStatusManager as unknown as SyncStatusManagerState;
}

describe('syncStatusManager', () => {
  beforeEach(() => {
    const state = getManagerState();
    state.activeSyncs.clear();
    state.completedSyncs.length = 0;
    state.maxCompletedHistory = 50;
  });

  it('tracks sync progress, logs, and errors', () => {
    const syncId = syncStatusManager.startSync('claude');

    syncStatusManager.updateSync(syncId, {
      phase: 'parsing',
      currentStep: 'Parsing sessions',
      totalFiles: 4,
      processedFiles: 1,
      successCount: 1,
    });
    syncStatusManager.addLog(syncId, 'warn', 'Slow disk read detected');
    syncStatusManager.addError(syncId, 'session-1.jsonl', 'Malformed JSON');

    const progress = syncStatusManager.getSync(syncId);

    expect(progress).toBeDefined();
    expect(progress?.providerId).toBe('claude');
    expect(progress?.status).toBe('running');
    expect(progress?.phase).toBe('parsing');
    expect(progress?.currentStep).toBe('Parsing sessions');
    expect(progress?.totalFiles).toBe(4);
    expect(progress?.processedFiles).toBe(1);
    expect(progress?.successCount).toBe(1);
    expect(progress?.errorCount).toBe(1);
    expect(progress?.errors).toHaveLength(1);
    expect(progress?.errors[0]).toMatchObject({
      file: 'session-1.jsonl',
      error: 'Malformed JSON',
    });
    expect(progress?.logs.map((entry) => entry.message)).toEqual(
      expect.arrayContaining([
        'Sync started',
        'Slow disk read detected',
        'Error processing session-1.jsonl: Malformed JSON',
      ])
    );
  });

  it('moves completed syncs into history and trims the history size', () => {
    const state = getManagerState();
    state.maxCompletedHistory = 2;
    const dateNowSpy = vi
      .spyOn(Date, 'now')
      .mockReturnValueOnce(1000)
      .mockReturnValueOnce(2000)
      .mockReturnValueOnce(3000);

    const firstId = syncStatusManager.startSync('claude');
    syncStatusManager.completeSync(firstId, 'completed');

    const secondId = syncStatusManager.startSync('clawdbot');
    syncStatusManager.completeSync(secondId, 'error');

    const thirdId = syncStatusManager.startSync('claude');
    syncStatusManager.completeSync(thirdId, 'completed');

    expect(syncStatusManager.getActiveSyncs()).toHaveLength(0);
    expect(syncStatusManager.getCompletedSyncs(10)).toHaveLength(2);
    expect(syncStatusManager.getSync(firstId)).toBeUndefined();
    expect(syncStatusManager.getLatestSync('clawdbot')?.id).toBe(secondId);
    expect(syncStatusManager.getLatestSync('claude')?.id).toBe(thirdId);
    dateNowSpy.mockRestore();
  });

  it('prefers active syncs over completed history when fetching the latest provider sync', () => {
    const completedId = syncStatusManager.startSync('claude');
    syncStatusManager.completeSync(completedId, 'completed');

    const activeId = syncStatusManager.startSync('claude');

    const latest = syncStatusManager.getLatestSync('claude');

    expect(latest?.id).toBe(activeId);
    expect(latest?.status).toBe('running');
  });
});
