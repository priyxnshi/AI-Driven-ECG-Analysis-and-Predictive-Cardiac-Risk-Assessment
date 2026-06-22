'use client';

import { useState, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { UploadCloud, FileText, ArrowRight, ShieldCheck, Clock, CheckCircle, AlertCircle, FileSpreadsheet, Image as ImageIcon } from 'lucide-react';
import SeverityBadge from '../ui/SeverityBadge';

interface RecordItem {
  id: number;
  filename: string;
  createdAt: string;
  status: string;
  category: string;
  severity: 'normal' | 'borderline' | 'abnormal' | 'unknown';
}

interface PatientDashboardProps {
  onViewResult: (recordId: string) => void;
}

export default function PatientDashboard({ onViewResult }: PatientDashboardProps) {
  const [records, setRecords] = useState<RecordItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [activeAnalysisId, setActiveAnalysisId] = useState<number | null>(null);
  const [activeStatus, setActiveStatus] = useState<string>('');

  const fetchHistory = async () => {
    try {
      const token = localStorage.getItem('token');
      const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const response = await fetch(`${apiBase}/api/ecg/records`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setRecords(data);
      }
    } catch (err) {
      console.error('Failed to load history', err);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  // Poll status of active analysis
  useEffect(() => {
    if (!activeAnalysisId) return;

    let intervalId: NodeJS.Timeout;

    const checkStatus = async () => {
      try {
        const token = localStorage.getItem('token');
        const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
        const response = await fetch(`${apiBase}/api/ecg/status/${activeAnalysisId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
          const record = await response.json();
          setActiveStatus(record.status);
          if (record.status === 'complete' || record.status === 'failed') {
            setActiveAnalysisId(null);
            fetchHistory();
            if (record.status === 'complete') {
              onViewResult(record.id.toString());
            } else {
              setError(`Analysis failed: ${record.errorMessage || 'Unknown error'}`);
            }
          }
        }
      } catch (err) {
        console.error('Error checking analysis status', err);
      }
    };

    intervalId = setInterval(checkStatus, 1500);
    return () => clearInterval(intervalId);
  }, [activeAnalysisId, onViewResult]);

  const onDrop = async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;
    const file = acceptedFiles[0];

    setError('');
    setIsLoading(true);
    setUploadProgress(0);

    const formData = new FormData();
    formData.append('file', file);
    
    // The backend overrides this linked patient ID based on the JWT token for safety
    formData.append('patientReferenceId', 'PT-DEFAULT');

    try {
      const token = localStorage.getItem('token');
      const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      
      const response = await fetch(`${apiBase}/api/ecg/upload`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Upload failed.');
      }

      setUploadProgress(100);
      const record = data.record;

      // Trigger analysis immediately
      const triggerResponse = await fetch(`${apiBase}/api/ecg/analyze/batch`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ recordIds: [record.id] })
      });

      if (!triggerResponse.ok) {
        throw new Error('Upload succeeded, but failed to trigger background processing.');
      }

      setActiveAnalysisId(record.id);
      setActiveStatus('queued');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred during file upload.');
    } finally {
      setIsLoading(false);
      setUploadProgress(null);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxFiles: 1,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png']
    }
  });

  const getCategoryIcon = (category: string) => {
    if (category === 'visual-scan') return <ImageIcon className="w-4 h-4 text-teal-600" />;
    if (category === 'digital-signal') return <FileSpreadsheet className="w-4 h-4 text-primary" />;
    return <FileText className="w-4 h-4 text-slate-500" />;
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-surface/10">
      
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-teal-600 to-teal-800 text-white rounded-2xl p-6 shadow-xl border border-teal-500/20 relative overflow-hidden">
        <div className="relative z-10 space-y-2">
          <h2 className="text-xl font-bold">Welcome to Your Personal ECG Workspace</h2>
          <p className="text-xs text-teal-100 max-w-xl">
            Upload your personal ECG records to check for heart rhythm abnormalities. Our HIPAA-compliant secure analyzer uses signal processing and deep learning model fallback to generate accurate evaluations.
          </p>
        </div>
        <div className="absolute right-6 bottom-0 w-24 h-24 text-teal-500/20 pointer-events-none">
          <ShieldCheck className="w-full h-full" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Upload Zone */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white border border-border rounded-2xl p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wide">
              Analyze New ECG
            </h3>
            
            {activeAnalysisId ? (
              <div className="border border-border rounded-xl p-5 bg-surface/30 flex flex-col items-center justify-center text-center space-y-4">
                <div className="h-10 w-10 animate-spin rounded-full border-4 border-teal-600 border-t-transparent" />
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-text-primary">Processing ECG File...</p>
                  <p className="text-xs text-text-tertiary">Status: <span className="font-mono text-teal-600 uppercase font-bold">{activeStatus}</span></p>
                </div>
                <p className="text-[10px] text-text-tertiary">
                  We are de-noising the waveform signal and running deep learning arrhythmia classifications.
                </p>
              </div>
            ) : (
              <div 
                {...getRootProps()} 
                className={`border-2 border-dashed border-border rounded-xl p-6 text-center cursor-pointer hover:border-teal-500 hover:bg-teal-50/10 transition-all flex flex-col items-center justify-center space-y-3 ${
                  isDragActive ? 'border-teal-500 bg-teal-50/20' : ''
                }`}
              >
                <input {...getInputProps()} />
                <div className="w-12 h-12 bg-teal-50 rounded-full flex items-center justify-center text-teal-600">
                  <UploadCloud className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-text-primary">Drag & drop ECG file here</p>
                  <p className="text-[10px] text-text-tertiary">or click to browse local files</p>
                </div>
                <span className="text-[9px] text-text-tertiary bg-surface px-2.5 py-1 rounded border border-border">
                  Supports: CSV, XLSX, PNG, JPG, JPEG
                </span>
              </div>
            )}

            {uploadProgress !== null && (
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] text-text-secondary font-semibold">
                  <span>Uploading file...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="h-1.5 w-full bg-border rounded-full overflow-hidden">
                  <div className="h-full bg-teal-600 transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                </div>
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-xs p-3 rounded-lg flex items-start gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}
          </div>
        </div>

        {/* History Ledger */}
        <div className="lg:col-span-2">
          <div className="bg-white border border-border rounded-2xl shadow-sm overflow-hidden flex flex-col h-[400px]">
            <div className="p-5 border-b border-border bg-white flex items-center justify-between">
              <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wide">
                Analysis History Log
              </h3>
              <span className="text-xs text-text-tertiary bg-surface border border-border px-2 py-0.5 rounded-full flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                {records.length} Analyses
              </span>
            </div>
            
            <div className="flex-1 overflow-y-auto min-h-0">
              {records.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-2">
                  <CheckCircle className="w-10 h-10 text-slate-300" />
                  <p className="text-sm font-semibold text-text-secondary">No previous analyses found</p>
                  <p className="text-xs text-text-tertiary max-w-xs">Upload your first ECG file above to begin mapping your heart health history.</p>
                </div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-surface/50 border-b border-border text-[10px] font-bold text-text-secondary uppercase tracking-wider">
                      <th className="p-4">File Name</th>
                      <th className="p-4">Category</th>
                      <th className="p-4">Date Uploaded</th>
                      <th className="p-4">Status</th>
                      <th className="p-4">Risk Severity</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {records.map((r) => (
                      <tr key={r.id} className="hover:bg-surface/10 text-xs text-text-secondary transition-colors">
                        <td className="p-4 font-semibold text-text-primary max-w-[150px] truncate" title={r.filename}>
                          {r.filename}
                        </td>
                        <td className="p-4 flex items-center gap-1.5 uppercase font-semibold font-mono text-[10px]">
                          {getCategoryIcon(r.category)}
                          {r.category.replace('-signal', '')}
                        </td>
                        <td className="p-4">
                          {new Date(r.createdAt).toLocaleString()}
                        </td>
                        <td className="p-4">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase font-mono ${
                            r.status === 'complete' 
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : r.status === 'failed'
                              ? 'bg-red-50 text-red-700 border border-red-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200 animate-pulse'
                          }`}>
                            {r.status}
                          </span>
                        </td>
                        <td className="p-4">
                          {r.status === 'complete' && r.severity !== 'unknown' ? (
                            <SeverityBadge severity={r.severity as 'normal' | 'borderline' | 'abnormal'} />
                          ) : (
                            <span className="text-text-tertiary">--</span>
                          )}
                        </td>
                        <td className="p-4 text-right">
                          {r.status === 'complete' && (
                            <button
                              onClick={() => onViewResult(r.id.toString())}
                              className="text-teal-600 hover:text-teal-700 font-semibold flex items-center gap-1 ml-auto cursor-pointer"
                            >
                              View Results
                              <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
