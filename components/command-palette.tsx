'use client';

import { Command } from 'cmdk';
import {
  Activity,
  BarChart3,
  FileText,
  Home,
  Play,
  RefreshCw,
  Settings,
  Terminal,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { trpc } from '@/lib/trpc/provider';

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const router = useRouter();
  const [search, setSearch] = React.useState('');
  const { data: recentSessions } = trpc.sessions.list.useQuery({ limit: 5 });
  const startSync = trpc.sync.syncProvider.useMutation();

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(!open);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, [open, onOpenChange]);

  const runCommand = React.useCallback(
    (command: () => void) => {
      onOpenChange(false);
      command();
    },
    [onOpenChange]
  );

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm"
          onClick={() => onOpenChange(false)}
        />
      )}
      <Command.Dialog
        open={open}
        onOpenChange={onOpenChange}
        className="fixed left-[50%] top-[50%] z-50 w-full max-w-2xl translate-x-[-50%] translate-y-[-50%] overflow-hidden border border-cyan-500/30 bg-zinc-900 shadow-2xl glow-cyan"
        label="Command Menu"
      >
        <div className="flex items-center border-b border-zinc-700 px-4">
          <Terminal className="mr-2 h-4 w-4 text-cyan-400" />
          <Command.Input
            value={search}
            onValueChange={setSearch}
            placeholder="Type a command or search..."
            className="flex h-12 w-full bg-transparent py-3 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none font-mono"
          />
          <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border border-zinc-700 bg-zinc-800 px-1.5 font-mono text-[10px] font-medium text-zinc-400">
            ESC
          </kbd>
        </div>

        <Command.List className="max-h-[400px] overflow-y-auto p-2">
          <Command.Empty className="py-6 text-center text-sm text-zinc-500 font-mono">
            No results found.
          </Command.Empty>

          <Command.Group
            heading="Navigation"
            className="mb-2 text-xs font-semibold text-zinc-500 px-2"
          >
            <CommandItem
              onSelect={() => runCommand(() => router.push('/dashboard'))}
              icon={<Home className="h-4 w-4" />}
              shortcut="⌘D"
            >
              Dashboard
            </CommandItem>
            <CommandItem
              onSelect={() => runCommand(() => router.push('/sessions'))}
              icon={<FileText className="h-4 w-4" />}
              shortcut="⌘S"
            >
              Sessions
            </CommandItem>
            <CommandItem
              onSelect={() => runCommand(() => router.push('/analytics'))}
              icon={<BarChart3 className="h-4 w-4" />}
              shortcut="⌘A"
            >
              Analytics
            </CommandItem>
            <CommandItem
              onSelect={() => runCommand(() => router.push('/settings'))}
              icon={<Settings className="h-4 w-4" />}
              shortcut="⌘,"
            >
              Settings
            </CommandItem>
          </Command.Group>

          <Command.Group
            heading="Actions"
            className="mb-2 text-xs font-semibold text-zinc-500 px-2"
          >
            <CommandItem
              onSelect={() =>
                runCommand(() => {
                  startSync.mutate({ providerId: 'claude' });
                  router.push('/sync');
                })
              }
              icon={<RefreshCw className="h-4 w-4" />}
              shortcut="⌘R"
            >
              Sync Claude Data
            </CommandItem>
            <CommandItem
              onSelect={() => runCommand(() => console.log('Start session'))}
              icon={<Play className="h-4 w-4" />}
              shortcut="⌘N"
            >
              Start New Session
            </CommandItem>
          </Command.Group>

          {recentSessions && recentSessions.length > 0 && (
            <Command.Group
              heading="Recent Sessions"
              className="mb-2 text-xs font-semibold text-zinc-500 px-2"
            >
              {recentSessions.map((session) => (
                <CommandItem
                  key={session.id}
                  onSelect={() => runCommand(() => router.push(`/sessions/${session.id}`))}
                  icon={<Activity className="h-4 w-4" />}
                >
                  {session.projectName}
                  <span className="ml-auto text-xs text-zinc-600 font-mono">
                    {new Date(session.startTime).toLocaleDateString()}
                  </span>
                </CommandItem>
              ))}
            </Command.Group>
          )}
        </Command.List>
      </Command.Dialog>
    </>
  );
}

function CommandItem({
  children,
  onSelect,
  icon,
  shortcut,
}: {
  children: React.ReactNode;
  onSelect: () => void;
  icon?: React.ReactNode;
  shortcut?: string;
}) {
  return (
    <Command.Item
      onSelect={onSelect}
      className="relative flex cursor-pointer select-none items-center rounded-sm px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-cyan-400 data-[selected=true]:bg-zinc-800 data-[selected=true]:text-cyan-400 font-mono transition-colors"
    >
      {icon && <span className="mr-2">{icon}</span>}
      {children}
      {shortcut && (
        <kbd className="ml-auto pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border border-zinc-700 bg-zinc-800 px-1.5 font-mono text-[10px] font-medium text-zinc-500">
          {shortcut}
        </kbd>
      )}
    </Command.Item>
  );
}
