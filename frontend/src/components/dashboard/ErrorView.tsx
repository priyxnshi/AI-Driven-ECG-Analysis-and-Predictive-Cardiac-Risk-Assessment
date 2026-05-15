'use client';

import { AlertCircle, RefreshCw, FileWarning } from 'lucide-react';

interface ErrorViewProps {
  message: string;
  onRetry: () => void;
}

export default function ErrorView({ message, onRetry }: ErrorViewProps) {
  // Determine if it's a "no signal" error or something else
  const isNoSignal = message.includes('No ECG traces') || message.includes('NO_ECG_DETECTED') || message.includes('flatline') || message.includes('INVALID_FILE_FORMAT');

  const title = isNoSignal ? 'Signal Extraction Failure' : 'Processing Error';
  
  const displayMessage = isNoSignal 
    ? 'The uploaded file does not contain recognizable electrocardiographic data. We could not isolate any valid waveform traces from the provided document.'
    : message;

  return (
    <div className="flex-1 flex items-center justify-center p-6 bg-surface/30">
      <div className="w-full max-w-md bg-white border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="p-6 border-b border-border">
          <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mb-4">
            {isNoSignal ? (
              <FileWarning className="w-6 h-6 text-red-600" />
            ) : (
              <AlertCircle className="w-6 h-6 text-red-600" />
            )}
          </div>
          <h2 className="text-xl font-semibold text-text-primary mb-2">
            {title}
          </h2>
          <p className="text-sm text-text-secondary leading-relaxed">
            {displayMessage}
          </p>
        </div>
        
        <div className="bg-surface px-6 py-4">
          <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">
            Potential Causes
          </h3>
          <ul className="text-xs text-text-tertiary space-y-2 mb-6">
            <li className="flex items-start gap-2">
              <span className="text-red-500 mt-0.5">•</span>
              <span>The file is a text document, prescription, or non-clinical scan.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-red-500 mt-0.5">•</span>
              <span>The image resolution is too low to extract valid signal bands.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-red-500 mt-0.5">•</span>
              <span>The signal-to-noise ratio prevents baseline isolation.</span>
            </li>
          </ul>

          <button
            onClick={onRetry}
            className="w-full flex items-center justify-center gap-2 h-10 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary-hover transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Upload New Scan
          </button>
        </div>
      </div>
    </div>
  );
}
