'use client';

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, Trash2, RotateCcw, Play, CheckCircle, Clock, AlertTriangle, ShieldCheck, Heart, FileText, Table } from 'lucide-react';
import type { PatientInputData } from '@/lib/types';

interface QueueItem {
  id: string;
  file: File;
  name: string;
  size: number;
  category: string;
  status: 'queued' | 'uploading' | 'uploaded' | 'processing' | 'complete' | 'failed';
  progress: number;
  error?: string;
  recordId?: string;
  patient: PatientInputData;
}

interface BatchUploadZoneProps {
  onViewResult: (recordId: string) => void;
  onCompareResults: (recordIds: string[]) => void;
}

export default function BatchUploadZone({ onViewResult, onCompareResults }: BatchUploadZoneProps) {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const getCategory = (filename: string): string => {
    const ext = filename.toLowerCase().split('.').pop() || '';
    if (['csv', 'dat', 'hea', 'mat', 'dcm', 'dicom'].includes(ext)) return 'digital-signal';
    if (ext === 'pdf') return 'document';
    if (['jpg', 'jpeg', 'png'].includes(ext)) return 'visual-scan';
    return 'unknown';
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newItems = acceptedFiles.map(file => {
      const category = getCategory(file.name);
      const isAllowed = ['csv', 'dat', 'hea', 'mat', 'dcm', 'dicom', 'pdf', 'jpg', 'jpeg', 'png'].includes(
        file.name.toLowerCase().split('.').pop() || ''
      );
      
      return {
        id: `q-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        file,
        name: file.name,
        size: file.size,
        category,
        status: isAllowed ? 'queued' as const : 'failed' as const,
        progress: 0,
        error: isAllowed ? undefined : 'Disallowed file format extension.',
        patient: {
          name: 'Patient Demo',
          age: '45',
          sex: 'Male' as const,
          referenceId: `PT-${Math.floor(10000 + Math.random() * 90000)}`
        }
      };
    });

    setQueue(prev => [...prev, ...newItems]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/octet-stream': ['.dat', '.mat', '.dcm', '.dicom'],
      'application/pdf': ['.pdf'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
    }
  });

  const handlePatientChange = (id: string, field: keyof PatientInputData, value: string) => {
    setQueue(prev => prev.map(item => {
      if (item.id === id) {
        return {
          ...item,
          patient: { ...item.patient, [field]: value }
        };
      }
      return item;
    }));
  };

  const handleRemove = (id: string) => {
    setQueue(prev => prev.filter(item => item.id !== id));
  };

  const handleClearAll = () => {
    setQueue([]);
    setIsProcessing(false);
  };

  const uploadAndProcessItem = async (item: QueueItem): Promise<string> => {
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    const token = localStorage.getItem('token');

    // 1. Upload file
    const formData = new FormData();
    formData.append('file', item.file);
    formData.append('patientReferenceId', item.patient.referenceId);
    formData.append('patientName', item.patient.name);
    formData.append('patientAge', item.patient.age);
    formData.append('patientSex', item.patient.sex);

    // Simulate upload progress
    setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'uploading', progress: 30 } : q));

    const response = await fetch(`${apiBase}/api/ecg/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || `Upload failed: ${response.status}`);
    }

    const recordId = data.record.id;
    setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'uploaded', progress: 100, recordId } : q));

    return recordId;
  };

  const startAnalysisQueue = async () => {
    setIsProcessing(true);
    const token = localStorage.getItem('token');
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

    const itemsToProcess = queue.filter(item => item.status === 'queued' || item.status === 'failed');
    
    // 1. Upload all files
    const recordIds: string[] = [];
    for (const item of itemsToProcess) {
      try {
        const recordId = await uploadAndProcessItem(item);
        recordIds.push(recordId);
      } catch (err: unknown) {
        setQueue(prev => prev.map(q => q.id === item.id ? { 
          ...q, 
          status: 'failed', 
          error: err instanceof Error ? err.message : 'Upload failed' 
        } : q));
      }
    }

    if (recordIds.length === 0) {
      setIsProcessing(false);
      return;
    }

    // 2. Trigger batch analysis
    try {
      const response = await fetch(`${apiBase}/api/ecg/analyze/batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ recordIds })
      });

      if (!response.ok) {
        throw new Error('Failed to queue batch analysis on backend.');
      }

      // Update status to processing
      setQueue(prev => prev.map(q => recordIds.includes(q.recordId || '') ? { ...q, status: 'processing', progress: 10 } : q));

      // 3. Poll statuses
      const activeRecordIds = [...recordIds];
      const pollInterval = setInterval(async () => {
        if (activeRecordIds.length === 0) {
          clearInterval(pollInterval);
          setIsProcessing(false);
          return;
        }

        for (const rId of [...activeRecordIds]) {
          try {
            const statusResp = await fetch(`${apiBase}/api/ecg/status/${rId}`, {
              headers: { 'Authorization': `Bearer ${token}` }
            });
            const statusData = await statusResp.json();
            
            if (statusData.status === 'complete') {
              setQueue(prev => prev.map(q => q.recordId === rId ? { ...q, status: 'complete', progress: 100 } : q));
              activeRecordIds.splice(activeRecordIds.indexOf(rId), 1);
            } else if (statusData.status === 'failed') {
              setQueue(prev => prev.map(q => q.recordId === rId ? { ...q, status: 'failed', error: statusData.errorMessage || 'Processing failed' } : q));
              activeRecordIds.splice(activeRecordIds.indexOf(rId), 1);
            } else {
              setQueue(prev => prev.map(q => q.recordId === rId ? { ...q, progress: statusData.progress || 20 } : q));
            }
          } catch (pollErr) {
            console.error('Error polling status:', pollErr);
          }
        }
      }, 1000);

    } catch (err: unknown) {
      setQueue(prev => prev.map(q => recordIds.includes(q.recordId || '') ? { 
        ...q, 
        status: 'failed', 
        error: err instanceof Error ? err.message : 'Batch queuing failed' 
      } : q));
      setIsProcessing(false);
    }
  };

  const handleDownloadBatchPDF = () => {
    const token = localStorage.getItem('token');
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    const completedIds = queue.filter(q => q.status === 'complete' && q.recordId).map(q => q.recordId);
    
    if (completedIds.length === 0) return;

    fetch(`${apiBase}/api/ecg/report/batch/pdf`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ recordIds: completedIds })
    })
    .then(resp => resp.blob())
    .then(blob => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Batch_Report_${Date.now()}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    });
  };

  const handleCompareSelected = () => {
    const completedIds = queue.filter(q => q.status === 'complete' && q.recordId).map(q => q.recordId!);
    if (completedIds.length < 2) return;
    onCompareResults(completedIds);
  };

  return (
    <div className="flex-1 flex flex-col p-6 overflow-y-auto">
      <div className="max-w-6xl mx-auto w-full flex-1 flex flex-col min-h-0 gap-6">
        
        {/* Title */}
        <div className="flex items-center justify-between flex-shrink-0">
          <div>
            <h1 className="text-xl font-bold text-text-primary tracking-tight">
              Clinical ECG Ingestion Queue
            </h1>
            <p className="text-sm text-text-secondary">
              Upload multiple waveforms and reports to analyze in batch
            </p>
          </div>
          
          <div className="flex gap-2">
            {queue.filter(q => q.status === 'complete').length >= 2 && (
              <button 
                onClick={handleCompareSelected}
                className="h-9 px-4 border border-border hover:bg-surface text-primary rounded-lg text-sm font-semibold transition-all flex items-center gap-1.5 cursor-pointer bg-white"
              >
                <Table className="w-4 h-4" />
                Compare Selected
              </button>
            )}
            {queue.filter(q => q.status === 'complete').length > 0 && (
              <button 
                onClick={handleDownloadBatchPDF}
                className="h-9 px-4 border border-border hover:bg-surface text-primary rounded-lg text-sm font-semibold transition-all flex items-center gap-1.5 cursor-pointer bg-white"
              >
                <FileText className="w-4 h-4" />
                Export Batch PDF
              </button>
            )}
            {queue.length > 0 && (
              <button
                onClick={handleClearAll}
                className="h-9 px-3 border border-border hover:bg-red-50 hover:text-red-700 text-text-secondary rounded-lg text-sm font-semibold transition-colors flex items-center gap-1 cursor-pointer bg-white"
                disabled={isProcessing}
              >
                <Trash2 className="w-4 h-4" />
                Clear Queue
              </button>
            )}
          </div>
        </div>

        {/* Drag Drop Area */}
        <div
          {...getRootProps()}
          className={`
            border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all flex-shrink-0
            ${isDragActive ? 'border-primary bg-primary-light/10' : 'border-border bg-white hover:border-primary/50'}
          `}
        >
          <input {...getInputProps()} />
          <Upload className="w-8 h-8 text-text-tertiary mx-auto mb-3" />
          <p className="text-sm font-semibold text-text-primary">
            {isDragActive ? 'Drop files here...' : 'Drag & drop ECG files'}
          </p>
          <p className="text-xs text-text-tertiary mt-1">
            Accepts <span className="mono-value">.csv</span>, <span className="mono-value">.dat</span>, <span className="mono-value">.hea</span>, <span className="mono-value">.mat</span>, <span className="mono-value">.pdf</span>, <span className="mono-value">.jpg</span>, <span className="mono-value">.png</span> (Max 10MB per file)
          </p>
        </div>

        {/* Queue List Table */}
        <div className="flex-1 min-h-0 bg-white border border-border rounded-xl shadow-sm overflow-hidden flex flex-col">
          <div className="flex-1 overflow-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead className="bg-surface text-text-tertiary text-xs uppercase tracking-wider sticky top-0 z-10 border-b border-border">
                <tr>
                  <th className="px-5 py-3 font-medium">ECG File Details</th>
                  <th className="px-5 py-3 font-medium">File Type</th>
                  <th className="px-5 py-3 font-medium">Patient Profiling Linkage</th>
                  <th className="px-5 py-3 font-medium">Analysis Progress</th>
                  <th className="px-5 py-3 font-medium text-right">Queue Operations</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {queue.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-16 text-center text-text-tertiary">
                      No files queued. Drag & drop files above to start ingestion.
                    </td>
                  </tr>
                ) : (
                  queue.map((item) => (
                    <tr key={item.id} className="hover:bg-surface/10 transition-colors">
                      <td className="px-5 py-4 min-w-[200px]">
                        <div className="font-semibold text-text-primary truncate" title={item.name}>{item.name}</div>
                        <div className="text-[10px] text-text-tertiary mono-value">
                          {(item.size / 1024).toFixed(1)} KB
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-surface border border-border text-text-secondary uppercase">
                          {item.category}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        {item.status === 'queued' ? (
                          <div className="grid grid-cols-3 gap-2">
                            <input
                              type="text"
                              placeholder="Patient ID"
                              className="text-xs border border-border rounded p-1"
                              value={item.patient.referenceId}
                              onChange={(e) => handlePatientChange(item.id, 'referenceId', e.target.value)}
                            />
                            <input
                              type="text"
                              placeholder="Name"
                              className="text-xs border border-border rounded p-1"
                              value={item.patient.name}
                              onChange={(e) => handlePatientChange(item.id, 'name', e.target.value)}
                            />
                            <input
                              type="number"
                              placeholder="Age"
                              className="text-xs border border-border rounded p-1"
                              value={item.patient.age}
                              onChange={(e) => handlePatientChange(item.id, 'age', e.target.value)}
                            />
                          </div>
                        ) : (
                          <div className="text-xs text-text-secondary">
                            <span className="font-semibold">{item.patient.name}</span> ({item.patient.referenceId}, {item.patient.age}y, {item.patient.sex[0]})
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-4 min-w-[150px]">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className={`inline-flex items-center gap-1 font-semibold uppercase text-[9px] ${
                              item.status === 'complete' ? 'text-green-600' :
                              item.status === 'failed' ? 'text-red-600' :
                              item.status === 'processing' ? 'text-blue-600' : 'text-text-tertiary'
                            }`}>
                              {item.status === 'complete' && <CheckCircle className="w-3 h-3" />}
                              {item.status === 'processing' && <Clock className="w-3 h-3 animate-spin" />}
                              {item.status === 'failed' && <AlertTriangle className="w-3 h-3" />}
                              {item.status}
                            </span>
                            <span className="mono-value text-[10px] text-text-tertiary">{item.progress}%</span>
                          </div>
                          <div className="h-1 bg-surface rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full transition-all duration-300 ${
                                item.status === 'complete' ? 'bg-green-500' :
                                item.status === 'failed' ? 'bg-red-500' : 'bg-primary'
                              }`} 
                              style={{ width: `${item.progress}%` }}
                            />
                          </div>
                          {item.error && (
                            <span className="text-[10px] text-red-500 truncate" title={item.error}>{item.error}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex justify-end gap-1.5">
                          {item.status === 'complete' && item.recordId && (
                            <button
                              onClick={() => onViewResult(item.recordId!)}
                              className="px-2 py-1 text-xs border border-border bg-white text-primary rounded font-semibold hover:bg-surface cursor-pointer"
                            >
                              Review Result
                            </button>
                          )}
                          {item.status === 'failed' && (
                            <button 
                              onClick={() => handleRemove(item.id)}
                              className="p-1 text-text-tertiary hover:text-red-600 rounded transition-colors bg-white border border-border cursor-pointer"
                              title="Dismiss error"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {item.status === 'queued' && (
                            <button 
                              onClick={() => handleRemove(item.id)}
                              className="p-1 text-text-tertiary hover:text-red-600 rounded transition-colors bg-white border border-border cursor-pointer"
                              title="Delete from queue"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          
          {/* Analyze Trigger Bar */}
          {queue.some(q => q.status === 'queued' || q.status === 'failed') && (
            <div className="p-4 border-t border-border bg-surface/30 flex items-center justify-between flex-shrink-0">
              <span className="text-xs text-text-secondary">
                {queue.filter(q => q.status === 'queued' || q.status === 'failed').length} files ready to be analyzed.
              </span>
              <button
                onClick={startAnalysisQueue}
                className="h-10 px-5 rounded-lg bg-primary hover:bg-primary-hover active:scale-[0.99] text-white font-semibold text-sm transition-all flex items-center gap-2 cursor-pointer shadow-md shadow-primary/10"
                disabled={isProcessing}
              >
                <Play className="w-4 h-4 fill-white" />
                Analyze Ingested Queue
              </button>
            </div>
          )}
        </div>

        {/* Bottom HIPAA Banner */}
        <div className="flex items-center justify-center gap-2 flex-shrink-0 text-text-tertiary text-[10px] uppercase font-semibold">
          <ShieldCheck className="w-4 h-4 text-green-600" />
          <span>Patient Identity Protection Layer Active (Strict Ingest validation enabled)</span>
        </div>
      </div>
    </div>
  );
}
