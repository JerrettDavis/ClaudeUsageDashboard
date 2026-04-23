import fs from 'node:fs';
import readline from 'node:readline';

export interface ParsedSession {
  messages: ParsedMessage[];
  metadata?: {
    cwd?: string;
    gitBranch?: string;
    version?: string;
    permissionMode?: string;
  };
  summary?: {
    leafUuid?: string;
    summary?: string;
  };
  summaries: Array<{ leafUuid?: string; summary: string }>;
  fileSnapshots: ParsedFileSnapshot[];
  filesModified?: string[];
  foldersAccessed?: string[];
  toolCalls: ParsedToolCall[];
}

export interface ParsedMessage {
  uuid: string;
  parentUuid?: string;
  sessionId: string;
  type: 'user' | 'assistant';
  timestamp: string;
  content: unknown;
  tokens?: number;
  inputTokens?: number;
  outputTokens?: number;
  model?: string;
  toolCalls?: ParsedToolCall[];
}

export interface ParsedToolCall {
  id: string;
  messageUuid: string;
  name: string;
  input: Record<string, unknown>;
  timestamp: string;
}

interface ParsedFileSnapshot {
  filePath: string;
  timestamp: string;
}

export async function parseJSONL(
  filePath: string,
  startLine = 0,
  onProgress?: (processedLines: number) => void
): Promise<ParsedSession> {
  const messages: ParsedMessage[] = [];
  const fileSnapshots: ParsedFileSnapshot[] = [];
  const toolCalls: ParsedToolCall[] = [];
  const summaries: ParsedSession['summaries'] = [];
  const filesModified = new Set<string>();
  const foldersAccessed = new Set<string>();
  const metadata: NonNullable<ParsedSession['metadata']> = {};
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

    if (lineNumber < startLine) continue;
    processedLines++;

    if (processedLines % 100 === 0) {
      onProgress?.(processedLines);
    }

    if (!line.trim()) continue;

    try {
      const entry = JSON.parse(line) as Record<string, unknown>;

      captureMetadata(entry, metadata);

      switch (entry.type) {
        case 'summary':
          if (typeof entry.summary === 'string') {
            const summaryEntry = {
              leafUuid: typeof entry.leafUuid === 'string' ? entry.leafUuid : undefined,
              summary: entry.summary,
            };
            summary = summaryEntry;
            summaries.push(summaryEntry);
          }
          break;

        case 'permission-mode':
          if (typeof entry.permissionMode === 'string') {
            metadata.permissionMode = entry.permissionMode;
          }
          break;

        case 'user':
        case 'assistant': {
          const message = parseMessage(entry);
          if (message) {
            messages.push(message);

            if (message.toolCalls?.length) {
              toolCalls.push(...message.toolCalls);

              for (const toolCall of message.toolCalls) {
                collectPathsFromValue(toolCall.input, filesModified, foldersAccessed);
              }
            }
          }
          break;
        }

        case 'file-history-snapshot': {
          const snapshot = asRecord(entry.snapshot);
          const trackedFileBackups = asRecord(snapshot?.trackedFileBackups);
          const timestamp =
            typeof snapshot?.timestamp === 'string'
              ? snapshot.timestamp
              : typeof entry.timestamp === 'string'
                ? entry.timestamp
                : new Date().toISOString();

          if (trackedFileBackups) {
            for (const filePath of Object.keys(trackedFileBackups)) {
              fileSnapshots.push({
                filePath,
                timestamp,
              });
              filesModified.add(filePath);
              const folderPath = getFolderPath(filePath);
              if (folderPath) {
                foldersAccessed.add(folderPath);
              }
            }
          }
          break;
        }

        default:
          break;
      }
    } catch {
      // Skip malformed lines without failing the whole parse.
    }
  }

  return {
    messages,
    metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
    summary,
    summaries,
    fileSnapshots,
    filesModified: Array.from(filesModified),
    foldersAccessed: Array.from(foldersAccessed),
    toolCalls,
  };
}

