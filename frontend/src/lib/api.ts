import type {
  UploadResponse,
  AnalysisStatus,
  AnalysisResult,
  FileCategory,
} from './types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

/* ── Upload File ─────────────────────────────────────── */
export async function uploadFile(
  file: File,
  onProgress?: (progress: number) => void
): Promise<UploadResponse> {
  // In production, this would POST to FastAPI
  // For demo, simulate upload with progress
  return new Promise((resolve) => {
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 25;
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);
        onProgress?.(100);

        const ext = file.name.split('.').pop()?.toLowerCase() || '';
        let detectedType: FileCategory = 'digital-signal';
        if (ext === 'pdf') detectedType = 'document';
        else if (['jpg', 'jpeg', 'png'].includes(ext)) detectedType = 'visual-scan';

        resolve({
          fileId: `file-${Date.now()}`,
          status: 'accepted',
          message: 'File accepted for processing',
          detectedType,
        });
      } else {
        onProgress?.(progress);
      }
    }, 200);
  });
}

/* ── Start Analysis ──────────────────────────────────── */
export async function startAnalysis(fileId: string): Promise<{ analysisId: string }> {
  // In production: POST ${API_BASE}/api/analyze
  return { analysisId: `analysis-${Date.now()}` };
}

/* ── Poll Analysis Status ────────────────────────────── */
export async function getAnalysisStatus(analysisId: string): Promise<AnalysisStatus> {
  // In production: GET ${API_BASE}/api/status/${analysisId}
  return {
    id: analysisId,
    status: 'complete',
    progress: 100,
    currentStep: 'Analysis complete',
  };
}

/* ── Get Results ─────────────────────────────────────── */
export async function getAnalysisResults(analysisId: string): Promise<AnalysisResult> {
  // In production: GET ${API_BASE}/api/results/${analysisId}
  // This will be replaced with actual API call
  const { generateMockResult, getNextCondition } = await import('./ecg-utils');
  const condition = getNextCondition();
  return generateMockResult(condition);
}

/* ── Production API hooks (ready for FastAPI) ────────── */
/*
  Backend endpoints expected:

  POST   /api/upload          → multipart/form-data → UploadResponse
  POST   /api/analyze         → { fileId } → { analysisId }
  GET    /api/status/{id}     → AnalysisStatus
  GET    /api/results/{id}    → AnalysisResult

  The FastAPI backend handles:
  - LayoutLMv3 for document structure extraction
  - OCR vision processing for scanned ECG images
  - Signal normalization to 500 Hz
  - Grid removal and trace binarization for visual scans
*/

export { API_BASE };
