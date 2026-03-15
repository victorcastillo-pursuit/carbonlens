# CarbonLens

A browser-based carbon credit documentation tool for solar energy facilities.

---

## The Problem

Solar energy producers lack a simple, auditable way to calculate and document the carbon credits their systems generate. Existing tools are either too complex, require specialized software, or lack the transparency needed for third-party verification — leaving facilities without a straightforward workflow to go from raw generation data to a verified, exportable report aligned with EPA emission standards.

---

## The Solution

CarbonLens provides a step-by-step, fully client-side workflow that guides users from facility setup to a verified, exportable carbon credit report. It applies EPA eGRID 2023 emission factors to raw generation data and produces a tamper-evident PDF — no backend, no account, no data sent anywhere.

---

## Key Features

- Step-by-step guided workflow: Facility → Generation → Calculation → Validation → Export
- EPA eGRID 2023 Rev 2 emission factors across 27 subregions
- SHA-256 cryptographic hashing for tamper-evident audit trail
- Client-side PDF generation and ZIP export — no backend required
- CSV generation data import via PapaParse for bulk entry

---

## Tech Stack

| Layer | Technologies |
|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS |
| Libraries | jsPDF, JSZip, PapaParse, lucide-react |
| Security | Web Crypto API (SHA-256) |
| Data | EPA eGRID 2023 Rev 2 (embedded, no external API calls) |

---

## Getting Started

```bash
# Clone the repository
git clone https://github.com/victorcastillo-pursuit/carbonlens.git
cd carbonlens

# Install dependencies
npm install

# Start development server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## How It Works

1. **Facility Setup** — Enter facility name, location, and select your EPA eGRID subregion
2. **Generation Data** — Input MWh values manually or import via CSV
3. **Calculation** — System applies the correct emission factor and calculates metric tons of CO₂ avoided
4. **Validation** — SHA-256 hash is generated over the report data for tamper-evidence
5. **Export** — Download a signed PDF monitoring report and/or a full ZIP audit package

---

## Formula

```
Carbon Credits (MT CO₂) = Generation (MWh) × Emission Factor (lb/MWh) ÷ 2204.62
```

- Emission factors sourced from **EPA eGRID 2023 Rev 2**
- Formula version: `cdm-ams-id-v1`
- Dataset version: `egrid_2023_rev2`

---

## Project Type

Pursuit Fellowship — Solo portfolio project
**Developer:** Victor Castillo
