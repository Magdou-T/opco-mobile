'use client';

import { WIZARD_STEPS } from '@opco/core';
import type { WizardStep } from '@opco/core';

interface ProgressBarProps {
  currentStepIndex: number;
  onStepClick?: (step: WizardStep) => void;
}

export function ProgressBar({ currentStepIndex, onStepClick }: ProgressBarProps) {
  return (
    <nav aria-label="Progression" className="w-full">
      <ol className="flex w-full items-center">
        {WIZARD_STEPS.map((step, index) => {
          const isCurrent = index === currentStepIndex;
          const isPast = index < currentStepIndex;
          const isClickable = isPast && onStepClick;

          return (
            <li key={step.key} className="flex flex-1 items-center">
              <button
                type="button"
                onClick={() => isClickable && onStepClick(step.key)}
                disabled={!isClickable}
                aria-current={isCurrent ? 'step' : undefined}
                className={`group flex w-full flex-col items-center ${
                  isClickable ? 'cursor-pointer' : 'cursor-default'
                }`}
              >
                <div className="mb-2 flex w-full items-center">
                  {index > 0 && (
                    <div className={`h-px flex-1 ${isPast ? 'bg-ink' : 'bg-rule'}`} />
                  )}
                  <div
                    className={`amount flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border text-sm font-semibold transition-colors ${
                      isCurrent
                        ? 'border-ink bg-marker text-ink'
                        : isPast
                        ? 'border-ink bg-ink text-paper group-hover:bg-navy'
                        : 'border-rule bg-white text-ink-faint'
                    }`}
                  >
                    {isPast ? '✓' : step.icon}
                  </div>
                  {index < WIZARD_STEPS.length - 1 && (
                    <div className={`h-px flex-1 ${isPast ? 'bg-ink' : 'bg-rule'}`} />
                  )}
                </div>
                <span
                  className={`text-center text-xs leading-tight ${
                    isCurrent
                      ? 'font-semibold text-ink'
                      : isPast
                      ? 'text-ink-soft'
                      : 'text-ink-faint'
                  }`}
                >
                  {step.label}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
