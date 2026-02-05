import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { WorkerPool } from '@/lib/workers/pool';

interface ParseResult {
  messages: Array<{ role: string; content: unknown }>;
}

describe('WorkerPool', () => {
  let testFile: string;

  beforeEach(() => {
    testFile = path.join(__dirname, '../fixtures/pool-test.jsonl');
    const testData = [{ type: 'user', content: 'Test', timestamp: '2024-01-01T00:00:00Z' }];
    fs.writeFileSync(testFile, testData.map((d) => JSON.stringify(d)).join('\n'));
  });

  afterEach(() => {
    if (fs.existsSync(testFile)) {
      fs.unlinkSync(testFile);
    }
  });

  it('should create worker pool with specified size', () => {
    const pool = new WorkerPool({
      workerPath: 'lib/workers/parser.worker.mjs',
      poolSize: 2,
    });

    expect(pool.getStats().totalWorkers).toBe(2);
    expect(pool.getStats().availableWorkers).toBe(2);

    pool.terminate();
  });

  it('should execute job and return result', async () => {
    const pool = new WorkerPool({
      workerPath: 'lib/workers/parser.worker.mjs',
      poolSize: 1,
    });

    const job = {
      id: 'test-1',
      type: 'parse' as const,
      data: { sessionPath: testFile },
    };

    const result = (await pool.execute(job)) as ParseResult;

    expect(result).toBeDefined();
    expect(result.messages).toBeDefined();
    expect(Array.isArray(result.messages)).toBe(true);

    await pool.terminate();
  }, 10000);

  it('should handle multiple concurrent jobs', async () => {
    const pool = new WorkerPool({
      workerPath: 'lib/workers/parser.worker.mjs',
      poolSize: 2,
    });

    // Create multiple test files
    const files = [1, 2, 3, 4].map((i) => {
      const file = path.join(__dirname, `../fixtures/pool-test-${i}.jsonl`);
      fs.writeFileSync(
        file,
        JSON.stringify({ type: 'user', content: `Test ${i}`, timestamp: new Date().toISOString() })
      );
      return file;
    });

    const jobs = files.map((file, i) => ({
      id: `test-${i}`,
      type: 'parse' as const,
      data: { sessionPath: file },
    }));

    const results = (await Promise.all(jobs.map((job) => pool.execute(job)))) as ParseResult[];

    expect(results).toHaveLength(4);
    results.forEach((result) => {
      expect(result.messages).toBeDefined();
    });

    // Cleanup
    files.forEach((file) => fs.unlinkSync(file));
    await pool.terminate();
  }, 15000);

  it('should handle worker errors gracefully', async () => {
    const pool = new WorkerPool({
      workerPath: 'lib/workers/parser.worker.mjs',
      poolSize: 1,
    });

    const job = {
      id: 'test-error',
      type: 'parse' as const,
      data: { sessionPath: '/non/existent/file.jsonl' },
    };

    await expect(pool.execute(job)).rejects.toThrow();

    await pool.terminate();
  }, 10000);
});
