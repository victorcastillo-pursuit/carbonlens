export interface EmissionFactor {
  subregionCode: string;
  co2LbsPerMwh: number;
  datasetVersion: string;
  egridRateId: string;
}

export interface Facility {
  id: string; // UUID
  name: string;
  capacityMw: number;
  egridSubregion: string;
  commercialOperationDate: string; // ISO date string
  emissionFactor: EmissionFactor;
  createdAt: string; // ISO datetime string
}

export interface GenerationRecord {
  date: string; // ISO date string YYYY-MM-DD
  mwh: number;
}

export type DataGranularity = 'hourly' | 'daily';

export interface HourlyGenerationRecord {
  hour: string; // ISO 8601: "2024-06-15T14:00:00Z"
  mwh: number;
}

export interface HourlyGridMix {
  period: string;     // EIA format: "2024-06-15T14"
  respondent: string; // BA code: "PJM", "ERCO", etc.
  fueltype: string;   // "COL" | "NG" | "OIL" | "SUN" | "WND" | "NUC" | "WAT" | "OTH"
  value: number;      // MWh generated
}

export interface FuelMixSnapshot {
  coal: number;      // MWh
  gas: number;       // MWh
  oil: number;       // MWh
  nuclear: number;   // MWh
  renewable: number; // MWh (solar + wind + hydro)
  other: number;     // MWh
  total: number;     // MWh
}

export interface HourlyDisplacement {
  hour: string;                  // ISO 8601
  generationMwh: number;
  marginalEmissionRate: number;  // lbs CO₂/MWh (fossil-weighted avg)
  displacedLbsCo2: number;
  displacedMtCo2: number;
  dominantFuelDisplaced: 'coal' | 'gas' | 'oil' | 'none';
  fuelMix: FuelMixSnapshot;
}

export interface FuelBreakdown {
  coalMt: number;
  gasMt: number;
  oilMt: number;
  coalPct: number;
  gasPct: number;
  oilPct: number;
}

export type CalculationMode = 'hourly_marginal' | 'annual_flat';

export interface USPVDBFacility {
  case_id: number;
  p_name: string;
  p_state: string;
  p_county: string;
  p_cap_ac: number;  // MW AC
  p_cap_dc: number;  // MW DC
  ylat: number;
  xlong: number;
  p_tech_p: string;  // panel technology type
  p_axis: string;    // axis/tracking type
  p_year: number;    // year online
}

export interface GenerationData {
  fileHash: string; // SHA-256 of original CSV
  fileName: string;
  fileSize: number;
  records: GenerationRecord[];
  totalMwh: number;
  dateRange: { start: string; end: string };
  committedAt: string; // ISO datetime string
  rawCsvContent: string;
  granularity: DataGranularity;
  hourlyRecords: HourlyGenerationRecord[] | null;
  interpolated: boolean;
}

export interface Calculation {
  id: string; // UUID
  facilityId: string;
  egridRateId: string; // denormalized
  co2LbsPerMwh: number; // denormalized
  datasetVersion: string; // denormalized
  formulaVersion: string; // "cdm-ams-id-v1" or "cdm-ams-id-v2-hourly"
  adjustmentFactor: number; // 1.0
  totalMwh: number;
  rawMt: number;
  adjustedMt: number;
  calculatedAt: string; // ISO datetime string
  sourceFileHash: string;
  status: 'active' | 'superseded';
  mode: CalculationMode;
  balancingAuthority: string | null;
  hourlyResults: HourlyDisplacement[] | null;
  fuelBreakdown: FuelBreakdown | null;
  fallbackReason: string | null;
  gridMixHash: string | null;
}

export type ReadinessCheckSeverity = 'PASS' | 'WARN' | 'BLOCK';
export type ReadinessStatus = 'READY_FOR_REPORT' | 'BLOCKED';

export interface ReadinessCheck {
  id: string;
  category: string;
  label: string;
  severity: ReadinessCheckSeverity;
  message: string;
}

export interface ReadinessResult {
  status: ReadinessStatus;
  blockingCount: number;
  checks: ReadinessCheck[];
  validatedAt: string; // ISO datetime string
}

export type AuditEventType =
  | 'facility_created'
  | 'facility_lookup_completed'
  | 'generation_data_uploaded'
  | 'grid_mix_data_fetched'
  | 'grid_mix_fetch_failed'
  | 'calculation_executed'
  | 'calculation_mode_fallback'
  | 'readiness_validation_run'
  | 'report_generated'
  | 'report_exported';

export interface AuditEvent {
  id: string; // UUID
  eventType: AuditEventType;
  timestamp: string; // ISO datetime string
  payload: Record<string, unknown>;
}

export interface ManifestEntry {
  filename: string;
  sha256: string;
  sizeBytes: number;
}

export interface ReportArtifact {
  reportId: string; // UUID
  generatedAt: string; // ISO datetime string
  pdfBlob: Blob;
  jsonData: string;
  csvContent: string;
  auditJson: string;
  manifest: ManifestEntry[];
}

export interface AppState {
  currentStep: 1 | 2 | 3 | 4 | 5;
  facility: Facility | null;
  generationData: GenerationData | null;
  calculation: Calculation | null;
  readiness: ReadinessResult | null;
  reportArtifact: ReportArtifact | null;
  auditLog: AuditEvent[];
  gridMixData: HourlyGridMix[] | null;
  facilityLookup: USPVDBFacility | null;
}