export function parseMessage(entry: Record<string, unknown>): ParsedMessage | null {
  if (!entry.uuid || !entry.type || !entry.timestamp) {
    return null;
  }

  const messageRecord = asRecord(entry.message);
  const content = messageRecord?.content ?? entry.message ?? entry.content;
  const usage = asRecord(messageRecord?.usage);
  const outputTokens = readNumber(usage?.output_tokens);
  const inputTokens = readNumber(usage?.input_tokens);

  const message: ParsedMessage = {
    uuid: entry.uuid as string,
    parentUuid: entry.parentUuid as string | undefined,
    sessionId: (entry.sessionId as string) || '',
    type: entry.type as 'user' | 'assistant',
    timestamp: entry.timestamp as string,
    content,
    inputTokens: inputTokens || undefined,
    outputTokens: outputTokens || undefined,
    model: typeof messageRecord?.model === 'string' ? messageRecord.model : undefined,
  };

  if (entry.type === 'assistant' && messageRecord) {
    const parsedToolCalls = extractToolCalls(content, message.uuid, message.timestamp);
    if (parsedToolCalls.length > 0) {
      message.toolCalls = parsedToolCalls;
    }
  }

  if (typeof outputTokens === 'number' && outputTokens > 0) {
    message.tokens = outputTokens;
  } else if (typeof message.content === 'string') {
    message.tokens = Math.ceil(message.content.length / 4);
  } else {
    const contentStr = JSON.stringify(message.content);
    message.tokens = Math.ceil(contentStr.length / 4);
  }

  return message;
}

export function extractToolCalls(
  message: unknown,
  messageUuid: string,
  timestamp: string
): ParsedToolCall[] {
  const toolCalls: ParsedToolCall[] = [];

  const contentBlocks = Array.isArray(message)
    ? message
    : Array.isArray(asRecord(message)?.content)
      ? (asRecord(message)?.content as unknown[])
      : [];

  for (const block of contentBlocks) {
    if (typeof block === 'object' && block !== null) {
      const blockObj = block as Record<string, unknown>;
      if (blockObj.type === 'tool_use' && typeof blockObj.id === 'string') {
        toolCalls.push({
          id: blockObj.id,
          messageUuid,
          name: typeof blockObj.name === 'string' ? blockObj.name : 'unknown',
          input: asRecord(blockObj.input) || {},
          timestamp,
        });
      }
    }
  }

  return toolCalls;
}

function captureMetadata(
  entry: Record<string, unknown>,
  metadata: NonNullable<ParsedSession['metadata']>
) {
  if (!metadata.cwd && typeof entry.cwd === 'string') {
    metadata.cwd = entry.cwd;
  }

  if (!metadata.gitBranch && typeof entry.gitBranch === 'string') {
    metadata.gitBranch = entry.gitBranch;
  }

  if (!metadata.version && typeof entry.version === 'string') {
    metadata.version = entry.version;
  }
}

function collectPathsFromValue(
  value: unknown,
  filesModified: Set<string>,
  foldersAccessed: Set<string>,
  parentKey?: string
) {
  if (typeof value === 'string') {
    const normalizedParentKey = parentKey?.toLowerCase();
    if (normalizedParentKey && FILE_PATH_KEYS.has(normalizedParentKey) && looksLikePath(value)) {
      filesModified.add(value);
      const folderPath = getFolderPath(value);
      if (folderPath) {
        foldersAccessed.add(folderPath);
      }
      return;
    }

    if (normalizedParentKey && FOLDER_PATH_KEYS.has(normalizedParentKey) && looksLikePath(value)) {
      foldersAccessed.add(value);
    }
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectPathsFromValue(item, filesModified, foldersAccessed, parentKey);
    }
    return;
  }

  const record = asRecord(value);
  if (!record) {
    return;
  }

  for (const [key, nestedValue] of Object.entries(record)) {
    collectPathsFromValue(nestedValue, filesModified, foldersAccessed, key);
  }
}

function looksLikePath(value: string) {
  return value.includes('\\') || value.includes('/') || value.includes('.');
}

function getFolderPath(filePath: string) {
  const separators = /[\\/]/;
  if (!separators.test(filePath)) {
    return undefined;
  }

  const normalized = filePath.replace(/[\\/]+$/, '');
  const lastSeparator = Math.max(normalized.lastIndexOf('\\'), normalized.lastIndexOf('/'));
  return lastSeparator > 0 ? normalized.slice(0, lastSeparator) : undefined;
}

function asRecord(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  return value as Record<string, unknown>;
}

function readNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

const FILE_PATH_KEYS = new Set([
  'path',
  'filepath',
  'file_path',
  'targetfile',
  'target_file',
  'from',
  'to',
]);

const FOLDER_PATH_KEYS = new Set([
  'cwd',
  'directory',
  'dir',
  'folder',
  'folderpath',
  'projectpath',
]);
