import { useState } from 'react';
import { Calculator, TrendingUp, AlertCircle, Zap, Clock } from 'lucide-react';
import { AppState, Calculation, AuditEvent, HourlyDisplacement } from '../../types';
import { calculateDisplacement, projectRevenue, FORMULA_VERSION, LBS_PER_MT } from '../../lib/calculation';
import { createAuditEvent } from '../../lib/auditLog';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { FieldRow } from '../ui/FieldRow';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from 'recharts';

interface Props {
  state: AppState;
  onCalculate: (calc: Calculation, event: AuditEvent) => void;
  onNext: () => void;
  onBack: () => void;
}

interface DailyChartPoint {
  date: string;
  mt: number;
  dominantFuel: string;
}

function aggregateHourlyToDaily(hourlyResults: HourlyDisplacement[]): DailyChartPoint[] {
  const byDate = new Map<string, { mt: number; coal: number; gas: number; oil: number }>();
  for (const h of hourlyResults) {
    const date = h.hour.slice(0, 10);
    const existing = byDate.get(date) ?? { mt: 0, coal: 0, gas: 0, oil: 0 };
    existing.mt += h.displacedMtCo2;
    const fossil = h.fuelMix.coal + h.fuelMix.gas + h.fuelMix.oil;
    if (fossil > 0) {
      existing.coal += h.displacedMtCo2 * (h.fuelMix.coal / fossil);
      existing.gas  += h.displacedMtCo2 * (h.fuelMix.gas  / fossil);
      existing.oil  += h.displacedMtCo2 * (h.fuelMix.oil  / fossil);
    }
    byDate.set(date, existing);
  }
  return Array.from(byDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => {
      const dominant = v.coal >= v.gas && v.coal >= v.oil ? 'coal'
        : v.gas >= v.coal && v.gas >= v.oil ? 'gas' : 'oil';
      return { date, mt: parseFloat(v.mt.toFixed(4)), dominantFuel: dominant };
    });
}

