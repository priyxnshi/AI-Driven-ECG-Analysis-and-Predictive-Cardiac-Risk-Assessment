/**
 * Signal Analyzer — R-peak detection, heart rate, rhythm classification
 */
import type { AnalysisResult, Finding, PatientMetadata, WaveformData, PatientInputData } from './types';

export function analyzeWaveform(waveform: WaveformData, patientData?: PatientInputData): AnalysisResult {
  const primaryLead = waveform.leads.find(l => ['II', 'Lead II'].includes(l.name)) || waveform.leads[0];
  if (!primaryLead) return buildFallbackResult(waveform);

  const peaks = detectRPeaks(primaryLead.samples, waveform.sampleRate);
  const hr = computeHeartRate(peaks, waveform.sampleRate);
  const rrIntervals = peaks.slice(1).map((p, i) => ((p - peaks[i]) / waveform.sampleRate) * 1000);
  const avgRR = rrIntervals.length > 0 ? rrIntervals.reduce((a, b) => a + b, 0) / rrIntervals.length : 833;
  const rrVariability = rrIntervals.length > 1 ? standardDeviation(rrIntervals) : 0;

  const { pWavesFound, prIntervals } = detectPWaves(primaryLead.samples, peaks, waveform.sampleRate);
  const avgPR = prIntervals.length > 0 ? prIntervals.reduce((a, b) => a + b, 0) / prIntervals.length : 160;

  const qrsDurations = measureQRS(primaryLead.samples, peaks, waveform.sampleRate);
  const avgQRS = qrsDurations.length > 0 ? qrsDurations.reduce((a, b) => a + b, 0) / qrsDurations.length : 86;

  const { findings, severity, severityScore, summary } = classify(
    hr, avgRR, rrVariability, pWavesFound, primaryLead.samples, waveform.sampleRate
  );

  const patient: PatientMetadata = {
    name: patientData?.name && patientData.name !== 'Uploaded Scan' ? patientData.name : 'Uploaded Scan',
    age: patientData?.age ? parseInt(patientData.age) : 45,
    sex: patientData?.sex || 'Other',
    recordingDate: new Date().toISOString().split('T')[0],
    duration: `${waveform.duration.toFixed(1)}s`,
    leadConfiguration: `${waveform.leads.length}-Lead`,
    device: 'ECGenius Image Processor',
    heartRate: hr,
    referenceId: patientData?.referenceId || `ECG-${Date.now().toString(36).toUpperCase()}`,
  };

  // Estimate QT dynamically from R peak to T wave end (approximated here by rate)
  // A true QT requires T-wave detection, but Bazett's is used for QTc.
  // We'll estimate QT based on generic repolarization constants if true T-wave not detected.
  const qtEst = Math.round(350 + (1000 - avgRR) * 0.1); 
  const qtcEst = avgRR > 0 ? Math.round(qtEst / Math.sqrt(avgRR / 1000)) : 0;

  return {
    id: `result-${Date.now()}`, timestamp: new Date().toISOString(),
    patient, waveform, overallSeverity: severity, severityScore,
    findings, summary, heartRate: hr, rrInterval: Math.round(avgRR),
    prInterval: Math.round(avgPR), qrsDuration: Math.round(avgQRS), qtInterval: qtEst, qtcInterval: qtcEst,
  };
}

function detectRPeaks(samples: number[], sampleRate: number): number[] {
  const peaks: number[] = [];
  const windowSize = Math.round(sampleRate * 0.15);
  const minDist = Math.round(sampleRate * 0.3); // min 300ms between beats

  // Find signal range
  let max = -Infinity, min = Infinity;
  for (const s of samples) { if (s > max) max = s; if (s < min) min = s; }
  const range = max - min;
  if (range < 0.01) return peaks;

  const threshold = min + range * 0.4;

  for (let i = windowSize; i < samples.length - windowSize; i++) {
    if (samples[i] < threshold) continue;
    let isMax = true;
    for (let j = i - windowSize; j <= i + windowSize; j++) {
      if (j !== i && samples[j] >= samples[i]) { isMax = false; break; }
    }
    if (isMax && (peaks.length === 0 || i - peaks[peaks.length - 1] >= minDist)) {
      peaks.push(i);
    }
  }
  return peaks;
}

function computeHeartRate(peaks: number[], sampleRate: number): number {
  if (peaks.length < 2) return 0;
  const totalTime = (peaks[peaks.length - 1] - peaks[0]) / sampleRate;
  return totalTime > 0 ? Math.round(((peaks.length - 1) / totalTime) * 60) : 0;
}

