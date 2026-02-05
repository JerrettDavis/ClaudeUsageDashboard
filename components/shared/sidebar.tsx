'use client';

import {
  Activity,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Settings,
  Terminal,
  Zap,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { ThemeToggle } from './theme-toggle';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: Activity },
  { name: 'Live Monitor', href: '/monitoring', icon: Zap },
  { name: 'Tiling Monitor', href: '/monitoring/sessions', icon: Terminal },
  { name: 'Sessions', href: '/sessions', icon: Terminal },
  { name: 'Analytics', href: '/analytics', icon: BarChart3 },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const isExpanded = !isCollapsed || isHovered;

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={cn(
        'flex flex-col border-r border-zinc-800 bg-zinc-900/95 backdrop-blur-sm transition-all duration-300',
        isExpanded ? 'w-56' : 'w-16'
      )}
    >
      <div className="flex h-14 items-center border-b border-zinc-800 px-4">
        {isExpanded && (
          <div className="flex items-center gap-2">
            <Terminal className="h-5 w-5 text-cyan-400" />
            <span className="font-mono text-sm font-semibold text-cyan-400">MONITOR</span>
          </div>
        )}
        {!isExpanded && <Terminal className="h-5 w-5 text-cyan-400" />}
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {navigation.map((item) => {
          const isActive = pathname?.startsWith(item.href);
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'group flex items-center gap-3 rounded px-3 py-2.5 transition-all text-sm font-mono',
                isActive
                  ? 'bg-cyan-500/10 text-cyan-400 border-l-2 border-cyan-400'
                  : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
              )}
            >
              <item.icon className={cn('h-4 w-4 shrink-0', isActive && 'text-cyan-400')} />
              {isExpanded && <span className="text-xs">{item.name}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-zinc-800 p-3">
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="w-full flex items-center justify-center rounded p-2 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300 transition-colors"
        >
          {isExpanded ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
        {isExpanded && (
          <div className="mt-2 flex items-center justify-between">
            <span className="text-[10px] text-zinc-600 font-mono">v0.1.0</span>
            <ThemeToggle />
          </div>
        )}
      </div>
    </div>
  );
}
