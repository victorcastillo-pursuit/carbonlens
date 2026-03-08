/**
 * Fuel-specific CO₂ emission factors in lbs CO₂/MWh.
 * Source: EPA eGRID 2023 national average output emission rates by fuel type.
 * Used to derive hourly marginal emission rates from EIA grid mix data.
 */
export const FUEL_CO2_LBS_PER_MWH: Record<string, number> = {
  COL: 2230, // coal
  NG:  900,  // natural gas
  OIL: 1620, // petroleum/other fossil
};

/** Fuels treated as zero-emission for displacement purposes. */
export const ZERO_EMISSION_FUELS = ['SUN', 'WND', 'NUC', 'WAT'] as const;

/** Version string for audit trail. */
export const FUEL_FACTORS_VERSION = 'epa_egrid_2023_avg';

/** EIA fuel type code → display label. */
export const FUEL_LABELS: Record<string, string> = {
  COL: 'Coal',
  NG:  'Natural Gas',
  OIL: 'Petroleum',
  SUN: 'Solar',
  WND: 'Wind',
  NUC: 'Nuclear',
  WAT: 'Hydro',
  OTH: 'Other',
};
