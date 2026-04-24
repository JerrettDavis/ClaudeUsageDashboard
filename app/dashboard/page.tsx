'use client';

import { keepPreviousData } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import {
  Activity,
  BarChart3,
  Clock,
  DollarSign,
  FileText,
  RefreshCw,
  Terminal,
  Zap,
} from 'lucide-react';
import Link from 'next/link';
import { type ReactNode, useMemo, useState } from 'react';
import { DashboardLayout } from '@/components/shared/dashboard-layout';
import { StatusBadge } from '@/components/shared/status-badge';
import { trpc } from '@/lib/trpc/provider';

export default function DashboardPage() {
  const [isSyncing, setIsSyncing] = useState(false);
  const utils = trpc.useUtils();
  const analyticsRange = useMemo(
    () => ({
      startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      endDate: new Date(),
    }),
    []
  );

  const { data: sessions, isLoading: sessionsLoading } = trpc.sessions.list.useQuery(
    { limit: 8 },
    { placeholderData: keepPreviousData }
  );
  const { data: summary, isLoading: summaryLoading } = trpc.analytics.summary.useQuery(
    analyticsRange,
    { placeholderData: keepPreviousData }
  );

  const syncMutation = trpc.sync.syncProvider.useMutation({
    onSuccess: () => {
      utils.sessions.list.invalidate();
      utils.analytics.summary.invalidate();
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
                value={summary?.totalSessions || 0}
                loading={summaryLoading && !summary}
              />
              <MetricItem
                icon={<BarChart3 className="h-4 w-4 text-emerald-400" />}
                label="Active Projects"
                value={summary?.activeProjects || 0}
                loading={summaryLoading && !summary}
              />
              <MetricItem
                icon={<Zap className="h-4 w-4 text-amber-400" />}
                label="Completion Rate"
                value={`${(summary?.completionRate || 0).toFixed(1)}%`}
                loading={summaryLoading && !summary}
              />
              <MetricItem
                icon={<DollarSign className="h-4 w-4 text-rose-400" />}
                label="Cost (Est)"
                value={`$${(summary?.estimatedCost || 0).toFixed(4)}`}
                loading={summaryLoading && !summary}
              />
              <MetricItem
                icon={<FileText className="h-4 w-4 text-blue-400" />}
                label="Avg Tokens"
                value={(summary?.averageTokensPerSession || 0).toLocaleString()}
                loading={summaryLoading && !summary}
              />
              <MetricItem
                icon={<Clock className="h-4 w-4 text-violet-400" />}
                label="Avg Session"
                value={formatDurationMinutes(summary?.averageSessionDurationMinutes)}
                loading={summaryLoading && !summary}
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
                label={isSyncing ? 'Syncing...' : 'Sync Claude Data'}
                onClick={handleSync}
                disabled={isSyncing}
                variant="cyan"
              />
              <ActionButton
                icon={<BarChart3 className="h-4 w-4" />}
                label="Open Analytics"
                onClick={() => {
                  window.location.href = '/analytics';
                }}
                variant="green"
              />
              <ActionButton
                icon={<FileText className="h-4 w-4" />}
                label="View All Sessions"
                onClick={() => {
                  window.location.href = '/sessions';
                }}
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
              {sessionsLoading && sessionsList.length === 0
                ? ['recent-a', 'recent-b', 'recent-c', 'recent-d'].map((placeholderId) => (
                    <div
                      key={placeholderId}
                      className="h-10 animate-pulse border border-zinc-800 bg-zinc-800/40"
                    />
                  ))
                : sessionsList.slice(0, 5).map((session) => (
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
              {!sessionsLoading && sessionsList.length === 0 && (
                <p className="text-xs text-zinc-600 font-mono text-center py-4">No sessions yet</p>
              )}
            </div>
          </div>
        </div>

        {/* Sessions Table */}
        <div className="border border-zinc-800 bg-zinc-900/50 rounded">
          <div className="border-b border-zinc-800 bg-zinc-900 px-4 py-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-400 font-mono">SESSION LOG</h2>
            <Link
              href="/sessions"
              className="text-xs text-cyan-400 hover:text-cyan-300 font-mono transition-colors"
            >
              VIEW ALL →
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
                {sessionsLoading && sessionsList.length === 0
                  ? ['row-a', 'row-b', 'row-c', 'row-d'].map((placeholderId) => (
                      <tr key={placeholderId} className="border-b border-zinc-800/50">
                        <td colSpan={6} className="px-4 py-3">
                          <div className="h-8 animate-pulse bg-zinc-800/40" />
                        </td>
                      </tr>
                    ))
                  : sessionsList.map((session) => (
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
                          {(
                            (session.tokensInput || 0) + (session.tokensOutput || 0)
                          ).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right text-emerald-400">
                          ${(session.estimatedCost || 0).toFixed(4)}
                        </td>
                      </tr>
                    ))}
                {!sessionsLoading && sessionsList.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-8 text-center text-zinc-600 font-mono text-xs"
                    >
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

function MetricItem({
  icon,
  label,
  value,
  loading = false,
}: {
  icon: ReactNode;
  label: string;
  value: string | number;
  loading?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-xs text-zinc-500 font-mono">{label}</span>
      </div>
      {loading ? (
        <span className="h-4 w-20 animate-pulse bg-zinc-800/50" />
      ) : (
        <span className="text-sm font-semibold text-zinc-300 font-mono">{value}</span>
      )}
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
  icon: ReactNode;
  label: string;
  onClick: () => void;
  variant?: 'default' | 'cyan' | 'green';
  disabled?: boolean;
}) {
  const variants = {
    default: 'border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800',
    cyan: 'border-cyan-500/30 hover:border-cyan-500/50 hover:bg-cyan-500/10 text-cyan-400',
    green:
      'border-emerald-500/30 hover:border-emerald-500/50 hover:bg-emerald-500/10 text-emerald-400',
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`w-full flex items-center gap-2 px-3 py-2 rounded border text-xs font-mono transition-all disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]}`}
    >
      {icon}
      {label}
    </button>
  );
}

function formatDurationMinutes(value?: number | null) {
  const minutes = Number(value || 0);
  if (minutes >= 60) {
    return `${(minutes / 60).toFixed(1)}h`;
  }

  return `${minutes.toFixed(1)}m`;
}
