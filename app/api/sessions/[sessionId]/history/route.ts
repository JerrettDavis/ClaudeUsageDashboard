import { readFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { type NextRequest, NextResponse } from 'next/server';
import { formatMessageAsTerminal } from '@/lib/services/message-formatter';

async function findSessionFile(sessionId: string): Promise<string | null> {
  const homeDir = process.env.HOME || process.env.USERPROFILE || '';

  // Search locations: Claude projects + Clawdbot agents
  const searchPaths: Array<{ base: string; pattern: 'flat' | 'nested' }> = [
    { base: join(homeDir, '.claude', 'projects'), pattern: 'flat' },
    { base: join(homeDir, '.clawdbot', 'agents'), pattern: 'nested' },
  ];

  for (const { base, pattern } of searchPaths) {
    try {
      const dirs = await readdir(base);

      for (const dir of dirs) {
        let searchDir = join(base, dir);

        // For Clawdbot: agents/{agentId}/sessions/
        if (pattern === 'nested') {
          searchDir = join(searchDir, 'sessions');
          try {
            await stat(searchDir);
          } catch {
            continue; // No sessions folder
          }
        }

        // Try exact match first
        const exactPath = join(searchDir, `${sessionId}.jsonl`);
        try {
          await stat(exactPath);
          return exactPath;
        } catch {
          // Not found, try partial match
        }

        // Try partial match (sessionId might be truncated in UI)
        try {
          const files = await readdir(searchDir);
          const match = files.find(
            (f) => f.endsWith('.jsonl') && (f.startsWith(sessionId) || f.includes(sessionId))
          );
          if (match) {
            return join(searchDir, match);
          }
        } catch {
          // Can't read directory
        }
      }
    } catch {
      // Base path doesn't exist
    }
  }

  return null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '100', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const sessionFilePath = await findSessionFile(sessionId);

    if (!sessionFilePath) {
      console.error(`[History API] Session file not found: ${sessionId}`);
      return NextResponse.json({ error: 'Session file not found' }, { status: 404 });
    }

    console.log(`[History API] Found session file: ${sessionFilePath}`);

    // Read and parse the file
    const content = await readFile(sessionFilePath, 'utf-8');
    const lines = content.split('\n').filter((line) => line.trim());
    const totalLines = lines.length;

    // Get the most recent messages (reverse for newest first, then slice)
    const startIdx = Math.max(0, totalLines - limit - offset);
    const endIdx = totalLines - offset;
    const messagesToProcess = lines.slice(startIdx, endIdx);

    const messages: Array<{ time: string; lines: string[] }> = [];

    for (const line of messagesToProcess) {
      try {
        const entry = JSON.parse(line);
        const terminalLines = formatMessageAsTerminal(entry);

        if (terminalLines.length > 0) {
          messages.push({
            time: entry.timestamp
              ? new Date(entry.timestamp).toLocaleTimeString()
              : new Date().toLocaleTimeString(),
            lines: terminalLines,
          });
        }
      } catch (parseError) {
        console.error('[History API] Failed to parse line:', parseError);
      }
    }

    return NextResponse.json({
      sessionId,
      messages,
      totalLines,
      limit,
      offset,
      hasMore: startIdx > 0,
    });
  } catch (error) {
    console.error('[History API] Error:', error);
    return NextResponse.json({ error: 'Failed to load session history' }, { status: 500 });
  }
}
