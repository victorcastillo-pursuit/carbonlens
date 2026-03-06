# CarbonLens V2 — Implementation Spec

**Status:** Approved — Ready for Claude Code implementation
**Owner:** Edwin Perez, Victor Castillo, Luba Kaper
**Date:** March 2026

---

## What This Document Is

This is the approved implementation plan for upgrading CarbonLens from flat-rate annual displacement to hourly marginal displacement. All design decisions have been made. The Claude Code team should treat this as the authoritative spec for V2 changes.

Reference documents: `PRD.md` (existing, still valid), `ARCHITECTURE.md` (existing, update after implementation), `TDD.md` (to be created based on this spec).

---

## Scope of V2

**What's changing:**
- Calculation engine upgrades from flat annual rate to hourly marginal displacement
- Facility onboarding adds USPVDB-powered search and auto-population
- Generation upload auto-detects hourly vs. daily CSV format
- Step 3 UI shows hourly displacement chart and fuel breakdown
- New service layer for EIA and USPVDB API calls
- New crosswalk data connecting eGRID subregions to EIA balancing authorities

**What's NOT changing:**
- The 5-step workflow structure (no new steps, no removed steps)
- Pure functions in `src/lib/` (no API calls inside domain logic)
- The audit trail pattern (extend, don't replace)
- SHA-256 hashing of inputs (extend to include EIA data snapshots)
- The export package format (PDF + JSON + CSV + audit + manifest ZIP)
- No backend, no database, no auth (all remain out of scope)

---

## Approved Design Decisions

### 1. Calculation Mode: Smart Default with Fallback

Default to hourly marginal calculation when EIA data is available. Auto-fall-back to flat annual rate when EIA data is unavailable (API down, time period not covered, etc.). Display a visible warning banner when fallback is active. The mode is informational, not a user choice — the system picks the best available method. The audit trail records which mode was used and why.

### 2. Facility Onboarding: Search-First UX

Replace the current manual-entry-first flow with a USPVDB search bar as the primary entry point. User types facility name → USPVDB returns matches → user selects one → form fields auto-populate (name, capacity, state, coordinates → eGRID subregion). A "Can't find your facility? Enter details manually" link below the search results falls back to the current manual form. The manual form remains identical to the current implementation.

### 3. CSV Format: Auto-Detect with Interpolation

The parser auto-detects whether the uploaded CSV contains hourly data (datetime with hours) or daily data (date only). If hourly, use directly for marginal calculation. If daily, distribute MWh across daylight hours using a standard bell-curve solar generation profile, flag as `interpolated` in the audit trail, and proceed with marginal calculation. The audit trail transparently records whether data was native hourly or interpolated.

### 4. Step 3 UI: Summary + Chart + Fuel Breakdown

The displacement calculation screen expands to show:
- Total MT displaced (existing, keep)
- Revenue projections at $7/MT and $20/MT (existing, keep)
- **New:** Calculation methodology badge ("Hourly Marginal" or "Annual Flat Rate — Fallback")
- **New:** Time-series area chart showing displacement by day/week over the monitoring period
- **New:** Fuel displacement breakdown — percentage and MT of coal vs. gas vs. oil displaced
- **New:** Peak displacement hours summary ("highest displacement: 2–5 PM, displacing primarily coal")

Use `recharts` for charting. Add as a project dependency.

### 5. API Key Handling: Vite Proxy

Use Vite's dev server proxy to forward EIA API requests, keeping the key in `.env` (server-side only). Add a `.env.example` file documenting the required variable. This works for local dev and demos. Production deployment will require a serverless proxy function (future scope).

### 6. Dependencies

Add `recharts` for charting in Step 3. Use native `fetch` for API calls — no new HTTP library needed.

---

## New File Structure

```
src/
  services/                         ← NEW directory
    eia.ts                          ← EIA API client (hourly gen mix by BA)
    uspvdb.ts                       ← USPVDB facility search client
  data/
    egrid.ts                        ← EXISTING — no changes needed
    egridCrosswalk.ts               ← NEW — subregion → balancing authority map
    fuelEmissionFactors.ts          ← NEW — fuel-specific CO₂ rates
  lib/
    calculation.ts                  ← EXISTING — rewrite (preserve old logic as fallback)
    marginalEmissions.ts            ← NEW — derive hourly marginal rate from grid mix
    csvParser.ts                    ← EXISTING — extend for hourly auto-detect
    validation.ts                   ← EXISTING — add new readiness checks
    pdfGenerator.ts                 ← EXISTING — extend for hourly data in reports
    zipExport.ts                    ← EXISTING — extend export with hourly data
  types/
    index.ts                        ← EXISTING — extend with new interfaces
  hooks/
    useAppState.ts                  ← EXISTING — extend with new state slices
  components/
    steps/
      FacilityOnboarding.tsx        ← EXISTING — add USPVDB search UI
      GenerationUpload.tsx          ← EXISTING — add hourly auto-detect feedback
      DisplacementCalculation.tsx   ← EXISTING — add chart + fuel breakdown
      ReadinessValidation.tsx       ← EXISTING — display new check categories
      ReportExport.tsx              ← EXISTING — minor updates for hourly metadata
```

Root-level changes:
```
.env.example                        ← NEW — documents VITE_EIA_API_KEY
vite.config.ts                      ← MODIFY — add EIA proxy config
package.json                        ← MODIFY — add recharts dependency
```

---

## Type Definitions to Add

Add these to `src/types/index.ts`:

```typescript
// ── Hourly data structures ──────────────────────────────────────────

export interface HourlyGenerationRecord {
  hour: string;    // ISO datetime "2024-06-15T14:00:00Z"
  mwh: number;
}

export interface HourlyGridMix {
  period: string;             // "2024-06-15T14"
  respondent: string;         // EIA BA code e.g. "PJM"
  fueltype: string;           // "COL" | "NG" | "OIL" | "SUN" | "WND" | "NUC" | "WAT" | "OTH"
  value: number;              // MWh
}

export interface HourlyDisplacement {
  hour: string;
  generationMwh: number;
  marginalEmissionRate: number;   // lbs CO₂/MWh (weighted avg of fossil fuels on grid)
  displacedLbsCo2: number;
  displacedMtCo2: number;
  dominantFuelDisplaced: string;  // "coal" | "gas" | "oil"
  fuelMixSnapshot: {              // what the grid was burning that hour
    coal: number;                 // MWh
    gas: number;
    oil: number;
    total: number;
  };
}

export type CalculationMode = 'hourly_marginal' | 'annual_flat';
export type DataGranularity = 'hourly' | 'daily';

// ── USPVDB types ────────────────────────────────────────────────────

export interface USPVDBFacility {
  case_id: number;
  p_name: string;
  p_state: string;
  p_county: string;
  p_cap_ac: number;       // MW AC
  p_cap_dc: number;       // MW DC
  ylat: number;
  xlong: number;
  p_tech_p: string;       // panel technology
  p_axis: string;         // axis/tracking type
  p_year: number;         // year online
}

// ── Extended existing types ─────────────────────────────────────────

// Extend GenerationData:
//   Add: granularity: DataGranularity
//   Add: hourlyRecords: HourlyGenerationRecord[] | null
//   Add: interpolated: boolean

// Extend Calculation:
//   Add: mode: CalculationMode
//   Add: balancingAuthority: string | null
//   Add: hourlyResults: HourlyDisplacement[] | null
//   Add: fuelBreakdown: { coal: number; gas: number; oil: number } | null
//   Add: fallbackReason: string | null   (populated when mode is 'annual_flat')

// Extend AppState:
//   Add: gridMixData: HourlyGridMix[] | null
//   Add: facilityLookup: USPVDBFacility | null
```

---

## Service Layer Specifications

### `src/services/eia.ts`

**Purpose:** Fetch hourly generation-by-fuel-type data from EIA API v2.

**Key constraints:**
- API returns max 5,000 rows per request. A full year of hourly data for one BA across 8 fuel types = ~70,000 rows. Paginate by month or quarter.
- All dates in EIA API are UTC.
- The proxy route `/api/eia` forwards to `https://api.eia.gov/v2/` with the API key injected server-side via Vite proxy.

**Functions to implement:**
- `fetchHourlyGridMix(balancingAuthority: string, startDate: string, endDate: string): Promise<HourlyGridMix[]>` — handles pagination internally, returns the full dataset
- Internal helper for pagination: fetch in chunks, concatenate results, deduplicate by period+fueltype

**Error handling:** If the EIA API returns an error or times out, the function should return an empty array (not throw). The calculation engine treats empty grid mix data as a signal to fall back to flat rate.

### `src/services/uspvdb.ts`

**Purpose:** Search USPVDB for facility records by name, state, or capacity.

**Key constraints:**
- Base URL: `https://energy.usgs.gov/api/uspvdb/v1/`
- No authentication needed for GET requests.
- Return type should be filtered to relevant fields only.

**Functions to implement:**
- `searchFacilities(query: string, state?: string): Promise<USPVDBFacility[]>` — searches by project name, optionally filtered by state
- `getFacilityById(caseId: number): Promise<USPVDBFacility | null>` — fetch a specific facility record

---

## Crosswalk Data: `src/data/egridCrosswalk.ts`

This is the lookup table that connects eGRID subregion codes (used for emission factors) to EIA balancing authority respondent codes (used for hourly grid mix data). Without this, the hourly calculation can't work.

```typescript
// Maps eGRID subregion → primary EIA balancing authority code(s)
export const SUBREGION_TO_BA: Record<string, string[]> = {
  AKGD: [],              // Alaska — no EIA hourly data
  AKMS: [],              // Alaska — no EIA hourly data
  AZNM: ["SRP", "AZPS", "PNM"],
  CAMX: ["CISO"],
  ERCT: ["ERCO"],
  FRCC: ["FPC", "FPL", "JEA", "SEC", "TEC", "TAL", "HST", "GVL", "NSB"],
  HIOA: [],              // Hawaii — no EIA hourly data
  HIMS: [],              // Hawaii — no EIA hourly data
  MROE: ["MISO"],
  MROW: ["MISO", "SWPP"],
  NEWE: ["ISNE"],
  NWPP: ["BPAT", "PACW", "PSEI", "AVA", "CHPD", "DOPD", "GCPD", "TPWR"],
  NYCW: ["NYIS"],
  NYLI: ["NYIS"],
  NYUP: ["NYIS"],
  RFCE: ["PJM"],
  RFCM: ["PJM", "MISO"],
  RFCW: ["PJM", "MISO"],
  RMPA: ["PSCO", "WACM"],
  SPNO: ["SWPP"],
  SPSO: ["SWPP"],
  SRMV: ["MISO"],
  SRMW: ["MISO"],
  SRSO: ["SOCO"],
  SRTV: ["TVA"],
  SRVC: ["CPLE", "DUK", "SC", "SCEG"],
  PRMS: [],              // Puerto Rico — no EIA hourly data
};

// Reverse lookup: BA → subregion (for validation)
export function getSubregionsForBA(baCode: string): string[] { ... }

// Primary BA for a subregion (first in the array, used as default for EIA queries)
export function getPrimaryBA(subregionCode: string): string | null { ... }
```

**Important:** This crosswalk is approximate. Some eGRID subregions span multiple BAs, and some BAs span multiple subregions. For the MVP, use the primary (first) BA in the array. The audit trail should record which BA was used.

---

## Calculation Engine: `src/lib/marginalEmissions.ts`

**Purpose:** Pure function that takes hourly grid mix data and returns an hourly marginal emission rate.

**Logic:**
```
For each hour h:
  1. Sum fossil fuel generation: coalMwh + gasMwh + oilMwh = fossilTotal
  2. If fossilTotal == 0: marginalRate = 0 (grid was 100% clean that hour)
  3. Else: marginalRate = (coalMwh × COAL_FACTOR + gasMwh × GAS_FACTOR + oilMwh × OIL_FACTOR) / fossilTotal
  4. This gives a generation-weighted average emission rate for fossil fuels on the grid that hour
```

**Fuel emission factors** (in `src/data/fuelEmissionFactors.ts`):
```typescript
export const FUEL_CO2_LBS_PER_MWH = {
  COL: 2230,     // coal
  NG:  900,      // natural gas
  OIL: 1620,     // petroleum
} as const;

export const FUEL_FACTORS_VERSION = 'epa_egrid_2023_avg';
```

---

## Updated Calculation Flow in `src/lib/calculation.ts`

Preserve the existing `calculateDisplacement` function but rename it to `calculateDisplacementFlat`. Add the new hourly function alongside it.

```typescript
// Existing (renamed):
export function calculateDisplacementFlat(facility, generationData): Calculation

// New:
export function calculateDisplacementHourly(
  facility: Facility,
  generationData: GenerationData,
  gridMixData: HourlyGridMix[]
): Calculation

// Router function (called by Step 3):
export function calculateDisplacement(
  facility: Facility,
  generationData: GenerationData,
  gridMixData: HourlyGridMix[] | null
): Calculation {
  if (gridMixData && gridMixData.length > 0) {
    return calculateDisplacementHourly(facility, generationData, gridMixData);
  }
  return calculateDisplacementFlat(facility, generationData);
}
```

**Formula versioning:**
- Flat rate: `FORMULA_VERSION = 'cdm-ams-id-v1'` (existing, unchanged)
- Hourly marginal: `FORMULA_VERSION_HOURLY = 'cdm-ams-id-v2-hourly'`

---

## New Readiness Checks in `src/lib/validation.ts`

Add a new check category: **Hourly Data Coverage**

- `hourly_eia_coverage`: If calculation mode is hourly, check that grid mix data exists for ≥90% of the hours in the generation period. WARN if 80–90% coverage, BLOCK if <80%.
- `hourly_ba_alignment`: Check that the facility's eGRID subregion maps to at least one balancing authority in the crosswalk. BLOCK if no BA mapping exists (Alaska, Hawaii, Puerto Rico).
- `hourly_rate_sanity`: Check that derived marginal rates fall within 100–3000 lbs CO₂/MWh. WARN if any hour is outside this range.
- `hourly_interpolation_flag`: If generation data was interpolated from daily to hourly, WARN (not block) with message explaining the interpolation.

---

## Vite Proxy Configuration

Update `vite.config.ts`:
```typescript
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
          rewrite: (path) => path.replace(/^\/api\/eia/, '') + `&api_key=${env.VITE_EIA_API_KEY}`,
        },
      },
    },
  };
});
```

Create `.env.example`:
```
VITE_EIA_API_KEY=your_eia_api_key_here
```

---

## Implementation Sequence

Build in this order. Each phase should be a separate branch/PR.

**Phase 1 — Data Foundation** (no UI changes)
1. Add new types to `src/types/index.ts`
2. Create `src/data/egridCrosswalk.ts`
3. Create `src/data/fuelEmissionFactors.ts`
4. Create `src/services/eia.ts`
5. Create `src/services/uspvdb.ts`
6. Update `vite.config.ts` with proxy
7. Add `.env.example`
8. Install `recharts`: `npm install recharts`

**Phase 2 — Calculation Engine** (no UI changes)
9. Create `src/lib/marginalEmissions.ts`
10. Refactor `src/lib/calculation.ts` — rename old function, add hourly function, add router
11. Extend `src/lib/csvParser.ts` — hourly auto-detection + interpolation
12. Extend `src/lib/validation.ts` — add hourly readiness checks
13. Verify: both engines produce valid output for Prairie Wolf test data

**Phase 3 — State & Wiring** (no visual changes)
14. Extend `useAppState.ts` — new slices, actions, reset cascade
15. Update `App.tsx` — new handlers for grid mix data, facility lookup, calculation mode

**Phase 4 — UI Updates**
16. `FacilityOnboarding.tsx` — USPVDB search-first UI
17. `GenerationUpload.tsx` — hourly auto-detect feedback
18. `DisplacementCalculation.tsx` — chart, fuel breakdown, mode badge
19. `ReadinessValidation.tsx` — new check categories displayed
20. `ReportExport.tsx` — hourly metadata in exports

**Phase 5 — Docs & Demo Prep**
21. Update `AGENTS.md`
22. Update `ARCHITECTURE.md`
23. Write PRD Addendum
24. Test against 3 real facilities in high-emission subregions

---

## Invariants — Do NOT Break These

- The 5-step workflow structure
- Pure functions in `src/lib/` — no API calls inside domain logic
- The audit trail — every state change logs an event with full payload
- SHA-256 hashing of all inputs
- Backward compatibility — a daily CSV with no EIA data must still produce a valid flat-rate report
- Deterministic, versioned calculations — same inputs always produce same outputs
- The export package format — PDF + JSON + CSV + audit trail + manifest in ZIP

---

*CarbonLens V2 Implementation Spec — Approved March 2026*
