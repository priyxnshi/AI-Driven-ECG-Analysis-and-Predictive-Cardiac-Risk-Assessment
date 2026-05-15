'use client';

import type { SeverityLevel } from '@/lib/types';

interface SeverityBadgeProps {
  severity: SeverityLevel;
  label?: string;
  size?: 'sm' | 'md';
}

const config: Record<SeverityLevel, { dotClass: string; label: string }> = {
  normal: { dotClass: 'severity-dot-normal', label: 'Normal' },
  borderline: { dotClass: 'severity-dot-borderline', label: 'Borderline' },
  abnormal: { dotClass: 'severity-dot-abnormal', label: 'Abnormal' },
};

export default function SeverityBadge({ severity, label, size = 'sm' }: SeverityBadgeProps) {
  const { dotClass, label: defaultLabel } = config[severity];
  const displayLabel = label || defaultLabel;

  return (
    <span
      className={`inline-flex items-center gap-1.5 ${
        size === 'md' ? 'text-sm' : 'text-xs'
      }`}
    >
      <span className={`severity-dot ${dotClass}`} />
      <span className="font-medium text-text-secondary">{displayLabel}</span>
    </span>
  );
}
