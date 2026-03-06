import { useState } from 'react';
import { Calculator, TrendingUp, AlertCircle } from 'lucide-react';
import { AppState, Calculation, AuditEvent } from '../../types';
import { calculateDisplacement, projectRevenue, FORMULA_VERSION, LBS_PER_MT } from '../../lib/calculation';
import { createAuditEvent } from '../../lib/auditLog';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { FieldRow } from '../ui/FieldRow';

interface Props {
  state: AppState;
  onCalculate: (calc: Calculation, event: AuditEvent) => void;
  onNext: () => void;
  onBack: () => void;
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
      totalMwh: newCalc.totalMwh,
      co2LbsPerMwh: newCalc.co2LbsPerMwh,
      rawMt: newCalc.rawMt,
      adjustedMt: newCalc.adjustedMt,
      sourceFileHash: newCalc.sourceFileHash,
    });

    onCalculate(newCalc, event);
    setCalculating(false);
  }

  const ef = facility.emissionFactor;
  const rev7 = calculation ? projectRevenue(calculation.adjustedMt, 7) : null;
  const rev20 = calculation ? projectRevenue(calculation.adjustedMt, 20) : null;

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

      {/* Inputs summary */}
      <Card title="Calculation Inputs">
        <div className="space-y-0.5">
          <FieldRow label="Facility" value={facility.name} locked />
          <FieldRow label="eGRID Subregion" value={facility.egridSubregion} locked />
          <FieldRow label="CO₂ Factor" value={`${ef.co2LbsPerMwh} lb/MWh`} mono locked secondary={ef.datasetVersion} />
          <FieldRow label="Total Generation" value={`${fmt(generationData.totalMwh)} MWh`} mono locked />
          <FieldRow label="Monitoring Period" value={`${generationData.dateRange.start} → ${generationData.dateRange.end}`} locked />
          <FieldRow label="Source File Hash" value={generationData.fileHash.slice(0, 16) + '…'} mono locked />
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
          <span>Formula version: <span className="font-mono">{FORMULA_VERSION}</span></span>
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