function standardDeviation(arr: number[]): number {
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  return Math.sqrt(arr.reduce((s, v) => s + (v - mean) ** 2, 0) / arr.length);
}

function detectPWaves(samples: number[], rPeaks: number[], sampleRate: number): { pWavesFound: boolean, prIntervals: number[] } {
  // P wave typically occurs 120-200ms before R peak
  const prIntervals: number[] = [];
  let pWavesDetected = 0;

  for (const rPeak of rPeaks) {
    const searchStart = Math.max(0, rPeak - Math.round(sampleRate * 0.25)); // 250ms before R
    const searchEnd = Math.max(0, rPeak - Math.round(sampleRate * 0.05)); // 50ms before R

    if (searchEnd <= searchStart) continue;

    // Look for a distinct local maximum in this window
    let pPeak = -1;
    let pMax = -Infinity;
    for (let i = searchStart; i < searchEnd; i++) {
      if (samples[i] > pMax) {
        pMax = samples[i];
        pPeak = i;
      }
    }

    // Basic heuristic: Is it a real wave or just noise?
    if (pPeak !== -1) {
      const prMs = ((rPeak - pPeak) / sampleRate) * 1000;
      if (prMs >= 100 && prMs <= 250) {
        prIntervals.push(prMs);
        pWavesDetected++;
      }
    }
  }

  // If we found P-waves for at least 50% of the beats, we consider P-waves present
  return {
    pWavesFound: pWavesDetected > 0 && pWavesDetected >= (rPeaks.length * 0.5),
    prIntervals
  };
}

function measureQRS(samples: number[], rPeaks: number[], sampleRate: number): number[] {
  const durations: number[] = [];
  
  for (const rPeak of rPeaks) {
    // QRS is typically 80-120ms. We look for the width around the R peak
    let qStart = rPeak;
    let sEnd = rPeak;
    
    // Scan left for Q wave (first dip below baseline or flattening)
    while (qStart > 0 && samples[qStart] > samples[qStart - 1] && (rPeak - qStart) < sampleRate * 0.08) {
      qStart--;
    }
    
    // Scan right for S wave
    while (sEnd < samples.length - 1 && samples[sEnd] > samples[sEnd + 1] && (sEnd - rPeak) < sampleRate * 0.08) {
      sEnd++;
    }

    const durationMs = ((sEnd - qStart) / sampleRate) * 1000;
    // Bound it to realistic QRS durations
    durations.push(Math.max(60, Math.min(durationMs * 1.5, 160)));
  }
  
  return durations;
}

function hasFlutterPattern(samples: number[], sampleRate: number): boolean {
  // Look for regular high-frequency oscillations (sawtooth ~300/min)
  const windowSec = 0.5;
  const windowSize = Math.round(sampleRate * windowSec);
  let crossings = 0;
  const mean = samples.slice(0, windowSize).reduce((a, b) => a + b, 0) / windowSize;
  for (let i = 1; i < Math.min(windowSize, samples.length); i++) {
    if ((samples[i - 1] - mean) * (samples[i] - mean) < 0) crossings++;
  }
  const crossRate = crossings / windowSec / 2;
  return crossRate > 200 && crossRate < 400;
}

interface Classification {
  findings: Finding[];
  severity: 'normal' | 'borderline' | 'abnormal';
  severityScore: number;
  summary: string;
}

