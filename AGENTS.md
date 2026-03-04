# Repository Guidelines

## Project Structure & Module Organization
CarbonLens is a Vite + React + TypeScript app.
- `src/main.tsx` bootstraps the app; `src/App.tsx` orchestrates the 5-step workflow.
- `src/components/` contains UI and step screens (`Layout/`, `steps/`, `ui/`).
- `src/lib/` contains domain logic and utilities (calculation, validation, CSV/PDF/ZIP, crypto, audit logging).
- `src/hooks/` stores stateful React hooks (`useAppState.ts`).
- `src/data/` contains static datasets (for example `egrid.ts`).
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
- Do not commit secrets or sensitive facility/customer data.
- Keep generated report artifacts and temporary exports out of version control.
- Review CSV/PDF/ZIP handling paths in `src/lib/` when introducing new file inputs.

## Development workflow
- Always create a new branch before implementing features
- Never push directly to main

## Product context
CarbonLense simplifies carbon credit verification and transactions for small producers.
Focus on transparent pricing and simplified marketplace interactions.

## Architecture Overview
CarbonLens is a client-side application that guides a user through a 5-step workflow for carbon credit documentation.

High level flow:
1. Facility data input
2. Energy / displacement data upload
3. Carbon reduction calculation
4. Verification summary
5. Report export (PDF/CSV/ZIP)

Core logic lives in `src/lib/` and should remain pure and testable.
React components should primarily orchestrate UI state and user interaction.

## AI Agent Instructions
When modifying this repository:

- Prefer extending existing utilities in `src/lib/` rather than duplicating logic.
- Avoid placing calculation logic inside React components.
- Keep components focused on UI rendering and state wiring.
- If adding new domain logic, create pure functions that can be easily tested.
- Maintain the existing step-based workflow implemented in `App.tsx`.
- Ensure any new file-processing logic (CSV/PDF/ZIP) remains deterministic and auditable.

## Feature Development Pattern
New features should follow this structure:

1. Domain logic implemented in `src/lib/`
2. Types defined or extended in `src/types/`
3. React UI added inside `src/components/`
4. State handled via `src/hooks/useAppState.ts`
5. UI integrated into the step workflow in `App.tsx`

## Domain Concepts
Key concepts used in this project:

- Displacement Calculation: estimating avoided carbon emissions based on energy displacement.
- EGRID Dataset: emissions factors dataset used for carbon intensity calculations.
- Verification Report: generated summary that documents emissions reduction and supporting evidence.
- Small Producers: target users who need simplified carbon credit verification workflows.

## Long-Term Product Direction

CarbonLense aims to evolve beyond a carbon calculation and reporting tool into a simplified marketplace for carbon credits focused on small producers.

Many small renewable energy producers struggle not only with verification but also with selling carbon credits due to complex registries, opaque pricing, and high transaction costs.

The long-term goal of CarbonLense is to simplify the full lifecycle of carbon credits by enabling users to:

- calculate carbon reductions
- generate verification-ready documentation
- list carbon credits for sale
- discover potential buyers
- complete simplified credit transactions

Future features may include:

- credit listing and inventory management
- transparent pricing dashboards
- buyer discovery tools
- simplified transaction flows
- integration with carbon registries or external marketplaces
