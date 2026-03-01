import { AppState, ReadinessCheck, ReadinessResult } from '../types';
import { EGRID_DATASET_VERSION } from '../data/egrid';
import { FORMULA_VERSION, LBS_PER_MT, ADJUSTMENT_FACTOR } from './calculation';

const PREREQUISITE_EVENTS = [
  'facility_created',
  'generation_data_uploaded',
  'calculation_executed',
] as const;

export function runReadinessValidation(state: AppState): ReadinessResult {
  const checks: ReadinessCheck[] = [];

  // ─── 1. Data Completeness ───────────────────────────────────────────────────
  const hasAllFacilityFields = !!(
    state.facility &&
    state.facility.name &&
    state.facility.capacityMw > 0 &&
    state.facility.egridSubregion &&
    state.facility.commercialOperationDate
  );

  checks.push({
    id: 'data_completeness_facility',
    category: 'Data Completeness',
    label: 'Facility record present',
    severity: state.facility ? 'PASS' : 'BLOCK',
    message: state.facility
      ? `Facility "${state.facility.name}" registered`
      : 'No facility record found — complete Step 1',
  });

  checks.push({
    id: 'data_completeness_facility_fields',
    category: 'Data Completeness',
    label: 'All facility fields populated',
    severity: hasAllFacilityFields ? 'PASS' : 'BLOCK',
    message: hasAllFacilityFields
      ? 'All required facility fields are present'
      : 'One or more facility fields are missing or invalid',
  });

  checks.push({
    id: 'data_completeness_generation',
    category: 'Data Completeness',
    label: 'Generation data uploaded',
    severity: state.generationData ? 'PASS' : 'BLOCK',
    message: state.generationData
      ? `File "${state.generationData.fileName}" committed`
      : 'No generation data — complete Step 2',
  });

  // ─── 2. Generation Sanity ───────────────────────────────────────────────────
  const genData = state.generationData;
  const totalMwh = genData?.totalMwh ?? 0;
  const hasNegative = genData?.records.some(r => r.mwh < 0) ?? false;
  const today = new Date();
  const hasFutureDates = genData?.records.some(r => new Date(r.date) > today) ?? false;

  checks.push({
    id: 'generation_sanity_total',
    category: 'Generation Sanity',
    label: 'Total generation > 0 MWh',
    severity: !genData ? 'BLOCK' : totalMwh > 0 ? 'PASS' : 'BLOCK',
    message: !genData
      ? 'No generation data'
      : totalMwh > 0
      ? `Total: ${totalMwh.toLocaleString(undefined, { maximumFractionDigits: 2 })} MWh`
      : 'Total MWh is zero — data may be empty',
  });

  checks.push({
    id: 'generation_sanity_negative',
    category: 'Generation Sanity',
    label: 'No negative generation values',
    severity: !genData ? 'BLOCK' : hasNegative ? 'BLOCK' : 'PASS',
    message: !genData
      ? 'No generation data'
      : hasNegative
      ? 'Negative MWh values detected — re-upload corrected file'
      : 'All generation values are non-negative',
  });

  checks.push({
    id: 'generation_sanity_future',
    category: 'Generation Sanity',
    label: 'No future-dated records',
    severity: !genData ? 'BLOCK' : hasFutureDates ? 'BLOCK' : 'PASS',
    message: !genData
      ? 'No generation data'
      : hasFutureDates
      ? 'Future-dated records found — monitoring period must be historical'
      : 'All record dates are in the past',
  });

  // ─── 3. Emission Factor Alignment ──────────────────────────────────────────
  const ef = state.facility?.emissionFactor;
  const efVersionMatch = ef?.datasetVersion === EGRID_DATASET_VERSION;

  checks.push({
    id: 'ef_alignment_version',
    category: 'Emission Factor Alignment',
    label: 'Dataset version matches active standard',
    severity: !ef ? 'BLOCK' : efVersionMatch ? 'PASS' : 'BLOCK',
    message: !ef
      ? 'No emission factor — facility not configured'
      : efVersionMatch
      ? `Dataset version: ${ef.datasetVersion}`
      : `Dataset version mismatch: expected ${EGRID_DATASET_VERSION}, got ${ef.datasetVersion}`,
  });

  checks.push({
    id: 'ef_alignment_factor',
    category: 'Emission Factor Alignment',
    label: 'Emission factor rate is positive',
    severity: !ef ? 'BLOCK' : ef.co2LbsPerMwh > 0 ? 'PASS' : 'BLOCK',
    message: !ef
      ? 'No emission factor'
      : ef.co2LbsPerMwh > 0
      ? `Factor: ${ef.co2LbsPerMwh} lb CO₂/MWh (${ef.subregionCode})`
      : 'Emission factor is zero or negative',
  });

  // ─── 4. Calculation Integrity ───────────────────────────────────────────────
  const calc = state.calculation;
  const formulaOk = calc?.formulaVersion === FORMULA_VERSION;
  const hasBothMt = calc && calc.rawMt != null && calc.adjustedMt != null;
  const notSuperseded = calc?.status === 'active';

  // Verify arithmetic independently
  let arithmeticOk = false;
  if (calc && state.facility) {
    const expected = (calc.totalMwh * calc.co2LbsPerMwh) / LBS_PER_MT;
    arithmeticOk = Math.abs(expected - calc.rawMt) < 0.01;
  }

  // Verify adjustment factor
  let adjustmentOk = false;
  if (calc) {
    const expectedAdjusted = calc.rawMt * ADJUSTMENT_FACTOR;
    adjustmentOk = Math.abs(expectedAdjusted - calc.adjustedMt) < 0.01;
  }

  checks.push({
    id: 'calc_integrity_present',
    category: 'Calculation Integrity',
    label: 'Calculation record present',
    severity: calc ? 'PASS' : 'BLOCK',
    message: calc
      ? `Calculation ID: ${calc.id.slice(0, 8)}…`
      : 'No calculation — run Step 3',
  });

  checks.push({
    id: 'calc_integrity_formula',
    category: 'Calculation Integrity',
    label: 'Formula version locked',
    severity: !calc ? 'BLOCK' : formulaOk ? 'PASS' : 'BLOCK',
    message: !calc
      ? 'No calculation'
      : formulaOk
      ? `Formula: ${calc.formulaVersion}`
      : `Formula version mismatch: ${calc.formulaVersion}`,
  });

  checks.push({
    id: 'calc_integrity_arithmetic',
    category: 'Calculation Integrity',
    label: 'Raw MT arithmetic verified',
    severity: !calc ? 'BLOCK' : arithmeticOk ? 'PASS' : 'BLOCK',
    message: !calc
      ? 'No calculation'
      : arithmeticOk
      ? `Raw MT: ${calc.rawMt.toFixed(2)} MT CO₂`
      : `Arithmetic mismatch — expected ${((calc.totalMwh * calc.co2LbsPerMwh) / LBS_PER_MT).toFixed(4)} MT`,
  });

  checks.push({
    id: 'calc_integrity_adjusted',
    category: 'Calculation Integrity',
    label: 'Adjusted MT and adjustment factor present',
    severity: !calc ? 'BLOCK' : (hasBothMt && adjustmentOk) ? 'PASS' : 'BLOCK',
    message: !calc
      ? 'No calculation'
      : hasBothMt && adjustmentOk
      ? `Adjusted MT: ${calc.adjustedMt.toFixed(2)} MT (factor: ${calc.adjustmentFactor})`
      : 'adjustedMt or rawMt missing / adjustment factor mismatch',
  });

  checks.push({
    id: 'calc_integrity_status',
    category: 'Calculation Integrity',
    label: 'Calculation status is active',
    severity: !calc ? 'BLOCK' : notSuperseded ? 'PASS' : 'WARN',
    message: !calc
      ? 'No calculation'
      : notSuperseded
      ? 'Status: active'
      : 'Calculation has been superseded — re-run calculation',
  });

  // ─── 5. Audit Integrity ─────────────────────────────────────────────────────
  const loggedTypes = new Set(state.auditLog.map(e => e.eventType));

  for (const eventType of PREREQUISITE_EVENTS) {
    checks.push({
      id: `audit_integrity_${eventType}`,
      category: 'Audit Integrity',
      label: `Event logged: ${eventType}`,
      severity: loggedTypes.has(eventType) ? 'PASS' : 'BLOCK',
      message: loggedTypes.has(eventType)
        ? `"${eventType}" present in audit log`
        : `Missing audit event: "${eventType}"`,
    });
  }

  const blockingCount = checks.filter(c => c.severity === 'BLOCK').length;
  const status = blockingCount === 0 ? 'READY_FOR_REPORT' : 'BLOCKED';

  return {
    status,
    blockingCount,
    checks,
    validatedAt: new Date().toISOString(),
  };
}
