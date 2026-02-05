'use client';

import { DashboardLayout } from '@/components/shared/dashboard-layout';
import { trpc } from '@/lib/trpc/provider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { StatusBadge } from '@/components/shared/status-badge';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { useState } from 'react';
import { Filter } from 'lucide-react';

export default function SessionsPage() {
  const [filter, setFilter] = useState<'all' | 'active' | 'completed' | 'error'>('all');

  const { data: sessions, isLoading } = trpc.sessions.list.useQuery({
    status: filter === 'all' ? undefined : filter,
    limit: 50,
  });

  const { data: count } = trpc.sessions.count.useQuery({
    status: filter === 'all' ? undefined : filter,
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">Sessions</h1>
          <p className="text-muted-foreground">
            Browse and analyze your Claude AI sessions
          </p>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>All Sessions</CardTitle>
                <CardDescription>
                  {count !== undefined ? `${count} total sessions` : 'Loading...'}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant={filter === 'all' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilter('all')}
                >
                  All
                </Button>
                <Button
                  variant={filter === 'active' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilter('active')}
                >
                  Active
                </Button>
                <Button
                  variant={filter === 'completed' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilter('completed')}
                >
                  Completed
                </Button>
                <Button
                  variant={filter === 'error' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilter('error')}
                >
                  Error
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : sessions && sessions.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Project</TableHead>
                    <TableHead>Started</TableHead>
                    <TableHead>Messages</TableHead>
                    <TableHead>Tokens</TableHead>
                    <TableHead>Cost</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sessions.map((session) => (
                    <TableRow key={session.id}>
                      <TableCell className="font-medium">
                        <div>
                          <p>{session.projectName}</p>
                          <p className="text-xs text-muted-foreground">
                            {session.projectPath}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="text-sm">
                            {formatDistanceToNow(new Date(session.startTime))} ago
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(session.startTime).toLocaleDateString()}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>{session.messageCount}</TableCell>
                      <TableCell>
                        <div>
                          <p className="text-sm">
                            {((session.tokensInput || 0) + (session.tokensOutput || 0)).toLocaleString()}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {(session.tokensInput || 0).toLocaleString()} in, {(session.tokensOutput || 0).toLocaleString()} out
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>${(session.estimatedCost || 0).toFixed(3)}</TableCell>
                      <TableCell>
                        <StatusBadge status={session.status} />
                      </TableCell>
                      <TableCell>
                        <Link href={`/sessions/${session.id}`}>
                          <Button variant="ghost" size="sm">
                            View
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-12">
                <p className="text-muted-foreground">No sessions found</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
