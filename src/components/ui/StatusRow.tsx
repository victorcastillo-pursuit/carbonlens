import { CheckCircle2, XCircle, AlertTriangle, LucideIcon } from 'lucide-react';
import { ReadinessCheckSeverity } from '../../types';

interface StatusRowProps {
  label: string;
  severity: ReadinessCheckSeverity;
  message?: string;
  category?: string;
}

const severityConfig: Record<ReadinessCheckSeverity, {
  icon: LucideIcon;
  badgeClass: string;
  iconClass: string;
}> = {
  PASS: {
    icon: CheckCircle2,
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    iconClass: 'text-emerald-600',
  },
  WARN: {
    icon: AlertTriangle,
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
    iconClass: 'text-amber-600',
  },
  BLOCK: {
    icon: XCircle,
    badgeClass: 'bg-red-50 text-red-700 border-red-200',
    iconClass: 'text-red-600',
  },
};

export function StatusRow({ label, severity, message }: StatusRowProps) {
  const { icon: Icon, badgeClass, iconClass } = severityConfig[severity];

  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-neutral-50 last:border-0">
      <Icon size={16} className={`mt-0.5 shrink-0 ${iconClass}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-neutral-800">{label}</span>
          <span className={`text-xs font-semibold px-1.5 py-0.5 rounded border ${badgeClass}`}>
            {severity}
          </span>
        </div>
        {message && (
          <p className="text-xs text-neutral-500 mt-0.5">{message}</p>
        )}
      </div>
    </div>
  );
}
