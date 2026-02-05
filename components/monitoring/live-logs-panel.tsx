'use client';

import { Home, Terminal, Wifi } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useEventSource } from '@/lib/hooks/use-event-source';
import { cn } from '@/lib/utils';

export function LiveLogsPanel() {
  const [events, setEvents] = useState<any[]>([]);
  const { isConnected, lastEvent } = useEventSource('/api/events/stream', {
    onEvent: (event) => {
      // Filter out noisy events
      if (event.type === 'ping' || event.type === 'connected' || event.type === 'status') {
        return; // Don't display these
      }

      // Filter out process:running heartbeats (too noisy)
      if (event.type === 'process:running') {
        return;
      }

      console.log('[LiveLogsPanel] Event:', event);
      setEvents((prev) => [...prev.slice(-99), event]); // Keep last 100 events
    },
  });

  return (
    <div className="flex flex-col h-full border border-zinc-800 bg-zinc-950 rounded overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 bg-zinc-900">
        <div className="flex items-center gap-2">
          <Link href="/dashboard">
            <Button
              variant="ghost"
              size="sm"
              className="text-zinc-400 hover:text-cyan-400 h-8 w-8 p-0"
            >
              <Home className="h-4 w-4" />
            </Button>
          </Link>
          <Terminal className="h-4 w-4 text-cyan-400" />
          <h2 className="text-sm font-semibold text-zinc-400 font-mono">LIVE LOGS</h2>
          <div
            className={cn(
              'h-2 w-2 rounded-full',
              isConnected ? 'bg-cyan-400 animate-pulse' : 'bg-zinc-600'
            )}
          />
          <span className="text-xs text-zinc-600 font-mono">{events.length} events</span>
        </div>
        <div className="flex items-center gap-2">
          {isConnected ? (
            <>
              <Wifi className="h-4 w-4 text-cyan-400" />
              <span className="text-xs text-cyan-400 font-mono">CONNECTED</span>
            </>
          ) : (
            <span className="text-xs text-zinc-600 font-mono">CONNECTING...</span>
          )}
        </div>
      </div>

      {/* Logs */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2 font-mono text-xs">
        {events.length === 0 ? (
          <div className="text-zinc-600 text-center py-8">
            {isConnected ? (
              <div className="space-y-2">
                <p>✓ Connected. Monitoring Claude sessions...</p>
                <p className="text-xs text-zinc-700">
                  Waiting for session activity (new sessions, messages, or process changes)
                </p>
                <p className="text-xs text-zinc-700">
                  Status and heartbeat events are hidden for clarity
                </p>
              </div>
            ) : (
              'Connecting to event stream...'
            )}
          </div>
        ) : (
          events.map((event, idx) => (
            <div key={idx} className="flex gap-2 hover:bg-zinc-900/50 px-2 py-1 rounded">
              <span className="text-zinc-600 shrink-0">
                {new Date(event.timestamp).toLocaleTimeString()}
              </span>
              <span
                className={cn(
                  'shrink-0 uppercase',
                  event.type?.includes('session') && 'text-cyan-400',
                  event.type?.includes('process:start') && 'text-emerald-400',
                  event.type?.includes('process:end') && 'text-rose-400',
                  event.type?.includes('message') && 'text-amber-400'
                )}
              >
                [{event.type}]
              </span>
              <span className="text-zinc-400 break-words flex-1">
                {event.type === 'process:start' && `PID ${event.pid} started`}
                {event.type === 'process:end' && `PID ${event.pid} ended`}
                {event.type === 'session:new' && `New session: ${event.sessionId}`}
                {event.type === 'session:update' && `Session updated: ${event.sessionId}`}
                {event.type === 'message:new' && event.terminalOutput && (
                  <div className="space-y-0.5 font-mono text-xs pl-4">
                    {event.terminalOutput.map((line: string, idx: number) => {
                      const isUser = line.startsWith('❯');
                      const isAssistant = line.startsWith('●');
                      const isContinuation = line.startsWith('⎿');

                      return (
                        <div
                          key={idx}
                          className={cn(
                            isUser && 'text-cyan-300',
                            isAssistant && 'text-emerald-300',
                            isContinuation && 'text-amber-300',
                            !isUser && !isAssistant && !isContinuation && 'text-zinc-400'
                          )}
                        >
                          {line}
                        </div>
                      );
                    })}
                  </div>
                )}
                {event.type === 'message:new' && !event.terminalOutput && `message`}
                {![
                  'process:start',
                  'process:end',
                  'session:new',
                  'session:update',
                  'message:new',
                ].includes(event.type) && JSON.stringify(event.data || event, null, 0)}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
