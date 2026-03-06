# CarbonLens V2 — Technical Design Document

**Status:** Draft — For implementation by Claude Code team
**Author:** Edwin Perez
**Date:** March 2026
**Depends on:** `CarbonLens_V2_Implementation_Spec.md` (approved design decisions), `PRD.md` (product requirements), `ARCHITECTURE.md` (current system architecture)

---

## 1. Overview

This TDD specifies the technical implementation for upgrading CarbonLens from flat-rate annual CO₂ displacement to hourly marginal displacement. It covers new service layer contracts, data structures, calculation engine internals, state management changes, CSV parser upgrades, validation extensions, export modifications, UI component changes, and the Vite proxy configuration.

All design decisions referenced here were approved in the Implementation Spec. This document translates those decisions into concrete code-level guidance.

### Scope

**In scope:** EIA API integration, USPVDB facility lookup, eGRID-to-BA crosswalk, hourly marginal calculation engine, CSV auto-detection with interpolation, Step 1/2/3/4/5 UI updates, Vite proxy for API key security, export package extensions.

**Out of scope:** Backend server, database, user authentication, multi-facility portfolio, Berkeley Lab USS integration, Open Power System Data (EU), production deployment infrastructure.

---

## 2. System Architecture — V2

### 2.1 Layer Diagram

```
┌──────────────────────────────────────────────────────────┐
│  EXTERNAL APIs                                            │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────┐  │
│  │ EIA API v2   │  │ USPVDB API   │  │ EPA eGRID      │  │
│  │ (hourly mix) │  │ (facilities) │  │ (static files) │  │
│  └──────┬───────┘  └──────┬───────┘  └───────┬────────┘  │
└─────────┼──────────────────┼──────────────────┼───────────┘
          │                  │                  │
          │ Vite proxy       │ Direct GET       │ Bundled
          │ /api/eia         │ (no auth)        │ in src/data/
          ▼                  ▼                  ▼
┌──────────────────────────────────────────────────────────┐
│  SERVICE LAYER — src/services/                            │
│  ┌─────────────┐  ┌──────────────┐                       │
│  │ eia.ts       │  │ uspvdb.ts    │                       │
│  └──────┬───────┘  └──────┬───────┘                       │
└─────────┼──────────────────┼──────────────────────────────┘
          │                  │
          ▼                  ▼
┌──────────────────────────────────────────────────────────┐
│  DATA LAYER — src/data/                                   │
│  ┌─────────────┐  ┌──────────────────┐  ┌─────────────┐ │
│  │ egrid.ts     │  │ egridCrosswalk.ts│  │ fuelEmission │ │
│  │ (existing)   │  │ (new)            │  │ Factors.ts   │ │
│  └──────┬───────┘  └────────┬─────────┘  └──────┬──────┘ │
└─────────┼───────────────────┼───────────────────┼─────────┘
          │                   │                   │
          ▼                   ▼                   ▼
┌──────────────────────────────────────────────────────────┐
│  DOMAIN LOGIC — src/lib/                                  │
│  ┌───────────────┐  ┌──────────────────┐  ┌───────────┐ │
│  │ calculation.ts │  │ marginalEmissions│  │ csvParser  │ │
│  │ (flat+hourly)  │  │ .ts (new)        │  │ .ts        │ │
│  ├───────────────┤  └──────────────────┘  ├───────────┤ │
│  │ validation.ts  │                        │ pdfGen.ts  │ │
│  │ (extended)     │                        │ zipExport  │ │
│  └───────┬───────┘                        └─────┬─────┘ │
└──────────┼──────────────────────────────────────┼────────┘
           │                                      │
           ▼                                      ▼
┌──────────────────────────────────────────────────────────┐
│  STATE — src/hooks/useAppState.ts (useReducer)            │
│  STATE — src/App.tsx (workflow controller)                 │
└──────────────────────┬───────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────┐
│  UI — src/components/steps/                               │
│  Step1: FacilityOnboarding (+ USPVDB search)              │
│  Step2: GenerationUpload (+ hourly auto-detect)           │
│  Step3: DisplacementCalculation (+ chart + fuel breakdown)│
│  Step4: ReadinessValidation (+ hourly checks)             │
│  Step5: ReportExport (+ hourly data in exports)           │
└──────────────────────────────────────────────────────────┘
```

### 2.2 Data Flow — Hourly Calculation Path

