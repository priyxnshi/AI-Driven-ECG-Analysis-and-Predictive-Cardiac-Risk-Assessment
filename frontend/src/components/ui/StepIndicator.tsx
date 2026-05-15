'use client';

import type { WorkflowStep } from '@/lib/types';
import { Check } from 'lucide-react';

interface StepIndicatorProps {
  currentStep: WorkflowStep;
}

const steps: { key: WorkflowStep; label: string; number: number }[] = [
  { key: 'upload', label: 'Upload', number: 1 },
  { key: 'analyzing', label: 'Analysis', number: 2 },
  { key: 'results', label: 'Results', number: 3 },
];

const stepOrder: Record<WorkflowStep, number> = {
  upload: 0,
  analyzing: 1,
  results: 2,
  error: -1,
};

export default function StepIndicator({ currentStep }: StepIndicatorProps) {
  const currentIndex = stepOrder[currentStep];

  return (
    <div className="flex items-center gap-1">
      {steps.map((step, i) => {
        const isComplete = i < currentIndex;
        const isCurrent = i === currentIndex;

        return (
          <div key={step.key} className="flex items-center">
            {/* Step */}
            <div className="flex items-center gap-2">
              <div
                className={`
                  w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold
                  transition-all duration-150
                  ${isComplete
                    ? 'bg-primary text-white'
                    : isCurrent
                      ? 'bg-primary text-white'
                      : 'bg-surface text-text-tertiary border border-border'
                  }
                `}
              >
                {isComplete ? <Check className="w-3.5 h-3.5" /> : step.number}
              </div>
              <span
                className={`text-xs font-medium hidden sm:block ${
                  isCurrent ? 'text-primary' : isComplete ? 'text-text-primary' : 'text-text-tertiary'
                }`}
              >
                {step.label}
              </span>
            </div>

            {/* Connector */}
            {i < steps.length - 1 && (
              <div
                className={`w-8 h-px mx-2 ${
                  i < currentIndex ? 'bg-primary' : 'bg-border'
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
