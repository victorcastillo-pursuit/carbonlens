# CarbonLens
**Digital MRV Infrastructure for Utility-Scale Solar**

- **Project:** CarbonLens — 1-Week MVP
- **Owner:** Victor, Edwin, Luba
- **Date:** Q1 2026
- **Status:** Draft — For review

> CONFIDENTIAL — Not for external distribution

---

## 1. Problem

Solar operators whose farms displace significant CO₂ in carbon-intensive grid regions have no streamlined way to produce the verifiable documentation required for voluntary carbon credit submission. What should be a structured data export and calculation step currently requires weeks of manual effort, $15K–$50K in consulting fees per report cycle, and produces fragile, hard-to-audit spreadsheet artifacts that struggle to pass third-party verification.

### Supporting Context

- In 2020, Verra and Gold Standard retired solar REC-linked credit methodologies, eliminating a secondary revenue stream for operators in high-emission grid subregions.
- In February 2025, Verra approved its first solar project under a digital MRV pilot — reopening the pathway but requiring digitally auditable documentation infrastructure that does not yet exist commercially.
- Prairie Wolf Solar (200 MW, RFCW subregion) displaces an estimated 144,778 metric tons of CO₂ annually — worth $1.0M–$2.9M in voluntary market credits — with no current path to monetization.

---

## 2. Opportunity

Build the automated data pipeline that takes a solar farm's generation data and outputs registry-ready carbon credit documentation — compressing a multi-week manual process into a sub-60-second self-serve workflow.

### Market Opportunity

- Hundreds of U.S. utility-scale solar facilities in subregions with emission rates above 800 lbs CO₂/MWh are potential customers. At a 15–20% platform fee on $7–$20/MT credits, per-facility annual platform revenue is $150K–$580K.
- The February 2025 Verra digital MRV pilot creates a first-mover window of 12–24 months before larger infrastructure platforms respond.
- Platform value exists independent of credit price: replacing $15K–$50K/report consultant cost is a compelling ROI even at $7/MT market conditions.

---

## 3. Users & Needs

### Who

- **Primary users:** Solar asset CFOs and asset managers at independent power producers (IPPs) operating utility-scale facilities (50–500 MW).
- **Secondary users:** Third-party verification auditors who receive and review the exported documentation package.

### Needs

**Primary User — Solar Asset CFO / Asset Manager**

- As an asset manager, I need to upload my SCADA-exported generation CSV and receive a formatted carbon credit monitoring report, because I cannot justify weeks of consultant engagement per reporting cycle.
- As a CFO, I need all calculation inputs — emission factor, formula version, dataset version — locked and traceable in the output, because my legal team requires auditability before submitting to any registry.
- As an asset manager, I need a readiness validation check before report generation, so I know the documentation will hold up to third-party scrutiny before I invest in the submission process.
- As a CFO, I need to see net revenue projections at $7/MT and $20/MT after platform fees, because I need to present the economic case to my investment committee before committing.
- As an asset manager, I need the documentation to be registry-agnostic, so I am not locked into a single registry pathway if standards shift.

**Secondary User — Third-Party Verification Auditor**

- As a verifier, I need an export package with SHA-256 hashes for all source files and outputs, so I can independently confirm data integrity without relying on the operator's assertion.
- As a verifier, I need a complete, dated audit trail of every system event, so I can confirm the calculation was produced from the stated inputs without post-hoc modification.

---

## 4. Proposed Solution

CarbonLens is a single-page web application that accepts a solar farm's monthly generation CSV, loads the applicable EPA eGRID emission factor from a versioned local dataset, runs a deterministic displacement calculation, validates documentation readiness, and produces a registry-ready monitoring report (PDF + JSON) plus a cryptographically verifiable export package. The MVP covers one facility — Prairie Wolf Solar — using EPA eGRID 2023 Rev 2 data and CDM AMS I.D report structure.

### Top 3 MVP Value Propositions

- **[The Vitamin] Audit-Grade Documentation** — Replaces error-prone spreadsheets with a locked, versioned, SHA-256-traceable calculation record that satisfies third-party verifier requirements.
- **[The Painkiller] Sub-60-Second Report Generation** — Compresses a 4–8 week consultant engagement into a self-serve workflow: upload CSV, run calculation, download export package.
- **[The Steroid] Readiness Gate Before You Submit** — Deterministic pre-report validation catches data gaps, calculation integrity issues, and missing audit events before the operator commits to registry submission — saving the cost of a failed verification round.

---

## 5. Goals & Non-Goals

### Goals

