'use client';

import { keepPreviousData } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import {
  Activity,
  BarChart3,
  Clock3,
  FolderTree,
  Gauge,
  GitBranch,
  Sparkles,
  Terminal,
  TrendingUp,
  Wrench,
} from 'lucide-react';
import { type ReactNode, useMemo, useState } from 'react';
import {
  Area,
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { DashboardLayout } from '@/components/shared/dashboard-layout';
import { trpc } from '@/lib/trpc/provider';

const RANGE_OPTIONS = [7, 30, 90] as const;
const PANEL_SKELETON_LINE_CLASSES = [
  'w-full',
  'w-5/6',
  'w-2/3',
  'w-3/4',
  'w-1/2',
  'w-4/5',
] as const;

export default function AnalyticsPage() {
  const [rangeDays, setRangeDays] = useState<(typeof RANGE_OPTIONS)[number]>(30);

  const range = useMemo(
    () => ({
      startDate: new Date(Date.now() - rangeDays * 24 * 60 * 60 * 1000),
      endDate: new Date(),
    }),
    [rangeDays]
  );

  const { data: summary, isLoading: summaryLoading } = trpc.analytics.summary.useQuery(range, {
    placeholderData: keepPreviousData,
  });
  const { data: dailyBreakdown, isLoading: dailyLoading } = trpc.analytics.dailyBreakdown.useQuery(
    range,
    { placeholderData: keepPreviousData }
  );
  const { data: statusBreakdown, isLoading: statusLoading } =
    trpc.analytics.statusBreakdown.useQuery(range, { placeholderData: keepPreviousData });
  const { data: toolBreakdown, isLoading: toolLoading } = trpc.analytics.toolBreakdown.useQuery(
    range,
    { placeholderData: keepPreviousData }
  );
  const { data: activityByHour, isLoading: activityLoading } =
    trpc.analytics.activityByHour.useQuery(range, { placeholderData: keepPreviousData });
  const { data: topProjects, isLoading: projectsLoading } = trpc.analytics.topProjects.useQuery(
    {
      ...range,
      limit: 6,
    },
    { placeholderData: keepPreviousData }
  );
  const { data: hotspots, isLoading: hotspotsLoading } = trpc.analytics.hotspots.useQuery(
    {
      ...range,
      limit: 6,
    },
    { placeholderData: keepPreviousData }
  );

  const trendData = dailyBreakdown || [];
  const tools = toolBreakdown || [];
  const statuses = statusBreakdown || [];
  const hours = activityByHour || [];
  const projects = topProjects || [];
  const topFiles = hotspots?.topFiles || [];
  const topFolders = hotspots?.topFolders || [];

  return (
    <DashboardLayout>
      <div className="space-y-6 px-4 py-6 md:px-6 lg:px-8">
        <section className="border border-zinc-800 bg-zinc-900/50">
          <div className="border-b border-zinc-800 bg-zinc-900 px-4 py-3 md:px-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.24em] text-cyan-400 font-mono">
                  <BarChart3 className="h-3.5 w-3.5" />
                  Operator Analytics
                </div>
                <div>
                  <h1 className="text-2xl font-semibold text-zinc-100 md:text-3xl">
                    Real usage, workflow health, and where the agent spends time
                  </h1>
                  <p className="mt-2 max-w-3xl text-sm text-zinc-400">
                    Built from synced Claude sessions, messages, tools, projects, and transcript
                    hotspots. This is the slice that turns transcript history into an actual
                    operator dashboard.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {RANGE_OPTIONS.map((days) => (
                  <button
                    key={days}
                    type="button"
                    onClick={() => setRangeDays(days)}
                    className={`min-w-16 border px-3 py-2 text-xs font-mono transition-colors ${
                      rangeDays === days
                        ? 'border-cyan-500/60 bg-cyan-500/10 text-cyan-300'
                        : 'border-zinc-800 bg-zinc-950 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300'
                    }`}
                  >
                    {days}D
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-px border-t border-zinc-800 bg-zinc-800 md:grid-cols-2 xl:grid-cols-6">
            <MetricCard
              label="Sessions"
              value={formatCompactNumber(summary?.totalSessions)}
              detail={`${formatCompactNumber(summary?.completedSessions)} completed`}
              accent="cyan"
              icon={<Activity className="h-4 w-4" />}
              loading={summaryLoading && !summary}
            />
            <MetricCard
              label="Active Projects"
              value={formatCompactNumber(summary?.activeProjects)}
              detail={summary?.busiestProject?.projectName || 'No project activity yet'}
              accent="emerald"
              icon={<GitBranch className="h-4 w-4" />}
              loading={summaryLoading && !summary}
            />
            <MetricCard
              label="Completion Rate"
              value={formatPercent(summary?.completionRate)}
              detail={`${formatPercent(summary?.errorRate)} error rate`}
              accent="violet"
              icon={<Gauge className="h-4 w-4" />}
              loading={summaryLoading && !summary}
            />
            <MetricCard
              label="Avg Session"
              value={formatDurationMinutes(summary?.averageSessionDurationMinutes)}
              detail={`${formatCompactNumber(summary?.averageMessagesPerSession)} msgs / ${formatCompactNumber(summary?.averageTokensPerSession)} tokens`}
              accent="amber"
              icon={<Clock3 className="h-4 w-4" />}
              loading={summaryLoading && !summary}
            />
            <MetricCard
              label="Tool Calls"
              value={formatCompactNumber(tools.reduce((sum, tool) => sum + tool.count, 0))}
              detail={
                summary?.topTool
                  ? `${summary.topTool.name} leads with ${summary.topTool.count}`
                  : 'Tool usage will appear after sync'
              }
              accent="rose"
              icon={<Wrench className="h-4 w-4" />}
              loading={(summaryLoading && !summary) || (toolLoading && tools.length === 0)}
            />
            <MetricCard
              label="Spend"
              value={formatCurrency(summary?.estimatedCost)}
              detail={`${formatCompactNumber(summary?.totalTokens)} tokens in ${rangeDays}d`}
              accent="blue"
              icon={<TrendingUp className="h-4 w-4" />}
              loading={summaryLoading && !summary}
            />
          </div>
        </section>
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.8fr)]">
          <Panel
            title="Throughput Trend"
            eyebrow={`Last ${rangeDays} days`}
            description="Session volume and token demand over time."
          >
            {dailyLoading && trendData.length === 0 ? (
              <PanelSkeleton />
            ) : (
              <ChartShell>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={trendData}>
                    <CartesianGrid stroke="#27272a" vertical={false} />
                    <XAxis dataKey="date" stroke="#71717a" tick={{ fontSize: 11 }} />
                    <YAxis
                      yAxisId="tokens"
                      stroke="#71717a"
                      tick={{ fontSize: 11 }}
                      tickFormatter={formatCompactNumber}
                    />
                    <YAxis
                      yAxisId="sessions"
                      orientation="right"
                      stroke="#71717a"
                      tick={{ fontSize: 11 }}
                      allowDecimals={false}
                    />
                    <Tooltip content={<AnalyticsTooltip />} />
                    <Area
                      yAxisId="tokens"
                      type="monotone"
                      dataKey="tokens"
                      stroke="#22d3ee"
                      fill="rgba(34, 211, 238, 0.18)"
                      strokeWidth={2}
                    />
                    <Line
                      yAxisId="sessions"
                      type="monotone"
                      dataKey="sessions"
                      stroke="#f59e0b"
                      strokeWidth={2}
                      dot={{ r: 2 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </ChartShell>
            )}
          </Panel>

          <Panel
            title="Session Health"
            eyebrow="Status mix"
            description="How cleanly work sessions are resolving."
          >
            {statusLoading && statuses.length === 0 ? (
              <PanelSkeleton />
            ) : (
              <ChartShell>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={statuses}>
                    <CartesianGrid stroke="#27272a" vertical={false} />
                    <XAxis dataKey="status" stroke="#71717a" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} stroke="#71717a" tick={{ fontSize: 11 }} />
                    <Tooltip content={<AnalyticsTooltip />} />
                    <Bar dataKey="sessions" radius={[0, 0, 0, 0]}>
                      {statuses.map((entry) => (
                        <Cell
                          key={entry.status}
                          fill={
                            entry.status === 'completed'
                              ? '#34d399'
                              : entry.status === 'error'
                                ? '#fb7185'
                                : '#22d3ee'
                          }
                        />
                      ))}
                    </Bar>
                  </ComposedChart>
                </ResponsiveContainer>
              </ChartShell>
            )}

            <div className="grid gap-3 border-t border-zinc-800 pt-4 md:grid-cols-2">
              <InsightCard
                icon={<Sparkles className="h-4 w-4 text-cyan-400" />}
                label="Peak Hour"
                value={
                  summary?.mostActiveHour !== null && summary?.mostActiveHour !== undefined
                    ? `${String(summary.mostActiveHour).padStart(2, '0')}:00 UTC`
                    : 'No activity yet'
                }
                loading={summaryLoading && !summary}
              />
              <InsightCard
                icon={<Terminal className="h-4 w-4 text-emerald-400" />}
                label="Busiest Day"
                value={
                  summary?.busiestDay
                    ? `${summary.busiestDay.date} · ${summary.busiestDay.sessions} sessions`
                    : 'No activity yet'
                }
                loading={summaryLoading && !summary}
              />
            </div>
          </Panel>
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <Panel
            title="Tool Mix"
            eyebrow="Most used actions"
            description="Which tools the assistant is leaning on most."
          >
            {toolLoading && tools.length === 0 ? (
              <PanelSkeleton />
            ) : (
              <ChartShell>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart layout="vertical" data={tools}>
                    <CartesianGrid stroke="#27272a" horizontal={false} />
                    <XAxis type="number" stroke="#71717a" tick={{ fontSize: 11 }} />
                    <YAxis
                      type="category"
                      dataKey="toolName"
                      width={90}
                      stroke="#71717a"
                      tick={{ fontSize: 11 }}
                    />
                    <Tooltip content={<AnalyticsTooltip />} />
                    <Bar dataKey="count" fill="#22d3ee" />
                  </ComposedChart>
                </ResponsiveContainer>
              </ChartShell>
            )}
          </Panel>

          <Panel
            title="Activity by Hour"
            eyebrow="Work rhythm"
            description="When sessions tend to start across the selected range."
          >
            {activityLoading && hours.length === 0 ? (
              <PanelSkeleton />
            ) : (
              <ChartShell>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={hours}>
                    <CartesianGrid stroke="#27272a" vertical={false} />
                    <XAxis
                      dataKey="hour"
                      stroke="#71717a"
                      tick={{ fontSize: 11 }}
                      tickFormatter={(hour) => `${String(hour).padStart(2, '0')}`}
                    />
                    <YAxis allowDecimals={false} stroke="#71717a" tick={{ fontSize: 11 }} />
                    <Tooltip content={<AnalyticsTooltip />} />
                    <Bar dataKey="sessions" fill="#a78bfa" />
                  </ComposedChart>
                </ResponsiveContainer>
              </ChartShell>
            )}
          </Panel>
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(340px,0.9fr)]">
          <Panel
            title="Project Leaderboard"
            eyebrow="Where the work lands"
            description="Projects ranked by token volume for the current range."
          >
            {projectsLoading && projects.length === 0 ? (
              <PanelSkeleton lines={6} />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] border border-zinc-800">
                  <thead className="bg-zinc-950 text-[11px] uppercase tracking-[0.18em] text-zinc-500 font-mono">
                    <tr>
                      <th className="px-4 py-3 text-left">Project</th>
                      <th className="px-4 py-3 text-right">Sessions</th>
                      <th className="px-4 py-3 text-right">Tokens</th>
                      <th className="px-4 py-3 text-right">Cost</th>
                      <th className="px-4 py-3 text-right">Last Active</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800 text-sm text-zinc-300">
                    {projects.map((project) => (
                      <tr key={project.projectPath} className="bg-zinc-900/30">
                        <td className="px-4 py-3">
                          <div className="font-medium text-zinc-100">{project.projectName}</div>
                          <div className="mt-1 font-mono text-[11px] text-zinc-500">
                            {project.projectPath}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right font-mono">
                          {project.sessions.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right font-mono">
                          {formatCompactNumber(project.tokens)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-emerald-400">
                          {formatCurrency(project.cost)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-zinc-500">
                          {formatDistanceToNow(project.lastActive, { addSuffix: true })}
                        </td>
                      </tr>
                    ))}
                    {projects.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-sm text-zinc-500">
                          Sync Claude data to populate project analytics.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          <Panel
            title="Hotspots"
            eyebrow="Touched most often"
            description="Top folders and files appearing in synced session activity."
          >
            {hotspotsLoading && topFolders.length === 0 && topFiles.length === 0 ? (
              <div className="grid gap-4 md:grid-cols-2">
                <PanelSkeleton lines={5} />
                <PanelSkeleton lines={5} />
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                <CompactList
                  title="Folders"
                  icon={<FolderTree className="h-4 w-4 text-emerald-400" />}
                  items={topFolders}
                  empty="No folder activity yet"
                />
                <CompactList
                  title="Files"
                  icon={<Terminal className="h-4 w-4 text-cyan-400" />}
                  items={topFiles}
                  empty="No file activity yet"
                />
              </div>
            )}
          </Panel>
        </div>
      </div>
    </DashboardLayout>
  );
}

function MetricCard({
  label,
  value,
  detail,
  accent,
  icon,
  loading = false,
}: {
  label: string;
  value: string;
  detail: string;
  accent: 'cyan' | 'emerald' | 'violet' | 'amber' | 'rose' | 'blue';
  icon: ReactNode;
  loading?: boolean;
}) {
  const accentClasses = {
    cyan: 'text-cyan-400',
    emerald: 'text-emerald-400',
    violet: 'text-violet-400',
    amber: 'text-amber-400',
    rose: 'text-rose-400',
    blue: 'text-blue-400',
  };

  return (
    <div className="bg-zinc-900/70 px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-500 font-mono">
          {label}
        </div>
        <div className={accentClasses[accent]}>{icon}</div>
      </div>
      {loading ? (
        <>
          <div className="mt-3 h-8 w-24 animate-pulse bg-zinc-800/50" />
          <div className="mt-2 h-4 w-40 animate-pulse bg-zinc-800/30" />
        </>
      ) : (
        <>
          <div className="mt-3 text-2xl font-semibold text-zinc-100 font-mono">{value}</div>
          <div className="mt-2 text-xs text-zinc-500">{detail}</div>
        </>
      )}
    </div>
  );
}

function Panel({
  title,
  eyebrow,
  description,
  children,
}: {
  title: string;
  eyebrow: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="border border-zinc-800 bg-zinc-900/50">
      <div className="border-b border-zinc-800 bg-zinc-900 px-4 py-3">
        <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-500 font-mono">
          {eyebrow}
        </div>
        <h2 className="mt-1 text-lg font-semibold text-zinc-100">{title}</h2>
        <p className="mt-1 text-sm text-zinc-500">{description}</p>
      </div>
      <div className="space-y-4 p-4">{children}</div>
    </section>
  );
}

function ChartShell({ children }: { children: ReactNode }) {
  return <div className="h-[280px] min-w-0 w-full">{children}</div>;
}

function InsightCard({
  icon,
  label,
  value,
  loading = false,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  loading?: boolean;
}) {
  return (
    <div className="border border-zinc-800 bg-zinc-950/60 px-3 py-3">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-zinc-500 font-mono">
        {icon}
        {label}
      </div>
      {loading ? (
        <div className="mt-2 h-5 w-40 animate-pulse bg-zinc-800/40" />
      ) : (
        <div className="mt-2 text-sm text-zinc-200">{value}</div>
      )}
    </div>
  );
}

function CompactList({
  title,
  icon,
  items,
  empty,
}: {
  title: string;
  icon: ReactNode;
  items: Array<{ name: string; count: number }>;
  empty: string;
}) {
  return (
    <div className="border border-zinc-800 bg-zinc-950/60">
      <div className="flex items-center gap-2 border-b border-zinc-800 px-3 py-2 text-[11px] uppercase tracking-[0.18em] text-zinc-500 font-mono">
        {icon}
        {title}
      </div>
      <div className="divide-y divide-zinc-800">
        {items.length > 0 ? (
          items.map((item) => (
            <div key={item.name} className="flex items-start justify-between gap-3 px-3 py-3">
              <div className="min-w-0">
                <div className="truncate text-sm text-zinc-200">{item.name}</div>
              </div>
              <div className="shrink-0 font-mono text-xs text-cyan-400">{item.count}</div>
            </div>
          ))
        ) : (
          <div className="px-3 py-6 text-sm text-zinc-500">{empty}</div>
        )}
      </div>
    </div>
  );
}

function AnalyticsTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number | string; color?: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) {
    return null;
  }

  return (
    <div className="border border-zinc-800 bg-zinc-950/95 px-3 py-2 shadow-2xl">
      {label ? <div className="mb-2 text-xs font-mono text-zinc-400">{label}</div> : null}
      <div className="space-y-1">
        {payload.map((entry) => (
          <div key={entry.name} className="flex items-center justify-between gap-4 text-xs">
            <span className="text-zinc-400" style={{ color: entry.color }}>
              {entry.name}
            </span>
            <span className="font-mono text-zinc-100">
              {typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PanelSkeleton({ lines = 4 }: { lines?: number }) {
  return (
    <div className="space-y-3">
      <div className="h-[220px] animate-pulse bg-zinc-800/30" />
      {PANEL_SKELETON_LINE_CLASSES.slice(0, lines).map((widthClass) => (
        <div
          key={`panel-skeleton-${widthClass}`}
          className={`h-4 animate-pulse bg-zinc-800/20 ${widthClass}`}
        />
      ))}
    </div>
  );
}

function formatCompactNumber(value?: number | null) {
  const safeValue = Number(value || 0);
  if (safeValue >= 1_000_000) return `${(safeValue / 1_000_000).toFixed(1)}M`;
  if (safeValue >= 1_000) return `${(safeValue / 1_000).toFixed(1)}K`;
  return safeValue.toString();
}

function formatCurrency(value?: number | null) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function formatPercent(value?: number | null) {
  return `${Number(value || 0).toFixed(1)}%`;
}

function formatDurationMinutes(value?: number | null) {
  const minutes = Number(value || 0);
  if (minutes >= 60) {
    return `${(minutes / 60).toFixed(1)}h`;
  }

  return `${minutes.toFixed(1)}m`;
}
