import fs from 'node:fs';
import readline from 'node:readline';
import { parentPort } from 'node:worker_threads';
import type { WorkerJob, WorkerResult } from '@/types';

export interface ParseJobData {
  sessionPath: string;
  incrementalFrom?: number;
}

interface ParseJobDataWithFile extends ParseJobData {
  filePath?: string;
}

export interface ParsedSession {
  messages: ParsedMessage[];
  summary?: {
    leafUuid?: string;
    summary?: string;
  };
  summaries: Array<{ summary: string }>;
  fileSnapshots: ParsedFileSnapshot[];
  filesModified?: string[];
  foldersAccessed?: string[];
  toolCalls: ParsedToolCall[];
}

interface ParsedMessage {
  uuid: string;
  parentUuid?: string;
  sessionId: string;
  type: 'user' | 'assistant';
  timestamp: string;
  content: unknown;
  tokens?: number;
  toolCalls?: ParsedToolCall[];
}

interface ParsedToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
  timestamp: string;
}

interface ParsedFileSnapshot {
  filePath: string;
  timestamp: string;
}

/**
 * Parser Worker for JSONL files
 * Handles CPU-intensive parsing of Claude session logs
 */

parentPort?.on('message', async (job: WorkerJob<ParseJobData>) => {
  try {
    const {
      sessionPath,
      filePath = sessionPath,
      incrementalFrom = 0,
    } = job.data as ParseJobDataWithFile;
    const actualPath = filePath || sessionPath;

    // Check file exists
    if (!fs.existsSync(actualPath)) {
      sendError(job.id, `File not found: ${filePath}`);
      return;
    }

    const result = await parseJSONL(filePath, incrementalFrom, job.id);
    sendResult(job.id, result);
  } catch (error) {
    sendError(job.id, error instanceof Error ? error.message : 'Unknown error');
  }
});

async function parseJSONL(
  filePath: string,
  startLine: number,
  jobId: string
): Promise<ParsedSession> {
  const messages: ParsedMessage[] = [];
  const fileSnapshots: ParsedFileSnapshot[] = [];
  let summary: ParsedSession['summary'];
  let lineNumber = 0;
  let processedLines = 0;

  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    lineNumber++;

    // Skip lines before startLine for incremental parsing
    if (lineNumber < startLine) continue;

    processedLines++;

    // Send progress updates every 100 lines
    if (processedLines % 100 === 0) {
      sendProgress(jobId, processedLines);
    }

    // Skip empty lines
    if (!line.trim()) continue;

    try {
      const entry = JSON.parse(line);

      switch (entry.type) {
        case 'summary':
          summary = {
            leafUuid: entry.leafUuid,
            summary: entry.summary,
          };
          break;

        case 'user':
        case 'assistant': {
          const message = parseMessage(entry);
          if (message) messages.push(message);
          break;
        }

        case 'file-history-snapshot':
          if (entry.filePath) {
            fileSnapshots.push({
              filePath: entry.filePath,
              timestamp: entry.timestamp || new Date().toISOString(),
            });
          }
          break;

        default:
          // Unknown type, skip
          break;
      }
    } catch (parseError) {
      // Log but don't fail entire job for one bad line
      console.error(`Error parsing line ${lineNumber}:`, parseError);
    }
  }

  return {
    messages,
    summary,
    summaries: [],
    fileSnapshots,
    filesModified: [],
    foldersAccessed: [],
    toolCalls: [],
  };
}

function parseMessage(entry: Record<string, unknown>): ParsedMessage | null {
  if (!entry.uuid || !entry.type || !entry.timestamp) {
    return null;
  }

  const message: ParsedMessage = {
    uuid: entry.uuid as string,
    parentUuid: entry.parentUuid as string | undefined,
    sessionId: entry.sessionId as string,
    type: entry.type as 'user' | 'assistant',
    timestamp: entry.timestamp as string,
    content: entry.message || entry.content,
  };

  // Extract tool calls from message content
  if (entry.type === 'assistant' && entry.message) {
    const toolCalls = extractToolCalls(entry.message);
    if (toolCalls.length > 0) {
      message.toolCalls = toolCalls;
    }
  }

  // Estimate tokens (rough approximation: 4 chars per token)
  if (typeof message.content === 'string') {
    message.tokens = Math.ceil(message.content.length / 4);
  } else {
    const contentStr = JSON.stringify(message.content);
    message.tokens = Math.ceil(contentStr.length / 4);
  }

  return message;
}

function extractToolCalls(message: unknown): ParsedToolCall[] {
  const toolCalls: ParsedToolCall[] = [];

  if (typeof message === 'object' && message !== null) {
    const msg = message as Record<string, unknown>;

    // Check if content is an array (Claude API format)
    if (Array.isArray(msg.content)) {
      for (const block of msg.content) {
        if (typeof block === 'object' && block !== null) {
          const blockObj = block as Record<string, unknown>;
          if (blockObj.type === 'tool_use') {
            toolCalls.push({
              id: blockObj.id as string,
              name: blockObj.name as string,
              input: (blockObj.input as Record<string, unknown>) || {},
              timestamp: new Date().toISOString(),
            });
          }
        }
      }
    }
  }

  return toolCalls;
}

function sendResult(jobId: string, result: ParsedSession) {
  const response: WorkerResult<ParsedSession> = {
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
