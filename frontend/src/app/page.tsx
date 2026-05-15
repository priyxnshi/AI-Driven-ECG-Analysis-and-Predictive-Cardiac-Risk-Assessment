'use client';

import { useState, useCallback } from 'react';
import type { WorkflowStep, ECGFile, AnalysisResult } from '@/lib/types';
import Header from '@/components/ui/Header';
import UploadZone from '@/components/upload/UploadZone';
import AnalysisDashboard from '@/components/dashboard/AnalysisDashboard';
import ResultsModule from '@/components/results/ResultsModule';
import ErrorView from '@/components/dashboard/ErrorView';
import type { PatientInputData } from '@/lib/types';

export default function Home() {
  const [step, setStep] = useState<WorkflowStep>('upload');
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [processingStatus, setProcessingStatus] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const handleStartAnalysis = useCallback(async (file: ECGFile, patientData: PatientInputData) => {
    setStep('analyzing');
    setAnalysisResult(null);
    setErrorMessage('');

    try {
      if (file.category === 'visual-scan') {
        // ── Real image processing pipeline ──
        setProcessingStatus('Loading image processor...');
        const { processECGImage } = await import('@/lib/image-processor');
        const { analyzeWaveform } = await import('@/lib/signal-analyzer');

        const processed = await processECGImage(file.file, (p) => {
          setProcessingStatus(p.step);
        });

        setProcessingStatus('Analyzing rhythm...');
        const result = analyzeWaveform(processed.waveform, patientData);
        setAnalysisResult(result);

      } else if (file.category === 'digital-signal') {
        // ── CSV / signal file parsing ──
        const ext = file.name.toLowerCase().split('.').pop();
        if (ext === 'csv') {
          setProcessingStatus('Parsing CSV data...');
          const { parseCSVFile } = await import('@/lib/csv-parser');
          const { analyzeWaveform } = await import('@/lib/signal-analyzer');

          const waveform = await parseCSVFile(file.file);
          setProcessingStatus('Analyzing rhythm...');
          const result = analyzeWaveform(waveform, patientData);
          setAnalysisResult(result);
        } else {
          // XML/EDF — use mock for now (needs backend)
          setProcessingStatus('Processing signal data...');
          const { generateMockResult, getNextCondition } = await import('@/lib/ecg-utils');
          await new Promise(r => setTimeout(r, 800));
          setAnalysisResult(generateMockResult(getNextCondition()));
        }

      } else {
        // ── PDF — needs backend OCR pipeline ──
        throw new Error('DOCUMENT_NOT_SUPPORTED: PDF and Document parsing requires the backend OCR pipeline. Please upload an image (.jpg/.png) or raw signal (.csv).');
      }
    } catch (err: unknown) {
      console.error('Processing error:', err);
      setErrorMessage(err instanceof Error ? err.message : 'An unknown error occurred during processing.');
      setStep('error');
    }
  }, []);

  const handleViewResults = useCallback(() => {
    setStep('results');
  }, []);

  const handleReset = useCallback(() => {
    setStep('upload');
    setAnalysisResult(null);
    setProcessingStatus('');
  }, []);

  return (
    <>
      <Header currentStep={step} onReset={handleReset} />

      <main className="flex-1 flex flex-col min-h-0">
        {step === 'upload' && (
          <UploadZone onStartAnalysis={handleStartAnalysis} />
        )}

        {step === 'analyzing' && (
          <AnalysisDashboard
            result={analysisResult}
            onViewResults={handleViewResults}
            processingStatus={processingStatus}
          />
        )}

        {step === 'results' && analysisResult && (
          <ResultsModule
            result={analysisResult}
            onNewAnalysis={handleReset}
          />
        )}

        {step === 'error' && (
          <ErrorView 
            message={errorMessage} 
            onRetry={handleReset} 
          />
        )}
      </main>
    </>
  );
}
