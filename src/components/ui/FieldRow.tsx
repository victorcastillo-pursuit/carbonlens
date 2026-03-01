import { Lock } from 'lucide-react';

interface FieldRowProps {
  label: string;
  value: string;
  mono?: boolean;
  locked?: boolean;
  secondary?: string;
}

export function FieldRow({ label, value, mono = false, locked = false, secondary }: FieldRowProps) {
  return (
    <div className="flex items-start justify-between py-2.5 border-b border-neutral-50 last:border-0 gap-4">
      <span className="text-sm text-neutral-500 shrink-0 w-44">{label}</span>
      <div className="flex items-center gap-1.5 flex-1 justify-end text-right">
        {locked && <Lock size={11} className="text-neutral-400 shrink-0" />}
        <div>
          <span className={`text-sm font-medium text-neutral-900 ${mono ? 'font-mono' : ''}`}>
            {value}
          </span>
          {secondary && (
            <p className="text-xs text-neutral-400 mt-0.5">{secondary}</p>
          )}
        </div>
      </div>
    </div>
  );
}
