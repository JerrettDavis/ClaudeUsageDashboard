import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const workerThreadMocks = vi.hoisted(() => {
  class FakeWorker {
    static instances: FakeWorker[] = [];
    handlers = new Map<string, (value: unknown) => void>();
    postMessage = vi.fn();
    terminate = vi.fn().mockResolvedValue(0);

    constructor(_workerPath: string) {
      FakeWorker.instances.push(this);
    }

    on(event: string, handler: (value: unknown) => void) {
      this.handlers.set(event, handler);
      return this;
    }

    emit(event: string, value: unknown) {
      this.handlers.get(event)?.(value);
    }
  }

  return { FakeWorker };
});

vi.mock('node:worker_threads', () => ({
  Worker: workerThreadMocks.FakeWorker,
  default: {
    Worker: workerThreadMocks.FakeWorker,
  },
}));

import { WorkerPool } from '@/lib/workers/pool';

describe('WorkerPool event handling', () => {
  beforeEach(() => {
    workerThreadMocks.FakeWorker.instances.length = 0;
    vi.restoreAllMocks();
  });

  afterEach(() => {
    process.exitCode = 0;
  });

  it('logs worker error and unexpected non-zero exits', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const pool = new WorkerPool({
      workerPath: 'lib/workers/parser.worker.ts',
      poolSize: 1,
    });
    const worker = workerThreadMocks.FakeWorker.instances[0];

    worker.emit('error', new Error('boom'));
    worker.emit('exit', 2);

    expect(errorSpy).toHaveBeenCalledWith('Worker error:', expect.any(Error));
    expect(errorSpy).toHaveBeenCalledWith('Worker stopped with exit code 2');

    void pool.terminate();
  });

  it('clears leaked process exit codes for intentional termination exits', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const pool = new WorkerPool({
      workerPath: 'lib/workers/parser.worker.ts',
      poolSize: 1,
    });
    const worker = workerThreadMocks.FakeWorker.instances[0];

    process.exitCode = 7;
    const termination = pool.terminate();
    worker.emit('exit', 7);
    await termination;

    expect(process.exitCode).toBe(0);
    expect(errorSpy).not.toHaveBeenCalledWith('Worker stopped with exit code 7');
  });
});
