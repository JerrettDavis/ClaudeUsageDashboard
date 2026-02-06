'use client';

import { Home, Zap, LayoutGrid } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { LiveLogsPanel } from '@/components/monitoring/live-logs-panel';

export default function MonitoringPage() {
  return (
    <div className="h-screen flex flex-col p-6 gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-cyan-400/10 rounded border border-cyan-400/20">
            <Zap className="h-5 w-5 text-cyan-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-zinc-100 font-mono">REAL-TIME MONITORING</h1>
            <p className="text-sm text-zinc-500 font-mono">Live session activity and logs</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/monitoring/sessions">
            <Button variant="outline" size="sm" className="text-cyan-400 border-cyan-500/50 hover:bg-cyan-500/20">
              <LayoutGrid className="h-4 w-4 mr-2" />
              Tiling View
            </Button>
          </Link>
          <Link href="/dashboard">
            <Button variant="outline" size="sm" className="text-cyan-400 border-cyan-500/50 hover:bg-cyan-500/20">
              <Home className="h-4 w-4 mr-2" />
              Dashboard
            </Button>
          </Link>
        </div>
      </div>

      {/* Live Logs Panel */}
      <div className="flex-1">
        <LiveLogsPanel />
      </div>
    </div>
  );
}
