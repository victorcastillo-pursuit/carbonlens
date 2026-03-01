import { EmissionFactor } from '../types';

// EPA eGRID 2023 Rev 2 — All continental US subregions
// Source: https://www.epa.gov/egrid/egrid-data
// co2_lbs_per_mwh = CO2 output emission rate (lb/MWh)
export const EGRID_DATASET_VERSION = 'egrid_2023_rev2';

export const EGRID_SUBREGIONS: EmissionFactor[] = [
  { subregionCode: 'AKGD', co2LbsPerMwh: 1095.1, datasetVersion: EGRID_DATASET_VERSION, egridRateId: 'AKGD_CO2_2023R2' },
  { subregionCode: 'AKMS', co2LbsPerMwh: 590.4,  datasetVersion: EGRID_DATASET_VERSION, egridRateId: 'AKMS_CO2_2023R2' },
  { subregionCode: 'AZNM', co2LbsPerMwh: 756.5,  datasetVersion: EGRID_DATASET_VERSION, egridRateId: 'AZNM_CO2_2023R2' },
  { subregionCode: 'CAMX', co2LbsPerMwh: 507.7,  datasetVersion: EGRID_DATASET_VERSION, egridRateId: 'CAMX_CO2_2023R2' },
  { subregionCode: 'ERCT', co2LbsPerMwh: 836.0,  datasetVersion: EGRID_DATASET_VERSION, egridRateId: 'ERCT_CO2_2023R2' },
  { subregionCode: 'FRCC', co2LbsPerMwh: 845.0,  datasetVersion: EGRID_DATASET_VERSION, egridRateId: 'FRCC_CO2_2023R2' },
  { subregionCode: 'HIOA', co2LbsPerMwh: 1498.0, datasetVersion: EGRID_DATASET_VERSION, egridRateId: 'HIOA_CO2_2023R2' },
  { subregionCode: 'HIMS', co2LbsPerMwh: 1471.0, datasetVersion: EGRID_DATASET_VERSION, egridRateId: 'HIMS_CO2_2023R2' },
  { subregionCode: 'MROE', co2LbsPerMwh: 1607.0, datasetVersion: EGRID_DATASET_VERSION, egridRateId: 'MROE_CO2_2023R2' },
  { subregionCode: 'MROW', co2LbsPerMwh: 1244.0, datasetVersion: EGRID_DATASET_VERSION, egridRateId: 'MROW_CO2_2023R2' },
  { subregionCode: 'NEWE', co2LbsPerMwh: 549.0,  datasetVersion: EGRID_DATASET_VERSION, egridRateId: 'NEWE_CO2_2023R2' },
  { subregionCode: 'NWPP', co2LbsPerMwh: 547.0,  datasetVersion: EGRID_DATASET_VERSION, egridRateId: 'NWPP_CO2_2023R2' },
  { subregionCode: 'NYCW', co2LbsPerMwh: 592.0,  datasetVersion: EGRID_DATASET_VERSION, egridRateId: 'NYCW_CO2_2023R2' },
  { subregionCode: 'NYLI', co2LbsPerMwh: 817.0,  datasetVersion: EGRID_DATASET_VERSION, egridRateId: 'NYLI_CO2_2023R2' },
  { subregionCode: 'NYUP', co2LbsPerMwh: 224.0,  datasetVersion: EGRID_DATASET_VERSION, egridRateId: 'NYUP_CO2_2023R2' },
  { subregionCode: 'RFCE', co2LbsPerMwh: 641.0,  datasetVersion: EGRID_DATASET_VERSION, egridRateId: 'RFCE_CO2_2023R2' },
  { subregionCode: 'RFCM', co2LbsPerMwh: 1135.0, datasetVersion: EGRID_DATASET_VERSION, egridRateId: 'RFCM_CO2_2023R2' },
  { subregionCode: 'RFCW', co2LbsPerMwh: 911.0,  datasetVersion: EGRID_DATASET_VERSION, egridRateId: 'RFCW_CO2_2023R2' },
  { subregionCode: 'RMPA', co2LbsPerMwh: 1397.0, datasetVersion: EGRID_DATASET_VERSION, egridRateId: 'RMPA_CO2_2023R2' },
  { subregionCode: 'SPNO', co2LbsPerMwh: 1193.0, datasetVersion: EGRID_DATASET_VERSION, egridRateId: 'SPNO_CO2_2023R2' },
  { subregionCode: 'SPSO', co2LbsPerMwh: 1086.0, datasetVersion: EGRID_DATASET_VERSION, egridRateId: 'SPSO_CO2_2023R2' },
  { subregionCode: 'SRMV', co2LbsPerMwh: 784.0,  datasetVersion: EGRID_DATASET_VERSION, egridRateId: 'SRMV_CO2_2023R2' },
  { subregionCode: 'SRMW', co2LbsPerMwh: 1335.0, datasetVersion: EGRID_DATASET_VERSION, egridRateId: 'SRMW_CO2_2023R2' },
  { subregionCode: 'SRSO', co2LbsPerMwh: 845.0,  datasetVersion: EGRID_DATASET_VERSION, egridRateId: 'SRSO_CO2_2023R2' },
  { subregionCode: 'SRTV', co2LbsPerMwh: 901.0,  datasetVersion: EGRID_DATASET_VERSION, egridRateId: 'SRTV_CO2_2023R2' },
  { subregionCode: 'SRVC', co2LbsPerMwh: 607.0,  datasetVersion: EGRID_DATASET_VERSION, egridRateId: 'SRVC_CO2_2023R2' },
  { subregionCode: 'PRMS', co2LbsPerMwh: 1425.0, datasetVersion: EGRID_DATASET_VERSION, egridRateId: 'PRMS_CO2_2023R2' },
];

export function getEmissionFactor(subregionCode: string): EmissionFactor | undefined {
  return EGRID_SUBREGIONS.find(r => r.subregionCode === subregionCode);
}

export const SUBREGION_LABELS: Record<string, string> = {
  AKGD: 'AKGD — Alaska Grid',
  AKMS: 'AKMS — Alaska Miscellaneous',
  AZNM: 'AZNM — Southwest',
  CAMX: 'CAMX — California',
  ERCT: 'ERCT — Texas (ERCOT)',
  FRCC: 'FRCC — Florida',
  HIOA: 'HIOA — Hawaii (Oahu)',
  HIMS: 'HIMS — Hawaii (Miscellaneous)',
  MROE: 'MROE — Midwest East',
  MROW: 'MROW — Midwest West',
  NEWE: 'NEWE — New England',
  NWPP: 'NWPP — Northwest',
  NYCW: 'NYCW — New York City / Westchester',
  NYLI: 'NYLI — Long Island',
  NYUP: 'NYUP — New York Upstate',
  RFCE: 'RFCE — RFC East',
  RFCM: 'RFCM — RFC Michigan',
  RFCW: 'RFCW — RFC West (OH/IN/IL/MI)',
  RMPA: 'RMPA — Rocky Mountain',
  SPNO: 'SPNO — SPP North',
  SPSO: 'SPSO — SPP South',
  SRMV: 'SRMV — SERC Mississippi Valley',
  SRMW: 'SRMW — SERC Midwest',
  SRSO: 'SRSO — SERC South',
  SRTV: 'SRTV — SERC Tennessee Valley',
  SRVC: 'SRVC — SERC Virginia / Carolina',
  PRMS: 'PRMS — Puerto Rico',
};
