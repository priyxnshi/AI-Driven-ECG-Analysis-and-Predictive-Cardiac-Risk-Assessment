import {
  type LeadData,
  type WaveformData,
  type AnalysisResult,
  type Finding,
  type PatientMetadata,
  type FileCategory,
} from './types';

/* ── File Category Detection ─────────────────────────── */
export function detectFileCategory(fileName: string): FileCategory {
  const ext = fileName.toLowerCase().split('.').pop() || '';
  if (['csv', 'xml', 'edf'].includes(ext)) return 'digital-signal';
  if (ext === 'pdf') return 'document';
  if (['jpg', 'jpeg', 'png'].includes(ext)) return 'visual-scan';
  return 'digital-signal';
}

export function getAcceptedFileTypes(): Record<string, string[]> {
  return {
    'text/csv': ['.csv'],
    'text/xml': ['.xml'],
    'application/xml': ['.xml'],
    'application/pdf': ['.pdf'],
    'image/jpeg': ['.jpg', '.jpeg'],
    'image/png': ['.png'],
    'application/edf': ['.edf'],
  };
}

/* ── PQRST Complex Generator ─────────────────────────── */
function generatePQRSTComplex(
  heartRate: number,
  sampleRate: number,
  amplitude: number = 1.0,
  noiseLevel: number = 0.02
): number[] {
  const samplesPerBeat = Math.round((60 / heartRate) * sampleRate);
  const samples: number[] = new Array(samplesPerBeat).fill(0);

  // P wave (atrial depolarization)
  const pStart = Math.round(samplesPerBeat * 0.1);
  const pDuration = Math.round(samplesPerBeat * 0.08);
  for (let i = 0; i < pDuration; i++) {
    const t = i / pDuration;
    samples[pStart + i] = amplitude * 0.15 * Math.sin(Math.PI * t);
  }

  // PR segment (flat)

  // QRS complex
  const qrsStart = Math.round(samplesPerBeat * 0.25);
  const qrsDuration = Math.round(sampleRate * 0.08); // ~80ms

  // Q wave (small downward)
  const qDuration = Math.round(qrsDuration * 0.2);
  for (let i = 0; i < qDuration; i++) {
    const t = i / qDuration;
    samples[qrsStart + i] = -amplitude * 0.1 * Math.sin(Math.PI * t);
  }

  // R wave (large upward)
  const rStart = qrsStart + qDuration;
  const rDuration = Math.round(qrsDuration * 0.35);
  for (let i = 0; i < rDuration; i++) {
    const t = i / rDuration;
    samples[rStart + i] = amplitude * 1.0 * Math.sin(Math.PI * t);
  }

  // S wave (small downward)
  const sStart = rStart + rDuration;
  const sDuration = Math.round(qrsDuration * 0.25);
  for (let i = 0; i < sDuration; i++) {
    const t = i / sDuration;
    samples[sStart + i] = -amplitude * 0.2 * Math.sin(Math.PI * t);
  }

  // ST segment (slight elevation possible)

  // T wave (ventricular repolarization)
  const tStart = Math.round(samplesPerBeat * 0.5);
  const tDuration = Math.round(samplesPerBeat * 0.15);
  for (let i = 0; i < tDuration; i++) {
    const t = i / tDuration;
    samples[tStart + i] = amplitude * 0.3 * Math.sin(Math.PI * t);
  }

  // Add subtle noise
  for (let i = 0; i < samples.length; i++) {
    samples[i] += (Math.random() - 0.5) * noiseLevel * amplitude;
  }

  return samples;
}

