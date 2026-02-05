'use client';

import {
  ChevronDown,
  ChevronUp,
  Clock,
  Coins,
  Folder,
  Home,
  Maximize2,
  MessageSquare,
  Plus,
  Terminal,
  X,
  Zap,
  ZapOff,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useEventSource } from '@/lib/hooks/use-event-source';
import { cn } from '@/lib/utils';
import { SessionPickerModal } from './session-picker-modal';

// Global message cache to avoid re-fetching history
const messageCache = new Map<string, Array<{ time: string; lines: string[] }>>();

interface SessionTerminalProps {
  sessionId: string;
  onRemove: () => void;
  onMaximize?: () => void;
}

interface SessionStats {
  projectPath?: string;
  projectName?: string;
  messageCount: number;
  tokensInput: number;
  tokensOutput: number;
  estimatedCost: number;
  duration: string;
  startTime?: Date;
}

function SessionTerminal({ sessionId, onRemove, onMaximize }: SessionTerminalProps) {
  const [messages, setMessages] = useState<Array<{ time: string; lines: string[] }>>([]);
  const [showDetails, setShowDetails] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [hasMoreHistory, setHasMoreHistory] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [stats, setStats] = useState<SessionStats>({
    messageCount: 0,
    tokensInput: 0,
    tokensOutput: 0,
    estimatedCost: 0,
    duration: '0s',
  });
  const scrollRef = useRef<HTMLDivElement>(null);
  const startTimeRef = useRef<Date>(new Date());

  // Load message history on mount
  useEffect(() => {
    const loadHistory = async () => {
      // Check cache first
      const cached = messageCache.get(sessionId);
      if (cached) {
        console.log(`[SessionTerminal] Using cached messages (${cached.length} messages)`);
        setMessages(cached);

        // Update stats from cached messages
        const totalChars = cached.reduce((sum, msg) => sum + msg.lines.join('').length, 0);

        setStats((prev) => ({
          ...prev,
          messageCount: cached.length,
          tokensInput: Math.floor(totalChars / 8),
          tokensOutput: Math.floor(totalChars / 8),
        }));

        setIsLoadingHistory(false);
        return;
      }

      // Otherwise fetch from API (most recent 100 messages)
      try {
        setIsLoadingHistory(true);
        const response = await fetch(`/api/sessions/${sessionId}/history?limit=100`);

        if (response.ok) {
          const data = await response.json();
          const loadedMessages = data.messages || [];

          // Cache the messages
          messageCache.set(sessionId, loadedMessages);

          setMessages(loadedMessages);
          setHasMoreHistory(data.hasMore || false);

          // Update stats from history
          const totalChars = loadedMessages.reduce(
            (sum: number, msg: { lines: string[] }) => sum + msg.lines.join('').length,
            0
          );

          setStats((prev) => ({
            ...prev,
            messageCount: loadedMessages.length,
            tokensInput: Math.floor(totalChars / 8),
            tokensOutput: Math.floor(totalChars / 8),
          }));

          console.log(
            `[SessionTerminal] Loaded ${loadedMessages.length} messages (hasMore: ${data.hasMore})`
          );
        } else {
          console.warn(`[SessionTerminal] Failed to load history: ${response.status}`);
        }
      } catch (error) {
        console.error('[SessionTerminal] Error loading history:', error);
      } finally {
        setIsLoadingHistory(false);
      }
    };

    loadHistory();
  }, [sessionId]);

  // Load more messages
  const loadMoreMessages = async () => {
    if (isLoadingMore || !hasMoreHistory) return;

    try {
      setIsLoadingMore(true);
      const currentOffset = messages.length;
      const response = await fetch(
        `/api/sessions/${sessionId}/history?limit=100&offset=${currentOffset}`
      );

      if (response.ok) {
        const data = await response.json();
        const olderMessages = data.messages || [];

        // Prepend older messages
        const updatedMessages = [...olderMessages, ...messages];
        messageCache.set(sessionId, updatedMessages);

        setMessages(updatedMessages);
        setHasMoreHistory(data.hasMore || false);

        console.log(
          `[SessionTerminal] Loaded ${olderMessages.length} more messages (hasMore: ${data.hasMore})`
        );
      }
    } catch (error) {
      console.error('[SessionTerminal] Error loading more messages:', error);
    } finally {
      setIsLoadingMore(false);
    }
  };

  // Update duration every second
  useEffect(() => {
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current.getTime();
      const seconds = Math.floor(elapsed / 1000);
      const minutes = Math.floor(seconds / 60);
      const hours = Math.floor(minutes / 60);

      let duration = '';
      if (hours > 0) {
        duration = `${hours}h ${minutes % 60}m`;
      } else if (minutes > 0) {
        duration = `${minutes}m ${seconds % 60}s`;
      } else {
        duration = `${seconds}s`;
      }

      setStats((prev) => ({ ...prev, duration }));
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  useEventSource('/api/events/stream', {
    onEvent: (event) => {
      // Only show events for this session
      if (event.sessionId !== sessionId) return;

      if (event.type === 'message:new' && event.terminalOutput) {
        setMessages((prev) => {
          const newMessages = [
            ...prev,
            {
              time: new Date(event.timestamp).toLocaleTimeString(),
              lines: event.terminalOutput,
            },
          ];

          // Update cache with new messages
          messageCache.set(sessionId, newMessages);

          return newMessages;
        });

        // Update stats
        setStats((prev) => ({
          ...prev,
          messageCount: prev.messageCount + 1,
          // Estimate tokens (rough approximation)
          tokensInput: prev.tokensInput + Math.floor(event.terminalOutput.join('').length / 4),
          tokensOutput: prev.tokensOutput + Math.floor(event.terminalOutput.join('').length / 4),
        }));
      }

      // Update session details from events
      if (event.type === 'session:update' && event.data) {
        setStats((prev) => ({
          ...prev,
          projectPath: event.data.projectPath || prev.projectPath,
          projectName: event.data.projectName || prev.projectName,
        }));
      }
    },
  });

  // Calculate estimated cost (rough estimate: $15/1M input tokens, $75/1M output tokens for Claude Sonnet)
  useEffect(() => {
    const inputCost = (stats.tokensInput / 1_000_000) * 3;
    const outputCost = (stats.tokensOutput / 1_000_000) * 15;
    setStats((prev) => ({
      ...prev,
      estimatedCost: inputCost + outputCost,
    }));
  }, [stats.tokensInput, stats.tokensOutput]);

  return (
    <div className="flex flex-col h-full border border-cyan-500/30 bg-black rounded-lg overflow-hidden shadow-lg shadow-cyan-500/20">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-cyan-950/30 border-b border-cyan-500/30">
        <div className="flex items-center gap-2">
          <Terminal className="h-4 w-4 text-cyan-400" />
          <span className="text-sm font-mono text-cyan-400 font-semibold">
            {sessionId.slice(0, 8)}...
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 hover:bg-cyan-500/20"
            onClick={() => setShowDetails(!showDetails)}
            title="Toggle details"
          >
            {showDetails ? (
              <ChevronUp className="h-4 w-4 text-cyan-400" />
            ) : (
              <ChevronDown className="h-4 w-4 text-cyan-400" />
            )}
          </Button>
          {onMaximize && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 hover:bg-cyan-500/20"
              onClick={onMaximize}
            >
              <Maximize2 className="h-4 w-4 text-cyan-400" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 hover:bg-red-500/20"
            onClick={onRemove}
          >
            <X className="h-4 w-4 text-red-400" />
          </Button>
        </div>
      </div>

      {/* Details Panel */}
      {showDetails && (
        <div className="px-3 py-2 bg-zinc-900/50 border-b border-cyan-500/20 space-y-1.5 text-xs font-mono">
          <div className="flex items-center gap-2 text-zinc-400">
            <Folder className="h-3.5 w-3.5 text-cyan-500" />
            <span className="text-cyan-300 font-medium">
              {stats.projectName || stats.projectPath || 'Unknown Project'}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
            <div className="flex items-center gap-2 text-zinc-400">
              <Clock className="h-3.5 w-3.5 text-amber-500" />
              <span>
                Duration: <span className="text-amber-300 font-semibold">{stats.duration}</span>
              </span>
            </div>
            <div className="flex items-center gap-2 text-zinc-400">
              <MessageSquare className="h-3.5 w-3.5 text-green-500" />
              <span>
                Messages: <span className="text-green-300 font-semibold">{stats.messageCount}</span>
              </span>
            </div>
            <div className="flex items-center gap-2 text-zinc-400">
              <Terminal className="h-3.5 w-3.5 text-blue-500" />
              <span>
                Tokens:{' '}
                <span className="text-blue-300 font-semibold">
                  {(stats.tokensInput + stats.tokensOutput).toLocaleString()}
                </span>
              </span>
            </div>
            <div className="flex items-center gap-2 text-zinc-400">
              <Coins className="h-3.5 w-3.5 text-yellow-500" />
              <span>
                Cost:{' '}
                <span className="text-yellow-300 font-semibold">
                  ${stats.estimatedCost.toFixed(4)}
                </span>
              </span>
            </div>
          </div>
          {stats.projectPath && (
            <div className="text-[10px] text-zinc-600 truncate pt-1 border-t border-zinc-800">
              {stats.projectPath}
            </div>
          )}
        </div>
      )}

      {/* Terminal Output */}
      <div ref={scrollRef} className="flex-1 bg-black overflow-y-auto">
        <div className="p-3 space-y-2 font-mono text-sm">
          {isLoadingHistory ? (
            <div className="text-zinc-600 text-center py-8">
              <div className="inline-block animate-spin rounded-full h-5 w-5 border-2 border-cyan-500 border-t-transparent mb-2"></div>
              <div className="text-sm">Loading recent messages...</div>
            </div>
          ) : (
            <>
              {hasMoreHistory && (
                <div className="text-center pb-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={loadMoreMessages}
                    disabled={isLoadingMore}
                    className="text-xs text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10"
                  >
                    {isLoadingMore ? (
                      <>
                        <div className="inline-block animate-spin rounded-full h-3 w-3 border border-cyan-500 border-t-transparent mr-2"></div>
                        Loading older messages...
                      </>
                    ) : (
                      <>↑ Load older messages</>
                    )}
                  </Button>
                </div>
              )}

              {messages.length === 0 ? (
                <div className="text-zinc-600 text-center py-8 text-sm">
                  Waiting for activity...
                </div>
              ) : (
                messages.map((msg, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="text-zinc-700 text-xs">{msg.time}</div>
                    <div className="space-y-0.5">
                      {msg.lines.map((line, lineIdx) => {
                        const isUser = line.startsWith('❯');
                        const isAssistant = line.startsWith('●');
                        const isContinuation = line.startsWith('⎿');

                        return (
                          <div
                            key={lineIdx}
                            className={cn(
                              'leading-relaxed',
                              isUser && 'text-cyan-300',
                              isAssistant && 'text-emerald-300',
                              isContinuation && 'text-amber-300',
                              !isUser && !isAssistant && !isContinuation && 'text-zinc-400'
                            )}
                          >
                            {line}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export function TilingMonitor() {
  const [sessions, setSessions] = useState<string[]>([]);
  const [availableSessions, setAvailableSessions] = useState<string[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [autoOpen, setAutoOpen] = useState(false);
  const [autoClose, setAutoClose] = useState(false);

  // Listen for new sessions and auto-add/remove
  useEventSource('/api/events/stream', {
    onEvent: (event) => {
      // Track available sessions from any activity
      if (
        event.sessionId &&
        (event.type === 'session:new' ||
          event.type === 'session:update' ||
          event.type === 'message:new')
      ) {
        setAvailableSessions((prev) => {
          if (!prev.includes(event.sessionId)) {
            return [...prev, event.sessionId];
          }
          return prev;
        });
      }

      // Auto-open: add new sessions when they first appear OR when they send their first message
      if (
        autoOpen &&
        (event.type === 'session:new' || (event.type === 'message:new' && event.sessionId))
      ) {
        const sessionId = event.sessionId;
        if (sessionId) {
          setSessions((prev) => {
            if (!prev.includes(sessionId)) {
              console.log(`[TilingMonitor] 🚀 Auto-opening session: ${sessionId}`);
              return [...prev, sessionId];
            }
            return prev;
          });
        }
      }

      // Auto-close finished sessions
      if (event.type === 'session:end' && autoClose) {
        setSessions((prev) => prev.filter((id) => id !== event.sessionId));
        setAvailableSessions((prev) => prev.filter((id) => id !== event.sessionId));
        console.log(`[TilingMonitor] 🔴 Auto-closing session: ${event.sessionId}`);
      }
    },
  });

  const addSession = () => {
    setShowPicker(true);
  };

  const handleSelectSession = (sessionId: string) => {
    if (!sessions.includes(sessionId)) {
      setSessions([...sessions, sessionId]);
    }
  };

  const removeSession = (sessionId: string) => {
    setSessions(sessions.filter((s) => s !== sessionId));
  };

  const maximizeSession = (sessionId: string) => {
    setSessions([sessionId]);
  };

  // Calculate grid layout based on number of sessions
  const getGridClass = () => {
    switch (sessions.length) {
      case 0:
        return 'grid-cols-1 grid-rows-1';
      case 1:
        return 'grid-cols-1 grid-rows-1';
      case 2:
        return 'grid-cols-2 grid-rows-1';
      case 3:
        return 'grid-cols-3 grid-rows-1';
      case 4:
        return 'grid-cols-2 grid-rows-2';
      case 5:
      case 6:
        return 'grid-cols-3 grid-rows-2';
      default:
        return 'grid-cols-3 grid-rows-3';
    }
  };

  return (
    <div className="flex flex-col h-screen bg-zinc-950">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-cyan-500/30 bg-zinc-900">
        <div className="flex items-center gap-3">
          <Link href="/dashboard">
            <Button variant="ghost" size="sm" className="text-zinc-400 hover:text-cyan-400">
              <Home className="h-4 w-4" />
            </Button>
          </Link>
          <Terminal className="h-5 w-5 text-cyan-400" />
          <h1 className="text-lg font-semibold text-cyan-400 font-mono">TILING SESSION MONITOR</h1>
          <span className="text-xs text-zinc-600 font-mono">{sessions.length} active</span>
        </div>

        <div className="flex items-center gap-3">
          {/* Auto Open Toggle */}
          <button
            type="button"
            onClick={() => {
              const newValue = !autoOpen;
              console.log('[TilingMonitor] Auto-open toggled to:', newValue);
              setAutoOpen(newValue);
            }}
            className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-md border transition-all',
              autoOpen
                ? 'bg-green-600/20 border-green-600/50 hover:bg-green-600/30'
                : 'bg-zinc-800/50 border-zinc-700/50 hover:bg-zinc-800'
            )}
          >
            <Zap className={cn('h-4 w-4', autoOpen ? 'text-green-400' : 'text-zinc-500')} />
            <span
              className={cn(
                'text-xs font-mono font-semibold',
                autoOpen ? 'text-green-300' : 'text-zinc-400'
              )}
            >
              AUTO-OPEN
            </span>
          </button>

          {/* Auto Close Toggle */}
          <button
            type="button"
            onClick={() => {
              const newValue = !autoClose;
              console.log('[TilingMonitor] Auto-close toggled to:', newValue);
              setAutoClose(newValue);
            }}
            className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-md border transition-all',
              autoClose
                ? 'bg-red-600/20 border-red-600/50 hover:bg-red-600/30'
                : 'bg-zinc-800/50 border-zinc-700/50 hover:bg-zinc-800'
            )}
          >
            <ZapOff className={cn('h-4 w-4', autoClose ? 'text-red-400' : 'text-zinc-500')} />
            <span
              className={cn(
                'text-xs font-mono font-semibold',
                autoClose ? 'text-red-300' : 'text-zinc-400'
              )}
            >
              AUTO-CLOSE
            </span>
          </button>

          <Button
            onClick={addSession}
            className="bg-cyan-500 hover:bg-cyan-600 text-black font-mono"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Session
          </Button>
        </div>
      </div>

      {/* Session Grid */}
      {sessions.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4">
            <Terminal className="h-16 w-16 mx-auto text-zinc-700" />
            <div className="space-y-2">
              <h2 className="text-xl font-semibold text-zinc-600">No sessions monitored</h2>
              <p className="text-sm text-zinc-700">
                Click "Add Session" to start monitoring Claude sessions in real-time
              </p>
            </div>
            <Button
              onClick={addSession}
              className="bg-cyan-500 hover:bg-cyan-600 text-black font-mono"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Your First Session
            </Button>
          </div>
        </div>
      ) : (
        <div className={cn('grid gap-3 p-3 flex-1 overflow-hidden', getGridClass())}>
          {sessions.map((sessionId) => (
            <SessionTerminal
              key={sessionId}
              sessionId={sessionId}
              onRemove={() => removeSession(sessionId)}
              onMaximize={sessions.length > 1 ? () => maximizeSession(sessionId) : undefined}
            />
          ))}
        </div>
      )}

      {/* Quick Add Bar - Recent Sessions */}
      {availableSessions.length > 0 && (
        <div className="border-t border-cyan-500/30 bg-zinc-900 px-4 py-2">
          <div className="flex items-center gap-2 overflow-x-auto">
            <span className="text-xs text-zinc-600 font-mono shrink-0">
              DETECTED ({availableSessions.length}):
            </span>
            {availableSessions
              .slice(-15)
              .reverse()
              .map((sessionId) => (
                <Button
                  key={sessionId}
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (!sessions.includes(sessionId)) {
                      setSessions([...sessions, sessionId]);
                    }
                  }}
                  className={cn(
                    'font-mono text-xs h-7 shrink-0',
                    sessions.includes(sessionId)
                      ? 'text-cyan-400 bg-cyan-500/20'
                      : 'text-zinc-600 hover:text-cyan-400 hover:bg-cyan-500/10'
                  )}
                  disabled={sessions.includes(sessionId)}
                >
                  {sessionId.slice(0, 8)}
                  {sessions.includes(sessionId) && ' ✓'}
                </Button>
              ))}
          </div>
        </div>
      )}

      {/* Session Picker Modal */}
      <SessionPickerModal
        open={showPicker}
        onClose={() => setShowPicker(false)}
        onSelectSession={handleSelectSession}
        excludeIds={sessions}
      />
    </div>
  );
}