- Demonstrate the full MRV pipeline — CSV upload through ZIP export — for a single facility (Prairie Wolf Solar) in a working MVP built in one week.
- Produce a monitoring report that passes structural review against CDM AMS I.D section requirements and is ready for registry or verifier submission.
- Lock all calculation inputs (emission factor, formula version, dataset version, source file hash) with full traceability in the output artifact.
- Implement a deterministic readiness validation gate that blocks report generation when blocking data or calculation issues are detected.
- Demonstrate registry-agnostic architecture: methodology formatting is a config-layer template, not embedded in calculation logic.

### Non-Goals

- No user authentication or role-based access control in MVP.
- No multi-facility portfolio management.
- No API-based generation data ingestion or SCADA integration.
- No direct registry submission, registry API integration, or marketplace listing.
- No additionality assessment, portfolio scoring, or AI-based predictions.
- No wind, storage, or non-solar asset types.
- No email notifications, workflow automation, or multi-user collaboration.

---

## 6. Success Metrics

| Goal | Signal | Metric | Target |
|------|--------|--------|--------|
| Calculation accuracy | Manual baseline matches system output | Displacement MT on Prairie Wolf test | 144,778 MT ±0.01 MT |
| Readiness validation | Gate correctly blocks / allows | Pass rate on clean data; block on bad data | 100% on both test cases |
| Documentation quality | Structural review passes | CDM AMS I.D section coverage | All required sections present |
| Export integrity | SHA-256 hashes validate | Manifest hash match rate | 100% on all export files |
| Workflow speed | Self-serve from upload to export | End-to-end runtime (Prairie Wolf dataset) | < 60 seconds wall time |
| Revenue accuracy | Projection matches manual calc | $7 and $20/MT net at 15% fee | $861K and $2.461M net |
| Audit coverage | All events logged, append-only verified | Event types in audit_logs | All 6 event types present |

---

## 7. Requirements

Requirements are organized by the core user journey: onboarding through export.
- **P0** = MVP required
- **P1** = Important for complete experience
- **P2** = Nice-to-have post-MVP

---

### User Journey 1: Facility Onboarding

Context: The operator sets up Prairie Wolf Solar as the monitored facility. This step establishes the facility record, links it to the correct eGRID subregion, and confirms the emission factor before any data is uploaded.

- **[P0]** User can create a facility profile by entering name, nameplate capacity (MW), eGRID subregion code, and commercial operation date.
- **[P0]** User sees the emission factor (lbs CO₂/MWh) for the selected subregion auto-populated from the active versioned dataset immediately on subregion selection — no hardcoded values.
- **[P0]** System assigns and displays a UUID for the new facility at creation time.
- **[P0]** System writes a `facility_created` audit log entry with field snapshot and timestamp.
- **[P1]** User sees a clear confirmation summary before the facility record is saved.
- **[P2]** User can edit facility profile fields; edit creates a new versioned snapshot rather than overwriting the original.

---

### User Journey 2: Generation Data Upload

Context: The operator uploads their SCADA-exported generation CSV. Validation and hashing must happen before any data is committed to ensure downstream calculation integrity.

- **[P0]** User can upload a CSV file containing `period_start`, `period_end`, and `generation_mwh` columns via drag-and-drop or file selector.
- **[P0]** System validates the file on upload: checks required columns, rejects non-numeric generation values, detects overlapping periods, rejects future-dated records.
- **[P0]** System computes SHA-256 hash of the uploaded file at receipt and displays it to the user before commit.
- **[P0]** System displays a validation summary — record count, total MWh, date range, file hash — and requires user confirmation before data is committed.
- **[P0]** System stores the raw CSV in object storage as an immutable file; the file cannot be modified after storage.
- **[P1]** User sees a clear error message for each specific validation failure with the affected row or field identified.
- **[P1]** User can re-upload for the same period with an explicit acknowledgment that prior calculation records will be marked superseded.
- **[P2]** User can preview the uploaded records in a paginated table before confirming commit.

---

### User Journey 3: Displacement Calculation

Context: The operator runs the CO₂ displacement calculation. The engine must be deterministic and fully traceable — every input is locked at calculation time.

