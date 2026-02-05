'use client';

import { trpc } from '@/lib/trpc/provider';
import { DashboardLayout } from '@/components/shared/dashboard-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle2, XCircle, Play, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export default function SyncStatusPage() {
  const { data: activeSyncs, refetch: refetchActive } = trpc.syncStatus.getActiveSyncs.useQuery(undefined, {
    refetchInterval: 1000, // Poll every second
  });

  const { data: history } = trpc.syncStatus.getHistory.useQuery({ limit: 20 });

  const startSyncMutation = trpc.syncStatus.startSync.useMutation({
    onSuccess: () => {
      refetchActive();
    },
  });

  const handleStartSync = (providerId: string) => {
    startSyncMutation.mutate({ providerId });
  };

  const activeSync = activeSyncs?.[0];
  const isRunning = !!activeSync;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Sync Status</h1>
            <p className="text-muted-foreground">
              Monitor and manage data synchronization
            </p>
          </div>
          <Button
            onClick={() => handleStartSync('claude')}
            disabled={isRunning || startSyncMutation.isPending}
          >
            {isRunning ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Syncing...
              </>
            ) : (
              <>
                <Play className="mr-2 h-4 w-4" />
                Start Sync
              </>
            )}
          </Button>
        </div>

        {/* Active Sync */}
        {activeSync && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Active Sync</CardTitle>
                  <CardDescription>
                    {activeSync.providerId} • Started {formatDistanceToNow(new Date(activeSync.startTime))} ago
                  </CardDescription>
                </div>
                <Badge variant="default" className="gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Running
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Progress */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{activeSync.currentStep}</span>
                  <span className="text-muted-foreground">
                    {activeSync.processedFiles} / {activeSync.totalFiles}
                  </span>
                </div>
                <Progress 
                  value={activeSync.totalFiles > 0 ? (activeSync.processedFiles / activeSync.totalFiles) * 100 : 0} 
                />
              </div>

              {/* Stats */}
              <div className="grid grid-cols-4 gap-4">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Phase</p>
                  <p className="text-lg font-semibold capitalize">{activeSync.phase}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Success</p>
                  <p className="text-lg font-semibold text-green-600">{activeSync.successCount}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Errors</p>
                  <p className="text-lg font-semibold text-red-600">{activeSync.errorCount}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Total Files</p>
                  <p className="text-lg font-semibold">{activeSync.totalFiles}</p>
                </div>
              </div>

              {/* Logs */}
              <div className="space-y-2">
                <h3 className="text-sm font-medium">Recent Logs</h3>
                <ScrollArea className="h-48 rounded-lg border bg-gray-50 dark:bg-gray-900 p-3">
                  <div className="space-y-1 font-mono text-xs">
                    {activeSync.logs.slice(-20).reverse().map((log, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <span className="text-muted-foreground whitespace-nowrap">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </span>
                        <span className={
                          log.level === 'error' ? 'text-red-600' :
                          log.level === 'warn' ? 'text-yellow-600' :
                          'text-foreground'
                        }>
                          [{log.level.toUpperCase()}]
                        </span>
                        <span>{log.message}</span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>

              {/* Errors */}
              {activeSync.errors.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-medium">Errors ({activeSync.errors.length})</h3>
                  <ScrollArea className="h-32 rounded-lg border bg-red-50 dark:bg-red-900/10 p-3">
                    <div className="space-y-2 text-xs">
                      {activeSync.errors.slice(-10).map((error, i) => (
                        <div key={i} className="space-y-1">
                          <p className="font-medium text-red-600">{error.file}</p>
                          <p className="text-muted-foreground">{error.error}</p>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* No Active Sync */}
        {!activeSync && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Clock className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">No sync in progress</p>
              <Button onClick={() => handleStartSync('claude')}>
                <Play className="mr-2 h-4 w-4" />
                Start New Sync
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Sync History */}
        <Card>
          <CardHeader>
            <CardTitle>Sync History</CardTitle>
            <CardDescription>Recent synchronization runs</CardDescription>
          </CardHeader>
          <CardContent>
            {history && history.length > 0 ? (
              <div className="space-y-3">
                {history.map((sync) => {
                  const duration = sync.endTime 
                    ? (new Date(sync.endTime).getTime() - new Date(sync.startTime).getTime()) / 1000
                    : 0;

                  return (
                    <div key={sync.id} className="flex items-center justify-between rounded-lg border p-4">
                      <div className="flex items-center gap-4">
                        {sync.status === 'completed' ? (
                          <CheckCircle2 className="h-5 w-5 text-green-600" />
                        ) : (
                          <XCircle className="h-5 w-5 text-red-600" />
                        )}
                        <div>
                          <p className="font-medium">{sync.providerId}</p>
                          <p className="text-sm text-muted-foreground">
                            {formatDistanceToNow(new Date(sync.startTime))} ago • {duration.toFixed(1)}s
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-6 text-sm">
                        <div>
                          <span className="text-muted-foreground">Files:</span>
                          <span className="ml-2 font-medium">{sync.processedFiles}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Success:</span>
                          <span className="ml-2 font-medium text-green-600">{sync.successCount}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Errors:</span>
                          <span className="ml-2 font-medium text-red-600">{sync.errorCount}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">No sync history yet</p>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
