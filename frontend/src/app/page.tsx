'use client';

import { useState, useEffect } from 'react';
import type { AnalysisResult } from '@/lib/types';
import Header from '@/components/ui/Header';
import BatchUploadZone from '@/components/upload/BatchUploadZone';
import ResultsModule from '@/components/results/ResultsModule';
import ComparativeWorkspace from '@/components/portal/ComparativeWorkspace';
import PatientDashboard from '@/components/portal/PatientDashboard';

export default function Home() {
  const [step, setStep] = useState<'upload' | 'results' | 'compare'>('upload');
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [compareRecordIds, setCompareRecordIds] = useState<string[]>([]);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [userRole, setUserRole] = useState('');

  useEffect(() => {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        const userObj = JSON.parse(userStr);
        setUserRole(userObj.role);
      } catch (e) {
        // ignore
      }
    }
  }, []);

  // Fetch results when a specific record is selected for review
  useEffect(() => {
    if (!selectedRecordId) return;

    const fetchResult = async () => {
      setIsLoading(true);
      setError('');
      try {
        const token = localStorage.getItem('token');
        const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
        
        const response = await fetch(`${apiBase}/api/ecg/results/${selectedRecordId}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (!response.ok) {
          throw new Error('Failed to load analysis result.');
        }

        const data = await response.json();
        setAnalysisResult(data);
        setStep('results');
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'An error occurred loading results.');
        setStep('upload');
      } finally {
        setIsLoading(false);
      }
    };

    fetchResult();
  }, [selectedRecordId]);

  const handleViewResult = (recordId: string) => {
    setSelectedRecordId(recordId);
  };

  const handleCompareResults = (recordIds: string[]) => {
    setCompareRecordIds(recordIds);
    setStep('compare');
  };

  const handleReset = () => {
    setStep('upload');
    setSelectedRecordId(null);
    setCompareRecordIds([]);
    setAnalysisResult(null);
  };

  return (
    <div className="flex-1 flex flex-col bg-background text-foreground">
      <Header currentStep={step === 'results' ? 'results' : 'upload'} onReset={handleReset} />

      <main className="flex-1 flex flex-col relative overflow-y-auto">
        {isLoading && (
          <div className="absolute inset-0 bg-white/80 z-50 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              <span className="text-sm font-medium text-text-secondary">Loading analysis details...</span>
            </div>
          </div>
        )}

        {step === 'upload' && (
          userRole === 'patient' ? (
            <PatientDashboard onViewResult={handleViewResult} />
          ) : (
            <BatchUploadZone 
              onViewResult={handleViewResult}
              onCompareResults={handleCompareResults}
            />
          )
        )}

        {step === 'results' && analysisResult && (
          <ResultsModule
            result={analysisResult}
            onNewAnalysis={handleReset}
          />
        )}

        {step === 'compare' && compareRecordIds.length > 0 && (
          <ComparativeWorkspace
            recordIds={compareRecordIds}
            onBack={handleReset}
          />
        )}
      </main>
    </div>
  );
}
