/**
 * Formats Claude JSONL messages into terminal-style output
 */

interface ClaudeMessage {
  type: 'user' | 'assistant';
  message: {
    content: Array<{
      type: 'text' | 'tool_use' | 'tool_result';
      text?: string;
      name?: string;
      input?: Record<string, unknown>;
      content?: string | Array<{ type: string; text?: string }>;
      tool_use_id?: string;
      is_error?: boolean;
    }>;
    role?: string;
    stop_reason?: string | null;
  };
  timestamp?: string;
}

export function formatMessageAsTerminal(msg: ClaudeMessage): string[] {
  const lines: string[] = [];

  // Safety checks
  if (!msg || !msg.type || !msg.message?.content) return lines;

  if (msg.type === 'user') {
    // Format user input with ❯ prompt
    const content = msg.message.content;
    
    // Handle content as array
    if (Array.isArray(content)) {
      const textContent = content.find(c => c && c.type === 'text');
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

  if (msg.type === 'assistant') {
    const content = msg.message.content;
    const contentArray = Array.isArray(content) ? content : [content];
    
    for (const item of contentArray) {
      if (!item) continue;
      
      if (item.type === 'text' && item.text) {
        // Regular assistant text with ● bullet
        lines.push(`● ${item.text}`);
      } else if (item.type === 'tool_use') {
        // Tool call with ● and tool name
        const name = item.name || 'Unknown';
        const input = item.input || {};
        
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
          if (content.is_error) {
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

function extractResultText(content: string | Array<{ type: string; text?: string }> | undefined): string {
  if (!content) return '';
  
  if (typeof content === 'string') {
    return content.trim();
  }
  
  if (Array.isArray(content)) {
    return content
      .filter(c => c.type === 'text' && c.text)
      .map(c => c.text)
      .join(' ')
      .trim();
  }
  
  return '';
}

function truncate(text: string, maxLength: number): string {
  // Remove newlines and extra whitespace
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (cleaned.length <= maxLength) return cleaned;
  return cleaned.slice(0, maxLength) + '...';
}

/**
 * Format a batch of messages with timestamps
 */
export function formatMessagesWithTimestamps(messages: ClaudeMessage[]): Array<{ timestamp: string; lines: string[] }> {
  return messages.map(msg => ({
    timestamp: msg.timestamp || new Date().toISOString(),
    lines: formatMessageAsTerminal(msg),
  }));
}
