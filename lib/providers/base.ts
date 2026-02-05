import type { AIProvider } from '@/types';

/**
 * Abstract base class for AI providers
 * Provides common functionality and enforces interface contract
 */
export abstract class BaseProvider implements AIProvider {
  abstract id: string;
  abstract name: string;
  abstract icon: string;

  // Implement common methods that can be shared
  protected log(message: string) {
    console.log(`[${this.name}] ${message}`);
  }

  protected error(message: string, error?: unknown) {
    console.error(`[${this.name}] ${message}`, error);
  }

  // Providers must implement these
  abstract initialize(): Promise<void>;
  abstract detectInstallation(): Promise<boolean>;
  abstract getConfigPath(): string;
  abstract listSessions(
    filter?: import('@/types').SessionFilter
  ): Promise<import('@/types').Session[]>;
  abstract getSession(id: string): Promise<import('@/types').SessionDetail>;
  abstract watchSessions(
    callback: (event: import('@/types').SessionEvent) => void
  ): import('@/types').Disposable;
  abstract getUsageStats(range: import('@/types').DateRange): Promise<import('@/types').UsageStats>;
  abstract getTokenMetrics(): Promise<import('@/types').TokenMetrics>;
  abstract getCostEstimate(usage: import('@/types').Usage): number;
  abstract detectRunningProcesses(): Promise<import('@/types').RunningProcess[]>;
  abstract launchSession(
    config: import('@/types').LaunchConfig
  ): Promise<import('@/types').ProcessHandle>;
}
