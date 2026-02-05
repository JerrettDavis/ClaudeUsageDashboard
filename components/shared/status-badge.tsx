'use client';

import { Badge } from '@/components/ui/badge';
import type { SessionStatus } from '@/types';

interface StatusBadgeProps {
  status: SessionStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const variants = {
    active: { variant: 'default' as const, label: 'Active', className: 'bg-green-500' },
    completed: { variant: 'secondary' as const, label: 'Completed', className: '' },
    error: { variant: 'destructive' as const, label: 'Error', className: '' },
  };

  const config = variants[status];

  return (
    <Badge variant={config.variant} className={config.className}>
      {config.label}
    </Badge>
  );
}