/* ── Flutter Wave Generator ──────────────────────────── */
function generateFlutterWaves(
  sampleRate: number,
  duration: number,
  amplitude: number = 1.0
): number[] {
  const totalSamples = sampleRate * duration;
  const samples: number[] = new Array(totalSamples).fill(0);
  const flutterRate = 300; // ~300 bpm atrial rate
  const samplesPerFlutter = Math.round((60 / flutterRate) * sampleRate);

  // Sawtooth F-waves
  for (let i = 0; i < totalSamples; i++) {
    const posInCycle = (i % samplesPerFlutter) / samplesPerFlutter;
    // Sawtooth pattern
    samples[i] = amplitude * 0.25 * (1 - 2 * posInCycle);
  }

  // Overlay ventricular response (every 3rd or 4th flutter wave)
  const ventricularRate = 75;
  const samplesPerVBeat = Math.round((60 / ventricularRate) * sampleRate);

  for (let beatStart = 0; beatStart < totalSamples; beatStart += samplesPerVBeat) {
    const qrsStart = beatStart;
    const qrsDuration = Math.round(sampleRate * 0.08);

    // Q
    for (let i = 0; i < Math.round(qrsDuration * 0.2) && qrsStart + i < totalSamples; i++) {
      const t = i / (qrsDuration * 0.2);
      samples[qrsStart + i] += -amplitude * 0.1 * Math.sin(Math.PI * t);
    }
    // R
    const rStart = qrsStart + Math.round(qrsDuration * 0.2);
    for (let i = 0; i < Math.round(qrsDuration * 0.35) && rStart + i < totalSamples; i++) {
      const t = i / (qrsDuration * 0.35);
      samples[rStart + i] += amplitude * 1.0 * Math.sin(Math.PI * t);
    }
    // S
    const sStart = rStart + Math.round(qrsDuration * 0.35);
    for (let i = 0; i < Math.round(qrsDuration * 0.25) && sStart + i < totalSamples; i++) {
      const t = i / (qrsDuration * 0.25);
      samples[sStart + i] += -amplitude * 0.2 * Math.sin(Math.PI * t);
    }
    // T (reduced due to flutter waves)
    const tStart = qrsStart + Math.round(samplesPerVBeat * 0.4);
    const tDuration = Math.round(samplesPerVBeat * 0.12);
    for (let i = 0; i < tDuration && tStart + i < totalSamples; i++) {
      const t = i / tDuration;
      samples[tStart + i] += amplitude * 0.15 * Math.sin(Math.PI * t);
    }
  }

  return samples;
}

/* ── Generate Lead Data ──────────────────────────────── */
type ECGCondition = 'normal-sinus' | 'sinus-tachycardia' | 'sinus-bradycardia' | 'atrial-flutter';

function generateLeadSamples(
  leadName: string,
  condition: ECGCondition,
  sampleRate: number,
  duration: number
): number[] {
  // Lead-specific amplitude variations
  const amplitudeMap: Record<string, number> = {
    'I': 0.8, 'II': 1.0, 'III': 0.6,
    'aVR': -0.5, 'aVL': 0.4, 'aVF': 0.7,
    'V1': 0.5, 'V2': 0.8, 'V3': 1.0,
    'V4': 1.1, 'V5': 0.9, 'V6': 0.7,
  };
  const amplitude = amplitudeMap[leadName] || 1.0;

  if (condition === 'atrial-flutter') {
    return generateFlutterWaves(sampleRate, duration, Math.abs(amplitude));
  }

  const heartRateMap: Record<ECGCondition, number> = {
    'normal-sinus': 72,
    'sinus-tachycardia': 115,
    'sinus-bradycardia': 48,
    'atrial-flutter': 75,
  };
  const heartRate = heartRateMap[condition];
  const totalSamples = sampleRate * duration;
  const complex = generatePQRSTComplex(heartRate, sampleRate, amplitude);

  const samples: number[] = [];
  while (samples.length < totalSamples) {
    // For sinus arrhythmia-like variation in normal rhythm
    const jitter = condition === 'normal-sinus'
      ? Math.round((Math.random() - 0.5) * sampleRate * 0.02)
      : 0;
    const beat = [...complex];
    // Add jitter samples
    if (jitter > 0) {
      for (let i = 0; i < jitter; i++) beat.push(0);
    }
    samples.push(...beat);
  }

  return samples.slice(0, totalSamples);
}

