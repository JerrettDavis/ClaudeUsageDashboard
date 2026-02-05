'use client';

import { DashboardLayout } from '@/components/shared/dashboard-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Settings as SettingsIcon } from 'lucide-react';

export default function SettingsPage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="text-muted-foreground">
            Configure your dashboard preferences
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Coming Soon</CardTitle>
            <CardDescription>
              Settings and configuration options are under development
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <SettingsIcon className="h-16 w-16 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-center max-w-md">
              This section will include provider settings, cost configuration, and notification preferences.
            </p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
