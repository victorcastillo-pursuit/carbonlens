import { Check } from 'lucide-react';

interface Step {
  number: 1 | 2 | 3 | 4 | 5;
  label: string;
}

const STEPS: Step[] = [
  { number: 1, label: 'Facility' },
  { number: 2, label: 'Generation' },
  { number: 3, label: 'Calculate' },
  { number: 4, label: 'Validate' },
  { number: 5, label: 'Export' },
];

interface StepNavProps {
  currentStep: 1 | 2 | 3 | 4 | 5;
  unlockedSteps: Set<number>;
  onStepClick: (step: 1 | 2 | 3 | 4 | 5) => void;
}

export function StepNav({ currentStep, unlockedSteps, onStepClick }: StepNavProps) {
  return (
    <nav aria-label="Progress" className="bg-white border-b border-neutral-200">
      <div className="max-w-5xl mx-auto px-6 py-3">
        <ol className="flex items-center gap-0">
          {STEPS.map((step, idx) => {
            const isCompleted = step.number < currentStep && unlockedSteps.has(step.number + 1);
            const isCurrent = step.number === currentStep;
            const isClickable = unlockedSteps.has(step.number) && step.number !== currentStep;

            return (
              <li key={step.number} className="flex items-center flex-1">
                <button
                  onClick={() => isClickable ? onStepClick(step.number) : undefined}
                  disabled={!isClickable && !isCurrent}
                  aria-current={isCurrent ? 'step' : undefined}
                  className={[
                    'flex flex-col items-center gap-1 flex-1 py-1 rounded transition-colors',
                    isClickable ? 'cursor-pointer hover:bg-neutral-50' : 'cursor-default',
                  ].join(' ')}
                >
                  <div className={[
                    'w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold border-2 transition-colors',
                    isCurrent
                      ? 'bg-blue-600 border-blue-600 text-white'
                      : isCompleted
                      ? 'bg-emerald-600 border-emerald-600 text-white'
                      : unlockedSteps.has(step.number)
                      ? 'bg-white border-neutral-400 text-neutral-600'
                      : 'bg-white border-neutral-200 text-neutral-300',
                  ].join(' ')}>
                    {isCompleted ? <Check size={12} /> : step.number}
                  </div>
                  <span className={[
                    'text-xs font-medium',
                    isCurrent ? 'text-blue-600' : isCompleted ? 'text-emerald-600' : 'text-neutral-400',
                  ].join(' ')}>
                    {step.label}
                  </span>
                </button>

                {idx < STEPS.length - 1 && (
                  <div className={[
                    'h-px flex-1 mx-1 transition-colors',
                    unlockedSteps.has(step.number + 1) ? 'bg-emerald-300' : 'bg-neutral-200',
                  ].join(' ')} />
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </nav>
  );
}
