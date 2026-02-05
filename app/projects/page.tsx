'use client';

import { DashboardLayout } from '@/components/shared/dashboard-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FolderOpen } from 'lucide-react';

export default function ProjectsPage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Projects</h1>
          <p className="text-muted-foreground">
            Manage and view all your Claude projects
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Coming Soon</CardTitle>
            <CardDescription>
              Project management features are under development
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FolderOpen className="h-16 w-16 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-center max-w-md">
              This section will include project details, session history, and file change tracking.
            </p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
