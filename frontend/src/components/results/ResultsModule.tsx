'use client';

import type { AnalysisResult, SeverityLevel } from '@/lib/types';
import MonoValue from '@/components/ui/MonoValue';
import FindingCard from './FindingCard';
import ReportActions from './ReportActions';
import { FileText, Heart, Clock, Activity } from 'lucide-react';

interface ResultsModuleProps {
  result: AnalysisResult;
  onNewAnalysis: () => void;
}

const severityConfig: Record<SeverityLevel, {
  label: string;
  sublabel: string;
  color: string;
  dotClass: string;
}> = {
  normal: {
    label: 'Normal',
    sublabel: 'No significant abnormalities detected',
    color: '#1DB954',
    dotClass: 'bg-success',
  },
  borderline: {
    label: 'Borderline',
    sublabel: 'Findings that may require clinical follow-up',
    color: '#E6A817',
    dotClass: 'bg-warning',
  },
  abnormal: {
    label: 'Requires Attention',
    sublabel: 'Significant findings requiring clinical review',
    color: '#D32F2F',
    dotClass: 'bg-alert',
  },
};

export default function ResultsModule({ result, onNewAnalysis }: ResultsModuleProps) {
  const severity = severityConfig[result.overallSeverity];

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto px-6 py-8">
        {/* Header + Actions */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-lg font-bold text-text-primary mb-0.5" id="results-title">
              Analysis Report
            </h1>
            <p className="text-xs text-text-tertiary">
              <span className="mono-value">{result.patient.referenceId}</span>
              <span className="mx-1.5">·</span>
              {result.patient.recordingDate}
            </p>
          </div>
          <ReportActions onNewAnalysis={onNewAnalysis} />
        </div>

        {/* ── Clinical Severity Gauge ──────────────────────── */}
        <div className="border border-border rounded-lg bg-white p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
              Overall Assessment
            </h2>
            <div className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full ${severity.dotClass}`} />
              <span className="text-sm font-semibold text-text-primary">{severity.label}</span>
            </div>
          </div>

          {/* Gauge */}
          <div className="relative mb-3">
            {/* Track */}
            <div className="h-1.5 rounded-full bg-surface relative overflow-visible">
              {/* Gradient fill — subtle, not garish */}
              <div
                className="absolute inset-y-0 left-0 rounded-full animate-gauge"
                style={{
                  width: `${result.severityScore}%`,
                  background: `linear-gradient(90deg, #1DB954 0%, #E6A817 50%, #D32F2F 100%)`,
                  backgroundSize: '300% 100%',
                  backgroundPosition: `${result.severityScore}% 0%`,
                }}
              />
            </div>

            {/* Needle / pointer */}
            <div
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 transition-all duration-700"
              style={{ left: `${result.severityScore}%` }}
            >
              <div
                className="w-3 h-3 rounded-full border-2 border-white shadow-sm"
                style={{ backgroundColor: severity.color }}
              />
            </div>

            {/* Scale labels */}
            <div className="flex items-center justify-between mt-3">
              <span className="text-[9px] mono-value text-text-tertiary">Normal</span>
              <span className="text-[9px] mono-value text-text-tertiary">Borderline</span>
              <span className="text-[9px] mono-value text-text-tertiary">Abnormal</span>
            </div>
          </div>

          {/* Summary text */}
          <p className="text-xs text-text-secondary leading-relaxed mt-4 pt-4 border-t border-border">
            {result.summary}
          </p>
        </div>

        {/* ── Key Metrics ──────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { icon: <Heart className="w-3.5 h-3.5" />, label: 'Heart Rate', value: result.heartRate, unit: 'BPM' },
            { icon: <Clock className="w-3.5 h-3.5" />, label: 'R-R Interval', value: result.rrInterval, unit: 'ms' },
            { icon: <Activity className="w-3.5 h-3.5" />, label: 'QRS Duration', value: result.qrsDuration, unit: 'ms' },
            { icon: <FileText className="w-3.5 h-3.5" />, label: 'QTc Interval', value: result.qtcInterval, unit: 'ms' },
          ].map((metric) => (
            <div
              key={metric.label}
              className="border border-border rounded-lg bg-white p-3"
            >
              <div className="flex items-center gap-1.5 mb-2">
                <span className="text-text-tertiary">{metric.icon}</span>
                <span className="text-[10px] font-medium text-text-tertiary uppercase tracking-wider">
                  {metric.label}
                </span>
              </div>
              <MonoValue value={metric.value} unit={metric.unit} size="lg" />
            </div>
          ))}
        </div>

        {/* ── Findings ─────────────────────────────────────── */}
        <div className="mb-8">
          <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">
            Detailed Findings
          </h2>
          <div className="space-y-2">
            {result.findings.map((finding, index) => (
              <FindingCard key={finding.id} finding={finding} index={index} />
            ))}
          </div>
        </div>

        {/* ── Disclaimer ───────────────────────────────────── */}
        <div className="border-t border-border pt-4 pb-8">
          <p className="text-[10px] text-text-tertiary leading-relaxed">
            <strong>Disclaimer:</strong> This analysis is intended for screening purposes only and does not constitute a medical diagnosis.
            All findings should be reviewed and confirmed by a qualified healthcare professional.
            ECGenius is a clinical decision support tool — it does not replace professional medical judgment.
          </p>
        </div>
      </div>
    </div>
  );
}
