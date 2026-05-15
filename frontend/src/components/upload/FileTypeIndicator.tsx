'use client';

import { detectFileCategory } from '@/lib/ecg-utils';
import type { FileCategory } from '@/lib/types';
import { Cpu, FileText, ScanLine } from 'lucide-react';

interface FileTypeIndicatorProps {
  fileName: string;
  category?: FileCategory;
}

const categoryConfig: Record<FileCategory, {
  icon: React.ReactNode;
  label: string;
  sublabel: string;
  color: string;
}> = {
  'digital-signal': {
    icon: <Cpu className="w-4 h-4" />,
    label: 'Digital Signal',
    sublabel: 'Normalized to 500 Hz',
    color: 'text-primary',
  },
  'document': {
    icon: <FileText className="w-4 h-4" />,
    label: 'Document',
    sublabel: 'Multi-page extraction',
    color: 'text-text-secondary',
  },
  'visual-scan': {
    icon: <ScanLine className="w-4 h-4" />,
    label: 'Visual Scan',
    sublabel: 'Grid removal + trace extraction',
    color: 'text-text-secondary',
  },
};

export default function FileTypeIndicator({ fileName, category }: FileTypeIndicatorProps) {
  const detected = category || detectFileCategory(fileName);
  const config = categoryConfig[detected];

  return (
    <div className="flex items-center gap-2 text-xs">
      <span className={config.color}>{config.icon}</span>
      <div>
        <span className="font-medium text-text-primary">{config.label}</span>
        <span className="text-text-tertiary ml-1.5">·</span>
        <span className="text-text-tertiary ml-1.5">{config.sublabel}</span>
      </div>
    </div>
  );
}
