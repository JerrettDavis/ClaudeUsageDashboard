import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const mockGet = vi.fn();
  const mockGetAll = vi.fn();
  const mockWhere = vi.fn();
  const mockSet = vi.fn(() => ({ where: mockWhere }));
  const mockUpdate = vi.fn(() => ({ set: mockSet }));

  return {
    mockGet,
    mockGetAll,
    mockWhere,
    mockSet,
    mockUpdate,
  };
});

vi.mock('@/lib/providers', () => ({
  providerRegistry: {
    get: mocks.mockGet,
    getAll: mocks.mockGetAll,
  },
}));

vi.mock('@/lib/db/client', () => ({
  db: {
    update: mocks.mockUpdate,
  },
}));

import { SyncService } from '@/lib/services/sync';

describe('SyncService', () => {
  const service = new SyncService();

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockWhere.mockResolvedValue(undefined);
  });

  it('syncs a provider successfully when the provider supports full sync', async () => {
    const provider = {
      id: 'claude',
      detectInstallation: vi.fn().mockResolvedValue(true),
      initialize: vi.fn().mockResolvedValue(undefined),
      fullSync: vi.fn().mockResolvedValue({ processed: 3, errors: 1 }),
    };

    mocks.mockGet.mockReturnValue(provider);

    const result = await service.syncProvider('claude');

    expect(result.providerId).toBe('claude');
    expect(result.success).toBe(true);
    expect(result.sessionsProcessed).toBe(3);
    expect(result.errors).toBe(1);
    expect(result.duration).toBeGreaterThanOrEqual(0);
    expect(provider.detectInstallation).toHaveBeenCalledOnce();
    expect(provider.initialize).toHaveBeenCalledOnce();
    expect(provider.fullSync).toHaveBeenCalledOnce();
    expect(mocks.mockUpdate).toHaveBeenCalledOnce();
    expect(mocks.mockSet).toHaveBeenCalledOnce();
    expect(mocks.mockWhere).toHaveBeenCalledOnce();
  });

  it('throws when the requested provider is missing', async () => {
    mocks.mockGet.mockReturnValue(undefined);

    await expect(service.syncProvider('missing')).rejects.toThrow('Provider not found: missing');
  });

  it('returns a failed result when the provider is not installed', async () => {
    const provider = {
      id: 'clawdbot',
      detectInstallation: vi.fn().mockResolvedValue(false),
      initialize: vi.fn(),
    };

    mocks.mockGet.mockReturnValue(provider);

    const result = await service.syncProvider('clawdbot');

    expect(result).toMatchObject({
      providerId: 'clawdbot',
      success: false,
      sessionsProcessed: 0,
      errors: 1,
    });
    expect(provider.initialize).not.toHaveBeenCalled();
    expect(mocks.mockUpdate).not.toHaveBeenCalled();
  });

  it('syncs all providers and records hard failures per provider', async () => {
    const claudeProvider = {
      id: 'claude',
      detectInstallation: vi.fn().mockResolvedValue(true),
      initialize: vi.fn().mockResolvedValue(undefined),
      fullSync: vi.fn().mockResolvedValue({ processed: 2, errors: 0 }),
    };

    mocks.mockGetAll.mockReturnValue([{ id: 'claude' }, { id: 'missing' }]);
    mocks.mockGet.mockImplementation((providerId: string) =>
      providerId === 'claude' ? claudeProvider : undefined
    );

    const results = await service.syncAll();

    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({
      providerId: 'claude',
      success: true,
      sessionsProcessed: 2,
    });
    expect(results[1]).toMatchObject({
      providerId: 'missing',
      success: false,
      sessionsProcessed: 0,
      errors: 1,
      duration: 0,
    });
  });

  it('checks installations and updates the provider installation state', async () => {
    const claudeProvider = {
      id: 'claude',
      detectInstallation: vi.fn().mockResolvedValue(true),
    };
    const clawdbotProvider = {
      id: 'clawdbot',
      detectInstallation: vi.fn().mockResolvedValue(false),
    };

    mocks.mockGetAll.mockReturnValue([claudeProvider, clawdbotProvider]);

    const result = await service.checkInstallations();

    expect(result).toEqual([
      { providerId: 'claude', installed: true },
      { providerId: 'clawdbot', installed: false },
    ]);
    expect(mocks.mockUpdate).toHaveBeenCalledTimes(2);
    expect(mocks.mockSet).toHaveBeenCalledTimes(2);
    expect(mocks.mockWhere).toHaveBeenCalledTimes(2);
  });
});
