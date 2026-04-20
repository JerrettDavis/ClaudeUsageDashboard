import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Worker } from 'node:worker_threads';
import type { WorkerJob, WorkerResult } from '@/types';

type WorkerCallback<T> = (result: T, error?: string) => void;

interface WorkerPoolConfig {
  workerPath: string;
  poolSize: number;
}

/**
 * Generic Worker Pool Manager
 * Manages a pool of worker threads for parallel processing
 */
export class WorkerPool<TJobData = unknown, TResult = unknown> {
  private workers: Worker[] = [];
  private availableWorkers: Worker[] = [];
  private jobQueue: Array<{
    job: WorkerJob<TJobData>;
    callback: WorkerCallback<TResult>;
  }> = [];
  private activeJobs = new Map<string, WorkerCallback<TResult>>();
  private _terminating = false;

  constructor(private config: WorkerPoolConfig) {
    this.initializeWorkers();
  }

  private initializeWorkers() {
    // Resolve the worker script path relative to this file's directory using
    // import.meta.url. This avoids Turbopack NFT tracing the entire project
    // (which would happen with process.cwd()). Callers should pass just the
    // filename (e.g., 'parser.worker.mjs'), not a full path.
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const workerPath = path.resolve(__dirname, this.config.workerPath);

    for (let i = 0; i < this.config.poolSize; i++) {
      const worker = new Worker(workerPath);

      worker.on('message', (result: WorkerResult<TResult>) => {
        this.handleWorkerMessage(worker, result);
      });

      worker.on('error', (error) => {
        console.error('Worker error:', error);
      });

      worker.on('exit', (code) => {
        if (code !== 0) {
          if (this._terminating) {
            // Worker exited with non-zero code due to intentional termination.
            // Reset process.exitCode so the non-zero worker exit doesn't leak
            // to the parent process (which would cause CI to report failure).
            if (process.exitCode === code) {
              process.exitCode = 0;
            }
          } else {
            console.error(`Worker stopped with exit code ${code}`);
          }
        }
      });

      this.workers.push(worker);
      this.availableWorkers.push(worker);
    }
  }

  private handleWorkerMessage(worker: Worker, result: WorkerResult<TResult>) {
    // Handle progress updates
    if (result.progress !== undefined && !result.result) {
      // Progress update, don't complete the job yet
      return;
    }

    const callback = this.activeJobs.get(result.jobId);
    if (callback) {
      callback(result.result as TResult, result.error);
      this.activeJobs.delete(result.jobId);
    }

    // Mark worker as available and process next job
    this.availableWorkers.push(worker);
    this.processNextJob();
  }

  private processNextJob() {
    if (this.jobQueue.length === 0 || this.availableWorkers.length === 0) {
      return;
    }

    const worker = this.availableWorkers.pop();
    const nextJob = this.jobQueue.shift();

    if (worker && nextJob) {
      this.activeJobs.set(nextJob.job.id, nextJob.callback);
      worker.postMessage(nextJob.job);
    }
  }

  /**
   * Execute a job using the worker pool
   */
  execute(job: WorkerJob<TJobData>): Promise<TResult> {
    return new Promise((resolve, reject) => {
      const callback: WorkerCallback<TResult> = (result, error) => {
        if (error) {
          reject(new Error(error));
        } else {
          resolve(result);
        }
      };

      this.jobQueue.push({ job, callback });
      this.processNextJob();
    });
  }

  /**
   * Terminate all workers
   */
  async terminate() {
    this._terminating = true;
    await Promise.all(this.workers.map((worker) => worker.terminate()));
    this.workers = [];
    this.availableWorkers = [];
    this.activeJobs.clear();
    this.jobQueue = [];
  }

  /**
   * Get pool statistics
   */
  getStats() {
    return {
      totalWorkers: this.workers.length,
      availableWorkers: this.availableWorkers.length,
      activeJobs: this.activeJobs.size,
      queuedJobs: this.jobQueue.length,
    };
  }
}

/**
 * Create a parser worker pool
 */
export function createParserPool(poolSize = 4) {
  return new WorkerPool({
    workerPath: 'parser.worker.mjs',
    poolSize,
  });
}