```
User selects facility (Step 1)
  → egridCrosswalk.ts resolves subregion → BA code
  → eia.ts fetches hourly grid mix for BA + date range (via Vite proxy)
  → grid mix data stored in AppState

User uploads generation CSV (Step 2)
  → csvParser.ts auto-detects granularity (hourly vs daily)
  → if daily: interpolate to hourly using solar generation profile curve
  → generation data stored in AppState (with granularity + interpolation flags)

User triggers calculation (Step 3)
  → calculation.ts router checks: gridMixData available?
    → YES: calculateDisplacementHourly()
      → marginalEmissions.ts derives hourly emission rates from grid mix
      → each hour: solarMwh × marginalRate / 2204.62 = displacedMt
      → aggregate: sum all hours, build fuel breakdown
    → NO: calculateDisplacementFlat() (existing V1 logic, unchanged)
  → Calculation record stored in AppState with mode + version + full payload

Validation (Step 4)
  → existing checks run unchanged
  → new hourly checks: EIA coverage, BA alignment, rate sanity, interpolation flag

Export (Step 5)
  → PDF: summary page (same as V1) + new hourly methodology section
  → JSON: full Calculation record including hourlyResults array
  → CSV: original uploaded file (unchanged)
  → Audit trail: all events including EIA fetch, mode selection, fallback reasons
  → Manifest: SHA-256 for all files
```

---

## 3. Type Definitions

### 3.1 New Types — Add to `src/types/index.ts`

```typescript
// ── Hourly generation (from CSV or interpolated) ────────────────────

export interface HourlyGenerationRecord {
  hour: string;    // ISO 8601: "2024-06-15T14:00:00Z"
  mwh: number;
}

// ── EIA grid mix (from API) ─────────────────────────────────────────

export interface HourlyGridMix {
  period: string;             // EIA format: "2024-06-15T14"
  respondent: string;         // BA code: "PJM", "ERCO", etc.
  fueltype: string;           // "COL" | "NG" | "OIL" | "SUN" | "WND" | "NUC" | "WAT" | "OTH"
  value: number;              // MWh generated
}

// ── Hourly displacement result ──────────────────────────────────────

export interface FuelMixSnapshot {
  coal: number;     // MWh
  gas: number;      // MWh
  oil: number;      // MWh
  nuclear: number;  // MWh
  renewable: number;// MWh (solar + wind + hydro)
  other: number;    // MWh
  total: number;    // MWh
}

export interface HourlyDisplacement {
  hour: string;                    // ISO 8601
  generationMwh: number;          // solar generation this hour
  marginalEmissionRate: number;   // lbs CO₂/MWh (fossil-weighted avg)
  displacedLbsCo2: number;
  displacedMtCo2: number;
  dominantFuelDisplaced: 'coal' | 'gas' | 'oil' | 'none';
  fuelMix: FuelMixSnapshot;
}

// ── Fuel breakdown aggregate ────────────────────────────────────────

export interface FuelBreakdown {
  coalMt: number;       // MT CO₂ displaced from coal
  gasMt: number;        // MT CO₂ displaced from gas
  oilMt: number;        // MT CO₂ displaced from oil
  coalPct: number;      // percentage of total
  gasPct: number;
  oilPct: number;
}

// ── Calculation mode ────────────────────────────────────────────────

export type CalculationMode = 'hourly_marginal' | 'annual_flat';
export type DataGranularity = 'hourly' | 'daily';

// ── USPVDB facility ─────────────────────────────────────────────────

export interface USPVDBFacility {
  case_id: number;
  p_name: string;
  p_state: string;
  p_county: string;
  p_cap_ac: number;       // MW AC
  p_cap_dc: number;       // MW DC
  ylat: number;
  xlong: number;
  p_tech_p: string;       // panel technology type
  p_axis: string;         // axis/tracking type
  p_year: number;         // year online
}
```

### 3.2 Extended Existing Types

**`GenerationData`** — add these fields:

```typescript
export interface GenerationData {
  // ... existing fields unchanged ...
  granularity: DataGranularity;                     // NEW
  hourlyRecords: HourlyGenerationRecord[] | null;   // NEW — populated for hourly CSVs or after interpolation
  interpolated: boolean;                            // NEW — true if daily data was interpolated to hourly
}
```

**`Calculation`** — add these fields:

```typescript
export interface Calculation {
  // ... existing fields unchanged ...
  mode: CalculationMode;                           // NEW
  balancingAuthority: string | null;               // NEW — BA code used for EIA lookup
  hourlyResults: HourlyDisplacement[] | null;      // NEW — full hourly breakdown (null for flat mode)
  fuelBreakdown: FuelBreakdown | null;             // NEW — aggregate fuel displacement (null for flat mode)
  fallbackReason: string | null;                   // NEW — populated when mode is 'annual_flat' due to missing data
  gridMixHash: string | null;                      // NEW — SHA-256 of the EIA data snapshot used
}
```

