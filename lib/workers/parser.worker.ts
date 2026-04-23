import fs from 'node:fs';
import { parentPort } from 'node:worker_threads';
import type { WorkerJob, WorkerResult } from '@/types';
import { parseJSONL } from './parser-core';

export type {
  ParsedMessage,
  ParsedSession,
  ParsedToolCall,
} from './parser-core';
export { extractToolCalls, parseJSONL, parseMessage } from './parser-core';

export interface ParseJobData {
  sessionPath: string;
  incrementalFrom?: number;
}

interface ParseJobDataWithFile extends ParseJobData {
  filePath?: string;
}

parentPort?.on('message', async (job: WorkerJob<ParseJobData>) => {
  try {
    const {
      sessionPath,
      filePath = sessionPath,
      incrementalFrom = 0,
    } = job.data as ParseJobDataWithFile;
    const actualPath = filePath || sessionPath;

    if (!fs.existsSync(actualPath)) {
      sendError(job.id, `File not found: ${filePath}`);
      return;
    }

    const result = await parseJSONL(actualPath, incrementalFrom, (processedLines) => {
      sendProgress(job.id, processedLines);
    });
    sendResult(job.id, result);
  } catch (error) {
    sendError(job.id, error instanceof Error ? error.message : 'Unknown error');
  }
});

function sendResult(jobId: string, result: Awaited<ReturnType<typeof parseJSONL>>) {
  const response: WorkerResult<Awaited<ReturnType<typeof parseJSONL>>> = {
    jobId,
    success: true,
    result,
  };
  parentPort?.postMessage(response);
}

function sendError(jobId: string, error: string) {
  const response: WorkerResult = {
    jobId,
    success: false,
    error,
  };
  parentPort?.postMessage(response);
}

function sendProgress(jobId: string, linesProcessed: number) {
  const response: WorkerResult = {
    jobId,
    success: true,
    progress: linesProcessed,
  };
  parentPort?.postMessage(response);
}
