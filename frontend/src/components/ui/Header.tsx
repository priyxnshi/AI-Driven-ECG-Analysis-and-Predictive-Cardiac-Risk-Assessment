'use client';

import type { WorkflowStep } from '@/lib/types';
import StepIndicator from './StepIndicator';
import { ArrowLeft } from 'lucide-react';

interface HeaderProps {
  currentStep: WorkflowStep;
  onReset: () => void;
}

export default function Header({ currentStep, onReset }: HeaderProps) {
  return (
    <header className="h-14 border-b border-border bg-white flex items-center justify-between px-6 flex-shrink-0">
      {/* Back / Context */}
      <button
        onClick={onReset}
        className={`flex items-center gap-2 text-sm font-medium transition-opacity ${currentStep !== 'upload' ? 'text-text-secondary hover:text-primary' : 'text-transparent pointer-events-none'}`}
      >
        <ArrowLeft className="w-4 h-4" />
        New Scan
      </button>

      {/* Step Indicator */}
      <StepIndicator currentStep={currentStep} />

      {/* Right side — version badge */}
      <div className="flex items-center gap-3">
        <span className="text-[10px] font-mono text-text-tertiary bg-surface px-2 py-0.5 rounded border border-border">
          v1.0.0
        </span>
      </div>
    </header>
  );
}
