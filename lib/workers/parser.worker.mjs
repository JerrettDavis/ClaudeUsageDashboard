import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { parentPort } from 'node:worker_threads';

if (parentPort) {
  parentPort.on('message', async (job) => {
    try {
      const result = await parseSessionFile(job.data.sessionPath);
      parentPort.postMessage({
        jobId: job.id,
        result: result,
        error: undefined,
      });
    } catch (error) {
      parentPort.postMessage({
        jobId: job.id,
        result: undefined,
        error: error.message,
      });
    }
  });
}

async function parseSessionFile(sessionPath) {
  const messages = [];
  const toolCalls = [];
  const fileSnapshots = [];
  const summaries = [];
  let tokensInput = 0;
  let tokensOutput = 0;
  let lineNumber = 0;
  let sessionMetadata = {};
  const filesModified = new Set();
  const foldersAccessed = new Set();

  const fileStream = createReadStream(sessionPath);
  const rl = createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    lineNumber++;

    if (!line.trim()) continue;

    try {
      const entry = JSON.parse(line);

      // Handle summary entries
      if (entry.type === 'summary') {
        summaries.push({
          summary: entry.summary,
          leafUuid: entry.leafUuid,
        });
      }

      // Handle user/assistant messages
      else if (entry.type === 'user' || entry.type === 'assistant') {
        // Extract metadata from user messages
        if (entry.type === 'user' && entry.cwd) {
          sessionMetadata = {
            cwd: entry.cwd,
            sessionId: entry.sessionId,
            version: entry.version,
            gitBranch: entry.gitBranch,
          };
        }

        const content = entry.message
          ? JSON.stringify(entry.message.content)
          : JSON.stringify(entry.content || entry.text || '');

        const tokens = Math.ceil(content.length / 4);

        if (entry.type === 'user') {
          tokensInput += tokens;
        } else {
          tokensOutput += tokens;
        }

        messages.push({
          uuid: entry.uuid,
          parentUuid: entry.parentUuid,
          sessionId: entry.sessionId,
          role: entry.type,
          content: content,
          timestamp: entry.timestamp || new Date().toISOString(),
          tokens,
        });

        // Extract tool calls from assistant messages
        if (entry.type === 'assistant') {
          const messageContent = entry.message?.content || entry.content;
          const contentBlocks = Array.isArray(messageContent) ? messageContent : [messageContent];

          for (const block of contentBlocks) {
            if (block && block.type === 'tool_use') {
              toolCalls.push({
                toolName: block.name,
                parameters: JSON.stringify(block.input || {}),
                timestamp: entry.timestamp || new Date().toISOString(),
                messageId: entry.uuid,
              });
            }
          }
        }
      }

      // Handle file history snapshots
      else if (entry.type === 'file-history-snapshot' && entry.snapshot) {
        const snapshot = entry.snapshot;
        if (snapshot.trackedFileBackups) {
          Object.keys(snapshot.trackedFileBackups).forEach((filePath) => {
            filesModified.add(filePath);
            const folder = filePath.substring(0, filePath.lastIndexOf('/'));
            if (folder) foldersAccessed.add(folder);
          });
        }

        fileSnapshots.push({
          messageId: entry.messageId,
          timestamp: snapshot.timestamp,
          fileCount: Object.keys(snapshot.trackedFileBackups || {}).length,
        });
      }
    } catch (err) {
      // Skip malformed lines
      console.warn(`Failed to parse line ${lineNumber} in ${sessionPath}:`, err.message);
    }

    // Report progress every 100 lines
    if (lineNumber % 100 === 0 && parentPort) {
      // Don't send progress for now - focus on completion
      // parentPort.postMessage({ type: 'progress', lines: lineNumber });
    }
  }

  return {
    messages,
    toolCalls,
    fileSnapshots,
    summaries,
    sessionMetadata,
    tokensInput,
    tokensOutput,
    filesModified: Array.from(filesModified),
    foldersAccessed: Array.from(foldersAccessed),
  };
}