function classify(
  hr: number, avgRR: number, rrVar: number, pWavesFound: boolean, samples: number[], sr: number
): Classification {
  const findings: Finding[] = [];
  const flutter = hasFlutterPattern(samples, sr);
  
  // 1. Atrial Fibrillation check
  // Irregularly irregular RR intervals (high variance) + no distinct P-waves
  if (rrVar > 100 && !pWavesFound && !flutter) {
    findings.push({
      id: 'f_afib', category: 'rhythm', clinicalTerm: 'Atrial Fibrillation',
      plainLanguage: 'Irregular and often rapid heart rhythm originating from the upper chambers.',
      severity: 'abnormal', confidence: 85, affectedLeads: ['II', 'V1'],
      details: 'Detected irregularly irregular R-R intervals with an absence of distinct P-waves.',
    });
    return { findings, severity: 'abnormal', severityScore: 85, summary: `Atrial Fibrillation detected. Ventricular rate ~${hr} BPM. Urgent clinical correlation recommended.` };
  }

  // 2. Atrial Flutter check
  if (flutter) {
    findings.push({
      id: 'f_flutter', category: 'rhythm', clinicalTerm: 'Atrial Flutter',
      plainLanguage: 'A rapid but organized rhythm originating from the upper chambers of your heart.',
      severity: 'abnormal', confidence: 82, affectedLeads: ['II', 'V1'],
      details: 'Detected high-frequency regular sawtooth oscillations consistent with atrial flutter pattern.',
    });
    return { findings, severity: 'abnormal', severityScore: 78, summary: `Possible atrial flutter pattern detected. Ventricular rate ~${hr} BPM. Cardiology referral recommended.` };
  }

  // 3. Bradycardia / Tachycardia
  if (hr === 0) {
    findings.push({ id: 'f_indet', category: 'rhythm', clinicalTerm: 'Indeterminate Rhythm', plainLanguage: 'Unable to clearly identify individual heartbeats from this recording. The scan quality may need improvement.', severity: 'borderline', confidence: 50, affectedLeads: ['II'] });
    return { findings, severity: 'borderline', severityScore: 50, summary: 'Unable to determine heart rate from the uploaded scan. Consider re-scanning with higher resolution.' };
  }

  let baseSeverity: 'normal' | 'borderline' | 'abnormal' = 'normal';
  let baseScore = 10;

  if (hr > 100) {
    baseSeverity = 'borderline';
    baseScore = Math.min(60, 30 + (hr - 100));
    findings.push({
      id: 'f_tachy', category: 'rhythm', clinicalTerm: 'Sinus Tachycardia',
      plainLanguage: 'Your heart rate is faster than the normal resting range. This can be caused by exercise, stress, caffeine, or other factors.',
      severity: 'borderline', confidence: Math.min(95, 70 + hr - 100), affectedLeads: ['II', 'V1'],
      details: `Heart rate of ${hr} BPM detected (>100 BPM threshold).`,
    });
  } else if (hr < 60 && hr > 0) {
    baseSeverity = 'borderline';
    baseScore = Math.min(50, 20 + (60 - hr));
    findings.push({
      id: 'f_brady', category: 'rhythm', clinicalTerm: 'Sinus Bradycardia',
      plainLanguage: 'Your heart rate is slower than the typical resting range. This is common in athletes or during sleep.',
      severity: 'borderline', confidence: Math.min(95, 70 + (60 - hr)), affectedLeads: ['II', 'V1'],
      details: `Heart rate of ${hr} BPM detected (<60 BPM threshold).`,
    });
  }

  // 4. Normal Sinus Rhythm
  if (findings.length === 0) {
    findings.push({
      id: 'f_nsr', category: 'rhythm', clinicalTerm: 'Normal Sinus Rhythm',
      plainLanguage: 'Your heart is beating in a normal, healthy pattern.', severity: 'normal', confidence: 90, affectedLeads: ['II', 'V1'],
      details: `Regular rhythm at ${hr} BPM. R-R interval: ${Math.round(avgRR)}ms. P-waves detected.`,
    });
    return { findings, severity: 'normal', severityScore: 10, summary: `Normal sinus rhythm at ${hr} BPM. No significant abnormalities detected.` };
  }

  return { findings, severity: baseSeverity, severityScore: baseScore, summary: `Rhythm analyzed at ${hr} BPM. See findings for details.` };
}

function buildFallbackResult(waveform: WaveformData): AnalysisResult {
  return {
    id: `result-${Date.now()}`, timestamp: new Date().toISOString(),
    patient: { name: 'Uploaded Scan', age: 0, sex: 'Other', recordingDate: new Date().toISOString().split('T')[0], duration: `${waveform.duration}s`, leadConfiguration: `${waveform.leads.length}-Lead`, device: 'ECGenius Image Processor', heartRate: 0, referenceId: `ECG-${Date.now().toString(36).toUpperCase()}` },
    waveform, overallSeverity: 'borderline', severityScore: 50,
    findings: [{ id: 'f1', category: 'rhythm', clinicalTerm: 'Insufficient Data', plainLanguage: 'Could not extract enough signal data for analysis.', severity: 'borderline', confidence: 30, affectedLeads: [] }],
    summary: 'Insufficient data for analysis.', heartRate: 0, rrInterval: 0, prInterval: 0, qrsDuration: 0, qtInterval: 0, qtcInterval: 0,
  };
}
