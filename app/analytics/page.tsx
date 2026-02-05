'use client';

import { BarChart3 } from 'lucide-react';
import { DashboardLayout } from '@/components/shared/dashboard-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function AnalyticsPage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Analytics</h1>
          <p className="text-muted-foreground">Advanced usage analytics and insights</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Coming Soon</CardTitle>
            <CardDescription>Advanced analytics features are under development</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <BarChart3 className="h-16 w-16 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-center max-w-md">
              This section will include charts, trends, cost projections, and detailed usage
              insights.
            </p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
