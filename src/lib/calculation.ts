import {
  Calculation,
  Facility,
  GenerationData,
  HourlyGridMix,
  HourlyDisplacement,
  FuelBreakdown,
} from '../types';
import { generateUUID } from './crypto';
import { sha256Hex } from './crypto';
import { deriveHourlyMarginalRates } from './marginalEmissions';
import { getPrimaryBA } from '../data/egridCrosswalk';

export const FORMULA_VERSION = 'cdm-ams-id-v1';
export const FORMULA_VERSION_HOURLY = 'cdm-ams-id-v2-hourly';
export const LBS_PER_MT = 2204.62;
export const ADJUSTMENT_FACTOR = 1.0;

export interface RevenueProjection {
  pricePerMt: number;
  grossRevenue: number;
  feeRate: number;
  feeAmount: number;
  netRevenue: number;
}

export function projectRevenue(adjustedMt: number, pricePerMt: number, feeRate = 0.15): RevenueProjection {
  const grossRevenue = adjustedMt * pricePerMt;
  const feeAmount = grossRevenue * feeRate;
  const netRevenue = grossRevenue - feeAmount;
  return { pricePerMt, grossRevenue, feeRate, feeAmount, netRevenue };
}

/**
 * Normalizes a datetime string to "YYYY-MM-DDTHH" for matching
 * generation records (ISO 8601) against EIA periods.
 */
function normalizeToHourKey(dt: string): string {
  // Handles both "2024-06-15T14:00:00Z" and "2024-06-15T14"
  return dt.slice(0, 13);
}

// ── Flat rate (V1 — preserved unchanged) ────────────────────────────────────

/**
 * CO₂ displacement formula (CDM AMS I.D):
 * CO₂ MT = (total_mwh × co2_lbs_per_mwh) ÷ 2204.62
 */
export function calculateDisplacementFlat(
  facility: Facility,
  generationData: GenerationData
): Calculation {
  const { emissionFactor } = facility;
  const totalMwh = generationData.totalMwh;
  const co2LbsPerMwh = emissionFactor.co2LbsPerMwh;

  const rawMt = (totalMwh * co2LbsPerMwh) / LBS_PER_MT;
  const adjustedMt = rawMt * ADJUSTMENT_FACTOR;

  return {
    id: generateUUID(),
    facilityId: facility.id,
    egridRateId: emissionFactor.egridRateId,
    co2LbsPerMwh,
    datasetVersion: emissionFactor.datasetVersion,
    formulaVersion: FORMULA_VERSION,
    adjustmentFactor: ADJUSTMENT_FACTOR,
    totalMwh,
    rawMt,
    adjustedMt,
    calculatedAt: new Date().toISOString(),
    sourceFileHash: generationData.fileHash,
    status: 'active',
    mode: 'annual_flat',
    balancingAuthority: null,
    hourlyResults: null,
    fuelBreakdown: null,
    fallbackReason: null,
    gridMixHash: null,
  };
}

// ── Hourly marginal (V2) ─────────────────────────────────────────────────────

export function calculateDisplacementHourly(
  facility: Facility,
  generationData: GenerationData,
  gridMixData: HourlyGridMix[]
): Calculation {
  const { emissionFactor } = facility;
  const hourlyRecords = generationData.hourlyRecords ?? [];
  const balancingAuthority = getPrimaryBA(facility.egridSubregion);

  // Build marginal rate lookup keyed by "YYYY-MM-DDTHH"
  const marginalRates = deriveHourlyMarginalRates(gridMixData);
  const rateByHour = new Map(marginalRates.map(r => [r.hour, r]));

  const hourlyResults: HourlyDisplacement[] = [];
  let coalMt = 0;
  let gasMt = 0;
  let oilMt = 0;

  for (const rec of hourlyRecords) {
    const key = normalizeToHourKey(rec.hour);
    const rateInfo = rateByHour.get(key);

    const marginalEmissionRate = rateInfo?.marginalEmissionRate ?? emissionFactor.co2LbsPerMwh;
    const fuelMix = rateInfo?.fuelMix ?? { coal: 0, gas: 0, oil: 0, nuclear: 0, renewable: 0, other: 0, total: 0 };
    const dominantFuel = rateInfo?.dominantFuel ?? 'none';

    const displacedLbsCo2 = rec.mwh * marginalEmissionRate;
    const displacedMtCo2 = displacedLbsCo2 / LBS_PER_MT;

    // Attribute displaced MT to fuel proportionally
    const fossilTotal = fuelMix.coal + fuelMix.gas + fuelMix.oil;
    if (fossilTotal > 0) {
      coalMt += displacedMtCo2 * (fuelMix.coal / fossilTotal);
      gasMt  += displacedMtCo2 * (fuelMix.gas  / fossilTotal);
      oilMt  += displacedMtCo2 * (fuelMix.oil  / fossilTotal);
    }

    hourlyResults.push({
      hour: rec.hour,
      generationMwh: rec.mwh,
      marginalEmissionRate,
      displacedLbsCo2,
      displacedMtCo2,
      dominantFuelDisplaced: dominantFuel,
      fuelMix,
    });
  }

  const rawMt = hourlyResults.reduce((sum, r) => sum + r.displacedMtCo2, 0);
  const adjustedMt = rawMt * ADJUSTMENT_FACTOR;
  const totalMt = coalMt + gasMt + oilMt || 1; // avoid divide-by-zero

  const fuelBreakdown: FuelBreakdown = {
    coalMt,
    gasMt,
    oilMt,
    coalPct: (coalMt / totalMt) * 100,
    gasPct:  (gasMt  / totalMt) * 100,
    oilPct:  (oilMt  / totalMt) * 100,
  };

  return {
    id: generateUUID(),
    facilityId: facility.id,
    egridRateId: emissionFactor.egridRateId,
    co2LbsPerMwh: emissionFactor.co2LbsPerMwh,
    datasetVersion: emissionFactor.datasetVersion,
    formulaVersion: FORMULA_VERSION_HOURLY,
    adjustmentFactor: ADJUSTMENT_FACTOR,
    totalMwh: generationData.totalMwh,
    rawMt,
    adjustedMt,
    calculatedAt: new Date().toISOString(),
    sourceFileHash: generationData.fileHash,
    status: 'active',
    mode: 'hourly_marginal',
    balancingAuthority,
    hourlyResults,
    fuelBreakdown,
    fallbackReason: null,
    gridMixHash: null, // populated by App.tsx after async hash
  };
}

// ── Router ───────────────────────────────────────────────────────────────────

/**
 * Routes to hourly or flat-rate calculation based on data availability.
 * Called by Step 3. Always returns a valid Calculation — never throws.
 */
export async function calculateDisplacement(
  facility: Facility,
  generationData: GenerationData,
  gridMixData: HourlyGridMix[] | null
): Promise<Calculation> {
  if (gridMixData && gridMixData.length > 0 && generationData.hourlyRecords && generationData.hourlyRecords.length > 0) {
    const calc = calculateDisplacementHourly(facility, generationData, gridMixData);
    calc.gridMixHash = await sha256Hex(JSON.stringify(gridMixData));
    return calc;
  }

  const calc = calculateDisplacementFlat(facility, generationData);
  calc.fallbackReason =
    !gridMixData || gridMixData.length === 0
      ? 'EIA hourly grid mix data unavailable for this period'
      : 'Generation data does not contain hourly records';
  return calc;
}
