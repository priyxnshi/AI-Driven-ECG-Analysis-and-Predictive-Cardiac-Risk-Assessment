/**
 * CSV/Signal Parser — reads CSV ECG files into WaveformData
 */
import type { WaveformData, LeadData } from './types';

export async function parseCSVFile(file: File): Promise<WaveformData> {
  const text = await file.text();
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) throw new Error('CSV file is empty or has no data rows');

  // Parse header for lead names
  const header = lines[0].split(/[,;\t]/);
  const isNumericHeader = header.every(h => !isNaN(parseFloat(h.trim())));

  let leadNames: string[];
  let dataStartRow: number;

  if (isNumericHeader) {
    // No header row — auto-name leads
    leadNames = header.map((_, i) => getDefaultLeadName(i, header.length));
    dataStartRow = 0;
  } else {
    leadNames = header.map((h, i) => {
      const clean = h.trim().replace(/["']/g, '');
      return clean || getDefaultLeadName(i, header.length);
    });
    dataStartRow = 1;
  }

  // Parse data rows
  const columns: number[][] = leadNames.map(() => []);
  for (let r = dataStartRow; r < lines.length; r++) {
    const cells = lines[r].split(/[,;\t]/);
    for (let c = 0; c < Math.min(cells.length, leadNames.length); c++) {
      const val = parseFloat(cells[c].trim());
      if (!isNaN(val)) columns[c].push(val);
    }
  }

  // Filter out columns that are likely time indices (monotonically increasing)
  const validLeads: LeadData[] = [];
  for (let i = 0; i < columns.length; i++) {
    if (columns[i].length < 10) continue;
    if (isMonotonic(columns[i]) && columns.length > 1) continue; // skip time column
    validLeads.push({ name: leadNames[i], samples: columns[i] });
  }

  if (validLeads.length === 0) {
    if (columns.length > 0) {
      validLeads.push({ name: leadNames[0], samples: columns[0] });
    } else {
      throw new Error('INVALID_CSV_FORMAT: No valid signal data columns found in the CSV file.');
    }
  }

  // Estimate sample rate (assume 500Hz if unknown)
  const sampleRate = 500;
  const duration = validLeads[0] ? validLeads[0].samples.length / sampleRate : 10;

  return { sampleRate, leads: validLeads, duration };
}

function isMonotonic(arr: number[]): boolean {
  if (arr.length < 3) return false;
  let increasing = 0;
  for (let i = 1; i < Math.min(arr.length, 100); i++) {
    if (arr[i] > arr[i - 1]) increasing++;
  }
  return increasing / Math.min(arr.length - 1, 99) > 0.95;
}

function getDefaultLeadName(index: number, total: number): string {
  const names12 = ['I','II','III','aVR','aVL','aVF','V1','V2','V3','V4','V5','V6'];
  if (total <= 12 && index < names12.length) return names12[index];
  return `Ch ${index + 1}`;
}
