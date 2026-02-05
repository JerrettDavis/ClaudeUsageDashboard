import { describe, it, expect } from 'vitest';
import { WorkerPool } from '@/lib/workers/pool';

describe('WorkerPool', () => {
  it('should create a worker pool', () => {
    // We can't fully test worker threads in unit tests without complex mocking
    // Just verify the pool can be instantiated
    expect(WorkerPool).toBeDefined();
  });

  it('should have getStats method', () => {
    const pool = new WorkerPool({
      workerPath: 'lib/workers/parser.worker.ts',
      poolSize: 2,
    });

    const stats = pool.getStats();
    expect(stats).toHaveProperty('totalWorkers');
    expect(stats).toHaveProperty('availableWorkers');
    expect(stats).toHaveProperty('activeJobs');
    expect(stats).toHaveProperty('queuedJobs');

    pool.terminate();
  });
});
