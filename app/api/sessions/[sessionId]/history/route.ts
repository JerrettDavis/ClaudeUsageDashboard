import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { type NextRequest, NextResponse } from 'next/server';
import { formatMessageAsTerminal } from '@/lib/services/message-formatter';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '100', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    // Find the session file
    const homeDir = process.env.HOME || process.env.USERPROFILE || '';
    const projectsPath = join(homeDir, '.claude', 'projects');

    // Try to find the file in any project directory
    const { readdir, stat } = await import('node:fs/promises');
    const projectDirs = await readdir(projectsPath);

    let sessionFilePath: string | null = null;

    for (const dir of projectDirs) {
      const filePath = join(projectsPath, dir, `${sessionId}.jsonl`);
      try {
        await stat(filePath);
        sessionFilePath = filePath;
        break;
      } catch {
        // File not found in this directory, continue
      }
    }

    if (!sessionFilePath) {
      return NextResponse.json({ error: 'Session file not found' }, { status: 404 });
    }

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
