/**
 * ECG Image Processor
 * 
 * Client-side pipeline for extracting ECG waveform data from scanned images.
 * Steps: Load → Grid Removal → Binarization → Trace Extraction → Signal Normalization
 */

import type { WaveformData, LeadData } from './types';

/* ── Types ───────────────────────────────────────────── */
export interface ProcessingProgress {
  step: string;
  progress: number; // 0-100
}

export interface ProcessedImage {
  waveform: WaveformData;
  originalWidth: number;
  originalHeight: number;
  tracesFound: number;
  sourceImage: string; // data URL of original
  processedImage: string; // data URL of processed (binarized)
}

/* ── Main Processing Pipeline ────────────────────────── */
export async function processECGImage(
  file: File,
  onProgress?: (p: ProcessingProgress) => void
): Promise<ProcessedImage> {
  // Step 1: Load image
  onProgress?.({ step: 'Loading image...', progress: 5 });
  const { canvas, ctx } = await loadImage(file);
  const { width, height } = canvas;
  const sourceImage = canvas.toDataURL('image/png');

  // Step 2: Get pixel data
  onProgress?.({ step: 'Analyzing pixel data...', progress: 15 });
  const imageData = ctx.getImageData(0, 0, width, height);

  // Step 3: Remove grid (filter out ECG paper grid lines)
  onProgress?.({ step: 'Removing grid lines...', progress: 30 });
  const gridRemoved = removeGrid(imageData, width, height);

  // Step 4: Binarize (isolate dark trace from background)
  onProgress?.({ step: 'Binarizing trace...', progress: 50 });
  const binary = binarize(gridRemoved, width, height);

  // Step 5: Extract waveform traces
  onProgress?.({ step: 'Extracting waveform traces...', progress: 70 });
  const traces = extractTraces(binary, width, height);

  // Step 6: Convert to processable image data URL
  onProgress?.({ step: 'Generating processed view...', progress: 80 });
  const processedCanvas = document.createElement('canvas');
  processedCanvas.width = width;
  processedCanvas.height = height;
  const pCtx = processedCanvas.getContext('2d')!;
  pCtx.putImageData(binary, 0, 0);
  const processedImage = processedCanvas.toDataURL('image/png');

  // Step 7: Convert traces to WaveformData
  onProgress?.({ step: 'Normalizing signal to 500 Hz...', progress: 90 });
  const waveform = tracesToWaveformData(traces, width);

  onProgress?.({ step: 'Processing complete', progress: 100 });

  return {
    waveform,
    originalWidth: width,
    originalHeight: height,
    tracesFound: traces.length,
    sourceImage,
    processedImage,
  };
}

/* ── Step 1: Load Image ──────────────────────────────── */
function loadImage(file: File): Promise<{
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
}> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      // Limit max dimensions for performance (keep aspect ratio)
      const MAX_DIM = 3000;
      let w = img.width;
      let h = img.height;
      if (w > MAX_DIM || h > MAX_DIM) {
        const scale = MAX_DIM / Math.max(w, h);
        w = Math.round(w * scale);
        h = Math.round(h * scale);
      }

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      resolve({ canvas, ctx });
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };

    img.src = url;
  });
}

/* ── Step 3: Grid Removal ────────────────────────────── */
/**
 * ECG paper typically has:
 * - Pink/red grid lines (H: ~340-360, S: 20-80%)
 * - Orange/brown grid lines on some papers
 * - Light gray grid lines on printed reports
 * 
 * We keep only the dark trace (the actual ECG waveform).
 */
function removeGrid(imageData: ImageData, width: number, height: number): ImageData {
  const src = imageData.data;
  const out = new ImageData(width, height);
  const dst = out.data;

  for (let i = 0; i < src.length; i += 4) {
    const r = src[i];
    const g = src[i + 1];
    const b = src[i + 2];

    // Convert to HSL for better color discrimination
    const { h, s, l } = rgbToHsl(r, g, b);

    // Determine if this pixel is grid or trace
    const isGrid = isGridPixel(r, g, b, h, s, l);
    const isBackground = isBackgroundPixel(r, g, b, l);

    if (isGrid || isBackground) {
      // Replace with white
      dst[i] = 255;
      dst[i + 1] = 255;
      dst[i + 2] = 255;
      dst[i + 3] = 255;
    } else {
      // Keep the pixel (it's likely trace)
      dst[i] = r;
      dst[i + 1] = g;
      dst[i + 2] = b;
      dst[i + 3] = 255;
    }
  }

  return out;
}

