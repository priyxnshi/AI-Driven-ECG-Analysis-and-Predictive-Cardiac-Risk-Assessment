'use client';

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import type { ECGFile, PatientInputData } from '@/lib/types';
import { detectFileCategory, getAcceptedFileTypes } from '@/lib/ecg-utils';
import FilePreview from './FilePreview';
import { Upload, ArrowRight, Shield, Zap, Database, User } from 'lucide-react';

interface UploadZoneProps {
  onStartAnalysis: (file: ECGFile, patientData: PatientInputData) => void;
}

export default function UploadZone({ onStartAnalysis }: UploadZoneProps) {
  const [selectedFile, setSelectedFile] = useState<ECGFile | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [isUploading, setIsUploading] = useState(false);
  const [patientData, setPatientData] = useState<PatientInputData>(() => ({
    name: 'Uploaded Scan',
    age: '',
    sex: 'Other',
    referenceId: `ECG-${Date.now().toString(36).toUpperCase()}`
  }));

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    const ecgFile: ECGFile = {
      id: `file-${Date.now()}`,
      name: file.name,
      size: file.size,
      type: file.type,
      category: detectFileCategory(file.name),
      file,
    };

    setSelectedFile(ecgFile);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: getAcceptedFileTypes(),
    maxFiles: 1,
    multiple: false,
  });

  const handleStartAnalysis = async () => {
    if (!selectedFile) return;
    setIsUploading(true);

    // Simulate upload progress
    const steps = [15, 35, 55, 75, 90, 100];
    for (const step of steps) {
      await new Promise(r => setTimeout(r, 150));
      setUploadProgress(step);
    }

    await new Promise(r => setTimeout(r, 200));
    onStartAnalysis(selectedFile, patientData);
  };

  const handleRemove = () => {
    setSelectedFile(null);
    setUploadProgress(0);
    setIsUploading(false);
  };

  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="w-full max-w-xl">
        {/* Title */}
        <div className="text-center mb-6">
          <h1 className="text-xl font-semibold text-text-primary mb-1" id="upload-title">
            Upload ECG Recording
          </h1>
          <p className="text-sm text-text-secondary">
            Drop your file to begin clinical analysis
          </p>
        </div>

        {/* Drop Zone */}
        {!selectedFile ? (
          <div
            {...getRootProps()}
            className={`
              relative border-2 border-dashed rounded-lg p-12 text-center cursor-pointer
              transition-all duration-150
              ${isDragActive
                ? 'border-primary bg-primary-light'
                : 'border-border bg-surface/50 hover:border-border-strong hover:bg-surface'
              }
            `}
            id="upload-dropzone"
          >
            <input {...getInputProps()} className="cursor-pointer" />

            <div className="flex flex-col items-center gap-4 pointer-events-none">
              <div
                className={`
                  w-12 h-12 rounded-lg flex items-center justify-center
                  ${isDragActive ? 'bg-primary text-white' : 'bg-white border border-border text-text-tertiary'}
                `}
              >
                <Upload className="w-5 h-5" />
              </div>

              <div>
                <p className="text-sm font-medium text-text-primary mb-1">
                  {isDragActive ? 'Release to upload' : 'Drag & drop your ECG file'}
                </p>
                <p className="text-xs text-text-tertiary">
                  or <span className="text-primary font-medium">browse files</span>
                </p>
              </div>

              {/* Accepted formats */}
              <div className="flex flex-wrap items-center justify-center gap-1.5 mt-2">
                {['.csv', '.xml', '.edf', '.pdf', '.jpg', '.png'].map(ext => (
                  <span
                    key={ext}
                    className="mono-value text-[10px] px-1.5 py-0.5 rounded bg-white border border-border text-text-tertiary"
                  >
                    {ext}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* File Preview */}
            <FilePreview ecgFile={selectedFile} onRemove={handleRemove} />

            {/* Upload Progress */}
            {isUploading && uploadProgress < 100 && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-text-secondary">Uploading...</span>
                  <span className="mono-value text-text-tertiary">{uploadProgress}%</span>
                </div>
                <div className="h-1 bg-surface rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-150"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Patient Details Form */}
            {!isUploading && (
              <div className="bg-white border border-border rounded-lg p-4 mb-4">
                <div className="flex items-center gap-2 mb-3">
                  <User className="w-4 h-4 text-text-tertiary" />
                  <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Patient Details (Optional)</h3>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] text-text-tertiary uppercase tracking-wider mb-1">Full Name</label>
                    <input 
                      type="text" 
                      className="w-full h-8 px-2 text-sm border border-border rounded focus:outline-none focus:border-primary"
                      placeholder="e.g. John Doe"
                      value={patientData.name === 'Uploaded Scan' ? '' : patientData.name}
                      onChange={e => setPatientData({...patientData, name: e.target.value || 'Uploaded Scan'})}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-text-tertiary uppercase tracking-wider mb-1">Reference ID</label>
                    <input 
                      type="text" 
                      className="w-full h-8 px-2 text-sm border border-border rounded focus:outline-none focus:border-primary mono-value"
                      value={patientData.referenceId}
                      onChange={e => setPatientData({...patientData, referenceId: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-text-tertiary uppercase tracking-wider mb-1">Age</label>
                    <input 
                      type="number" 
                      className="w-full h-8 px-2 text-sm border border-border rounded focus:outline-none focus:border-primary"
                      placeholder="Years"
                      value={patientData.age}
                      onChange={e => setPatientData({...patientData, age: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-text-tertiary uppercase tracking-wider mb-1">Biological Sex</label>
                    <select 
                      className="w-full h-8 px-2 text-sm border border-border rounded focus:outline-none focus:border-primary bg-white"
                      value={patientData.sex}
                      onChange={e => setPatientData({...patientData, sex: e.target.value as PatientInputData['sex']})}
                    >
                      <option value="Other">Unspecified</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Action Button */}
            {!isUploading && (
              <button
                onClick={handleStartAnalysis}
                className="
                  w-full h-11 rounded-lg bg-primary text-white text-sm font-semibold
                  flex items-center justify-center gap-2
                  hover:bg-primary-hover active:scale-[0.99] transition-all duration-150
                "
                id="begin-analysis-btn"
              >
                Begin Analysis
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        )}

        {/* Bottom features strip */}
        <div className="flex items-center justify-center gap-6 mt-8">
          {[
            { icon: <Shield className="w-3.5 h-3.5" />, text: 'HIPAA Compliant' },
            { icon: <Zap className="w-3.5 h-3.5" />, text: '500 Hz Normalization' },
            { icon: <Database className="w-3.5 h-3.5" />, text: 'Universal Port' },
          ].map((feature) => (
            <div
              key={feature.text}
              className="flex items-center gap-1.5 text-text-tertiary"
            >
              {feature.icon}
              <span className="text-[10px] font-medium uppercase tracking-wider">
                {feature.text}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
