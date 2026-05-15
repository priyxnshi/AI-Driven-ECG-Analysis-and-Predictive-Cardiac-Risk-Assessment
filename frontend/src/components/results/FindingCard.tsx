'use client';

import type { Finding } from '@/lib/types';
import SeverityBadge from '@/components/ui/SeverityBadge';
import MonoValue from '@/components/ui/MonoValue';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';

interface FindingCardProps {
  finding: Finding;
  index: number;
}

export default function FindingCard({ finding, index }: FindingCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className="border border-border rounded-lg bg-white overflow-hidden animate-slide-up"
      style={{ animationDelay: `${index * 80}ms` }}
    >
      {/* Main row */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-start justify-between gap-3 text-left hover:bg-surface/50"
        id={`finding-card-${finding.id}`}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <SeverityBadge severity={finding.severity} size="md" />
            <span className="text-[10px] font-medium text-text-tertiary uppercase tracking-wider">
              {finding.category}
            </span>
          </div>
          <h3 className="text-sm font-semibold text-text-primary mb-0.5">
            {finding.clinicalTerm}
          </h3>
          <p className="text-xs text-text-secondary leading-relaxed">
            {finding.plainLanguage}
          </p>
        </div>

        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <MonoValue value={`${finding.confidence}%`} size="sm" className="text-text-tertiary" />
          {expanded ? (
            <ChevronUp className="w-3.5 h-3.5 text-text-tertiary" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-text-tertiary" />
          )}
        </div>
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="px-4 py-3 border-t border-border bg-surface/30">
          {finding.details && (
            <p className="text-xs text-text-secondary leading-relaxed mb-3">
              {finding.details}
            </p>
          )}

          <div className="flex items-center justify-between">
            <div>
              <span className="text-[10px] font-medium text-text-tertiary uppercase tracking-wider mr-2">
                Leads
              </span>
              {finding.affectedLeads.map(lead => (
                <span
                  key={lead}
                  className="mono-value text-[10px] px-1.5 py-0.5 rounded bg-white border border-border text-text-secondary mr-1"
                >
                  {lead}
                </span>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[10px] text-text-tertiary">Confidence</span>
              <div className="w-16 h-1.5 bg-border rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full animate-fill-bar"
                  style={{ width: `${finding.confidence}%` }}
                />
              </div>
              <MonoValue value={`${finding.confidence}%`} size="sm" className="text-text-secondary !text-[10px]" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