function isGridPixel(r: number, g: number, b: number, h: number, s: number, l: number): boolean {
  // Pink/red grid (most common ECG paper)
  if ((h >= 330 || h <= 20) && s > 15 && l > 40 && l < 90) return true;

  // Orange/brown grid lines
  if (h >= 15 && h <= 45 && s > 15 && l > 40 && l < 85) return true;

  // Green grid (some European ECG papers)
  if (h >= 80 && h <= 160 && s > 10 && l > 40 && l < 85) return true;

  // Blue grid (some digital printouts)
  if (h >= 190 && h <= 250 && s > 10 && l > 45 && l < 85) return true;

  // Light gray grid lines (low saturation, medium-high lightness)
  if (s < 10 && l > 70 && l < 95) return true;

  return false;
}

function isBackgroundPixel(_r: number, _g: number, _b: number, l: number): boolean {
  // Very light pixels = paper background
  return l > 92;
}

/* ── Step 4: Binarize ────────────────────────────────── */
function binarize(imageData: ImageData, width: number, height: number): ImageData {
  const src = imageData.data;
  const out = new ImageData(width, height);
  const dst = out.data;

  // Adaptive threshold: use Otsu's method
  const grayscale = new Uint8Array(width * height);
  for (let i = 0; i < src.length; i += 4) {
    const gray = Math.round(0.299 * src[i] + 0.587 * src[i + 1] + 0.114 * src[i + 2]);
    grayscale[i / 4] = gray;
  }

  const threshold = otsuThreshold(grayscale);

  for (let i = 0; i < grayscale.length; i++) {
    const isTrace = grayscale[i] < threshold;
    const pi = i * 4;
    if (isTrace) {
      dst[pi] = 0;       // Black = trace
      dst[pi + 1] = 0;
      dst[pi + 2] = 0;
      dst[pi + 3] = 255;
    } else {
      dst[pi] = 255;     // White = background
      dst[pi + 1] = 255;
      dst[pi + 2] = 255;
      dst[pi + 3] = 255;
    }
  }

  // Morphological cleanup: remove isolated noise pixels
  cleanupNoise(dst, width, height);

  return out;
}

/* ── Otsu's Threshold ────────────────────────────────── */
function otsuThreshold(data: Uint8Array): number {
  const histogram = new Uint32Array(256);
  for (let i = 0; i < data.length; i++) {
    histogram[data[i]]++;
  }

  const total = data.length;
  let sumAll = 0;
  for (let i = 0; i < 256; i++) sumAll += i * histogram[i];

  let sumBg = 0;
  let wBg = 0;
  let maxVariance = 0;
  let threshold = 0;

  for (let t = 0; t < 256; t++) {
    wBg += histogram[t];
    if (wBg === 0) continue;

    const wFg = total - wBg;
    if (wFg === 0) break;

    sumBg += t * histogram[t];
    const meanBg = sumBg / wBg;
    const meanFg = (sumAll - sumBg) / wFg;
    const variance = wBg * wFg * (meanBg - meanFg) * (meanBg - meanFg);

    if (variance > maxVariance) {
      maxVariance = variance;
      threshold = t;
    }
  }

  // Bias towards keeping traces (darken threshold slightly)
  return Math.min(threshold + 15, 240);
}

/* ── Noise Cleanup ───────────────────────────────────── */
function cleanupNoise(data: Uint8ClampedArray, width: number, height: number): void {
  // Remove isolated black pixels (noise) — a black pixel with < 2 black neighbors
  const isBlack = (x: number, y: number) => {
    if (x < 0 || x >= width || y < 0 || y >= height) return false;
    const idx = (y * width + x) * 4;
    return data[idx] === 0;
  };

  const toWhiten: number[] = [];

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = (y * width + x) * 4;
      if (data[idx] !== 0) continue; // skip white

      let blackNeighbors = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          if (isBlack(x + dx, y + dy)) blackNeighbors++;
        }
      }

      if (blackNeighbors < 2) {
        toWhiten.push(idx);
      }
    }
  }

  for (const idx of toWhiten) {
    data[idx] = 255;
    data[idx + 1] = 255;
    data[idx + 2] = 255;
  }
}

/* ── Step 5: Trace Extraction ────────────────────────── */
/**
 * Scans the binary image to find horizontal waveform traces.
 * For each column (x), finds the vertical center of dark pixels in each trace band.
 * Returns array of traces, where each trace is an array of y-values per x.
 */
