'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import type { ECGFile } from '@/lib/types';
import FileTypeIndicator from './FileTypeIndicator';
import { X, FileCheck, FileText } from 'lucide-react';

interface FilePreviewProps {
  ecgFile: ECGFile;
  onRemove: () => void;
}

export default function FilePreview({ ecgFile, onRemove }: FilePreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // Generate waveform thumbnail for signal files, or image preview for scans
  useEffect(() => {
    if (ecgFile.category === 'visual-scan') {
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(ecgFile.file);
      return;
    }

    // For signal files, render a mini waveform preview
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = canvas;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    // Clear
    ctx.fillStyle = '#F4F7F9';
    ctx.fillRect(0, 0, width, height);

    // Draw mini ECG grid
    ctx.strokeStyle = '#E0E4E8';
    ctx.lineWidth = 0.5;
    const gridSize = 8;
    for (let x = 0; x < width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Generate a simple waveform preview
    ctx.strokeStyle = '#0052CC';
    ctx.lineWidth = 1.5;
    ctx.beginPath();

    const centerY = height / 2;
    const samplesCount = width;

    for (let i = 0; i < samplesCount; i++) {
      const x = i;

      // Simplified PQRST pattern
      const beatPos = (i % (samplesCount / 3)) / (samplesCount / 3);
      let y = centerY;

      if (beatPos > 0.15 && beatPos < 0.22) {
        // P wave
        y = centerY - Math.sin((beatPos - 0.15) / 0.07 * Math.PI) * 6;
      } else if (beatPos > 0.28 && beatPos < 0.3) {
        // Q
        y = centerY + 4;
      } else if (beatPos > 0.3 && beatPos < 0.34) {
        // R
        y = centerY - Math.sin((beatPos - 0.3) / 0.04 * Math.PI) * 30;
      } else if (beatPos > 0.34 && beatPos < 0.37) {
        // S
        y = centerY + 8;
      } else if (beatPos > 0.5 && beatPos < 0.62) {
        // T wave
        y = centerY - Math.sin((beatPos - 0.5) / 0.12 * Math.PI) * 10;
      }

      // Add subtle noise
      y += (Math.random() - 0.5) * 1;

      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }, [ecgFile]);

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="animate-slide-up border border-border rounded-lg overflow-hidden bg-white">
      {/* Preview area */}
      <div className="relative h-32 bg-surface">
        {ecgFile.category === 'visual-scan' && imagePreview ? (
          <Image
            src={imagePreview}
            alt="ECG scan preview"
            fill
            className="object-contain p-2"
          />
        ) : ecgFile.category === 'document' ? (
          <div className="w-full h-full flex items-center justify-center">
            <FileText className="w-10 h-10 text-text-tertiary" />
          </div>
        ) : (
          <canvas
            ref={canvasRef}
            className="w-full h-full"
            width={400}
            height={128}
          />
        )}

        {/* Remove button */}
        <button
          onClick={onRemove}
          className="absolute top-2 right-2 w-6 h-6 rounded-full bg-white border border-border flex items-center justify-center hover:bg-surface"
          id="file-preview-remove"
        >
          <X className="w-3 h-3 text-text-secondary" />
        </button>
      </div>

      {/* File info */}
      <div className="p-3 border-t border-border">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <FileCheck className="w-4 h-4 text-success flex-shrink-0" />
            <span className="text-sm font-medium text-text-primary truncate">
              {ecgFile.name}
            </span>
          </div>
          <span className="mono-value text-xs text-text-tertiary flex-shrink-0">
            {formatSize(ecgFile.size)}
          </span>
        </div>
        <FileTypeIndicator fileName={ecgFile.name} category={ecgFile.category} />
      </div>
    </div>
  );
}
