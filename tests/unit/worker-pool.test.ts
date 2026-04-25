import { describe, expect, it } from 'vitest';
import { createParserPool, WorkerPool } from '@/lib/workers/pool';

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

  it('should expose the parser-pool factory defaults', async () => {
    const pool = createParserPool(1);

    expect(pool.getStats().totalWorkers).toBe(1);

    await pool.terminate();
  });

  it('should ignore progress-only worker messages until a final result arrives', async () => {
    const pool = new WorkerPool({
      workerPath: 'lib/workers/parser.worker.ts',
      poolSize: 1,
    });

    const internalPool = pool as unknown as {
      availableWorkers: unknown[];
      handleWorkerMessage: (worker: unknown, result: { jobId: string; progress?: number }) => void;
    };
    const availableBefore = pool.getStats().availableWorkers;

    internalPool.handleWorkerMessage(internalPool.availableWorkers[0], {
      jobId: 'job-progress',
      progress: 50,
    });

    expect(pool.getStats().availableWorkers).toBe(availableBefore);

    await pool.terminate();
  });
});
