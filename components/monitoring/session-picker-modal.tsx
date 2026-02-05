'use client';

import { useState, useEffect } from 'react';
import { X, Terminal, Clock, MessageSquare, Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useEventSource } from '@/lib/hooks/use-event-source';

interface Session {
  id: string;
  projectName: string;
  status: 'active' | 'completed' | 'error';
  messageCount: number;
  lastActivity?: Date;
  startTime: Date;
}

interface SessionPickerModalProps {
  open: boolean;
  onClose: () => void;
  onSelectSession: (sessionId: string) => void;
  excludeIds?: string[];
}

export function SessionPickerModal({
  open,
  onClose,
  onSelectSession,
  excludeIds = [],
}: SessionPickerModalProps) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(false);

  // Listen to event stream for active sessions
  useEventSource('/api/events/stream', {
    onEvent: (event) => {
      if (event.type === 'session:new' || event.type === 'session:update') {
        setSessions((prev) => {
          const existing = prev.find(s => s.id === event.sessionId);
          if (existing) {
            // Update existing
            return prev.map(s => 
              s.id === event.sessionId 
                ? { ...s, lastActivity: new Date(), status: 'active' }
                : s
            );
          } else {
            // Add new session
            return [...prev, {
              id: event.sessionId,
              projectName: event.sessionId.slice(0, 8) + '...',
              status: 'active' as const,
              messageCount: 0,
              lastActivity: new Date(),
              startTime: new Date(),
            }];
          }
        });
      }
    },
  });

  // Don't need to fetch - we'll show sessions as they appear in the stream
  useEffect(() => {
    if (open && sessions.length === 0) {
      // Show a helpful message after a moment if no sessions detected
      const timer = setTimeout(() => {
        setLoading(false);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [open, sessions.length]);

  const handleSelect = (sessionId: string) => {
    onSelectSession(sessionId);
    onClose();
  };

  const getTimeSince = (date: Date) => {
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] bg-zinc-900 border-cyan-500/30">
        <DialogHeader>
          <DialogTitle className="text-cyan-400 font-mono flex items-center gap-2">
            <Terminal className="h-5 w-5" />
            SELECT SESSION
          </DialogTitle>
          <DialogDescription className="text-zinc-500">
            Choose a Claude session to monitor in real-time
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[500px] pr-4">
          {sessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-zinc-600">
              <Terminal className="h-12 w-12 mb-3 opacity-50" />
              <p>Waiting for active sessions...</p>
              <p className="text-sm text-zinc-700 mt-1">
                Sessions will appear here when they have live activity
              </p>
              <p className="text-xs text-zinc-800 mt-2">
                Start typing in a Claude Code session to see it here
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {sessions
                .filter((s) => !excludeIds.includes(s.id))
                .map((session) => (
                  <button
                    key={session.id}
                    onClick={() => handleSelect(session.id)}
                    className={cn(
                      'w-full text-left p-4 rounded-lg border transition-all',
                      'hover:bg-cyan-500/10 hover:border-cyan-500/50',
                      'border-zinc-800 bg-zinc-950/50',
                      'focus:outline-none focus:ring-2 focus:ring-cyan-500/50'
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium text-zinc-200 truncate">
                            {session.projectName}
                          </span>
                          <span
                            className={cn(
                              'text-xs px-2 py-0.5 rounded font-mono',
                              session.status === 'active' &&
                                'bg-emerald-500/20 text-emerald-400',
                              session.status === 'completed' &&
                                'bg-zinc-500/20 text-zinc-400',
                              session.status === 'error' && 'bg-red-500/20 text-red-400'
                            )}
                          >
                            {session.status}
                          </span>
                        </div>

                        <div className="text-xs text-zinc-600 font-mono truncate mb-2">
                          {session.id}
                        </div>

                        <div className="flex items-center gap-4 text-xs text-zinc-500">
                          <div className="flex items-center gap-1">
                            <MessageSquare className="h-3 w-3" />
                            <span>{session.messageCount || 0} messages</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            <span>
                              {getTimeSince(
                                session.lastActivity || session.startTime
                              )}
                            </span>
                          </div>
                        </div>
                      </div>

                      {session.status === 'active' && (
                        <Activity className="h-4 w-4 text-emerald-400 shrink-0 animate-pulse" />
                      )}
                    </div>
                  </button>
                ))}
            </div>
          )}
        </ScrollArea>

        <div className="flex justify-end gap-2 pt-4 border-t border-zinc-800">
          <Button
            variant="ghost"
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-200"
          >
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
