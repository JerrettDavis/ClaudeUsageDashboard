'use client';

import { Search } from 'lucide-react';
import { trpc } from '@/lib/trpc/provider';
import { ConnectionStatus } from './connection-status';

export function TopBar({ onCommandOpen }: { onCommandOpen: () => void }) {
  const { data: activeSessions } = trpc.sessions.list.useQuery({
    status: 'active',
    limit: 10,
  });

  return (
    <div className="border-b border-zinc-800 bg-zinc-950/95 backdrop-blur-sm">
      {/* Main top bar */}
      <div className="flex h-14 items-center gap-4 px-4">
        {/* Command Palette Trigger */}
        <button
          onClick={onCommandOpen}
          className="flex flex-1 max-w-md items-center gap-2 rounded border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-500 hover:border-cyan-500/30 hover:text-zinc-400 transition-colors"
        >
          <Search className="h-4 w-4" />
          <span className="font-mono text-xs">Search or type command...</span>
          <kbd className="ml-auto pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border border-zinc-700 bg-zinc-800 px-1.5 font-mono text-[10px] font-medium text-zinc-500">
            ⌘K
          </kbd>
        </button>

        {/* Right side - Connection Status */}
        <div className="ml-auto flex items-center gap-2">
          <ConnectionStatus />
        </div>
      </div>

      {/* Active Sessions Ticker */}
      {activeSessions && activeSessions.length > 0 && (
        <div className="border-t border-zinc-800/50 bg-zinc-900/50 px-4 py-2">
          <div className="flex items-center gap-4 overflow-x-auto scrollbar-hide">
            <span className="text-xs font-semibold text-zinc-500 font-mono shrink-0">ACTIVE:</span>
            {activeSessions.map((session) => (
              <div
                key={session.id}
                className="flex items-center gap-2 rounded border border-cyan-500/20 bg-cyan-500/5 px-2 py-1 shrink-0"
              >
                <div className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
                <span className="text-xs text-zinc-300 font-mono">{session.projectName}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
