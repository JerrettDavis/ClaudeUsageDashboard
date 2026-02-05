'use client';

import { Activity, Clock, DollarSign, MessageSquare } from 'lucide-react';
import { StatCard } from '@/components/shared/stat-card';
import { Skeleton } from '@/components/ui/skeleton';
import { trpc } from '@/lib/trpc/provider';

export function StatsCards() {
  const dateRange = {
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
    endDate: new Date(),
  };

  const { data: stats, isLoading } = trpc.analytics.usageStats.useQuery(dateRange);

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
    );
  }

  if (!stats) return null;

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const formatCost = (cost: number) => {
    return `$${cost.toFixed(2)}`;
  };

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <StatCard
        title="Total Sessions"
        value={stats.totalSessions}
        description="Last 30 days"
        icon={Activity}
      />
      <StatCard
        title="Total Tokens"
        value={formatNumber(stats.totalTokens)}
        description={`${formatNumber(stats.totalTokensInput)} in, ${formatNumber(stats.totalTokensOutput)} out`}
        icon={MessageSquare}
      />
      <StatCard
        title="Estimated Cost"
        value={formatCost(stats.estimatedCost)}
        description="Based on usage"
        icon={DollarSign}
      />
      <StatCard
        title="Active Time"
        value={`${Math.floor((stats.totalTokens || 0) / 100)}m`}
        description="Estimated from tokens"
        icon={Clock}
      />
    </div>
  );
}
