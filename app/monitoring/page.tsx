'use client';

import { Zap } from 'lucide-react';
import { LiveLogsPanel } from '@/components/monitoring/live-logs-panel';

export default function MonitoringPage() {
  return (
    <div className="h-screen flex flex-col p-6 gap-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-cyan-400/10 rounded border border-cyan-400/20">
          <Zap className="h-5 w-5 text-cyan-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-zinc-100 font-mono">REAL-TIME MONITORING</h1>
          <p className="text-sm text-zinc-500 font-mono">Live session activity and logs</p>
        </div>
      </div>

      {/* Live Logs Panel */}
      <div className="flex-1">
        <LiveLogsPanel />
      </div>
    </div>
  );
}