**`AppState`** — add these fields:

```typescript
export interface AppState {
  // ... existing fields unchanged ...
  gridMixData: HourlyGridMix[] | null;             // NEW — cached EIA response
  facilityLookup: USPVDBFacility | null;           // NEW — USPVDB match result
}
```

**`AuditEventType`** — add new event types:

```typescript
export type AuditEventType =
  | 'facility_created'
  | 'facility_lookup_completed'          // NEW
  | 'generation_data_uploaded'
  | 'grid_mix_data_fetched'              // NEW
  | 'grid_mix_fetch_failed'              // NEW
  | 'calculation_executed'
  | 'calculation_mode_fallback'          // NEW
  | 'readiness_validation_run'
  | 'report_generated'
  | 'report_exported';
```

---

## 4. Service Layer

### 4.1 `src/services/eia.ts`

**Responsibility:** Fetch hourly generation-by-fuel-type data from EIA API v2 through the Vite dev proxy.

**Proxy route:** `/api/eia` → `https://api.eia.gov/v2` (API key injected server-side by Vite).

**Pagination strategy:** EIA limits responses to 5,000 rows. One hour for one BA across 8 fuel types = 8 rows. One month = ~5,952 rows (31 days × 24 hours × 8 fuels). Fetch one month at a time and concatenate results.

```typescript
// ── Public API ──────────────────────────────────────────────────────

/**
 * Fetches hourly grid mix data for a balancing authority over a date range.
 * Handles pagination internally (one month per request).
 * Returns empty array on API failure (does NOT throw).
 */
export async function fetchHourlyGridMix(
  balancingAuthority: string,
  startDate: string,       // ISO date: "2024-01-01"
  endDate: string          // ISO date: "2024-12-31"
): Promise<HourlyGridMix[]>

// ── Internal helpers ────────────────────────────────────────────────

/**
 * Fetches a single page of EIA data (up to 5000 rows).
 */
async function fetchEiaPage(
  balancingAuthority: string,
  start: string,           // EIA format: "2024-01-01T00"
  end: string,             // EIA format: "2024-01-31T23"
  offset: number
): Promise<{ data: HourlyGridMix[]; total: number }>

/**
 * Splits a date range into monthly chunks for pagination.
 */
function splitIntoMonths(
  startDate: string,
  endDate: string
): Array<{ start: string; end: string }>
```

**EIA API response shape** (for reference during implementation):

```json
{
  "response": {
    "total": 5952,
    "data": [
      {
        "period": "2024-06-15T14",
        "respondent": "PJM",
        "respondent-name": "PJM Interconnection, LLC",
        "fueltype": "COL",
        "type-name": "Coal",
        "value": 24500,
        "value-units": "megawatthours"
      }
    ]
  }
}
```

**Error handling:** Wrap all fetch calls in try/catch. On network error, timeout, or non-200 response, log the error to console and return an empty array. The calculation engine interprets an empty array as "EIA data unavailable — use flat rate fallback." Never throw from this module.

**Rate limiting note:** EIA throttles excessive requests. The monthly pagination approach keeps total requests under 15 per calculation (12 months + retries). Add a 200ms delay between successive page fetches to be safe.

**Crosswalk validation note:** Before fetching, verify that the BA code exists in the EIA respondent list. Some BA codes in the crosswalk may use aggregated regional codes (e.g., `FLA` for Florida) rather than individual utility codes. During Phase 1 implementation, test each crosswalk entry against the actual EIA API and correct codes that return no data.

### 4.2 `src/services/uspvdb.ts`

**Responsibility:** Search the USPVDB for facility records. Read-only, no authentication required.

**Base URL:** `https://energy.usgs.gov/api/uspvdb/v1/`

```typescript
/**
 * Searches USPVDB by project name. Returns top matches.
 * Optionally filter by state abbreviation.
 */
export async function searchFacilities(
  query: string,
  state?: string
): Promise<USPVDBFacility[]>

/**
 * Fetches a single facility by its USPVDB case_id.
 */
export async function getFacilityById(
  caseId: number
): Promise<USPVDBFacility | null>
```

**Response mapping:** The USPVDB API returns fields with varying naming conventions. Map API response fields to the `USPVDBFacility` interface in this module. If the API returns additional fields beyond what `USPVDBFacility` captures, ignore them.

**Error handling:** On failure, return empty array / null. Log error to console. Same pattern as EIA service — never throw.

