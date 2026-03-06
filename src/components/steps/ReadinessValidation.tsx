import { useState } from 'react';
import { ShieldCheck, XCircle, CheckCircle2, RefreshCw } from 'lucide-react';
import { AppState, ReadinessResult, AuditEvent, ReadinessCheck } from '../../types';
import { runReadinessValidation } from '../../lib/validation';
import { createAuditEvent } from '../../lib/auditLog';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { StatusRow } from '../ui/StatusRow';

interface Props {
  state: AppState;
  onValidate: (result: ReadinessResult, event: AuditEvent) => void;
  onNext: () => void;
  onBack: () => void;
}

const CATEGORY_ORDER = [
  'Data Completeness',
  'Generation Sanity',
  'Emission Factor Alignment',
  'Calculation Integrity',
  'Audit Integrity',
  'Hourly Data Coverage',
];

export function ReadinessValidation({ state, onValidate, onNext, onBack }: Props) {
  const [running, setRunning] = useState(false);
  const { readiness } = state;

  async function handleRun() {
    setRunning(true);
    // Small delay to make button state visible
    await new Promise(r => setTimeout(r, 200));

    const result = runReadinessValidation(state);

    const event = createAuditEvent('readiness_validation_run', {
      status: result.status,
      blockingCount: result.blockingCount,
      checkCount: result.checks.length,
      validatedAt: result.validatedAt,
    });

    onValidate(result, event);
    setRunning(false);
  }

  // Group checks by category
  const grouped: Record<string, ReadinessCheck[]> = {};
  if (readiness) {
    for (const check of readiness.checks) {
      if (!grouped[check.category]) grouped[check.category] = [];
      grouped[check.category].push(check);
    }
  }

  const categoriesInOrder = CATEGORY_ORDER.filter(c => grouped[c]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <ShieldCheck size={20} className="text-blue-600" />
        <div>
          <h2 className="text-lg font-semibold text-neutral-900">Step 4 — Readiness Validation</h2>
          <p className="text-sm text-neutral-500">Run 5-category audit check before generating report</p>
        </div>
      </div>

      {/* Summary banner */}
      {readiness && (
        <div className={[
          'flex items-center gap-3 rounded-lg px-4 py-3 border',
          readiness.status === 'READY_FOR_REPORT'
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
            : 'bg-red-50 border-red-200 text-red-800',
        ].join(' ')}>
          {readiness.status === 'READY_FOR_REPORT'
            ? <CheckCircle2 size={20} className="text-emerald-600 shrink-0" />
            : <XCircle size={20} className="text-red-600 shrink-0" />
          }
          <div>
            <p className="text-sm font-semibold">
              {readiness.status === 'READY_FOR_REPORT'
                ? 'Ready for Report — All checks passed'
                : `Blocked — ${readiness.blockingCount} blocking issue(s)`}
            </p>
            <p className="text-xs mt-0.5 opacity-75">
              Validated at {new Date(readiness.validatedAt).toLocaleString()}
            </p>
          </div>
          <div className="ml-auto flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              loading={running}
              onClick={handleRun}
            >
              <RefreshCw size={14} />
              Re-run
            </Button>
          </div>
        </div>
      )}

      {/* Check categories */}
      {readiness ? (
        <div className="space-y-4">
          {categoriesInOrder.map(category => {
            const checks = grouped[category];
            const hasBlock = checks.some(c => c.severity === 'BLOCK');
            const hasWarn = checks.some(c => c.severity === 'WARN');

            return (
              <Card
                key={category}
                title={category}
                headerRight={
                  <span className={[
                    'text-xs font-semibold px-2 py-0.5 rounded border',
                    hasBlock ? 'bg-red-50 text-red-700 border-red-200'
                      : hasWarn ? 'bg-amber-50 text-amber-700 border-amber-200'
                      : 'bg-emerald-50 text-emerald-700 border-emerald-200',
                  ].join(' ')}>
                    {hasBlock ? 'BLOCKED' : hasWarn ? 'WARNING' : 'PASS'}
                  </span>
                }
              >
                <div className="space-y-0">
                  {checks.map(check => (
                    <StatusRow
                      key={check.id}
                      label={check.label}
                      severity={check.severity}
                      message={check.message}
                    />
                  ))}
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <div className="text-center py-8">
            <ShieldCheck size={36} className="mx-auto text-neutral-300 mb-3" />
            <p className="text-sm font-medium text-neutral-700">Ready to validate</p>
            <p className="text-xs text-neutral-400 mt-1">
              Runs up to 6 categories of checks: facility data, generation data, emission factor, calculation integrity, audit trail, and hourly data coverage.
            </p>
          </div>
        </Card>
      )}

      {/* Actions */}
      <div className="flex justify-between items-center">
        <Button variant="ghost" onClick={onBack}>Back</Button>
        <div className="flex gap-3">
          {!readiness && (
            <Button variant="primary" loading={running} onClick={handleRun}>
              Run Validation
            </Button>
          )}
          {readiness?.status === 'READY_FOR_REPORT' && (
            <Button variant="primary" onClick={onNext}>
              Generate Report
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
