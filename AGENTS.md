# Repository Guidelines

## Project Structure & Module Organization
CarbonLens is a Vite + React + TypeScript app.
- `src/main.tsx` bootstraps the app; `src/App.tsx` orchestrates the 5-step workflow.
- `src/components/` contains UI and step screens (`Layout/`, `steps/`, `ui/`).
- `src/lib/` contains domain logic and utilities (calculation, validation, CSV/PDF/ZIP, crypto, audit logging).
- `src/services/` contains external API clients (EIA, USPVDB). These are the ONLY modules that make network requests. Domain logic in `src/lib/` must never call APIs directly.
- `src/hooks/` stores stateful React hooks (`useAppState.ts`).
- `src/data/` contains static datasets and reference tables (eGRID emission factors, subregion-to-BA crosswalk, fuel emission factors).
- `src/types/` centralizes shared TypeScript types.
- `assets/` contains static media.

## Build, Test, and Development Commands
Install dependencies:
```bash
npm install
```
Run local dev server:
```bash
npm run dev
```
Create production build (TypeScript check + Vite build):
```bash
npm run build
```
Preview the production bundle locally:
```bash
npm run preview
```

## Environment Variables
Copy `.env.example` to `.env` and fill in required values:
- `VITE_EIA_API_KEY` — EIA API key (free, register at https://www.eia.gov/opendata/register.php). Used by the Vite dev server proxy to forward requests to `api.eia.gov`. Never exposed to client-side code.

The Vite proxy config in `vite.config.ts` injects the API key server-side. In production, a serverless proxy function or backend service must handle this instead.

## Coding Style & Naming Conventions
- Use TypeScript for all new logic and React components.
- Follow existing formatting: semicolons are common in most `src/` files, 2-space indentation in TS/TSX.
- Components/types use `PascalCase`; functions/variables use `camelCase`; constants use `UPPER_SNAKE_CASE`.
- Keep pure business logic in `src/lib/` and keep components focused on UI/state wiring.
- Use descriptive filenames matching exports (for example `DisplacementCalculation.tsx`, `auditLog.ts`).

## Testing Guidelines
There is currently no test runner configured. Until one is added:
- Validate changes with `npm run build` and manual checks through the step flow in `npm run dev`.
- For logic-heavy changes, prefer adding testable pure functions in `src/lib/`.
- If adding tests, place them near source files as `*.test.ts` / `*.test.tsx` and document the new command in `package.json`.

## Commit & Pull Request Guidelines
Git history currently uses concise, imperative-style messages (for example: `Initial project commit: CarbonLens MVP`, `Add PRD for CarbonLens MVP`).
- Use clear commit subjects describing intent and scope.
- Keep commits focused; avoid mixing refactors and behavior changes.
- PRs should include: summary, key files changed, manual test steps, and screenshots for UI changes.
- Link related issues or product notes (for example `PRD.md`) when applicable.

## Security & Configuration Tips
- Do not commit secrets, API keys, or sensitive facility/customer data.
- The EIA API key lives in `.env` and is injected via Vite proxy — never import it in client-side code.
- Keep generated report artifacts and temporary exports out of version control.
- Review CSV/PDF/ZIP handling paths in `src/lib/` when introducing new file inputs.

## Development workflow
- Always create a new branch before implementing features
- Never push directly to main

## Product context
CarbonLens is a digital MRV (Measurement, Reporting, Verification) platform for utility-scale solar operators seeking carbon credit documentation. It automates the process of converting solar generation data into registry-ready carbon displacement reports.

The V2 upgrade introduces hourly marginal displacement calculation using EIA grid mix data, USPVDB facility lookup, and enhanced eGRID crosswalk data. This replaces the V1 flat annual emission rate approach with time-resolved displacement that accounts for what fuel the grid was burning at each hour.

## Architecture Overview
CarbonLens is a client-side application that guides a user through a 5-step workflow for carbon credit documentation. There is no backend or database — all state is held in-memory via React `useReducer` and resets on page refresh.

High level flow:
1. Facility onboarding (with USPVDB search-first lookup)
2. Generation data upload (auto-detects hourly vs. daily CSV)
3. Carbon displacement calculation (hourly marginal with flat-rate fallback)
4. Readiness validation (includes hourly data coverage checks)
5. Report export (PDF/CSV/ZIP with hourly data included)

### Layer Separation
- **UI layer:** `src/components/` — React components, rendering, user interaction
- **State layer:** `src/hooks/useAppState.ts` — central state store via `useReducer`
- **Domain logic layer:** `src/lib/` — pure functions for calculation, validation, parsing, export. NO network requests in this layer.
- **Service layer:** `src/services/` — external API clients (EIA, USPVDB). ONLY layer that makes HTTP requests.
- **Data layer:** `src/data/` — static datasets, crosswalk tables, versioned emission factors
- **Type layer:** `src/types/` — shared TypeScript interfaces and type definitions

### Data Flow for Hourly Calculation
1. User selects facility in Step 1 → eGRID subregion resolved
2. Subregion mapped to EIA balancing authority via crosswalk (`src/data/egridCrosswalk.ts`)
3. EIA service fetches hourly grid mix for that BA and time period (`src/services/eia.ts`)
4. User uploads generation CSV in Step 2 → parser auto-detects granularity
5. Step 3: calculation engine receives generation data + grid mix data → produces hourly displacement array + summary
6. If EIA data unavailable: automatic fallback to flat annual rate with audit flag

## AI Agent Instructions
When modifying this repository:

- Prefer extending existing utilities in `src/lib/` rather than duplicating logic.
- Avoid placing calculation logic inside React components.
- Keep components focused on UI rendering and state wiring.
- If adding new domain logic, create pure functions that can be easily tested.
- Maintain the existing step-based workflow implemented in `App.tsx`.
- Ensure any new file-processing logic (CSV/PDF/ZIP) remains deterministic and auditable.
- **Never place API calls inside `src/lib/` functions.** All HTTP requests must go through `src/services/`. Domain logic receives data as function arguments.
- **Never import or reference the EIA API key in client-side code.** All EIA requests route through the Vite dev proxy at `/api/eia`.
- **Preserve backward compatibility.** A daily CSV with no EIA data must still produce a valid flat-rate report using the existing formula.
- **Version all calculations.** The flat-rate formula uses `cdm-ams-id-v1`. The hourly marginal formula uses `cdm-ams-id-v2-hourly`. Both versions must be recorded in calculation records.
- **Log everything.** Every state change, API fetch, calculation execution, and mode fallback must produce an audit event with a full payload snapshot.

## Feature Development Pattern
New features should follow this structure:

1. Types defined or extended in `src/types/`
2. Static data or reference tables added to `src/data/`
3. Service clients (if external API needed) added to `src/services/`
4. Domain logic implemented as pure functions in `src/lib/`
5. State slices and actions added to `src/hooks/useAppState.ts`
6. React UI added or updated in `src/components/`
7. Workflow integration wired in `App.tsx`

## Domain Concepts
Key concepts used in this project:

- **Displacement Calculation:** Estimating avoided carbon emissions based on energy displacement. V2 supports both flat annual rate and hourly marginal rate methodologies.
- **Hourly Marginal Displacement:** Calculating displacement hour-by-hour based on the actual fuel mix on the grid at each hour. Solar generation during coal-heavy hours displaces more CO₂ than during gas-heavy hours.
- **eGRID Dataset:** EPA emissions factors by subregion — the baseline emission rate for each grid region.
- **eGRID-to-BA Crosswalk:** Mapping table that connects eGRID subregion codes to EIA balancing authority codes. Required to link static emission factors to hourly grid operations data.
- **EIA Hourly Grid Mix:** Real-time (1-day lag) hourly generation data by fuel type per balancing authority, from EIA Form 930. This is what tells us whether the grid was burning coal or gas at a given hour.
- **USPVDB:** USGS/Berkeley Lab database of all U.S. ground-mounted solar facilities ≥1 MW. Used for facility lookup and auto-population.
- **Calculation Mode Fallback:** When hourly EIA data is unavailable, the system falls back to flat annual rate calculation and flags this in the audit trail. This ensures the workflow never blocks due to external API issues.
- **Verification Report:** Generated documentation package (PDF + JSON + CSV + audit trail + manifest) for registry submission.

## Long-Term Product Direction

CarbonLens aims to evolve beyond a carbon calculation and reporting tool into a simplified marketplace for carbon credits focused on small and mid-size producers.

The long-term goal is to simplify the full lifecycle of carbon credits:

- calculate carbon reductions (V1 complete, V2 hourly upgrade in progress)
- generate verification-ready documentation (V1 complete)
- list carbon credits for sale (future)
- discover potential buyers (future)
- complete simplified credit transactions (future)
- integrate with carbon registries or external marketplaces (future)

## Reference: Key API Endpoints

**EIA Hourly Grid Mix** (via Vite proxy):
```
GET /api/eia/electricity/rto/fuel-type-data/data/
  ?frequency=hourly
  &data[0]=value
  &facets[respondent][]={BA_CODE}
  &start={YYYY-MM-DDTHH}
  &end={YYYY-MM-DDTHH}
  &sort[0][column]=period
  &sort[0][direction]=asc
  &length=5000
```

**USPVDB Facility Search** (direct, no auth):
```
GET https://energy.usgs.gov/api/uspvdb/v1/
  ?p_name={NAME}
  &p_state={STATE}
```