**CORS note:** The USPVDB API may not include CORS headers for browser requests. If this is the case, route through the Vite proxy (add a second proxy route `/api/uspvdb`). Test during Phase 1 and add proxy config if needed.

---

## 5. Data Layer

### 5.1 `src/data/egridCrosswalk.ts`

**Purpose:** Maps eGRID subregion codes to EIA balancing authority respondent codes.

```typescript
export const SUBREGION_TO_BA: Record<string, string[]> = {
  // ... full mapping per Implementation Spec ...
};

/**
 * Returns the primary BA code for an eGRID subregion.
 * Returns null for subregions with no BA mapping (AK, HI, PR).
 */
export function getPrimaryBA(subregionCode: string): string | null {
  const bas = SUBREGION_TO_BA[subregionCode];
  return bas && bas.length > 0 ? bas[0] : null;
}

/**
 * Returns true if the subregion has at least one BA mapping.
 */
export function hasHourlyDataSupport(subregionCode: string): boolean {
  const bas = SUBREGION_TO_BA[subregionCode];
  return !!bas && bas.length > 0;
}

/**
 * Returns all subregions mapped to a given BA code.
 */
export function getSubregionsForBA(baCode: string): string[] {
  return Object.entries(SUBREGION_TO_BA)
    .filter(([_, bas]) => bas.includes(baCode))
    .map(([code]) => code);
}
```

**Implementation note:** The crosswalk in the Implementation Spec is a starting point. During Phase 1, the implementer MUST validate each BA code by making a test request to the EIA API (`fuel-type-data` endpoint with that respondent code). Any codes that return empty results should be replaced with the correct aggregated regional respondent code. Document corrections as code comments with the date verified.

### 5.2 `src/data/fuelEmissionFactors.ts`

```typescript
/**
 * Fuel-specific CO₂ emission factors in lbs CO₂/MWh.
 * Source: EPA eGRID 2023 national average output emission rates by fuel type.
 * These are used to derive hourly marginal emission rates from EIA grid mix data.
 */
export const FUEL_CO2_LBS_PER_MWH: Record<string, number> = {
  COL: 2230,     // coal
  NG:  900,      // natural gas
  OIL: 1620,     // petroleum/other fossil
} as const;

/** Fuels treated as zero-emission for displacement purposes. */
export const ZERO_EMISSION_FUELS = ['SUN', 'WND', 'NUC', 'WAT'] as const;

/** Version string for audit trail. */
export const FUEL_FACTORS_VERSION = 'epa_egrid_2023_avg';

/** EIA fuel type code → display label mapping. */
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
```

---

## 6. Domain Logic

### 6.1 `src/lib/marginalEmissions.ts` (new)

**Purpose:** Pure function that takes EIA hourly grid mix data and produces an hourly marginal emission rate for each hour.

```typescript
import { HourlyGridMix, FuelMixSnapshot } from '../types';
import { FUEL_CO2_LBS_PER_MWH, ZERO_EMISSION_FUELS } from '../data/fuelEmissionFactors';

export interface HourlyMarginalRate {
  hour: string;                         // ISO period
  marginalEmissionRate: number;         // lbs CO₂/MWh
  dominantFuel: 'coal' | 'gas' | 'oil' | 'none';
  fuelMix: FuelMixSnapshot;
}

/**
 * Derives hourly marginal emission rates from EIA grid mix data.
 *
 * For each hour:
 *   1. Sum fossil fuel generation: coal + gas + oil = fossilTotal
 *   2. If fossilTotal == 0: rate = 0 (grid was 100% clean)
 *   3. Else: rate = (coal×2230 + gas×900 + oil×1620) / fossilTotal
 *
 * This gives the generation-weighted average CO₂ intensity of the
 * fossil fuels that were running at that hour. When solar displaces
 * grid power, it proportionally displaces this mix.
 */
export function deriveHourlyMarginalRates(
  gridMix: HourlyGridMix[]
): HourlyMarginalRate[]
```

**Grouping logic:** The `gridMix` array contains one entry per fuel type per hour. The function must first group entries by period (hour), then sum by fuel category within each hour. Use a Map keyed by period string for efficient grouping.

**Edge cases:**
- Hours with zero fossil generation: marginalRate = 0, dominantFuel = 'none'
- Hours with only one fossil fuel type: marginalRate = that fuel's factor
- Missing hours (gaps in EIA data): do not interpolate — omit from output. The calculation engine will handle coverage validation separately.

### 6.2 `src/lib/calculation.ts` (rewrite)

**Preserve the existing function as `calculateDisplacementFlat`.** Add `calculateDisplacementHourly` and a router function.