export function DisplacementCalculation({ state, onCalculate, onNext, onBack }: Props) {
  const [calculating, setCalculating] = useState(false);
  const { facility, generationData, calculation } = state;

  if (!facility || !generationData) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-amber-600">
          <AlertCircle size={18} />
          <span className="text-sm font-medium">Complete Steps 1 and 2 before calculating displacement.</span>
        </div>
      </div>
    );
  }

  async function handleCalculate() {
    if (!facility || !generationData) return;
    setCalculating(true);

    const newCalc = await calculateDisplacement(facility, generationData, state.gridMixData);

    const event = createAuditEvent('calculation_executed', {
      calculationId: newCalc.id,
      facilityId: newCalc.facilityId,
      formulaVersion: newCalc.formulaVersion,
      mode: newCalc.mode,
      totalMwh: newCalc.totalMwh,
      co2LbsPerMwh: newCalc.co2LbsPerMwh,
      rawMt: newCalc.rawMt,
      adjustedMt: newCalc.adjustedMt,
      sourceFileHash: newCalc.sourceFileHash,
      balancingAuthority: newCalc.balancingAuthority,
    });

    onCalculate(newCalc, event);
    setCalculating(false);
  }

  const ef = facility.emissionFactor;
  const rev7  = calculation ? projectRevenue(calculation.adjustedMt, 7)  : null;
  const rev20 = calculation ? projectRevenue(calculation.adjustedMt, 20) : null;

  const dailyChart = calculation?.hourlyResults ? aggregateHourlyToDaily(calculation.hourlyResults) : [];
  const fb = calculation?.fuelBreakdown;

  function fmt(n: number, d = 2) {
    return n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
  }
  function fmtUSD(n: number) {
    return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Calculator size={20} className="text-blue-600" />
        <div>
          <h2 className="text-lg font-semibold text-neutral-900">Step 3 — Displacement Calculation</h2>
          <p className="text-sm text-neutral-500">Compute CO₂ displacement using CDM AMS I.D formula</p>
        </div>
      </div>

      {/* Methodology badge */}
      {calculation && (
        <div className={[
          'flex items-center gap-2 px-4 py-3 rounded-lg border text-sm font-medium',
          calculation.mode === 'hourly_marginal'
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
            : 'bg-amber-50 border-amber-200 text-amber-800',
        ].join(' ')}>
          {calculation.mode === 'hourly_marginal'
            ? <><Zap size={15} className="shrink-0" /> Hourly Marginal Displacement — {calculation.hourlyResults?.length.toLocaleString()} hours analyzed</>
            : <><Clock size={15} className="shrink-0" /> Annual Flat Rate (Fallback) — {calculation.fallbackReason}</>
          }
        </div>
      )}

      {/* Inputs summary */}
      <Card title="Calculation Inputs">
        <div className="space-y-0.5">
          <FieldRow label="Facility" value={facility.name} locked />
          <FieldRow label="eGRID Subregion" value={facility.egridSubregion} locked />
          <FieldRow label="CO₂ Factor" value={`${ef.co2LbsPerMwh} lb/MWh`} mono locked secondary={ef.datasetVersion} />
          <FieldRow label="Total Generation" value={`${fmt(generationData.totalMwh)} MWh`} mono locked />
          <FieldRow label="Monitoring Period" value={`${generationData.dateRange.start} → ${generationData.dateRange.end}`} locked />
          <FieldRow label="Source File Hash" value={generationData.fileHash.slice(0, 16) + '…'} mono locked />
          {state.gridMixData && state.gridMixData.length > 0 && (
            <FieldRow label="EIA Grid Mix" value={`${state.gridMixData.length.toLocaleString()} records (${calculation?.balancingAuthority ?? '…'})`} mono locked />
          )}
        </div>
      </Card>

      {/* Formula */}
      <Card title="Formula (CDM AMS I.D)">
        <div className="bg-neutral-50 border border-neutral-200 rounded-md p-4 font-mono text-sm text-neutral-700 space-y-1">
          <p>CO₂ MT = (Total MWh × CO₂ lb/MWh) ÷ 2,204.62</p>
          <p className="text-neutral-400 text-xs mt-2">
            = ({fmt(generationData.totalMwh, 0)} × {ef.co2LbsPerMwh}) ÷ {LBS_PER_MT}
          </p>
          {calculation && (
            <p className="text-blue-700 font-semibold">
              = {fmt(calculation.rawMt)} MT CO₂ (raw)
            </p>
          )}
        </div>
        <div className="mt-3 flex items-center justify-between text-xs text-neutral-500">
          <span>Formula version: <span className="font-mono">{calculation?.formulaVersion ?? FORMULA_VERSION}</span></span>
          <span>Divisor: 2,204.62 lb/MT (exact)</span>
        </div>
      </Card>

      {/* Result */}
      {calculation ? (
        <Card title="Calculation Result">
          <div className="space-y-0.5">
            <FieldRow label="Calculation ID" value={calculation.id} mono locked />
            <FieldRow label="Formula Version" value={calculation.formulaVersion} mono locked />
            <FieldRow label="Dataset Version" value={calculation.datasetVersion} mono locked />
            <FieldRow label="eGRID Rate ID" value={calculation.egridRateId} mono locked />
            {calculation.balancingAuthority && (
              <FieldRow label="Balancing Authority" value={calculation.balancingAuthority} mono locked />
            )}
            <FieldRow label="Raw CO₂" value={`${fmt(calculation.rawMt)} MT`} mono locked />
            <FieldRow label="Adjustment Factor" value={`${calculation.adjustmentFactor}`} mono locked />
            <FieldRow label="Status" value={calculation.status.toUpperCase()} />
            <FieldRow label="Calculated At" value={new Date(calculation.calculatedAt).toLocaleString()} />
          </div>
          <div className="mt-4 pt-4 border-t border-neutral-100 bg-blue-50 -mx-6 -mb-4 px-6 py-4 rounded-b-lg">
            <div className="flex items-baseline gap-3">
              <span className="text-sm text-neutral-600">Adjusted CO₂ Displacement:</span>
              <span className="text-2xl font-bold text-blue-700 font-mono">{fmt(calculation.adjustedMt)} MT</span>
            </div>
            <p className="text-xs text-neutral-500 mt-1">
              Eligible metric tonnes of CO₂ for carbon credit issuance
            </p>
          </div>
        </Card>
      ) : (
        <Card>
          <div className="text-center py-6">
            <Calculator size={32} className="mx-auto text-neutral-300 mb-3" />
            <p className="text-sm text-neutral-500">Run the calculation to compute CO₂ displacement</p>
          </div>
        </Card>
      )}

      {/* Displacement over time chart (hourly mode only) */}
      {calculation?.mode === 'hourly_marginal' && dailyChart.length > 0 && (
        <Card title="Displacement Over Time">
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailyChart} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="mtGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: '#9ca3af' }}
                  tickFormatter={d => d.slice(5)}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 10, fill: '#9ca3af' }}
                  tickFormatter={v => `${v.toFixed(1)}`}
                  width={40}
                />
                <Tooltip
                  formatter={(value: number | undefined) => [`${(value ?? 0).toFixed(3)} MT CO₂`, 'Displaced']}
                  labelFormatter={l => `Date: ${l}`}
                  contentStyle={{ fontSize: 12 }}
                />
                <Area
                  type="monotone"
                  dataKey="mt"
                  stroke="#3b82f6"
                  strokeWidth={1.5}
                  fill="url(#mtGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-neutral-400 mt-2">Daily MT CO₂ displaced over the monitoring period</p>
        </Card>
      )}

      {/* Fuel breakdown (hourly mode only) */}
      {calculation?.mode === 'hourly_marginal' && fb && (
        <Card title="Fuel Displacement Breakdown">
          <div className="grid grid-cols-3 gap-4 mb-4">
            {[
              { label: 'Coal', mt: fb.coalMt, pct: fb.coalPct, color: 'bg-neutral-700' },
              { label: 'Natural Gas', mt: fb.gasMt, pct: fb.gasPct, color: 'bg-blue-500' },
              { label: 'Petroleum', mt: fb.oilMt, pct: fb.oilPct, color: 'bg-amber-600' },
            ].map(f => (
              <div key={f.label} className="text-center">
                <p className="text-xs text-neutral-500 mb-1">{f.label}</p>
                <p className="text-lg font-bold text-neutral-800 font-mono">{fmt(f.mt)} MT</p>
                <p className="text-xs text-neutral-400">{f.pct.toFixed(1)}%</p>
              </div>
            ))}
          </div>
          {/* Stacked bar */}
          <div className="flex h-3 rounded-full overflow-hidden gap-0.5">
            <div className="bg-neutral-700 transition-all" style={{ width: `${fb.coalPct}%` }} />
            <div className="bg-blue-500 transition-all"   style={{ width: `${fb.gasPct}%` }} />
            <div className="bg-amber-600 transition-all"  style={{ width: `${fb.oilPct}%` }} />
          </div>
          <div className="flex items-center gap-4 mt-2">
            {[
              { label: 'Coal',        color: 'bg-neutral-700' },
              { label: 'Natural Gas', color: 'bg-blue-500' },
              { label: 'Petroleum',   color: 'bg-amber-600' },
            ].map(f => (
              <div key={f.label} className="flex items-center gap-1.5 text-xs text-neutral-500">
                <span className={`w-2.5 h-2.5 rounded-sm ${f.color}`} />
                {f.label}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Revenue projections */}
      {calculation && rev7 && rev20 && (
        <Card title="Revenue Projections" subtitle="Illustrative only — 15% platform fee applied">
          <div className="space-y-0">
            <div className="flex items-center gap-3">
              <TrendingUp size={16} className="text-emerald-600 shrink-0" />
              <span className="text-sm text-neutral-600 flex-1">At $7 / MT</span>
              <div className="text-right">
                <div className="text-sm font-semibold text-emerald-700">{fmtUSD(rev7.netRevenue)} net</div>
                <div className="text-xs text-neutral-400">{fmtUSD(rev7.grossRevenue)} gross</div>
              </div>
            </div>
            <div className="my-3 border-t border-neutral-100" />
            <div className="flex items-center gap-3">
              <TrendingUp size={16} className="text-emerald-600 shrink-0" />
              <span className="text-sm text-neutral-600 flex-1">At $20 / MT</span>
              <div className="text-right">
                <div className="text-sm font-semibold text-emerald-700">{fmtUSD(rev20.netRevenue)} net</div>
                <div className="text-xs text-neutral-400">{fmtUSD(rev20.grossRevenue)} gross</div>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Actions */}
      <div className="flex justify-between items-center">
        <Button variant="ghost" onClick={onBack}>Back</Button>
        <div className="flex gap-3">
          {calculation ? (
            <>
              <Button variant="secondary" loading={calculating} onClick={handleCalculate}>
                Recalculate
              </Button>
              <Button variant="primary" onClick={onNext}>
                Continue to Validation
              </Button>
            </>
          ) : (
            <Button variant="primary" loading={calculating} onClick={handleCalculate}>
              Run Calculation
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