function extractTraces(
  imageData: ImageData,
  width: number,
  height: number
): number[][] {
  const data = imageData.data;

  // Find horizontal bands that contain traces
  // Count black pixels per row to identify trace regions
  const rowDensity = new Float32Array(height);
  for (let y = 0; y < height; y++) {
    let blackCount = 0;
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      if (data[idx] === 0) blackCount++;
    }
    rowDensity[y] = blackCount / width;
  }

  // Find trace bands by detecting rows with significant black content
  // Use a sliding window to detect bands
  const bandThreshold = 0.005; // minimum 0.5% of row width must be black
  const bands: Array<{ yStart: number; yEnd: number }> = [];
  let inBand = false;
  let bandStart = 0;

  for (let y = 0; y < height; y++) {
    // Smooth density with small window
    let smoothed = 0;
    let count = 0;
    for (let dy = -2; dy <= 2; dy++) {
      const yy = y + dy;
      if (yy >= 0 && yy < height) {
        smoothed += rowDensity[yy];
        count++;
      }
    }
    smoothed /= count;

    if (smoothed > bandThreshold && !inBand) {
      inBand = true;
      bandStart = y;
    } else if (smoothed <= bandThreshold && inBand) {
      inBand = false;
      const bandHeight = y - bandStart;
      // Only keep bands that are reasonably sized (not too thin or too fat)
      if (bandHeight > height * 0.02 && bandHeight < height * 0.5) {
        bands.push({ yStart: bandStart, yEnd: y });
      }
    }
  }
  if (inBand) {
    const bandHeight = height - bandStart;
    if (bandHeight > height * 0.02) {
      bands.push({ yStart: bandStart, yEnd: height });
    }
  }

  // Merge bands that are very close (within 3% of height)
  const mergeGap = height * 0.03;
  const mergedBands: Array<{ yStart: number; yEnd: number }> = [];
  for (const band of bands) {
    if (mergedBands.length > 0) {
      const last = mergedBands[mergedBands.length - 1];
      if (band.yStart - last.yEnd < mergeGap) {
        last.yEnd = band.yEnd;
        continue;
      }
    }
    mergedBands.push({ ...band });
  }

  // If no clear bands found, it's not an ECG (e.g. text document)
  if (mergedBands.length === 0) {
    throw new Error('NO_ECG_DETECTED: No horizontal trace bands found in image.');
  }

  const traceBands = mergedBands;

  // Extract trace from each band
  const traces: number[][] = [];

  for (const band of traceBands) {
    const trace: number[] = [];
    const bandHeight = band.yEnd - band.yStart;
    const bandCenter = (band.yStart + band.yEnd) / 2;

    for (let x = 0; x < width; x++) {
      // Find the weighted center of all black pixels in this column within the band
      let weightSum = 0;
      let posSum = 0;
      let blackCount = 0;

      for (let y = band.yStart; y < band.yEnd; y++) {
        const idx = (y * width + x) * 4;
        if (data[idx] === 0) {
          // Weight by how close to center (reduces outlier impact)
          const distFromCenter = Math.abs(y - bandCenter) / (bandHeight / 2);
          const weight = 1 - distFromCenter * 0.3;
          weightSum += weight;
          posSum += y * weight;
          blackCount++;
        }
      }

      if (blackCount > 0) {
        // Weighted center of black pixels
        trace.push(posSum / weightSum);
      } else {
        // No black pixel found in this column — interpolate from neighbors
        trace.push(trace.length > 0 ? trace[trace.length - 1] : bandCenter);
      }
    }

    // Smooth the trace to reduce jaggedness
    const smoothed = smoothTrace(trace, 3);
    traces.push(smoothed);
  }

  return traces;
}

/* ── Trace Smoothing ─────────────────────────────────── */
function smoothTrace(trace: number[], windowSize: number): number[] {
  const result = new Array(trace.length);
  for (let i = 0; i < trace.length; i++) {
    let sum = 0;
    let count = 0;
    for (let j = -windowSize; j <= windowSize; j++) {
      const idx = i + j;
      if (idx >= 0 && idx < trace.length) {
        sum += trace[idx];
        count++;
      }
    }
    result[i] = sum / count;
  }
  return result;
}

/* ── Step 7: Convert to WaveformData ─────────────────── */
function tracesToWaveformData(
  traces: number[][],
  imageWidth: number
): WaveformData {
  const TARGET_SAMPLE_RATE = 500;

  // Standard ECG lead names based on number of traces found
  const leadNames = getLeadNames(traces.length);

  const leads: LeadData[] = traces.map((trace, i) => {
    // Normalize y-values: convert pixel positions to millivolt-like values
    // Invert because in images, y=0 is top but in ECG, positive is up
    const bandHeight = estimateBandHeight(trace);
    const bandCenter = estimateBandCenter(trace);

    const normalized = trace.map(y => {
      // Convert pixel position to voltage (inverted, centered)
      return -(y - bandCenter) / (bandHeight / 2);
    });

    // Check trace validity via variance (reject flatlines or pure noise)
    const variance = computeVariance(normalized);
    if (variance < 0.0001 || variance > 0.5) {
      throw new Error(`INVALID_FILE_FORMAT: Trace variance (${variance.toFixed(4)}) out of normal ECG range. Likely a text document or flatline.`);
    }

    // Resample to target sample rate
    // Assume the image represents ~10 seconds of ECG (standard 12-lead printout)
    const estimatedDuration = estimateECGDuration(normalized, imageWidth);
    const targetSamples = Math.round(TARGET_SAMPLE_RATE * estimatedDuration);
    const resampled = resample(normalized, targetSamples);

    return {
      name: leadNames[i] || `Trace ${i + 1}`,
      samples: resampled,
    };
  });

  const duration = leads.length > 0 ? leads[0].samples.length / TARGET_SAMPLE_RATE : 10;

  return {
    sampleRate: TARGET_SAMPLE_RATE,
    leads,
    duration,
  };
}

