import { providerRegistry } from '@/lib/providers';
import { db } from '@/lib/db/client';
import { providers } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export interface SyncResult {
  providerId: string;
  success: boolean;
  sessionsProcessed: number;
  errors: number;
  duration: number;
}

/**
 * Sync Service
 * Orchestrates data synchronization from providers to database
 */
export class SyncService {
  /**
   * Sync a specific provider
   */
  async syncProvider(providerId: string): Promise<SyncResult> {
    const startTime = Date.now();
    const provider = providerRegistry.get(providerId);

    if (!provider) {
      throw new Error(`Provider not found: ${providerId}`);
    }

    try {
      // Check if provider is installed
      const installed = await provider.detectInstallation();
      if (!installed) {
        throw new Error(`Provider not installed: ${providerId}`);
      }

      // Initialize provider
      await provider.initialize();

      // Perform full sync (for now - incremental coming later)
      const result = await (provider as any).fullSync?.();

      if (!result) {
        throw new Error('Provider does not support fullSync');
      }

      // Update provider last sync time
      await db
        .update(providers)
        .set({
          lastSync: new Date(),
          installed: true,
        })
        .where(eq(providers.id, providerId));

      const duration = Date.now() - startTime;

      return {
        providerId,
        success: true,
        sessionsProcessed: result.processed,
        errors: result.errors,
        duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      return {
        providerId,
        success: false,
        sessionsProcessed: 0,
        errors: 1,
        duration,
      };
    }
  }

  /**
   * Sync all installed providers
   */
  async syncAll(): Promise<SyncResult[]> {
    const allProviders = providerRegistry.getAll();
    const results: SyncResult[] = [];

    for (const provider of allProviders) {
      try {
        const result = await this.syncProvider(provider.id);
        results.push(result);
      } catch (error) {
        console.error(`Error syncing provider ${provider.id}:`, error);
        results.push({
          providerId: provider.id,
          success: false,
          sessionsProcessed: 0,
          errors: 1,
          duration: 0,
        });
      }
    }

    return results;
  }

  /**
   * Check which providers are installed
   */
  async checkInstallations(): Promise<
    Array<{ providerId: string; installed: boolean }>
  > {
    const allProviders = providerRegistry.getAll();
    const results = [];

    for (const provider of allProviders) {
      const installed = await provider.detectInstallation();
      results.push({
        providerId: provider.id,
        installed,
      });

      // Update database
      await db
        .update(providers)
        .set({ installed })
        .where(eq(providers.id, provider.id));
    }

    return results;
  }
}

// Export singleton
export const syncService = new SyncService();
