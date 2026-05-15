/* ── Severity Levels ─────────────────────────────────── */
export type SeverityLevel = 'normal' | 'borderline' | 'abnormal';

/* ── File Ingestion ──────────────────────────────────── */
export type FileCategory = 'digital-signal' | 'document' | 'visual-scan';

export interface ECGFile {
  id: string;
  name: string;
  size: number;
  type: string;
  category: FileCategory;
  file: File;
  preview?: string;
}

export interface PatientInputData {
  name: string;
  age: string;
  sex: 'Male' | 'Female' | 'Other';
  referenceId: string;
}

/* ── Patient Metadata ────────────────────────────────── */
export interface PatientMetadata {
  name: string;
  age: number;
  sex: 'Male' | 'Female' | 'Other';
  recordingDate: string;
  duration: string;
  leadConfiguration: string;
  device: string;
  heartRate: number;
  referenceId: string;
}

/* ── Waveform Data ───────────────────────────────────── */
export interface LeadData {
  name: string;
  samples: number[];
}

export interface WaveformData {
  sampleRate: number;
  leads: LeadData[];
  duration: number; // seconds
}

/* ── Analysis Findings ───────────────────────────────── */
export type FindingCategory = 'rhythm' | 'morphology' | 'interval' | 'conduction';

export interface Finding {
  id: string;
  category: FindingCategory;
  clinicalTerm: string;
  plainLanguage: string;
  severity: SeverityLevel;
  confidence: number; // 0-100
  affectedLeads: string[];
  details?: string;
}

/* ── Analysis Result ─────────────────────────────────── */
export interface AnalysisResult {
  id: string;
  timestamp: string;
  patient: PatientMetadata;
  waveform: WaveformData;
  overallSeverity: SeverityLevel;
  severityScore: number; // 0-100, position on gauge
  findings: Finding[];
  summary: string;
  heartRate: number;
  rrInterval: number;
  prInterval: number;
  qrsDuration: number;
  qtInterval: number;
  qtcInterval: number;
}

/* ── API Types ───────────────────────────────────────── */
export interface UploadResponse {
  fileId: string;
  status: 'accepted' | 'rejected';
  message: string;
  detectedType: FileCategory;
}

export interface AnalysisStatus {
  id: string;
  status: 'queued' | 'preprocessing' | 'analyzing' | 'complete' | 'error';
  progress: number; // 0-100
  currentStep: string;
}

export type WorkflowStep = 'upload' | 'analyzing' | 'results' | 'error';
