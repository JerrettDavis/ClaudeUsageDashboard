import fs from 'node:fs';
import path from 'node:path';
import { Worker } from 'node:worker_threads';
import { describe, expect, it } from 'vitest';

interface ParsedMessage {
  role: string;
  content: unknown;
}

interface ToolCall {
  toolName: string;
  [key: string]: unknown;
}

interface ParseResult {
  messages: ParsedMessage[];
  toolCalls?: ToolCall[];
}

interface WorkerResponse {
  jobId: string;
  result?: ParseResult;
  error?: string;
}

describe('Parser Worker', () => {
  const generateJobId = () => `job_${Date.now()}_${Math.random().toString(36).slice(2)}`;

  it('should parse a simple JSONL file', async () => {
    // Create a test file
    const testFile = path.join(__dirname, '../fixtures/test-session.jsonl');
    const testData = [
      { type: 'user', content: 'Hello', timestamp: '2024-01-01T00:00:00Z' },
      {
        type: 'assistant',
        content: [{ type: 'text', text: 'Hi there!' }],
        timestamp: '2024-01-01T00:00:01Z',
      },
    ];

    fs.writeFileSync(testFile, testData.map((d) => JSON.stringify(d)).join('\n'));

    // Test the worker
    const workerPath = path.resolve(process.cwd(), 'lib/workers/parser.worker.mjs');
    const worker = new Worker(workerPath);
    const jobId = generateJobId();

    const result = await new Promise<ParseResult>((resolve, reject) => {
      const timeout = setTimeout(() => {
        worker.terminate();
        reject(new Error('Worker timeout after 5s'));
      }, 5000);

      worker.on('message', (msg: WorkerResponse) => {
        if (msg.jobId === jobId) {
          clearTimeout(timeout);
          if (msg.error) {
            reject(new Error(msg.error));
          } else if (msg.result) {
            resolve(msg.result);
          }
        }
      });

      worker.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });

      // Send message in the format the worker expects
      worker.postMessage({ id: jobId, data: { sessionPath: testFile } });
    });

    await worker.terminate();
    fs.unlinkSync(testFile);

    expect(result).toBeDefined();
    expect(result.messages).toHaveLength(2);
    expect(result.messages[0].role).toBe('user');
    expect(result.messages[1].role).toBe('assistant');
  });

  it('should handle tool calls in assistant messages', async () => {
    const testFile = path.join(__dirname, '../fixtures/test-tools.jsonl');
    const testData = [
      {
        type: 'assistant',
        content: [
          { type: 'text', text: 'Let me check that file.' },
          { type: 'tool_use', id: 'tool1', name: 'read_file', input: { path: '/test.txt' } },
        ],
        timestamp: '2024-01-01T00:00:00Z',
      },
    ];

    fs.writeFileSync(testFile, testData.map((d) => JSON.stringify(d)).join('\n'));

    const workerPath = path.resolve(process.cwd(), 'lib/workers/parser.worker.mjs');
    const worker = new Worker(workerPath);
    const jobId = generateJobId();

    const result = await new Promise<ParseResult>((resolve, reject) => {
      const timeout = setTimeout(() => {
        worker.terminate();
        reject(new Error('Worker timeout'));
      }, 5000);

      worker.on('message', (msg: WorkerResponse) => {
        if (msg.jobId === jobId) {
          clearTimeout(timeout);
          if (msg.error) {
            reject(new Error(msg.error));
          } else if (msg.result) {
            resolve(msg.result);
          }
        }
      });

      worker.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });

      worker.postMessage({ id: jobId, data: { sessionPath: testFile } });
    });

    await worker.terminate();
    fs.unlinkSync(testFile);

    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls?.[0].toolName).toBe('read_file');
  });

  it('should skip malformed lines without failing', async () => {
    const testFile = path.join(__dirname, '../fixtures/test-malformed.jsonl');
    const testData = [
      '{"type":"user","content":"Hello","timestamp":"2024-01-01T00:00:00Z"}',
      'this is not valid json',
      '{"type":"assistant","content":"Hi","timestamp":"2024-01-01T00:00:01Z"}',
    ];

    fs.writeFileSync(testFile, testData.join('\n'));

    const workerPath = path.resolve(process.cwd(), 'lib/workers/parser.worker.mjs');
    const worker = new Worker(workerPath);
    const jobId = generateJobId();

    const result = await new Promise<ParseResult>((resolve, reject) => {
      const timeout = setTimeout(() => {
        worker.terminate();
        reject(new Error('Worker timeout'));
      }, 5000);

      worker.on('message', (msg: WorkerResponse) => {
        if (msg.jobId === jobId) {
          clearTimeout(timeout);
          if (msg.error) {
            reject(new Error(msg.error));
          } else if (msg.result) {
            resolve(msg.result);
          }
        }
      });

      worker.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });

      worker.postMessage({ id: jobId, data: { sessionPath: testFile } });
    });

    await worker.terminate();
    fs.unlinkSync(testFile);

    expect(result.messages).toHaveLength(2); // Should have 2 valid messages
  });
});
