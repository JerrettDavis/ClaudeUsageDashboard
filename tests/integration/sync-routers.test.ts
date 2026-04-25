import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  syncProviderMock: vi.fn(),
  syncAllMock: vi.fn(),
  checkInstallationsMock: vi.fn(),
  getSyncMock: vi.fn(),
  getActiveSyncsMock: vi.fn(),
  getCompletedSyncsMock: vi.fn(),
  getLatestSyncMock: vi.fn(),
  startSyncMock: vi.fn(),
  completeSyncMock: vi.fn(),
  claudeFullSyncMock: vi.fn(),
}));

vi.mock('@/lib/services/sync', () => ({
  syncService: {
    syncProvider: mocks.syncProviderMock,
    syncAll: mocks.syncAllMock,
    checkInstallations: mocks.checkInstallationsMock,
  },
}));

vi.mock('@/lib/services/sync-status', () => ({
  syncStatusManager: {
    getSync: mocks.getSyncMock,
    getActiveSyncs: mocks.getActiveSyncsMock,
    getCompletedSyncs: mocks.getCompletedSyncsMock,
    getLatestSync: mocks.getLatestSyncMock,
    startSync: mocks.startSyncMock,
    completeSync: mocks.completeSyncMock,
  },
}));

vi.mock('@/lib/providers/claude', () => ({
  claudeProvider: {
    fullSync: mocks.claudeFullSyncMock,
  },
}));

import { createCallerFactory } from '@/lib/trpc/init';
import { appRouter } from '@/lib/trpc/root';

describe('sync routers', () => {
  const createCaller = createCallerFactory(appRouter);
  const caller = createCaller({});

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('delegates sync router procedures to syncService', async () => {
    mocks.syncProviderMock.mockResolvedValue({
      providerId: 'claude',
      success: true,
      sessionsProcessed: 4,
      errors: 0,
      duration: 123,
    });
    mocks.syncAllMock.mockResolvedValue([{ providerId: 'claude', success: true }]);
    mocks.checkInstallationsMock.mockResolvedValue([{ providerId: 'claude', installed: true }]);

    await expect(caller.sync.syncProvider({ providerId: 'claude' })).resolves.toMatchObject({
      providerId: 'claude',
      success: true,
      sessionsProcessed: 4,
    });
    await expect(caller.sync.syncAll()).resolves.toEqual([{ providerId: 'claude', success: true }]);
    await expect(caller.sync.checkInstallations()).resolves.toEqual([
      { providerId: 'claude', installed: true },
    ]);

    expect(mocks.syncProviderMock).toHaveBeenCalledWith('claude');
    expect(mocks.syncAllMock).toHaveBeenCalledOnce();
    expect(mocks.checkInstallationsMock).toHaveBeenCalledOnce();
  });

  it('delegates sync status queries to syncStatusManager', async () => {
    mocks.getSyncMock.mockReturnValue({ id: 'sync-1', status: 'running' });
    mocks.getActiveSyncsMock.mockReturnValue([{ id: 'sync-1' }]);
    mocks.getCompletedSyncsMock.mockReturnValue([{ id: 'sync-0' }]);
    mocks.getLatestSyncMock.mockReturnValue({ id: 'sync-2', providerId: 'claude' });

    await expect(caller.syncStatus.getStatus({ id: 'sync-1' })).resolves.toEqual({
      id: 'sync-1',
      status: 'running',
    });
    await expect(caller.syncStatus.getActiveSyncs()).resolves.toEqual([{ id: 'sync-1' }]);
    await expect(caller.syncStatus.getHistory({})).resolves.toEqual([{ id: 'sync-0' }]);
    await expect(caller.syncStatus.getLatestForProvider({ providerId: 'claude' })).resolves.toEqual(
      { id: 'sync-2', providerId: 'claude' }
    );

    expect(mocks.getSyncMock).toHaveBeenCalledWith('sync-1');
    expect(mocks.getActiveSyncsMock).toHaveBeenCalledOnce();
    expect(mocks.getCompletedSyncsMock).toHaveBeenCalledWith(10);
    expect(mocks.getLatestSyncMock).toHaveBeenCalledWith('claude');
  });

  it('starts a background Claude sync and returns the sync id', async () => {
    mocks.startSyncMock.mockReturnValue('sync-claude-1');
    mocks.claudeFullSyncMock.mockResolvedValue({ processed: 2, errors: 0 });

    await expect(caller.syncStatus.startSync({ providerId: 'claude' })).resolves.toEqual({
      syncId: 'sync-claude-1',
    });

    expect(mocks.startSyncMock).toHaveBeenCalledWith('claude');
    expect(mocks.claudeFullSyncMock).toHaveBeenCalledWith('sync-claude-1');
  });

  it('marks the sync as errored when the background Claude sync fails', async () => {
    mocks.startSyncMock.mockReturnValue('sync-claude-2');
    mocks.claudeFullSyncMock.mockRejectedValue(new Error('background failure'));

    await caller.syncStatus.startSync({ providerId: 'claude' });
    await Promise.resolve();

    expect(mocks.completeSyncMock).toHaveBeenCalledWith('sync-claude-2', 'error');
  });

  it('returns a sync id without launching Claude background work for other providers', async () => {
    mocks.startSyncMock.mockReturnValue('sync-openclaw-1');

    await expect(caller.syncStatus.startSync({ providerId: 'clawdbot' })).resolves.toEqual({
      syncId: 'sync-openclaw-1',
    });

    expect(mocks.startSyncMock).toHaveBeenCalledWith('clawdbot');
    expect(mocks.claudeFullSyncMock).not.toHaveBeenCalled();
    expect(mocks.completeSyncMock).not.toHaveBeenCalled();
  });
});
