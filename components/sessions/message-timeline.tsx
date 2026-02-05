'use client';

import { formatDistanceToNow } from 'date-fns';
import { Bot, User, Wrench } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { trpc } from '@/lib/trpc/provider';

interface MessageTimelineProps {
  sessionId: string;
}

export function MessageTimeline({ sessionId }: MessageTimelineProps) {
  const { data: session, isLoading } = trpc.sessions.get.useQuery({ id: sessionId });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-xs text-zinc-600 font-mono">Loading messages...</p>
      </div>
    );
  }

  if (!session || !session.messages || session.messages.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-xs text-zinc-600 font-mono">No messages found</p>
      </div>
    );
  }

  const parseContent = (content: string) => {
    try {
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        return parsed;
      }
      return [{ type: 'text', text: parsed }];
    } catch {
      return [{ type: 'text', text: content }];
    }
  };

  return (
    <div className="space-y-6">
      {session.messages.map((message: any) => {
        const contentBlocks = parseContent(message.content);
        const isUser = message.role === 'user';

        return (
          <div
            key={message.id}
            className={`flex gap-4 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
          >
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                isUser
                  ? 'bg-cyan-500/20 border border-cyan-500/30'
                  : 'bg-emerald-500/20 border border-emerald-500/30'
              }`}
            >
              {isUser ? (
                <User className="h-5 w-5 text-cyan-400" />
              ) : (
                <Bot className="h-5 w-5 text-emerald-400" />
              )}
            </div>

            <div className={`flex-1 ${isUser ? 'max-w-[85%]' : 'max-w-[90%]'}`}>
              <div className="mb-2 flex items-center gap-3">
                <p className="text-sm font-semibold font-mono text-zinc-200">
                  {isUser ? 'You' : 'Claude'}
                </p>
                <p className="text-xs text-zinc-600 font-mono">
                  {formatDistanceToNow(new Date(message.timestamp))} ago
                </p>
                {message.tokens > 0 && (
                  <Badge variant="outline" className="text-xs font-mono border-zinc-700">
                    {message.tokens} tokens
                  </Badge>
                )}
              </div>

              <div className="space-y-3">
                {contentBlocks.map((block: any, blockIndex: number) => {
                  if (block.type === 'text') {
                    return (
                      <div
                        key={blockIndex}
                        className="border border-zinc-800 bg-zinc-900/30 rounded p-4"
                      >
                        <p className="text-sm leading-relaxed text-zinc-300 whitespace-pre-wrap">
                          {block.text}
                        </p>
                      </div>
                    );
                  }

                  if (block.type === 'tool_use') {
                    return (
                      <div
                        key={blockIndex}
                        className="rounded border border-amber-500/40 bg-amber-500/5 p-4"
                      >
                        <div className="flex items-center gap-2 mb-3">
                          <Wrench className="h-4 w-4 text-amber-400" />
                          <p className="text-sm font-semibold font-mono text-amber-400">
                            {block.name}
                          </p>
                        </div>
                        <pre className="text-xs overflow-x-auto text-zinc-400 font-mono bg-black/20 p-3 rounded">
                          {JSON.stringify(block.input, null, 2)}
                        </pre>
                      </div>
                    );
                  }

                  if (block.type === 'tool_result') {
                    return (
                      <div
                        key={blockIndex}
                        className="rounded border border-emerald-500/40 bg-emerald-500/5 p-4"
                      >
                        <p className="text-xs font-semibold mb-2 font-mono text-emerald-400">
                          Tool Result
                        </p>
                        <pre className="text-xs overflow-x-auto text-zinc-400 font-mono bg-black/20 p-3 rounded">
                          {typeof block.content === 'string'
                            ? block.content
                            : JSON.stringify(block.content, null, 2)}
                        </pre>
                      </div>
                    );
                  }

                  return null;
                })}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
