# CarbonLens Architecture

## Overview
CarbonLens is a client-side single-page app built with Vite + React + TypeScript. It implements a deterministic 5-step MRV flow for solar carbon documentation:
1. Facility onboarding (with USPVDB search-first lookup)
2. Generation CSV upload (auto-detects hourly vs. daily)
3. CO₂ displacement calculation (hourly marginal with flat-rate fallback)
4. Readiness validation (includes hourly data coverage checks)
5. Report generation/export (PDF/CSV/ZIP with hourly data included)

There is no backend or database. All state is held in-memory in React (`useReducer`) and is lost on page refresh.

## Project Architecture
The app uses a layered structure:
- UI layer: React components in `src/components/`
- State orchestration layer: `src/App.tsx` + `src/hooks/useAppState.ts`
- Domain logic layer: pure utilities in `src/lib/`
- Service layer: external API clients in `src/services/` (only layer that makes HTTP requests)
- Data/constants layer: static datasets and crosswalk tables in `src/data/`
- Domain model layer: shared interfaces in `src/types/index.ts`

`src/App.tsx` is the workflow controller: it renders one step at a time, wires callbacks from step components, appends audit events, and triggers EIA grid mix fetches automatically after generation data is committed.

## System Diagram
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
│  │ (existing)   │  │ (subregion→BA)   │  │ Factors.ts   │ │
│  └──────┬───────┘  └────────┬─────────┘  └──────┬──────┘ │
└─────────┼───────────────────┼───────────────────┼─────────┘
          │                   │                   │
          ▼                   ▼                   ▼
┌──────────────────────────────────────────────────────────┐
│  DOMAIN LOGIC — src/lib/                                  │
│  ┌───────────────┐  ┌──────────────────┐  ┌───────────┐ │
│  │ calculation.ts │  │ marginalEmissions│  │ csvParser  │ │
│  │ (flat+hourly)  │  │ .ts              │  │ .ts        │ │
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

### Diagram Data Flow
User actions in step components flow through `App.tsx` into `useAppState` actions. Steps call pure utilities (`csvParser`, `calculation`, `validation`) and commit typed results back to state. After generation data is committed in Step 2, `App.tsx` automatically resolves the facility's eGRID subregion to an EIA balancing authority via `egridCrosswalk.ts`, fetches hourly grid mix data from the EIA API via `eia.ts`, and stores it in state. In Step 3, the calculation engine receives both generation data and grid mix data and routes to the appropriate path. In Step 5, the current state snapshot is used to generate the PDF, JSON, CSV, and audit files; `zipExport` hashes artifacts, builds a manifest, and produces the downloadable ZIP package.

## Major Folder Roles
- `src/components/Layout/`: shell components (`Header`, `StepNav`)
- `src/components/steps/`: one component per workflow step
- `src/components/ui/`: reusable primitives (`Button`, `Card`, etc.)
- `src/hooks/`: global app-state hook (`useAppState`)
- `src/services/`: external API clients
  - `eia.ts`: EIA API v2 client — fetches hourly generation-by-fuel-type data for a balancing authority; handles pagination and returns empty array on failure
  - `uspvdb.ts`: USPVDB facility search client — searches by project name/state; no auth required
- `src/lib/`: core logic
  - `calculation.ts`: displacement + revenue projection math (flat-rate and hourly marginal paths, plus router function)
  - `marginalEmissions.ts`: derives hourly marginal emission rates from EIA grid mix data
  - `csvParser.ts`: CSV parsing, auto-detection of hourly vs. daily granularity, solar profile interpolation
  - `validation.ts`: readiness checks across 5 categories (including hourly data coverage)
  - `pdfGenerator.ts`: PDF report rendering (includes hourly methodology section)
  - `zipExport.ts`: export package + manifest assembly
  - `auditLog.ts`, `crypto.ts`: event and hashing utilities
- `src/data/`: versioned static datasets
  - `egrid.ts`: EPA eGRID 2023 emission factors by subregion
  - `egridCrosswalk.ts`: maps eGRID subregion codes to EIA balancing authority respondent codes
  - `fuelEmissionFactors.ts`: fuel-specific CO₂ emission factors (coal, gas, oil) used for hourly marginal calculation
- `src/types/`: canonical data contracts (`Facility`, `GenerationData`, `Calculation`, `HourlyDisplacement`, `FuelBreakdown`, `USPVDBFacility`, etc.)
- `assets/`: static media

