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
      setProcessingStatus('Uploading ECG file to clinical server...');
      const { uploadFile, startAnalysis, getAnalysisStatus, getAnalysisResults } = await import('@/lib/api');
      
      // 1. Upload file
      const uploadResp = await uploadFile(file.file, (progress) => {
        setProcessingStatus(`Uploading ECG file... (${Math.round(progress)}%)`);
      });

      setProcessingStatus('Initializing clinical neural analysis...');
      
      // 2. Start analysis
      const { analysisId } = await startAnalysis(uploadResp.fileId);

      // 3. Poll analysis status
      let attempts = 0;
      const maxAttempts = 60; // 30 seconds max polling
      let statusComplete = false;

      while (attempts < maxAttempts && !statusComplete) {
        attempts++;
        setProcessingStatus(`Analyzing waveform metrics... (step ${attempts})`);
        
        const statusResp = await getAnalysisStatus(analysisId);
        
        if (statusResp.status === 'complete') {
          statusComplete = true;
        } else if (statusResp.status === 'error') {
          throw new Error(statusResp.currentStep || 'Backend analysis error');
        } else {
          setProcessingStatus(statusResp.currentStep || 'Analyzing ECG signals...');
          await new Promise((r) => setTimeout(r, 800)); // wait 800ms between polls
        }
      }

      if (!statusComplete) {
        throw new Error('Analysis timed out. Please try again.');
      }

      setProcessingStatus('Compiling report findings...');
      
      // 4. Fetch final analysis results
      const result = await getAnalysisResults(analysisId);
      
      // Set patient metadata on results based on inputs
      if (result.patient) {
        result.patient.name = patientData.name && patientData.name !== 'Uploaded Scan' ? patientData.name : result.patient.name;
        result.patient.age = patientData.age ? parseInt(patientData.age) : result.patient.age;
        result.patient.sex = patientData.sex || result.patient.sex;
        result.patient.referenceId = patientData.referenceId || result.patient.referenceId;
      }
      
      setAnalysisResult(result);

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