function computeVariance(arr: number[]): number {
  if (arr.length === 0) return 0;
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  return arr.reduce((s, v) => s + (v - mean) ** 2, 0) / arr.length;
}

/* ── Lead Name Assignment ────────────────────────────── */
function getLeadNames(count: number): string[] {
  const standard12 = ['I', 'II', 'III', 'aVR', 'aVL', 'aVF', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6'];
  const standard6 = ['I', 'II', 'III', 'aVR', 'aVL', 'aVF'];
  const standard4 = ['I', 'II', 'III', 'V1'];
  const standard3 = ['I', 'II', 'V1'];

  if (count >= 12) return standard12.slice(0, count);
  if (count >= 6) return standard6.slice(0, count);
  if (count >= 4) return standard4.slice(0, count);
  if (count >= 3) return standard3.slice(0, count);
  if (count === 2) return ['Lead I', 'Lead II'];
  return ['Lead II']; // single lead, assume Lead II (most diagnostic)
}

/* ── Signal Utilities ────────────────────────────────── */
function estimateBandHeight(trace: number[]): number {
  let min = Infinity, max = -Infinity;
  for (const v of trace) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  return Math.max(max - min, 1);
}

function estimateBandCenter(trace: number[]): number {
  // Use median as center (more robust than mean for ECG with spikes)
  const sorted = [...trace].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function estimateECGDuration(signal: number[], imageWidth: number): number {
  // Try to estimate duration from R-R intervals
  // Count major peaks (R-waves)
  const peaks = findPeaks(signal, 0.3);
  if (peaks.length >= 3) {
    // Estimate heart rate from peak spacing
    const intervals: number[] = [];
    for (let i = 1; i < peaks.length; i++) {
      intervals.push(peaks[i] - peaks[i - 1]);
    }
    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    
    // Standard ECG paper: 25mm/s → each R-R at 75bpm is ~0.8s → ~200px at ~250px/s
    // Estimate duration assuming reasonable heart rate (40-180 bpm)
    const pixelsPerBeat = avgInterval;
    const estimatedBPM = 60 / (pixelsPerBeat / (imageWidth / 10)); // assume 10s total
    
    if (estimatedBPM >= 30 && estimatedBPM <= 200) {
      return signal.length / (pixelsPerBeat * (estimatedBPM / 60));
    }
  }

  // Default: assume 10 seconds (standard ECG recording)
  return 10;
}

function findPeaks(signal: number[], threshold: number): number[] {
  const peaks: number[] = [];
  const max = Math.max(...signal);
  const min = Math.min(...signal);
  const range = max - min;
  if (range === 0) return peaks;

  const absThreshold = min + range * threshold;

  for (let i = 2; i < signal.length - 2; i++) {
    if (
      signal[i] > absThreshold &&
      signal[i] > signal[i - 1] &&
      signal[i] > signal[i + 1] &&
      signal[i] > signal[i - 2] &&
      signal[i] > signal[i + 2]
    ) {
      // Check minimum distance from last peak
      if (peaks.length === 0 || i - peaks[peaks.length - 1] > signal.length * 0.02) {
        peaks.push(i);
      }
    }
  }

  return peaks;
}

function resample(data: number[], targetLength: number): number[] {
  if (data.length === targetLength) return data;
  if (data.length === 0) return new Array(targetLength).fill(0);

  const result = new Array(targetLength);
  const ratio = (data.length - 1) / (targetLength - 1);

  for (let i = 0; i < targetLength; i++) {
    const srcIdx = i * ratio;
    const lo = Math.floor(srcIdx);
    const hi = Math.min(lo + 1, data.length - 1);
    const frac = srcIdx - lo;
    result[i] = data[lo] * (1 - frac) + data[hi] * frac;
  }

  return result;
}

/* ── Color Utilities ─────────────────────────────────── */
function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0, s = 0;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  return { h: h * 360, s: s * 100, l: l * 100 };
}
