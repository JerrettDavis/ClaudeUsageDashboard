'use client';

import { DashboardLayout } from '@/components/shared/dashboard-layout';
import { Button } from '@/components/ui/button';
import { trpc } from '@/lib/trpc/provider';
import { RefreshCw, Terminal, Zap, DollarSign, FileText, Play, Activity, Clock } from 'lucide-react';
import { useState } from 'react';
import Link from 'next/link';
import { StatusBadge } from '@/components/shared/status-badge';
import { formatDistanceToNow } from 'date-fns';

export default function DashboardPage() {
  const [isSyncing, setIsSyncing] = useState(false);
  const utils = trpc.useUtils();

  const { data: sessions, isLoading } = trpc.sessions.list.useQuery({ limit: 8 });
  const { data: stats } = trpc.analytics.usageStats.useQuery({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
    endDate: new Date(),
  });

  const syncMutation = trpc.sync.syncProvider.useMutation({
    onSuccess: () => {
      utils.sessions.list.invalidate();
      utils.analytics.usageStats.invalidate();
      setIsSyncing(false);
    },
    onError: () => {
      setIsSyncing(false);
    },
  });

  const handleSync = () => {
    setIsSyncing(true);
    syncMutation.mutate({ providerId: 'claude' });
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-[calc(100vh-3.5rem)]">
          <div className="flex items-center gap-3">
            <Terminal className="h-6 w-6 text-cyan-400 animate-pulse" />
            <span className="text-zinc-500 font-mono">LOADING SYSTEMS...</span>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const sessionsList = sessions || [];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Stats Panel */}
          <div className="border border-zinc-800 bg-zinc-900/50 rounded">
            <div className="border-b border-zinc-800 bg-zinc-900 px-4 py-2">
              <h2 className="text-sm font-semibold text-zinc-400 font-mono flex items-center gap-2">
                <Activity className="h-4 w-4 text-cyan-400" />
                SYSTEM METRICS
              </h2>
            </div>
            <div className="p-4 space-y-4">
              <MetricItem
                icon={<Terminal className="h-4 w-4 text-cyan-400" />}
                label="Total Sessions"
                value={stats?.totalSessions || 0}
              />
              <MetricItem
                icon={<FileText className="h-4 w-4 text-emerald-400" />}
                label="Tokens In"
                value={(stats?.totalTokensInput || 0).toLocaleString()}
              />
              <MetricItem
                icon={<Zap className="h-4 w-4 text-amber-400" />}
                label="Tokens Out"
                value={(stats?.totalTokensOutput || 0).toLocaleString()}
              />
              <MetricItem
                icon={<DollarSign className="h-4 w-4 text-rose-400" />}
                label="Cost (Est)"
                value={`$${(stats?.estimatedCost || 0).toFixed(4)}`}
              />
            </div>
          </div>

          {/* Quick Actions Panel */}
          <div className="border border-zinc-800 bg-zinc-900/50 rounded">
            <div className="border-b border-zinc-800 bg-zinc-900 px-4 py-2">
              <h2 className="text-sm font-semibold text-zinc-400 font-mono flex items-center gap-2">
                <Zap className="h-4 w-4 text-cyan-400" />
                QUICK ACTIONS
              </h2>
            </div>
            <div className="p-4 space-y-2">
              <ActionButton
                icon={<RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />}
                label={isSyncing ? "Syncing..." : "Sync Claude Data"}
                onClick={handleSync}
                disabled={isSyncing}
                variant="cyan"
              />
              <ActionButton
                icon={<Play className="h-4 w-4" />}
                label="Start New Session"
                onClick={() => console.log('Start session')}
                variant="green"
              />
              <ActionButton
                icon={<FileText className="h-4 w-4" />}
                label="View All Sessions"
                onClick={() => window.location.href = '/sessions'}
                variant="default"
              />
            </div>
          </div>

          {/* Recent Activity Panel */}
          <div className="border border-zinc-800 bg-zinc-900/50 rounded">
            <div className="border-b border-zinc-800 bg-zinc-900 px-4 py-2">
              <h2 className="text-sm font-semibold text-zinc-400 font-mono flex items-center gap-2">
                <Clock className="h-4 w-4 text-cyan-400" />
                RECENT ACTIVITY
              </h2>
            </div>
            <div className="p-4 space-y-2">
              {sessionsList.slice(0, 5).map((session) => (
                <Link
                  key={session.id}
                  href={`/sessions/${session.id}`}
                  className="block p-2 rounded border border-zinc-800 hover:border-cyan-500/30 hover:bg-zinc-800/50 transition-all group"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <StatusBadge status={session.status} />
                      <span className="text-xs text-zinc-300 font-mono truncate group-hover:text-cyan-400">
                        {session.projectName}
                      </span>
                    </div>
                    <span className="text-[10px] text-zinc-600 font-mono shrink-0">
                      {formatDistanceToNow(new Date(session.startTime))}
                    </span>
                  </div>
                </Link>
              ))}
              {sessionsList.length === 0 && (
                <p className="text-xs text-zinc-600 font-mono text-center py-4">No sessions yet</p>
              )}
            </div>
          </div>
        </div>

        {/* Sessions Table */}
        <div className="border border-zinc-800 bg-zinc-900/50 rounded">
          <div className="border-b border-zinc-800 bg-zinc-900 px-4 py-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-400 font-mono">SESSION LOG</h2>
            <Link href="/sessions">
              <button className="text-xs text-cyan-400 hover:text-cyan-300 font-mono transition-colors">
                VIEW ALL →
              </button>
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-zinc-800 bg-zinc-900/80">
                <tr className="text-xs font-mono text-zinc-500">
                  <th className="px-4 py-2 text-left">STATUS</th>
                  <th className="px-4 py-2 text-left">PROJECT</th>
                  <th className="px-4 py-2 text-left">TIME</th>
                  <th className="px-4 py-2 text-right">MSGS</th>
                  <th className="px-4 py-2 text-right">TOKENS</th>
                  <th className="px-4 py-2 text-right">COST</th>
                </tr>
              </thead>
              <tbody className="font-mono text-xs">
                {sessionsList.map((session) => (
                  <tr
                    key={session.id}
                    className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <StatusBadge status={session.status} />
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/sessions/${session.id}`}
                        className="text-zinc-300 hover:text-cyan-400 transition-colors"
                      >
                        {session.projectName}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-zinc-500">
                      {new Date(session.startTime).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right text-zinc-400">
                      {session.messageCount}
                    </td>
                    <td className="px-4 py-3 text-right text-zinc-400">
                      {((session.tokensInput || 0) + (session.tokensOutput || 0)).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right text-emerald-400">
                      ${(session.estimatedCost || 0).toFixed(4)}
                    </td>
                  </tr>
                ))}
                {sessionsList.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-zinc-600 font-mono text-xs">
                      No sessions found. Click "Sync Claude Data" to import sessions.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

function MetricItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-xs text-zinc-500 font-mono">{label}</span>
      </div>
      <span className="text-sm font-semibold text-zinc-300 font-mono">{value}</span>
    </div>
  );
}

function ActionButton({
  icon,
  label,
  onClick,
  variant = 'default',
  disabled = false,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  variant?: 'default' | 'cyan' | 'green';
  disabled?: boolean;
}) {
  const variants = {
    default: 'border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800',
    cyan: 'border-cyan-500/30 hover:border-cyan-500/50 hover:bg-cyan-500/10 text-cyan-400',
    green: 'border-emerald-500/30 hover:border-emerald-500/50 hover:bg-emerald-500/10 text-emerald-400',
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full flex items-center gap-2 px-3 py-2 rounded border text-xs font-mono transition-all disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]}`}
    >
      {icon}
      {label}
    </button>
  );
}
