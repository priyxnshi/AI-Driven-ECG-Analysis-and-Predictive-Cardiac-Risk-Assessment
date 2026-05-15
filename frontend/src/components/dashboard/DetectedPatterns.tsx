'use client';

import type { Finding } from '@/lib/types';
import SeverityBadge from '@/components/ui/SeverityBadge';
import MonoValue from '@/components/ui/MonoValue';

interface DetectedPatternsProps {
  findings: Finding[] | null;
  isLoading?: boolean;
}

const categoryLabels: Record<string, string> = {
  rhythm: 'Rhythm',
  morphology: 'Morphology',
  interval: 'Interval',
  conduction: 'Conduction',
};

function SkeletonFinding() {
  return (
    <div className="p-3 border-b border-border">
      <div className="skeleton h-3 w-24 rounded mb-2" />
      <div className="skeleton h-2.5 w-full rounded mb-1.5" />
      <div className="skeleton h-2.5 w-3/4 rounded" />
    </div>
  );
}

export default function DetectedPatterns({ findings, isLoading }: DetectedPatternsProps) {
  if (isLoading || !findings) {
    return (
      <div className="w-72 border-l border-border bg-white flex-shrink-0">
        <div className="px-4 py-3 border-b border-border">
          <div className="skeleton h-3 w-28 rounded" />
        </div>
        {Array.from({ length: 3 }).map((_, i) => (
          <SkeletonFinding key={i} />
        ))}
      </div>
    );
  }

  // Group by category
  const grouped = findings.reduce<Record<string, Finding[]>>((acc, f) => {
    if (!acc[f.category]) acc[f.category] = [];
    acc[f.category].push(f);
    return acc;
  }, {});

  return (
    <div className="w-72 border-l border-border bg-white flex-shrink-0 overflow-y-auto">
      {/* Title */}
      <div className="px-4 py-3 border-b border-border">
        <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
          Detected Patterns
        </h2>
        <p className="text-[10px] text-text-tertiary mt-0.5">
          {findings.length} finding{findings.length !== 1 ? 's' : ''} identified
        </p>
      </div>

      {/* Findings grouped by category */}
      {Object.entries(grouped).map(([category, categoryFindings]) => (
        <div key={category}>
          {/* Category header */}
          <div className="px-4 py-2 bg-surface border-b border-border">
            <span className="text-[10px] font-semibold text-text-tertiary uppercase tracking-wider">
              {categoryLabels[category] || category}
            </span>
          </div>

          {/* Findings in this category */}
          {categoryFindings.map((finding, idx) => (
            <div
              key={finding.id}
              className={`px-4 py-3 ${
                idx < categoryFindings.length - 1 ? 'border-b border-border' : ''
              } animate-slide-up`}
              style={{ animationDelay: `${idx * 100}ms` }}
            >
              {/* Clinical term + severity */}
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <h3 className="text-sm font-semibold text-text-primary leading-tight">
                  {finding.clinicalTerm}
                </h3>
                <SeverityBadge severity={finding.severity} />
              </div>

              {/* Plain language */}
              <p className="text-xs text-text-secondary leading-relaxed mb-2">
                {finding.plainLanguage}
              </p>

              {/* Details */}
              {finding.details && (
                <p className="text-[10px] text-text-tertiary leading-relaxed mb-2 italic">
                  {finding.details}
                </p>
              )}

              {/* Metadata row */}
              <div className="flex items-center justify-between">
                {/* Affected leads */}
                <div className="flex items-center gap-1">
                  {finding.affectedLeads.map(lead => (
                    <span
                      key={lead}
                      className="mono-value text-[10px] px-1 py-0.5 rounded bg-surface border border-border text-text-tertiary"
                    >
                      {lead}
                    </span>
                  ))}
                </div>

                {/* Confidence */}
                <div className="flex items-center gap-1.5">
                  <div className="w-12 h-1 bg-surface rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full animate-fill-bar"
                      style={{ width: `${finding.confidence}%` }}
                    />
                  </div>
                  <MonoValue value={`${finding.confidence}%`} size="sm" className="text-text-tertiary !text-[10px]" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