```typescript
// ── Constants ───────────────────────────────────────────────────────

export const FORMULA_VERSION = 'cdm-ams-id-v1';           // existing, flat rate
export const FORMULA_VERSION_HOURLY = 'cdm-ams-id-v2-hourly';  // new, hourly marginal
export const LBS_PER_MT = 2204.62;                         // existing, unchanged
export const ADJUSTMENT_FACTOR = 1.0;                       // existing, unchanged

// ── Flat rate (renamed from existing calculateDisplacement) ─────────

export function calculateDisplacementFlat(
  facility: Facility,
  generationData: GenerationData
): Calculation
// Implementation: identical to current V1 logic.
// Sets mode: 'annual_flat', hourlyResults: null, fuelBreakdown: null.

// ── Hourly marginal (new) ───────────────────────────────────────────

export function calculateDisplacementHourly(
  facility: Facility,
  generationData: GenerationData,
  gridMixData: HourlyGridMix[]
): Calculation
// Implementation:
//   1. Call deriveHourlyMarginalRates(gridMixData) → HourlyMarginalRate[]
//   2. For each hour in generationData.hourlyRecords:
//      a. Find matching marginalRate from step 1
//      b. displacedLbs = generationMwh × marginalRate
//      c. displacedMt = displacedLbs / LBS_PER_MT
//      d. Determine dominantFuelDisplaced from the hour's fuel mix
//   3. Aggregate:
//      - rawMt = sum of all hourly displacedMt
//      - adjustedMt = rawMt × ADJUSTMENT_FACTOR
//      - fuelBreakdown = { coalMt, gasMt, oilMt, coalPct, gasPct, oilPct }
//   4. Build Calculation record with mode: 'hourly_marginal'
//
// Sets: mode, balancingAuthority, hourlyResults, fuelBreakdown, gridMixHash.
// Does NOT set fallbackReason (only set on flat-rate fallback).

// ── Router (called by Step 3 component) ─────────────────────────────

export function calculateDisplacement(
  facility: Facility,
  generationData: GenerationData,
  gridMixData: HourlyGridMix[] | null
): Calculation {
  if (gridMixData && gridMixData.length > 0 && generationData.hourlyRecords) {
    return calculateDisplacementHourly(facility, generationData, gridMixData);
  }
  const calc = calculateDisplacementFlat(facility, generationData);
  // Set fallbackReason based on what's missing
  calc.fallbackReason = !gridMixData || gridMixData.length === 0
    ? 'EIA hourly grid mix data unavailable for this period'
    : 'Generation data is daily without hourly resolution';
  return calc;
}

// ── Revenue projection (unchanged) ──────────────────────────────────

export function projectRevenue(
  adjustedMt: number,
  pricePerMt: number,
  feeRate?: number
): RevenueProjection
```

**Hour matching logic:** Generation records and grid mix records use different time formats. Generation hours are ISO 8601 (`"2024-06-15T14:00:00Z"`), EIA periods are truncated (`"2024-06-15T14"`). The matching function should normalize both to `YYYY-MM-DDTHH` before comparing. Hours in generation data without a matching grid mix entry should be calculated at the flat subregion rate and flagged individually in the hourly results.

### 6.3 `src/lib/csvParser.ts` (extend)

Add auto-detection of hourly vs. daily granularity and solar profile interpolation.

```typescript
// ── Existing (unchanged) ────────────────────────────────────────────

export interface CsvParseResult {
  success: boolean;
  records: GenerationRecord[];     // daily records (always populated)
  errors: string[];
  totalMwh: number;
  dateRange: { start: string; end: string } | null;
  granularity: DataGranularity;                        // NEW
  hourlyRecords: HourlyGenerationRecord[] | null;      // NEW
}

// ── Auto-detection logic ────────────────────────────────────────────
//
// Check the first column header and data values:
//   - If header is "datetime" or "hour" or "timestamp" → hourly
//   - If header is "date" → check values:
//     - If values contain "T" (e.g., "2024-06-15T14:00:00") → hourly
//     - If values are YYYY-MM-DD only → daily
//
// For hourly CSVs:
//   - Required columns: datetime (or hour/timestamp), mwh
//   - Parse directly into HourlyGenerationRecord[]
//   - Also aggregate into daily GenerationRecord[] for backward compat
//
// For daily CSVs:
//   - Parse as current V1 behavior (unchanged)
//   - Set hourlyRecords = null, granularity = 'daily'

// ── Solar profile interpolation ─────────────────────────────────────

/**
 * Distributes daily MWh across 24 hours using a solar generation profile.
 * Uses a bell curve centered on solar noon (hour 12) with generation
 * between hours 6–18 (6 AM to 6 PM).
 *
 * Profile weights (must sum to 1.0):
 *   Hour 6:  0.02    Hour 12: 0.14    Hour 18: 0.00
 *   Hour 7:  0.05    Hour 13: 0.14
 *   Hour 8:  0.08    Hour 14: 0.12
 *   Hour 9:  0.10    Hour 15: 0.10
 *   Hour 10: 0.12    Hour 16: 0.07
 *   Hour 11: 0.14    Hour 17: 0.04
 *   Hours 19-5: 0.00 (no solar generation at night)
 *
 * Returns HourlyGenerationRecord[] with 24 entries per day.
 */
export function interpolateDailyToHourly(
  dailyRecords: GenerationRecord[]
): HourlyGenerationRecord[]
```

