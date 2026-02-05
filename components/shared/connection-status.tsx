'use client';

import { Wifi, WifiOff } from 'lucide-react';
import { useState } from 'react';
import { useEventSource } from '@/lib/hooks/use-event-source';

export function ConnectionStatus() {
  const [_events, setEvents] = useState<any[]>([]);
  const { isConnected, lastEvent } = useEventSource('/api/events/stream', {
    onEvent: (event) => {
      if (event.type !== 'ping') {
        console.log('[ConnectionStatus] Event:', event);
        setEvents((prev) => [...prev.slice(-9), event]); // Keep last 10 events
      }
    },
  });

  return (
    <div className="flex items-center gap-2">
      {isConnected ? (
        <>
          <div className="relative">
            <Wifi className="h-4 w-4 text-cyan-400" />
            {lastEvent && (
              <span className="absolute -top-1 -right-1 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-400"></span>
              </span>
            )}
          </div>
          <span className="text-xs text-cyan-400 font-mono">LIVE</span>
        </>
      ) : (
        <>
          <WifiOff className="h-4 w-4 text-zinc-600" />
          <span className="text-xs text-zinc-600 font-mono">OFFLINE</span>
        </>
      )}
    </div>
  );
}
