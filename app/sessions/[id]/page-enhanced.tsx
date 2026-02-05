'use client';

import { use } from 'react';
import { trpc } from '@/lib/trpc/provider';
import { DashboardLayout } from '@/components/shared/dashboard-layout';
import { StatusBadge } from '@/components/shared/status-badge';
import { MessageTimeline } from '@/components/sessions/message-timeline';
import { Files, Folder, Terminal, Zap, Clock, DollarSign, GitBranch, Code } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export default function SessionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: session, isLoading } = trpc.sessions.get.useQuery({ id });

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-[calc(100vh-3.5rem)]">
          <div className="flex items-center gap-3">
            <Terminal className="h-6 w-6 text-cyan-400 animate-pulse" />
            <span className="text-zinc-500 font-mono">LOADING SESSION...</span>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!session) {
    return (
      <DashboardLayout>
        <div className="p-6">
          <div className="border border-zinc-800 bg-zinc-900/50 rounded p-6 text-center">
            <Terminal className="h-12 w-12 text-zinc-700 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-zinc-400 mb-2 font-mono">Session Not Found</h2>
            <p className="text-sm text-zinc-600 font-mono">The requested session could not be located.</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const filesModified = session.filesModified ? JSON.parse(session.filesModified) : [];
  const foldersAccessed = session.foldersAccessed ? JSON.parse(session.foldersAccessed) : [];

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-cyan-400 font-mono">{session.projectName}</h1>
            <p className="text-sm text-zinc-500 font-mono mt-1">{session.projectPath}</p>
          </div>
          <StatusBadge status={session.status} />
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            icon={<Clock className="h-4 w-4 text-cyan-400" />}
            label="Duration"
            value={formatDistanceToNow(new Date(session.startTime))}
          />
          <StatCard
            icon={<Terminal className="h-4 w-4 text-emerald-400" />}
            label="Messages"
            value={(session.messageCount || 0).toString()}
          />
          <StatCard
            icon={<Zap className="h-4 w-4 text-amber-400" />}
            label="Tokens"
            value={((session.tokensInput || 0) + (session.tokensOutput || 0)).toLocaleString()}
          />
          <StatCard
            icon={<DollarSign className="h-4 w-4 text-rose-400" />}
            label="Cost"
            value={`$${(session.estimatedCost || 0).toFixed(4)}`}
          />
        </div>

        {/* Metadata Row */}
        {(session.cwd || session.gitBranch || session.version) && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {session.cwd && (
              <MetadataCard icon={<Folder className="h-4 w-4 text-cyan-400" />} label="Working Directory" value={session.cwd} />
            )}
            {session.gitBranch && (
              <MetadataCard icon={<GitBranch className="h-4 w-4 text-emerald-400" />} label="Git Branch" value={session.gitBranch} />
            )}
            {session.version && (
              <MetadataCard icon={<Code className="h-4 w-4 text-amber-400" />} label="Claude Version" value={session.version} />
            )}
          </div>
        )}

        {/* Summary */}
        {session.lastSummary && (
          <div className="border border-zinc-800 bg-zinc-900/50 rounded">
            <div className="border-b border-zinc-800 bg-zinc-900 px-4 py-2">
              <h2 className="text-sm font-semibold text-zinc-400 font-mono">SESSION SUMMARY</h2>
            </div>
            <div className="p-4">
              <p className="text-sm text-zinc-300 font-mono leading-relaxed">{session.lastSummary}</p>
            </div>
          </div>
        )}

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Files & Folders - Left Column */}
          <div className="space-y-6">
            {/* Files Modified */}
            {filesModified.length > 0 && (
              <div className="border border-zinc-800 bg-zinc-900/50 rounded">
                <div className="border-b border-zinc-800 bg-zinc-900 px-4 py-2 flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-zinc-400 font-mono flex items-center gap-2">
                    <Files className="h-4 w-4 text-cyan-400" />
                    FILES MODIFIED
                  </h2>
                  <span className="text-xs text-zinc-600 font-mono">{filesModified.length}</span>
                </div>
                <div className="p-4 max-h-[400px] overflow-y-auto">
                  <div className="space-y-1">
                    {filesModified.map((file: string, idx: number) => (
                      <div key={idx} className="text-xs text-zinc-400 font-mono hover:text-cyan-400 transition-colors py-1 px-2 hover:bg-zinc-800/50 rounded">
                        {file}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Folders Accessed */}
            {foldersAccessed.length > 0 && (
              <div className="border border-zinc-800 bg-zinc-900/50 rounded">
                <div className="border-b border-zinc-800 bg-zinc-900 px-4 py-2 flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-zinc-400 font-mono flex items-center gap-2">
                    <Folder className="h-4 w-4 text-emerald-400" />
                    FOLDERS
                  </h2>
                  <span className="text-xs text-zinc-600 font-mono">{foldersAccessed.length}</span>
                </div>
                <div className="p-4 max-h-[300px] overflow-y-auto">
                  <div className="space-y-1">
                    {foldersAccessed.map((folder: string, idx: number) => (
                      <div key={idx} className="text-xs text-zinc-400 font-mono hover:text-emerald-400 transition-colors py-1 px-2 hover:bg-zinc-800/50 rounded">
                        {folder}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Messages Timeline - Right 2 Columns */}
          <div className="lg:col-span-2">
            <div className="border border-zinc-800 bg-zinc-900/50 rounded">
              <div className="border-b border-zinc-800 bg-zinc-900 px-4 py-2">
                <h2 className="text-sm font-semibold text-zinc-400 font-mono">CONVERSATION</h2>
              </div>
              <div className="p-4">
                <MessageTimeline sessionId={id} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="border border-zinc-800 bg-zinc-900/50 rounded p-4">
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-xs text-zinc-500 font-mono">{label}</span>
      </div>
      <div className="text-lg font-semibold text-zinc-300 font-mono">{value}</div>
    </div>
  );
}

function MetadataCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="border border-zinc-800 bg-zinc-900/50 rounded p-3">
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="text-xs text-zinc-500 font-mono">{label}</span>
      </div>
      <div className="text-sm text-zinc-300 font-mono truncate">{value}</div>
    </div>
  );
}
