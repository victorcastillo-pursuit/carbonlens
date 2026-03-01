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

export interface GenerationData {
  fileHash: string; // SHA-256 of original CSV
  fileName: string;
  fileSize: number;
  records: GenerationRecord[];
  totalMwh: number;
  dateRange: { start: string; end: string };
  committedAt: string; // ISO datetime string
  rawCsvContent: string;
}

export interface Calculation {
  id: string; // UUID
  facilityId: string;
  egridRateId: string; // denormalized
  co2LbsPerMwh: number; // denormalized
  datasetVersion: string; // denormalized
  formulaVersion: string; // "cdm-ams-id-v1"
  adjustmentFactor: number; // 1.0
  totalMwh: number;
  rawMt: number;
  adjustedMt: number;
  calculatedAt: string; // ISO datetime string
  sourceFileHash: string;
  status: 'active' | 'superseded';
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
  | 'generation_data_uploaded'
  | 'calculation_executed'
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
}