**Important:** The interpolation profile is a simplified approximation. Real solar generation profiles vary by latitude, season, and panel tracking type. This is documented in the audit trail. The profile weights above are normalized to sum to 1.0 across the 13 daylight hours.

### 6.4 `src/lib/validation.ts` (extend)

Add new check category: **Hourly Data Coverage.** These checks only run when the calculation mode is `hourly_marginal`.

```typescript
// ── New checks (add to runReadinessValidation) ──────────────────────

// 6. Hourly Data Coverage (only when gridMixData exists)

// hourly_ba_alignment
// Severity: BLOCK
// Condition: facility's eGRID subregion has no BA in crosswalk
// Message: "No balancing authority mapping for subregion {code} — hourly calculation unavailable"

// hourly_eia_coverage
// Severity: BLOCK if < 80%, WARN if 80-90%, PASS if ≥ 90%
// Condition: count hours with grid mix data / total hours in generation period
// Message: "EIA data covers {X}% of generation period ({Y} of {Z} hours)"

// hourly_rate_sanity
// Severity: WARN
// Condition: any derived marginal rate outside 100–3000 lbs CO₂/MWh range
// Message: "{N} hours have marginal rates outside expected range (100–3000 lbs/MWh)"

// hourly_interpolation_flag
// Severity: WARN (never blocks)
// Condition: generationData.interpolated === true
// Message: "Generation data was interpolated from daily to hourly using standard solar profile"
```

---

## 7. State Management Changes

### 7.1 `src/hooks/useAppState.ts`

**New action types:**

```typescript
type Action =
  | { type: 'SET_FACILITY'; payload: Facility }
  | { type: 'SET_FACILITY_LOOKUP'; payload: USPVDBFacility | null }     // NEW
  | { type: 'SET_GENERATION_DATA'; payload: GenerationData }
  | { type: 'SET_GRID_MIX_DATA'; payload: HourlyGridMix[] | null }     // NEW
  | { type: 'SET_CALCULATION'; payload: Calculation }
  | { type: 'SET_READINESS'; payload: ReadinessResult }
  | { type: 'SET_REPORT_ARTIFACT'; payload: ReportArtifact }
  | { type: 'APPEND_AUDIT_EVENT'; payload: AuditEvent }
  | { type: 'GO_TO_STEP'; payload: 1 | 2 | 3 | 4 | 5 }
  | { type: 'RESET_FROM_STEP'; payload: 1 | 2 | 3 | 4 | 5 };
```

**Reset cascade update:** When `RESET_FROM_STEP` fires:
- Step ≤ 1: clear facility, facilityLookup, and everything downstream
- Step ≤ 2: clear generationData, gridMixData, and everything downstream
- Step ≤ 3: clear calculation, gridMixData (force re-fetch if re-calculating), and everything downstream

**Important:** `gridMixData` resets when generation data changes (because the date range may have changed) AND when facility changes (because the BA may have changed). It does NOT reset independently of those upstream changes.

### 7.2 `src/App.tsx`

**New handler functions:**

```typescript
// Step 1: facility lookup from USPVDB
function handleFacilityLookup(uspvdbFacility: USPVDBFacility, event: AuditEvent) {
  actions.setFacilityLookup(uspvdbFacility);
  actions.appendAuditEvent(event);
}

// Step 2 (after generation data committed): fetch EIA grid mix
async function handleGridMixFetch(
  balancingAuthority: string,
  startDate: string,
  endDate: string
) {
  const gridMix = await fetchHourlyGridMix(balancingAuthority, startDate, endDate);
  actions.setGridMixData(gridMix);

  if (gridMix.length > 0) {
    const event = createAuditEvent('grid_mix_data_fetched', {
      balancingAuthority,
      startDate,
      endDate,
      recordCount: gridMix.length,
      hash: await sha256Hex(JSON.stringify(gridMix)),
    });
    actions.appendAuditEvent(event);
  } else {
    const event = createAuditEvent('grid_mix_fetch_failed', {
      balancingAuthority,
      startDate,
      endDate,
      reason: 'EIA API returned no data or request failed',
    });
    actions.appendAuditEvent(event);
  }
}
```

