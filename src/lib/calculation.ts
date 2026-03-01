import { Calculation, Facility, GenerationData } from '../types';
import { generateUUID } from './crypto';

export const FORMULA_VERSION = 'cdm-ams-id-v1';
export const LBS_PER_MT = 2204.62;
export const ADJUSTMENT_FACTOR = 1.0;

/**
 * CO₂ displacement formula (CDM AMS I.D):
 * CO₂ MT = (total_mwh × co2_lbs_per_mwh) ÷ 2204.62
 */
export function calculateDisplacement(
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
  };
}

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
