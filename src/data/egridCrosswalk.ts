// Maps eGRID subregion codes → EIA balancing authority respondent codes.
// First entry in each array is the primary BA used for EIA queries.
// Empty arrays = no EIA hourly data available (AK, HI, PR).
export const SUBREGION_TO_BA: Record<string, string[]> = {
  AKGD: [],
  AKMS: [],
  AZNM: ['SRP', 'AZPS', 'PNM'],
  CAMX: ['CISO'],
  ERCT: ['ERCO'],
  FRCC: ['FPC', 'FPL', 'JEA', 'SEC', 'TEC', 'TAL', 'HST', 'GVL', 'NSB'],
  HIOA: [],
  HIMS: [],
  MROE: ['MISO'],
  MROW: ['MISO', 'SWPP'],
  NEWE: ['ISNE'],
  NWPP: ['BPAT', 'PACW', 'PSEI', 'AVA', 'CHPD', 'DOPD', 'GCPD', 'TPWR'],
  NYCW: ['NYIS'],
  NYLI: ['NYIS'],
  NYUP: ['NYIS'],
  RFCE: ['PJM'],
  RFCM: ['PJM', 'MISO'],
  RFCW: ['PJM', 'MISO'],
  RMPA: ['PSCO', 'WACM'],
  SPNO: ['SWPP'],
  SPSO: ['SWPP'],
  SRMV: ['MISO'],
  SRMW: ['MISO'],
  SRSO: ['SOCO'],
  SRTV: ['TVA'],
  SRVC: ['CPLE', 'DUK', 'SC', 'SCEG'],
  PRMS: [],
};

/** Returns the primary BA code for a subregion, or null if unsupported. */
export function getPrimaryBA(subregionCode: string): string | null {
  const bas = SUBREGION_TO_BA[subregionCode];
  return bas && bas.length > 0 ? bas[0] : null;
}

/** Returns true if the subregion has at least one BA mapping. */
export function hasHourlyDataSupport(subregionCode: string): boolean {
  const bas = SUBREGION_TO_BA[subregionCode];
  return !!bas && bas.length > 0;
}

/** Returns all subregions mapped to a given BA code. */
export function getSubregionsForBA(baCode: string): string[] {
  return Object.entries(SUBREGION_TO_BA)
    .filter(([, bas]) => bas.includes(baCode))
    .map(([code]) => code);
}
