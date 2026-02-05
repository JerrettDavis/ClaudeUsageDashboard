'use client';

import { trpc } from '@/lib/trpc/provider';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function Home() {
  const { data: providers, isLoading } = trpc.providers.list.useQuery();

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <div className="text-center space-y-6 p-8">
        <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
          Claude Usage Dashboard
        </h1>
        <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl">
          Monitor and analyze your Claude AI usage across projects with real-time insights
        </p>
        
        <div className="flex gap-4 justify-center mt-8">
          <Link href="/dashboard">
            <Button size="lg" className="text-lg px-8">
              Open Dashboard
            </Button>
          </Link>
          <Link href="/sessions">
            <Button size="lg" variant="outline" className="text-lg px-8">
              View Sessions
            </Button>
          </Link>
        </div>

        <div className="mt-12 pt-8 border-t">
          <p className="text-sm text-gray-500 mb-4">Providers Status</p>
          <div className="flex gap-4 justify-center">
            {providers && providers.map((provider) => (
              <div key={provider.id} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white dark:bg-gray-800 border">
                <div className={`h-2 w-2 rounded-full ${provider.installed ? 'bg-green-500' : 'bg-gray-300'}`} />
                <span className="text-sm font-medium">{provider.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
