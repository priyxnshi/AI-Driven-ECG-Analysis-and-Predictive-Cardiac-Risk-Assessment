'use client';

import { RotateCcw, Download, Share2 } from 'lucide-react';

interface ReportActionsProps {
  onNewAnalysis: () => void;
}

export default function ReportActions({ onNewAnalysis }: ReportActionsProps) {
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={onNewAnalysis}
        className="
          h-9 px-4 rounded-lg bg-primary text-white text-xs font-semibold
          flex items-center gap-1.5
          hover:bg-primary-hover active:scale-[0.99] transition-all duration-150
        "
        id="new-analysis-btn"
      >
        <RotateCcw className="w-3.5 h-3.5" />
        New Analysis
      </button>
      <button
        className="
          h-9 px-4 rounded-lg bg-white border border-border text-text-primary text-xs font-semibold
          flex items-center gap-1.5
          hover:bg-surface active:scale-[0.99] transition-all duration-150
        "
        id="download-report-btn"
      >
        <Download className="w-3.5 h-3.5" />
        Download PDF
      </button>
      <button
        className="
          h-9 px-4 rounded-lg bg-white border border-border text-text-primary text-xs font-semibold
          flex items-center gap-1.5
          hover:bg-surface active:scale-[0.99] transition-all duration-150
        "
        id="share-report-btn"
      >
        <Share2 className="w-3.5 h-3.5" />
        Share
      </button>
    </div>
  );
}
