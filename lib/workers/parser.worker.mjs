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
  let summary = undefined;
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
        // Keep the last summary as the main summary
        summary = {
          leafUuid: entry.leafUuid,
          summary: entry.summary,
        };
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

        const messageToolCalls = [];

        // Extract tool calls from assistant messages
        if (entry.type === 'assistant') {
          const messageContent = entry.message?.content || entry.content;
          const contentBlocks = Array.isArray(messageContent) ? messageContent : [messageContent];

          for (const block of contentBlocks) {
            if (block && block.type === 'tool_use') {
              const toolCall = {
                id: block.id,
                name: block.name,
                input: block.input || {},
                timestamp: entry.timestamp || new Date().toISOString(),
              };
              toolCalls.push({
                toolName: block.name,
                parameters: JSON.stringify(block.input || {}),
                timestamp: entry.timestamp || new Date().toISOString(),
                messageId: entry.uuid,
              });
              messageToolCalls.push(toolCall);
            }
          }
        }

        messages.push({
          uuid: entry.uuid,
          parentUuid: entry.parentUuid,
          sessionId: entry.sessionId,
          type: entry.type,
          role: entry.type, // Alias for compatibility
          content: content,
          timestamp: entry.timestamp || new Date().toISOString(),
          tokens,
          toolCalls: messageToolCalls.length > 0 ? messageToolCalls : undefined,
        });
      }

      // Handle file history snapshots
      else if (entry.type === 'file-history-snapshot') {
        // Handle both formats: {filePath} and {snapshot: {trackedFileBackups}}
        if (entry.filePath) {
          fileSnapshots.push({
            filePath: entry.filePath,
            timestamp: entry.timestamp || new Date().toISOString(),
          });
          filesModified.add(entry.filePath);
          const folder = entry.filePath.substring(0, entry.filePath.lastIndexOf('/'));
          if (folder) foldersAccessed.add(folder);
        } else if (entry.snapshot?.trackedFileBackups) {
          Object.keys(entry.snapshot.trackedFileBackups).forEach((filePath) => {
            filesModified.add(filePath);
            const folder = filePath.substring(0, filePath.lastIndexOf('/'));
            if (folder) foldersAccessed.add(folder);
          });

          fileSnapshots.push({
            messageId: entry.messageId,
            timestamp: entry.snapshot.timestamp,
            fileCount: Object.keys(entry.snapshot.trackedFileBackups || {}).length,
          });
        }
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
    summary,
    summaries,
    toolCalls,
    fileSnapshots,
    sessionMetadata,
    tokensInput,
    tokensOutput,
    filesModified: Array.from(filesModified),
    foldersAccessed: Array.from(foldersAccessed),
  };
}