export function generateWaveformData(
  condition: ECGCondition = 'normal-sinus',
  duration: number = 10
): WaveformData {
  const sampleRate = 500;
  const leadNames = ['I', 'II', 'III', 'aVR', 'aVL', 'aVF', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6'];

  const leads: LeadData[] = leadNames.map(name => ({
    name,
    samples: generateLeadSamples(name, condition, sampleRate, duration),
  }));

  return { sampleRate, leads, duration };
}

/* ── Mock Analysis Results ───────────────────────────── */
const conditionFindings: Record<ECGCondition, Finding[]> = {
  'normal-sinus': [
    {
      id: 'f1',
      category: 'rhythm',
      clinicalTerm: 'Normal Sinus Rhythm',
      plainLanguage: 'Your heart is beating in a normal, healthy pattern with a regular rhythm originating from the correct location.',
      severity: 'normal',
      confidence: 96,
      affectedLeads: ['II', 'V1'],
    },
  ],
  'sinus-tachycardia': [
    {
      id: 'f1',
      category: 'rhythm',
      clinicalTerm: 'Sinus Tachycardia',
      plainLanguage: 'Your heart rate is faster than the normal resting range. This can be caused by exercise, stress, caffeine, or other factors.',
      severity: 'borderline',
      confidence: 94,
      affectedLeads: ['II', 'V1', 'V5'],
      details: 'Heart rate >100 BPM with regular rhythm and normal P-wave morphology. Each P-wave is followed by a QRS complex.',
    },
    {
      id: 'f2',
      category: 'interval',
      clinicalTerm: 'Shortened R-R Interval',
      plainLanguage: 'The time between heartbeats is shorter than typical, consistent with the elevated heart rate.',
      severity: 'borderline',
      confidence: 91,
      affectedLeads: ['II'],
    },
  ],
  'sinus-bradycardia': [
    {
      id: 'f1',
      category: 'rhythm',
      clinicalTerm: 'Sinus Bradycardia',
      plainLanguage: 'Your heart rate is slower than the typical resting range. This is common in athletes or during sleep but may require evaluation if symptomatic.',
      severity: 'borderline',
      confidence: 95,
      affectedLeads: ['II', 'V1'],
      details: 'Heart rate <60 BPM with regular rhythm and normal P-wave morphology.',
    },
    {
      id: 'f2',
      category: 'interval',
      clinicalTerm: 'Prolonged R-R Interval',
      plainLanguage: 'The time between heartbeats is longer than typical, consistent with the slower heart rate.',
      severity: 'normal',
      confidence: 93,
      affectedLeads: ['II'],
    },
  ],
  'atrial-flutter': [
    {
      id: 'f1',
      category: 'rhythm',
      clinicalTerm: 'Atrial Flutter',
      plainLanguage: 'A rapid but organized rhythm originating from the upper chambers of your heart. The atria are beating very fast in a regular pattern.',
      severity: 'abnormal',
      confidence: 89,
      affectedLeads: ['II', 'III', 'aVF', 'V1'],
      details: 'Characteristic sawtooth F-waves at approximately 300/min with 4:1 conduction ratio yielding a ventricular rate of ~75 BPM.',
    },
    {
      id: 'f2',
      category: 'morphology',
      clinicalTerm: 'Sawtooth F-Waves',
      plainLanguage: 'A distinctive wave pattern visible in the recording that confirms flutter activity in the upper heart chambers.',
      severity: 'abnormal',
      confidence: 87,
      affectedLeads: ['II', 'III', 'aVF'],
    },
    {
      id: 'f3',
      category: 'conduction',
      clinicalTerm: 'Regular Ventricular Response',
      plainLanguage: 'Despite the rapid atrial activity, the lower chambers are responding at a controlled, regular rate.',
      severity: 'borderline',
      confidence: 85,
      affectedLeads: ['V1', 'V2'],
    },
  ],
};

const conditionMetrics: Record<ECGCondition, {
  heartRate: number;
  rrInterval: number;
  prInterval: number;
  qrsDuration: number;
  qtInterval: number;
  qtcInterval: number;
  severityScore: number;
  overallSeverity: 'normal' | 'borderline' | 'abnormal';
}> = {
  'normal-sinus': {
    heartRate: 72, rrInterval: 833, prInterval: 160,
    qrsDuration: 86, qtInterval: 380, qtcInterval: 416,
    severityScore: 12, overallSeverity: 'normal',
  },
  'sinus-tachycardia': {
    heartRate: 115, rrInterval: 522, prInterval: 148,
    qrsDuration: 84, qtInterval: 320, qtcInterval: 442,
    severityScore: 45, overallSeverity: 'borderline',
  },
  'sinus-bradycardia': {
    heartRate: 48, rrInterval: 1250, prInterval: 168,
    qrsDuration: 88, qtInterval: 420, qtcInterval: 375,
    severityScore: 38, overallSeverity: 'borderline',
  },
  'atrial-flutter': {
    heartRate: 75, rrInterval: 800, prInterval: 0,
    qrsDuration: 90, qtInterval: 360, qtcInterval: 402,
    severityScore: 78, overallSeverity: 'abnormal',
  },
};

export function generateMockResult(condition: ECGCondition = 'sinus-tachycardia'): AnalysisResult {
  const waveform = generateWaveformData(condition);
  const metrics = conditionMetrics[condition];
  const findings = conditionFindings[condition];

  const patient: PatientMetadata = {
    name: 'Patient Demo',
    age: 45,
    sex: 'Male',
    recordingDate: new Date().toISOString().split('T')[0],
    duration: '10s',
    leadConfiguration: '12-Lead',
    device: 'ECGenius Universal Port',
    heartRate: metrics.heartRate,
    referenceId: `ECG-${Date.now().toString(36).toUpperCase()}`,
  };

  const summaryMap: Record<ECGCondition, string> = {
    'normal-sinus': 'Normal sinus rhythm. No significant abnormalities detected. All intervals within normal limits.',
    'sinus-tachycardia': 'Sinus tachycardia detected with heart rate of 115 BPM. Regular rhythm with normal P-wave morphology. Clinical correlation recommended.',
    'sinus-bradycardia': 'Sinus bradycardia detected with heart rate of 48 BPM. Regular rhythm with normal P-wave morphology. Evaluate for symptomatic presentation.',
    'atrial-flutter': 'Atrial flutter identified with characteristic sawtooth F-waves at ~300/min. Regular ventricular response at 75 BPM with 4:1 conduction. Cardiology referral recommended.',
  };

  return {
    id: `result-${Date.now()}`,
    timestamp: new Date().toISOString(),
    patient,
    waveform,
    overallSeverity: metrics.overallSeverity,
    severityScore: metrics.severityScore,
    findings,
    summary: summaryMap[condition],
    heartRate: metrics.heartRate,
    rrInterval: metrics.rrInterval,
    prInterval: metrics.prInterval,
    qrsDuration: metrics.qrsDuration,
    qtInterval: metrics.qtInterval,
    qtcInterval: metrics.qtcInterval,
  };
}

/* ── Condition picker (cycles through demos) ─────────── */
const conditions: ECGCondition[] = [
  'sinus-tachycardia',
  'sinus-bradycardia',
  'atrial-flutter',
  'normal-sinus',
];

let conditionIndex = 0;
export function getNextCondition(): ECGCondition {
  const condition = conditions[conditionIndex % conditions.length];
  conditionIndex++;
  return condition;
}

/* ── Grid helpers ────────────────────────────────────── */
export function msToPixels(ms: number, pixelsPerSecond: number): number {
  return (ms / 1000) * pixelsPerSecond;
}

export function mvToPixels(mv: number, pixelsPerMv: number): number {
  return mv * pixelsPerMv;
}