**When to trigger grid mix fetch:** After generation data is committed in Step 2 AND a facility with a valid BA mapping exists. The fetch should be triggered automatically — not require a separate user action. Show a loading indicator in the Step 2 UI while fetching.

---

## 8. UI Component Changes

### 8.1 `FacilityOnboarding.tsx` — USPVDB Search-First

**Layout change:**
- Top section: search bar with placeholder "Search for your solar facility..."
- Below search: results list (facility name, state, capacity, year online)
- User clicks a result → form fields auto-populate
- Below results: "Can't find your facility? Enter details manually" link
- Clicking the link reveals the existing manual form (unchanged)

**Search behavior:**
- Debounce search input by 300ms
- Minimum 3 characters before triggering search
- Show loading spinner during USPVDB API call
- Map USPVDB result to form fields:
  - `p_name` → name
  - `p_cap_ac` → capacityMw
  - `p_year` → commercialOperationDate (use Jan 1 of that year as default)
  - Coordinates (`ylat`, `xlong`) → resolve to eGRID subregion (use a lat/lng-to-subregion lookup or let user confirm)

**eGRID subregion from coordinates:** This is a non-trivial mapping. For the MVP, present the USPVDB result and let the user confirm/select the eGRID subregion from the dropdown (pre-selecting the most likely match based on state). A full geospatial lookup can be added later.

### 8.2 `GenerationUpload.tsx` — Hourly Auto-Detect

**Changes:**
- After CSV parsing, display a badge showing detected granularity: "Hourly Data Detected" (green) or "Daily Data — Will Interpolate to Hourly" (amber)
- If daily data detected and interpolation will occur, show a brief explanation: "Daily generation values will be distributed across daylight hours using a standard solar profile for hourly marginal calculation."
- After commit, if facility has a valid BA mapping, automatically trigger EIA grid mix fetch. Show loading indicator: "Fetching hourly grid data from EIA for {BA_NAME}..."
- On fetch complete: show success badge with record count. On fetch failure: show amber warning that calculation will use flat rate.

### 8.3 `DisplacementCalculation.tsx` — Chart + Fuel Breakdown

**This is the largest UI change.** The current component shows a single card with the calculation result. V2 adds three new visual sections.

**Section 1: Methodology Badge** (new, above existing result card)
- If `mode === 'hourly_marginal'`: green badge "Hourly Marginal Displacement — {N} hours analyzed"
- If `mode === 'annual_flat'`: amber badge "Annual Flat Rate (Fallback) — {reason}"

**Section 2: Result Card** (existing, keep, minor updates)
- Total MT displaced, revenue projections — same as V1
- Add: balancing authority name, formula version, grid mix data hash

**Section 3: Displacement Over Time Chart** (new)
- `recharts` AreaChart showing daily aggregated displacement over the monitoring period
- X-axis: dates. Y-axis: MT CO₂ displaced.
- Color-coded by dominant fuel displaced (coal = dark gray, gas = blue-gray, oil = brown)
- Only rendered when `mode === 'hourly_marginal'`

**Section 4: Fuel Breakdown** (new)
- Three-column display: Coal | Natural Gas | Oil
- Each shows: MT displaced, % of total, icon
- Horizontal stacked bar showing proportions
- Only rendered when `mode === 'hourly_marginal'`

**Charting dependency:** Add `recharts` to the project. Import `AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer` from recharts.

**Data preparation for chart:** The `hourlyResults` array may have 8,760 entries. Aggregate to daily before passing to recharts: sum `displacedMtCo2` by date, determine `dominantFuelDisplaced` for each day by highest MT contribution.

### 8.4 `ReadinessValidation.tsx` — New Check Categories

**Changes:** Display the new "Hourly Data Coverage" check category alongside existing categories. No structural change to the component — the check results already render dynamically from the `ReadinessResult.checks` array. The new checks will appear automatically once added to `validation.ts`.

### 8.5 `ReportExport.tsx` — Hourly Metadata

**Changes:**
- Display calculation mode in the export summary
- No structural changes — the hourly data flows through the existing export pipeline via the `Calculation` record in state

---

## 9. Export Package Changes

### 9.1 PDF Report (`src/lib/pdfGenerator.ts`)

**Add a new section after the Displacement Calculation section:**

