import { Check } from 'lucide-react';

interface StepIndicatorProps {
  steps: number;
  current: number;
  labels: string[];
}

export function StepIndicator({ steps, current, labels }: StepIndicatorProps) {
  return (
    <div className="w-full max-w-3xl mx-auto px-4 py-4">
      <div className="flex items-center justify-between">
        {Array.from({ length: steps }, (_, i) => {
          const stepNum = i + 1;
          const isActive = stepNum === current;
          const isDone = stepNum < current;

          return (
            <div key={i} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${
                    isDone
                      ? 'bg-green-500 text-white'
                      : isActive
                        ? 'bg-foreground text-primary-foreground'
                        : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {isDone ? <Check className="h-4 w-4" /> : stepNum}
                </div>
                <span
                  className={`text-xs mt-1 text-center whitespace-nowrap ${
                    isActive ? 'text-foreground font-medium' : 'text-muted-foreground'
                  }`}
                >
                  {labels[i]}
                </span>
              </div>
              {i < steps - 1 && (
                <div
                  className={`flex-1 h-0.5 mx-2 mt-[-1rem] ${
                    isDone ? 'bg-green-500' : 'bg-muted'
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
