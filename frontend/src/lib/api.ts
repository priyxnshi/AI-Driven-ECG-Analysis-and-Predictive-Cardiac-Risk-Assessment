import type {
  UploadResponse,
  AnalysisStatus,
  AnalysisResult,
} from './types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

/* ── Upload File ─────────────────────────────────────── */
export async function uploadFile(
  file: File,
  onProgress?: (progress: number) => void
): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append('file', file);

  // Simulate progress
  let progress = 0;
  const progressInterval = setInterval(() => {
    progress = Math.min(progress + Math.random() * 25, 90);
    onProgress?.(progress);
  }, 200);

  const response = await fetch(`${API_BASE}/api/upload`, {
    method: 'POST',
    body: formData,
  });

  clearInterval(progressInterval);
  onProgress?.(100);

  if (!response.ok) {
    throw new Error('Upload failed: Server returned ' + response.status);
  }

  return await response.json();
}

/* ── Start Analysis ──────────────────────────────────── */
export async function startAnalysis(fileId: string): Promise<{ analysisId: string }> {
  const response = await fetch(`${API_BASE}/api/analyze/${fileId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    throw new Error('Analysis failed: Server returned ' + response.status);
  }

  const data = await response.json();
  return { analysisId: data.analysisId };
}

/* ── Poll Analysis Status ────────────────────────────── */
export async function getAnalysisStatus(analysisId: string): Promise<AnalysisStatus> {
  const response = await fetch(`${API_BASE}/api/analysis/${analysisId}/status`);

  if (!response.ok) {
    throw new Error('Failed to get status: Server returned ' + response.status);
  }

  const data = await response.json();
  return {
    id: analysisId,
    status: data.status || 'processing',
    progress: data.progress || 50,
    currentStep: data.message || 'Processing...',
  };
}

/* ── Get Results ─────────────────────────────────────── */
export async function getAnalysisResults(analysisId: string): Promise<AnalysisResult> {
  // Extract fileId from analysisId
  const fileId = analysisId.replace('analysis_', '');
  const response = await fetch(`${API_BASE}/api/results/${fileId}`);

  if (!response.ok) {
    throw new Error('Failed to get results: Server returned ' + response.status);
  }

  return await response.json();
}

export { API_BASE };