"Calculation Methodology" section:
- Mode: Hourly Marginal or Annual Flat Rate
- If hourly: balancing authority, hours analyzed, EIA data coverage %, grid mix data hash
- If flat (fallback): fallback reason, subregion rate used
- Fuel breakdown table (if hourly): coal MT / gas MT / oil MT / percentages

**Do NOT include the full hourly results array in the PDF.** The PDF is a summary document. The hourly detail goes in the JSON report only.

### 9.2 JSON Report (`src/lib/zipExport.ts`)

The `buildJsonReport` function serializes the `Calculation` object into the JSON report. The extended `Calculation` type automatically includes `hourlyResults`, `fuelBreakdown`, `mode`, `balancingAuthority`, and `gridMixHash`. No code change needed beyond what the type extension provides — the existing `JSON.stringify(calculation)` call will pick up the new fields.

**Size consideration:** A full year of `hourlyResults` (8,760 entries) serializes to approximately 2–3 MB of JSON. This is within the ZIP export's capabilities but the JSON report file will be significantly larger than V1. This is acceptable — verifiers need the hourly detail.

### 9.3 New Export File (optional, deferred)

Consider adding a `hourly_displacement.csv` to the export ZIP containing the hourly results as a flat CSV (hour, mwh, rate, mt, fuel). This makes the data directly importable into Excel for verifier review. This is a nice-to-have and can be added in Phase 5 if time permits.

---

## 10. Vite Proxy Configuration

```typescript
// vite.config.ts
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api/eia': {
          target: 'https://api.eia.gov/v2',
          changeOrigin: true,
          rewrite: (path) => {
            const cleaned = path.replace(/^\/api\/eia/, '');
            const separator = cleaned.includes('?') ? '&' : '?';
            return cleaned + separator + 'api_key=' + env.VITE_EIA_API_KEY;
          },
        },
        // Add USPVDB proxy if CORS blocks direct requests:
        // '/api/uspvdb': {
        //   target: 'https://energy.usgs.gov/api/uspvdb/v1',
        //   changeOrigin: true,
        //   rewrite: (path) => path.replace(/^\/api\/uspvdb/, ''),
        // },
      },
    },
  };
});
```

**`.env.example`:**
```
# EIA API key — register free at https://www.eia.gov/opendata/register.php
VITE_EIA_API_KEY=your_eia_api_key_here
```

**`.gitignore` addition:**
```
.env
.env.local
```

---

## 11. Testing Strategy

No test runner is currently configured. Until one is added, use these validation approaches:

**Phase 1 validation:**
- Call EIA API through Vite proxy and confirm data returns for PJM, ERCO, CISO
- Call USPVDB API for "Prairie Wolf" and confirm facility match
- Verify crosswalk: for each subregion with a BA mapping, confirm EIA returns data for that BA code

**Phase 2 validation:**
- Run both `calculateDisplacementFlat` and `calculateDisplacementHourly` against Prairie Wolf test data
- Flat rate should produce: ~144,778 MT (matching existing V1 output)
- Hourly rate will differ — document the delta and the reason (this is the whole point)
- Verify fuel breakdown percentages sum to 100%
- Verify that removing grid mix data from the router function correctly triggers flat-rate fallback

**Phase 4 validation:**
- Walk through full 5-step flow with USPVDB lookup → hourly CSV → hourly calculation → export
- Walk through fallback flow: daily CSV, no EIA data → flat rate with warning
- Verify chart renders with realistic data shapes
- Verify export ZIP contains hourly data in JSON report

---

## 12. Risk Register

| Risk | Impact | Mitigation |
|------|--------|------------|
| EIA API downtime during demo | Calculation falls back to flat rate, less impressive demo | Test fallback UX thoroughly; cache a known-good EIA response for demo backup |
| Crosswalk BA codes return no EIA data | Facility appears to have no hourly support | Validate all codes in Phase 1; use aggregated regional codes where individual utility codes fail |
| USPVDB API CORS blocks browser requests | Facility search doesn't work | Add Vite proxy for USPVDB; test early in Phase 1 |
| Hourly JSON report too large for some verifiers | Verifier can't open the JSON file | Add optional `hourly_displacement.csv` to export ZIP as a lightweight alternative |
| Solar interpolation profile misrepresents actual generation | Audit concern for interpolated data | Clearly flag interpolation in audit trail; document that hourly SCADA data is preferred |
| Hourly vs flat rate produces significantly different MT | Could raise questions about V1 report accuracy | Frame as methodology improvement, not correction; document both results in report |

---

*CarbonLens V2 Technical Design Document — March 2026*