- **[P0]** User can trigger a displacement calculation for a selected facility and generation period.
- **[P0]** System loads the emission factor from the versioned `egrid_emission_rates` dataset by `subregion_code` + active `dataset_version` at calculation time — no hardcoded factors.
- **[P0]** System computes: `CO₂ MT = (total_mwh × co2_lbs_per_mwh) ÷ 2204.62` using a pure, stateless calculation function.
- **[P0]** User can set a conservative adjustment factor (0.85–1.00, default 1.00); system stores both raw and adjusted MT.
- **[P0]** System stores an immutable calculation record locking: `egrid_rate_id` (FK), `co2_lbs_per_mwh` (denorm), `dataset_version` (denorm), `formula_version`, `adjustment_factor`, `raw_mt`, `adjusted_mt`, `calculated_at`.
- **[P0]** System writes a `calculation_executed` audit log entry with full input snapshot.
- **[P0]** User sees a calculation result screen displaying all inputs, both MT values, dataset version, and source SHA-256.
- **[P1]** User can recalculate; prior record is retained and marked `superseded_by` the new record's UUID.
- **[P2]** User can view a side-by-side comparison of current and superseded calculation records.

---

### User Journey 4: Readiness Validation

Context: Before generating a report, the operator runs a deterministic pre-flight check across five categories. This gate prevents submission of incomplete or inconsistent documentation.

- **[P0]** User is automatically shown the readiness validation screen when navigating to report generation; user can also trigger re-validation manually.
- **[P0]** System evaluates all five check categories: data completeness, generation sanity, emission factor alignment, calculation integrity, audit integrity — and returns results in < 2 seconds.
- **[P0]** System displays each check as a labeled row with a pass / fail / warn status indicator using both color and iconography (accessible, not color-only).
- **[P0]** System displays a summary banner: `READY_FOR_REPORT` (blocking_count = 0) or `X blocking issue(s) must be resolved`.
- **[P0]** Report generation is blocked and the Generate button is disabled when any blocking check fails.
- **[P0]** Advisory warnings (WARN severity) are displayed but do not block report generation.
- **[P0]** System writes a `readiness_validation_run` audit log entry with the full status object as the payload.
- **[P1]** Each blocking failure message includes a direct link or instruction pointing to the relevant action screen (upload, calculation).
- **[P1]** Advisory warnings display a note explaining they will be included in the audit record but do not block submission.
- **[P2]** User can download a readiness report as a standalone PDF for internal review before committing to full report generation.

---

### User Journey 5: Report Generation & Export

Context: The operator generates the formal monitoring report and downloads the complete export package for registry submission or verifier review.

- **[P0]** User can generate a PDF monitoring report once readiness status is `READY_FOR_REPORT`.
- **[P0]** PDF follows CDM AMS I.D section structure (applied via versioned template config file — independent of calculation engine).
- **[P0]** PDF header embeds: generation CSV SHA-256, eGRID `dataset_version`, `source_sha256`, `formula_version`, and report generation timestamp.
- **[P0]** System generates a JSON report with identical fields to the PDF in a documented schema.
- **[P0]** System writes a `report_generated` audit log entry.
- **[P0]** User can download a ZIP export package containing: monitoring report PDF, monitoring report JSON, original generation CSV, audit trail JSON, and `manifest.txt` with SHA-256 for every file.
- **[P0]** `manifest.txt` includes shell verification instructions for `sha256sum` / `CertUtil`.
- **[P0]** System writes a `report_exported` audit log entry.
- **[P0]** User sees revenue projections at $7/MT and $20/MT with 15% platform fee deduction in the report.
- **[P1]** User can configure the platform fee percentage (10–25%) and a custom credit price ($1–$100/MT) before generation.
- **[P1]** Report includes a disclaimer that revenue figures are estimates dependent on registry acceptance and market conditions.
- **[P2]** User can regenerate a report from any prior (non-superseded) calculation record without re-running the calculation.

---

## 8. Appendix

### Key Calculations

- **Formula:** `CO₂ MT = (total_mwh × co2_lbs_per_mwh) ÷ 2204.62`
- **Prairie Wolf example:** 350,400 MWh × 911 lbs/MWh (RFCW, egrid_2023_rev2) ÷ 2204.62 = 144,778 MT
- At $7/MT: $1.013M gross → $861K net (15% fee)
- At $20/MT: $2.896M gross → $2.461M net

### Related Documents

- CarbonLens MVP PRD v1.2 (detailed technical specification with full functional requirements, data model, system architecture, and 1-week build plan)
- EPA eGRID 2023 Rev 2 — source dataset for all 27 U.S. subregion emission factors
- CDM AMS I.D Methodology — monitoring report structural reference

### Legend

- **[P0]** = MVP required for launch
- **[P1]** = Important for complete user experience; plan for near-term post-MVP
- **[P2]** = Nice-to-have; deferred to Phase 2+

---

*CarbonLens PRD v1.2 • CONFIDENTIAL • Not for distribution without authorization*
