'use client';

import { type ReactNode, useState } from 'react';
import { CommandPalette } from '../command-palette';
import { Sidebar } from './sidebar';
import { TopBar } from './top-bar';

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const [commandOpen, setCommandOpen] = useState(false);

  return (
    <>
      <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} />
      <div className="flex h-screen overflow-hidden bg-zinc-950">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <TopBar onCommandOpen={() => setCommandOpen(true)} />
          <main className="flex-1 overflow-y-auto">{children}</main>
        </div>
      </div>
    </>
  );
}
