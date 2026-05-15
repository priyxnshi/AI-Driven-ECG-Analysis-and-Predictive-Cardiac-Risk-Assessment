'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import type { WaveformData } from '@/lib/types';
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';

interface ECGCanvasProps {
  waveform: WaveformData | null;
  isLoading?: boolean;
}

export default function ECGCanvas({ waveform, isLoading }: ECGCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState(0);
  const [panStartX, setPanStartX] = useState(0);
  const [selectedLead, setSelectedLead] = useState<string>('all');

  const PIXELS_PER_SECOND = 100; // 25mm/s at ~4px/mm
  const PIXELS_PER_MV = 80;    // 10mm/mV at ~8px/mm
  const GRID_SMALL = 4;         // 1mm
  const GRID_LARGE = 20;        // 5mm

  const drawGrid = useCallback((ctx: CanvasRenderingContext2D, width: number, height: number) => {
    // Small grid
    ctx.strokeStyle = '#F0E8E8';
    ctx.lineWidth = 0.5;
    for (let x = 0; x < width; x += GRID_SMALL * zoom) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += GRID_SMALL * zoom) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Large grid
    ctx.strokeStyle = '#E0D4D4';
    ctx.lineWidth = 0.8;
    for (let x = 0; x < width; x += GRID_LARGE * zoom) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += GRID_LARGE * zoom) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
  }, [zoom]);

  const drawWaveform = useCallback((
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    data: WaveformData
  ) => {
    const leads = selectedLead === 'all'
      ? data.leads
      : data.leads.filter(l => l.name === selectedLead);

    const leadCount = leads.length;
    const leadHeight = height / leadCount;

    leads.forEach((lead, index) => {
      const yCenter = leadHeight * index + leadHeight / 2;
      const yTop = leadHeight * index;

      // Lead separator
      if (index > 0) {
        ctx.strokeStyle = '#E0E4E8';
        ctx.lineWidth = 0.5;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(0, yTop);
        ctx.lineTo(width, yTop);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Lead label
      ctx.fillStyle = '#5A6068';
      ctx.font = `600 11px 'Roboto Mono', monospace`;
      ctx.fillText(lead.name, 8, yTop + 16);

      // Draw waveform
      ctx.strokeStyle = '#1A1C1E';
      ctx.lineWidth = 1.2;
      ctx.beginPath();

      const samplesPerPixel = data.sampleRate / (PIXELS_PER_SECOND * zoom);
      const startSample = Math.max(0, Math.floor(-panX * samplesPerPixel));
      const endSample = Math.min(lead.samples.length, Math.floor((-panX + width) * samplesPerPixel));

      for (let sIdx = startSample; sIdx < endSample; sIdx++) {
        const x = (sIdx / data.sampleRate) * PIXELS_PER_SECOND * zoom + panX;
        const y = yCenter - lead.samples[sIdx] * PIXELS_PER_MV * zoom;
        const clampedY = Math.max(yTop + 4, Math.min(yTop + leadHeight - 4, y));

        if (sIdx === startSample) ctx.moveTo(x, clampedY);
        else ctx.lineTo(x, clampedY);
      }
      ctx.stroke();
    });
  }, [zoom, panX, selectedLead]);

  // Main render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || !waveform) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    ctx.scale(dpr, dpr);

    // Clear with ECG paper background
    ctx.fillStyle = '#FEFCFC';
    ctx.fillRect(0, 0, rect.width, rect.height);

    drawGrid(ctx, rect.width, rect.height);
    drawWaveform(ctx, rect.width, rect.height, waveform);

    // Speed label
    ctx.fillStyle = '#8A9098';
    ctx.font = `500 10px 'Roboto Mono', monospace`;
    ctx.fillText(`25 mm/s  |  10 mm/mV  |  ${waveform.sampleRate} Hz`, rect.width - 220, rect.height - 8);

  }, [waveform, zoom, panX, selectedLead, drawGrid, drawWaveform]);

  // Resize observer
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const ro = new ResizeObserver(() => {
      // Trigger re-render
      setPanX(prev => prev + 0);
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  // Pan handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsPanning(true);
    setPanStart(e.clientX);
    setPanStartX(panX);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanning) return;
    const dx = e.clientX - panStart;
    setPanX(panStartX + dx);
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  // Zoom handlers
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setZoom(prev => Math.max(0.3, Math.min(3, prev + delta)));
  };

  const handleZoomIn = () => setZoom(prev => Math.min(3, prev + 0.2));
  const handleZoomOut = () => setZoom(prev => Math.max(0.3, prev - 0.2));
  const handleReset = () => { setZoom(1); setPanX(0); setSelectedLead('all'); };

  if (isLoading || !waveform) {
    return (
      <div className="flex-1 flex flex-col bg-surface/30 min-w-0">
        <div className="h-10 border-b border-border px-4 flex items-center">
          <div className="skeleton h-3 w-32 rounded" />
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="skeleton h-4 w-48 rounded mx-auto mb-2" />
            <div className="skeleton h-3 w-32 rounded mx-auto" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-w-0">
      {/* Toolbar */}
      <div className="h-10 border-b border-border px-4 flex items-center justify-between flex-shrink-0 bg-white">
        <div className="flex items-center gap-2">
          <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
            ECG Waveform
          </h2>
          <span className="text-[10px] mono-value text-text-tertiary">
            {selectedLead === 'all' ? '12-Lead' : selectedLead}
          </span>
        </div>

        <div className="flex items-center gap-1">
          {/* Lead selector */}
          <select
            value={selectedLead}
            onChange={(e) => setSelectedLead(e.target.value)}
            className="text-xs border border-border rounded px-2 py-1 bg-white text-text-primary mr-2 focus:outline-none focus:border-primary"
            id="lead-selector"
          >
            <option value="all">All Leads</option>
            {waveform.leads.map(l => (
              <option key={l.name} value={l.name}>{l.name}</option>
            ))}
          </select>

          <button
            onClick={handleZoomOut}
            className="w-7 h-7 rounded flex items-center justify-center hover:bg-surface border border-border"
            title="Zoom out"
            id="ecg-zoom-out"
          >
            <ZoomOut className="w-3.5 h-3.5 text-text-secondary" />
          </button>
          <span className="mono-value text-[10px] text-text-tertiary w-10 text-center">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={handleZoomIn}
            className="w-7 h-7 rounded flex items-center justify-center hover:bg-surface border border-border"
            title="Zoom in"
            id="ecg-zoom-in"
          >
            <ZoomIn className="w-3.5 h-3.5 text-text-secondary" />
          </button>
          <button
            onClick={handleReset}
            className="w-7 h-7 rounded flex items-center justify-center hover:bg-surface border border-border ml-1"
            title="Reset view"
            id="ecg-reset"
          >
            <Maximize2 className="w-3.5 h-3.5 text-text-secondary" />
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div
        ref={containerRef}
        className="flex-1 ecg-canvas-container min-h-0"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      >
        <canvas ref={canvasRef} className="block w-full h-full" />
      </div>
    </div>
  );
}
