import { claudeProvider } from './claude';
import type { AIProvider } from '@/types';

/**
 * Provider Registry
 * Central registry for all AI providers
 */
class ProviderRegistry {
  private providers = new Map<string, AIProvider>();

  register(provider: AIProvider) {
    this.providers.set(provider.id, provider);
  }

  get(id: string): AIProvider | undefined {
    return this.providers.get(id);
  }

  getAll(): AIProvider[] {
    return Array.from(this.providers.values());
  }

  has(id: string): boolean {
    return this.providers.has(id);
  }
}

// Global registry instance
export const providerRegistry = new ProviderRegistry();

// Register built-in providers
providerRegistry.register(claudeProvider);

// Export for easy access
export { claudeProvider };