## Main Data Flow
1. `main.tsx` mounts `App`.
2. `App` initializes `useAppState` (single state store + actions).
3. Each step component collects input, calls pure functions in `src/lib/`, then emits typed results and audit events back to `App`.
4. `App` stores artifacts in state (`facility`, `generationData`, `gridMixData`, `calculation`, `readiness`, `reportArtifact`) and appends events to `auditLog`.
5. `StepNav` unlocks steps based on derived state.
6. Step 5 generates output files (PDF/JSON/CSV/audit/manifest) and downloads a ZIP.

State reset rules are enforced when upstream inputs change (for example, re-uploading generation data clears downstream calculation/validation/report state, and also clears `gridMixData` to force a re-fetch).

## Carbon Calculation Logic
Primary logic lives in `src/lib/calculation.ts`. Two calculation paths are supported:

### Flat-Rate Path (`calculateDisplacementFlat`)
Used when EIA hourly grid mix data is unavailable or generation data has no hourly records.
- Formula: `CO₂ MT = (totalMwh × co2LbsPerMwh) / 2204.62`
- Emission factor: eGRID subregion annual average rate from `src/data/egrid.ts`
- Formula version: `cdm-ams-id-v1`
- Output: `Calculation` with `mode: 'annual_flat'`, `fallbackReason` populated, `hourlyResults: null`, `fuelBreakdown: null`

### Hourly Marginal Path (`calculateDisplacementHourly`)
Used when EIA hourly grid mix data is available and generation data contains hourly records.
- For each hour: `displacedMt = generationMwh × marginalEmissionRate / 2204.62`
- Marginal rate derived in `src/lib/marginalEmissions.ts`: generation-weighted fossil fuel CO₂ intensity for that hour using fuel factors from `src/data/fuelEmissionFactors.ts`
- Formula version: `cdm-ams-id-v2-hourly`
- Output: `Calculation` with `mode: 'hourly_marginal'`, full `hourlyResults` array, `fuelBreakdown` aggregate, `gridMixHash` (SHA-256 of EIA data snapshot)

### Router (`calculateDisplacement`)
Called by Step 3. If `gridMixData` is non-empty and `hourlyRecords` are present, routes to the hourly path. Otherwise routes to flat-rate and sets `fallbackReason`. Never throws — always returns a valid `Calculation`.

All constants are versioned in code (`FORMULA_VERSION`, `FORMULA_VERSION_HOURLY`, `LBS_PER_MT`, `ADJUSTMENT_FACTOR`). Validation of calculation integrity happens separately in `src/lib/validation.ts`.

## 5-Step Workflow Mechanics
1. `FacilityOnboarding`: user searches USPVDB for their facility (debounced, 3-char minimum); selecting a result auto-populates the form and fires `facility_lookup_completed`. User confirms/adjusts the eGRID subregion and submits; logs `facility_created`.
2. `GenerationUpload`: parses/validates CSV, auto-detects granularity (hourly vs. daily). Hashes raw content (SHA-256) and commits generation dataset (logs `generation_data_uploaded`). App then resolves the eGRID subregion → balancing authority via `egridCrosswalk.ts` and automatically fetches EIA hourly grid mix; logs `grid_mix_data_fetched` on success or `grid_mix_fetch_failed` on error.
3. `DisplacementCalculation`: router function checks grid mix data availability. If available: `calculateDisplacementHourly` → displays time-series chart and fuel breakdown. If unavailable: `calculateDisplacementFlat` (fallback) → displays amber warning badge. Logs `calculation_executed`. If fallback path taken, additionally logs `calculation_mode_fallback` with the reason.
4. `ReadinessValidation`: runs deterministic checks across 5 categories — data completeness, generation sanity, factor alignment, calculation integrity, audit integrity — plus (when in hourly mode) hourly data coverage checks: BA alignment, EIA coverage percentage, marginal rate sanity, interpolation flag. Logs `readiness_validation_run`.
5. `ReportExport`: builds report package (`buildExportPackage`) and ZIP download (`downloadExportZip`). PDF includes a Calculation Methodology section with mode, BA, coverage stats, and fuel breakdown. JSON report includes full `hourlyResults` array. Logs `report_generated` and `report_exported`.

## Future Feature Placement (Credit Listing / Transactions)
For marketplace features, keep the same separation:
- Domain models: add `CreditLot`, `Listing`, `Offer`, `Transaction` in `src/types/`.
- Domain logic: add pricing/listing/settlement utilities in new `src/lib/marketplace/` modules.
- UI flow: add new `src/components/steps/` screens after export or as a second workflow track.
- State orchestration: extend `useAppState` with marketplace slices and actions.

If persistence/API integration is introduced, add a data-access layer (for example `src/services/`) so API calls remain separate from UI and pure calculation logic.
