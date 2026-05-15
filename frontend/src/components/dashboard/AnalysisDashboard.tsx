'use client';

import { useState, useEffect } from 'react';
import type { AnalysisResult } from '@/lib/types';
import PatientSidebar from './PatientSidebar';
import ECGCanvas from './ECGCanvas';
import DetectedPatterns from './DetectedPatterns';

interface AnalysisDashboardProps {
  result: AnalysisResult | null;
  onViewResults: () => void;
  processingStatus?: string;
}

export default function AnalysisDashboard({ result, onViewResults, processingStatus }: AnalysisDashboardProps) {
  const [showPatient, setShowPatient] = useState(false);
  const [showWaveform, setShowWaveform] = useState(false);
  const [showFindings, setShowFindings] = useState(false);
  const [analysisComplete, setAnalysisComplete] = useState(false);

  // Progressive disclosure — panels appear once result is ready
  useEffect(() => {
    if (!result) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShowPatient(false);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShowWaveform(false);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShowFindings(false);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAnalysisComplete(false);
      return;
    }

    const t1 = setTimeout(() => setShowPatient(true), 200);
    const t2 = setTimeout(() => setShowWaveform(true), 500);
    const t3 = setTimeout(() => setShowFindings(true), 900);
    const t4 = setTimeout(() => setAnalysisComplete(true), 1400);

    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
  }, [result]);

  const statusText = !result
    ? (processingStatus || 'Processing ECG recording...')
    : analysisComplete
      ? 'Analysis complete'
      : 'Building analysis...';

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Status bar */}
      <div className="h-9 border-b border-border bg-surface px-6 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          {!analysisComplete ? (
            <>
              <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span className="text-xs font-medium text-text-secondary">{statusText}</span>
            </>
          ) : (
            <>
              <div className="w-2 h-2 rounded-full bg-success" />
              <span className="text-xs font-medium text-text-secondary">Analysis complete</span>
            </>
          )}
        </div>

        {analysisComplete && (
          <button onClick={onViewResults} className="text-xs font-semibold text-primary hover:text-primary-hover" id="view-results-btn">
            View Results →
          </button>
        )}
      </div>

      {/* Three-column layout */}
      <div className="flex-1 flex min-h-0">
        <PatientSidebar patient={showPatient ? result?.patient || null : null} isLoading={!showPatient} />
        <ECGCanvas waveform={showWaveform ? result?.waveform || null : null} isLoading={!showWaveform} />
        <DetectedPatterns findings={showFindings ? result?.findings || null : null} isLoading={!showFindings} />
      </div>
    </div>
  );
}
