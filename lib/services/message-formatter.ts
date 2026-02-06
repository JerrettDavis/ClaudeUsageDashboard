/**
 * Formats Claude/Clawdbot JSONL messages into terminal-style output
 * Supports both Claude Code and Clawdbot session formats
 */

interface SessionMessage {
  type: 'user' | 'assistant' | 'message' | 'toolResult';
  message?: {
    role?: 'user' | 'assistant' | 'toolResult';
    content: unknown;
    stop_reason?: string | null;
    provider?: string;
    model?: string;
  };
  timestamp?: string;
}

export function formatMessageAsTerminal(msg: SessionMessage): string[] {
  const lines: string[] = [];

  // Safety checks
  if (!msg) return lines;
  
  // Determine the message type - handle both Claude and Clawdbot formats
  // Claude: type is 'user' or 'assistant'
  // Clawdbot: type is 'message', role is in message.role
  let msgType = msg.type;
  if (msg.type === 'message' && msg.message?.role) {
    msgType = msg.message.role as any;
  }
  
  // Get content - could be on msg directly or in msg.message
  const content = msg.message?.content;
  if (!content) return lines;

  if (msgType === 'user') {
    // Format user input with ❯ prompt
    // Handle content as array
    if (Array.isArray(content)) {
      const textContent = (content as Array<{type?: string; text?: string}>).find((c) => c && c.type === 'text');
      if (textContent?.text) {
        lines.push(`❯ ${textContent.text}`);
      }
    }
    // Handle content as string or object with text property
    else if (typeof content === 'string') {
      lines.push(`❯ ${content}`);
    } else if ((content as any)?.text) {
      lines.push(`❯ ${(content as any).text}`);
    }
    return lines;
  }

  // Handle tool results (Clawdbot format)
  if (msgType === 'toolResult') {
    const resultText = extractResultText(content as string | Array<{ type: string; text?: string }> | undefined);
    if (resultText) {
      const truncated = truncate(resultText, 100);
      lines.push(`  ⎿  ${truncated}`);
    }
    return lines;
  }

  if (msgType === 'assistant') {
    const contentArray = (Array.isArray(content) ? content : [content]) as Array<Record<string, any>>;

    for (const item of contentArray) {
      if (!item) continue;

      if (item.type === 'text' && item.text) {
        // Regular assistant text with ● bullet
        lines.push(`● ${item.text}`);
      } else if (item.type === 'thinking' && item.thinking) {
        // Thinking block (Clawdbot extended thinking)
        lines.push(`💭 ${truncate(item.thinking, 80)}`);
      } else if (item.type === 'tool_use' || item.type === 'toolCall') {
        // Tool call with ● and tool name
        const name = item.name || 'Unknown';
        const input = item.input || item.arguments || {};

        // Format based on common tool types
        if (name === 'Bash' || name === 'powershell') {
          const cmd = input.command || input.description || '';
          lines.push(`● ${name}(${truncate(String(cmd), 80)})`);
        } else if (name === 'Read' || name === 'view') {
          const path = input.path || '';
          lines.push(`● ${name}(${path})`);
        } else if (name === 'Write' || name === 'create') {
          const path = input.path || '';
          lines.push(`● ${name}(${path})`);
        } else if (name === 'edit') {
          const path = input.path || '';
          lines.push(`● ${name}(${path})`);
        } else if (name === 'Search' || name === 'grep') {
          const pattern = input.pattern || '';
          lines.push(`● ${name}(pattern: "${pattern}")`);
        } else {
          lines.push(`● ${name}(${JSON.stringify(input).slice(0, 60)}...)`);
        }
      } else if (item.type === 'tool_result') {
        // Tool result with ⎿ continuation
        const resultText = extractResultText(item.content);
        if (resultText) {
          const truncated = truncate(resultText, 100);
          if (item.is_error) {
            lines.push(`  ⎿  Error: ${truncated}`);
          } else {
            lines.push(`  ⎿  ${truncated}`);
          }
        }
      }
    }
  }

  return lines;
}

function extractResultText(
  content: string | Array<{ type: string; text?: string }> | undefined
): string {
  if (!content) return '';

  if (typeof content === 'string') {
    return content.trim();
  }

  if (Array.isArray(content)) {
    return content
      .filter((c) => c.type === 'text' && c.text)
      .map((c) => c.text)
      .join(' ')
      .trim();
  }

  return '';
}

function truncate(text: string, maxLength: number): string {
  // Remove newlines and extra whitespace
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (cleaned.length <= maxLength) return cleaned;
  return `${cleaned.slice(0, maxLength)}...`;
}

/**
 * Format a batch of messages with timestamps
 */
export function formatMessagesWithTimestamps(
  messages: SessionMessage[]
): Array<{ timestamp: string; lines: string[] }> {
  return messages.map((msg) => ({
    timestamp: msg.timestamp || new Date().toISOString(),
    lines: formatMessageAsTerminal(msg),
  }));
}
