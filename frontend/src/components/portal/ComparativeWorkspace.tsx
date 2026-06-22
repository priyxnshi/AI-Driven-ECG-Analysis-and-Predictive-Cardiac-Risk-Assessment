'use client';

import { useEffect, useState } from 'react';
import { ArrowLeft, Table, Heart, Clock, AlertTriangle } from 'lucide-react';
import ECGCanvas from '../dashboard/ECGCanvas';
import type { AnalysisResult } from '@/lib/types';

interface ComparativeWorkspaceProps {
  recordIds: string[];
  onBack: () => void;
}

export default function ComparativeWorkspace({ recordIds, onBack }: ComparativeWorkspaceProps) {
  const [results, setResults] = useState<AnalysisResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchComparisons = async () => {
      try {
        const token = localStorage.getItem('token');
        const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
        
        const response = await fetch(`${apiBase}/api/ecg/results/compare`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ recordIds })
        });

        if (!response.ok) {
          throw new Error('Failed to load comparative data.');
        }

        const data = await response.json();
        setResults(data);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'An error occurred during comparison loading.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchComparisons();
  }, [recordIds]);

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background text-foreground">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <span className="text-sm font-medium text-text-secondary">Loading comparative workspace...</span>
        </div>
      </div>
    );
  }

  if (error || results.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background text-foreground p-6">
        <div className="max-w-md text-center space-y-4">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto" />
          <h2 className="text-lg font-bold text-text-primary">Failed to Compare Records</h2>
          <p className="text-sm text-text-secondary">{error || 'No results available.'}</p>
          <button onClick={onBack} className="h-9 px-4 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary-hover transition-colors">
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-background">
      <header className="h-14 border-b border-border bg-white flex items-center px-6 flex-shrink-0">
        <button onClick={onBack} className="mr-3 p-1 hover:bg-surface rounded transition-colors" title="Back to Ingest Queue">
          <ArrowLeft className="w-4 h-4 text-text-secondary" />
        </button>
        <h1 className="text-sm font-semibold text-text-primary flex items-center gap-2">
          <Table className="w-4 h-4 text-primary" />
          ECG Comparative Review Workspace
        </h1>
      </header>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          
          {/* Comparative Metrics Table */}
          <div className="bg-white border border-border rounded-xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-border bg-surface/50">
              <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
                Clinical Metrics Cross-Comparison
              </h3>
            </div>
            <table className="w-full text-left text-sm border-collapse">
              <thead className="bg-surface text-text-tertiary text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3 font-medium">Measurement</th>
                  {results.map(res => (
                    <th key={res.id} className="px-5 py-3 font-medium border-l border-border">
                      {res.patient.name} <span className="font-mono text-[10px] text-text-tertiary">({res.patient.referenceId})</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                <tr className="hover:bg-surface/30">
                  <td className="px-5 py-3 font-semibold text-text-secondary">Overall Severity</td>
                  {results.map(res => (
                    <td key={res.id} className="px-5 py-3 border-l border-border font-bold">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] uppercase ${
                        res.overallSeverity === 'normal' ? 'bg-green-100 text-green-700' :
                        res.overallSeverity === 'abnormal' ? 'bg-red-100 text-red-700' :
                        'bg-amber-100 text-amber-700'
                      }`}>
                        {res.overallSeverity}
                      </span>
                    </td>
                  ))}
                </tr>
                <tr className="hover:bg-surface/30">
                  <td className="px-5 py-3 font-semibold text-text-secondary">Heart Rate</td>
                  {results.map(res => (
                    <td key={res.id} className="px-5 py-3 border-l border-border">
                      <div className="flex items-center gap-1 font-mono text-sm">
                        <Heart className="w-3.5 h-3.5 text-red-500 fill-red-500" />
                        <span>{res.heartRate} BPM</span>
                      </div>
                    </td>
                  ))}
                </tr>
                <tr className="hover:bg-surface/30">
                  <td className="px-5 py-3 font-semibold text-text-secondary">R-R Interval</td>
                  {results.map(res => (
                    <td key={res.id} className="px-5 py-3 border-l border-border font-mono text-sm">
                      {res.rrInterval} ms
                    </td>
                  ))}
                </tr>
                <tr className="hover:bg-surface/30">
                  <td className="px-5 py-3 font-semibold text-text-secondary">QRS Duration</td>
                  {results.map(res => (
                    <td key={res.id} className="px-5 py-3 border-l border-border font-mono text-sm">
                      {res.qrsDuration} ms
                    </td>
                  ))}
                </tr>
                <tr className="hover:bg-surface/30">
                  <td className="px-5 py-3 font-semibold text-text-secondary">PR Interval</td>
                  {results.map(res => (
                    <td key={res.id} className="px-5 py-3 border-l border-border font-mono text-sm">
                      {res.prInterval} ms
                    </td>
                  ))}
                </tr>
                <tr className="hover:bg-surface/30">
                  <td className="px-5 py-3 font-semibold text-text-secondary">QTc Interval</td>
                  {results.map(res => (
                    <td key={res.id} className="px-5 py-3 border-l border-border font-mono text-sm">
                      {res.qtcInterval} ms
                    </td>
                  ))}
                </tr>
                <tr className="hover:bg-surface/30">
                  <td className="px-5 py-3 font-semibold text-text-secondary">HRV (SDNN)</td>
                  {results.map(res => (
                    <td key={res.id} className="px-5 py-3 border-l border-border font-mono text-sm">
                      {res.hrv || '--'} ms
                    </td>
                  ))}
                </tr>
                <tr className="hover:bg-surface/30">
                  <td className="px-5 py-3 font-semibold text-text-secondary">ST Segment Status</td>
                  {results.map(res => (
                    <td key={res.id} className="px-5 py-3 border-l border-border font-medium">
                      {res.stStatus || 'Normal'}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>

          {/* Waveform comparative canvases */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {results.map(res => (
              <div key={res.id} className="bg-white border border-border rounded-xl overflow-hidden shadow-sm flex flex-col h-[360px]">
                <div className="px-4 py-3 border-b border-border bg-surface/30 flex items-center justify-between">
                  <span className="text-xs font-bold text-text-secondary truncate">{res.patient.name} Waveform</span>
                  <span className="text-[10px] text-text-tertiary mono-value">{res.patient.referenceId}</span>
                </div>
                <div className="flex-1 min-h-0 flex flex-col">
                  <ECGCanvas waveform={res.waveform} />
                </div>
              </div>
            ))}
          </div>

        </div>
      </div>
    </div>
  );
}
