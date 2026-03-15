import { HourlyGridMix, FuelMixSnapshot } from '../types';
import { FUEL_CO2_LBS_PER_MWH } from '../data/fuelEmissionFactors';

export interface HourlyMarginalRate {
  hour: string;                           // EIA period format "YYYY-MM-DDTHH"
  marginalEmissionRate: number;           // lbs CO₂/MWh (fossil-weighted avg)
  dominantFuel: 'coal' | 'gas' | 'oil' | 'none';
  fuelMix: FuelMixSnapshot;
}

/**
 * Derives hourly marginal emission rates from EIA grid mix data.
 *
 * For each hour:
 *   1. Sum fossil fuel generation: coal + gas + oil = fossilTotal
 *   2. If fossilTotal == 0: rate = 0 (grid was 100% clean that hour)
 *   3. Else: rate = (coal×2230 + gas×900 + oil×1620) / fossilTotal
 *
 * Returns one HourlyMarginalRate per hour present in the data.
 * Missing hours are omitted — coverage validation is handled upstream.
 */
export function deriveHourlyMarginalRates(gridMix: HourlyGridMix[]): HourlyMarginalRate[] {
  // Group entries by period (one entry per fuel type per hour)
  const byHour = new Map<string, HourlyGridMix[]>();
  for (const row of gridMix) {
    const existing = byHour.get(row.period) ?? [];
    existing.push(row);
    byHour.set(row.period, existing);
  }

  const results: HourlyMarginalRate[] = [];

  for (const [hour, rows] of byHour) {
    let coal = 0;
    let gas = 0;
    let oil = 0;
    let nuclear = 0;
    let renewable = 0;
    let other = 0;

    for (const row of rows) {
      const v = Math.max(0, row.value); // treat negative values as 0
      switch (row.fueltype) {
        case 'COL': coal += v; break;
        case 'NG':  gas += v; break;
        case 'OIL': oil += v; break;
        case 'NUC': nuclear += v; break;
        case 'SUN':
        case 'WND':
        case 'WAT': renewable += v; break;
        default:    other += v; break;
      }
    }

    const total = coal + gas + oil + nuclear + renewable + other;
    const fossilTotal = coal + gas + oil;

    const fuelMix: FuelMixSnapshot = { coal, gas, oil, nuclear, renewable, other, total };

    let marginalEmissionRate = 0;
    let dominantFuel: 'coal' | 'gas' | 'oil' | 'none' = 'none';

    if (fossilTotal > 0) {
      marginalEmissionRate =
        (coal * FUEL_CO2_LBS_PER_MWH['COL'] +
         gas  * FUEL_CO2_LBS_PER_MWH['NG'] +
         oil  * FUEL_CO2_LBS_PER_MWH['OIL']) / fossilTotal;

      // Dominant fossil fuel by MWh share
      if (coal >= gas && coal >= oil) dominantFuel = 'coal';
      else if (gas >= coal && gas >= oil) dominantFuel = 'gas';
      else dominantFuel = 'oil';
    }

    results.push({ hour, marginalEmissionRate, dominantFuel, fuelMix });
  }

  // Sort chronologically
  results.sort((a, b) => a.hour.localeCompare(b.hour));
  return results;
}
