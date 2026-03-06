import { useAppState } from './hooks/useAppState';
import { Header } from './components/Layout/Header';
import { StepNav } from './components/Layout/StepNav';
import { FacilityOnboarding } from './components/steps/FacilityOnboarding';
import { GenerationUpload } from './components/steps/GenerationUpload';
import { DisplacementCalculation } from './components/steps/DisplacementCalculation';
import { ReadinessValidation } from './components/steps/ReadinessValidation';
import { ReportExport } from './components/steps/ReportExport';
import { Facility, GenerationData, Calculation, ReadinessResult, ReportArtifact, AuditEvent, USPVDBFacility } from './types';
import { fetchHourlyGridMix } from './services/eia';
import { getPrimaryBA } from './data/egridCrosswalk';
import { sha256Hex } from './lib/crypto';
import { createAuditEvent } from './lib/auditLog';
import { interpolateDailyToHourly } from './lib/csvParser';

export default function App() {
  const { state, actions, unlockedSteps } = useAppState();

  function handleStepClick(step: 1 | 2 | 3 | 4 | 5) {
    if (unlockedSteps.has(step)) {
      actions.goToStep(step);
    }
  }

  function goNext() {
    const next = (state.currentStep + 1) as 1 | 2 | 3 | 4 | 5;
    if (next <= 5) actions.goToStep(next);
  }

  function goBack() {
    const prev = (state.currentStep - 1) as 1 | 2 | 3 | 4 | 5;
    if (prev >= 1) actions.goToStep(prev);
  }

  // ── Step 1 handlers ────────────────────────────────────────────────────────
  function handleFacilitySave(facility: Facility, event: AuditEvent) {
    actions.setFacility(facility);
    actions.appendAuditEvent(event);
    actions.goToStep(2);
  }

  function handleFacilityLookup(uspvdb: USPVDBFacility, event: AuditEvent) {
    actions.setFacilityLookup(uspvdb);
    actions.appendAuditEvent(event);
  }

  // ── Step 2 handlers ────────────────────────────────────────────────────────
  async function handleGenerationCommit(data: GenerationData, event: AuditEvent) {
    // Interpolate daily to hourly if needed
    let committed = data;
    if (data.granularity === 'daily') {
      const hourlyRecords = interpolateDailyToHourly(data.records);
      committed = { ...data, hourlyRecords, interpolated: true };
    }

    actions.setGenerationData(committed);
    actions.appendAuditEvent(event);

    // Automatically fetch EIA grid mix if facility has a BA mapping
    const ba = state.facility ? getPrimaryBA(state.facility.egridSubregion) : null;
    if (ba && committed.dateRange) {
      await handleGridMixFetch(ba, committed.dateRange.start, committed.dateRange.end);
    }
  }

  async function handleGridMixFetch(balancingAuthority: string, startDate: string, endDate: string) {
    const gridMix = await fetchHourlyGridMix(balancingAuthority, startDate, endDate);
    actions.setGridMixData(gridMix);

    if (gridMix.length > 0) {
      const hash = await sha256Hex(JSON.stringify(gridMix));
      actions.appendAuditEvent(createAuditEvent('grid_mix_data_fetched', {
        balancingAuthority,
        startDate,
        endDate,
        recordCount: gridMix.length,
        hash,
      }));
    } else {
      actions.appendAuditEvent(createAuditEvent('grid_mix_fetch_failed', {
        balancingAuthority,
        startDate,
        endDate,
        reason: 'EIA API returned no data or request failed',
      }));
    }
  }

  // ── Step 3 handlers ────────────────────────────────────────────────────────
  function handleCalculation(calc: Calculation, event: AuditEvent) {
    // Reset downstream validation/report
    if (state.calculation) {
      actions.resetFromStep(4);
    }
    actions.setCalculation(calc);
    actions.appendAuditEvent(event);

    // Log fallback event when flat-rate is used instead of hourly marginal
    if (calc.mode === 'annual_flat' && calc.fallbackReason) {
      actions.appendAuditEvent(createAuditEvent('calculation_mode_fallback', {
        calculationId: calc.id,
        fallbackReason: calc.fallbackReason,
        gridMixDataAvailable: !!(state.gridMixData && state.gridMixData.length > 0),
        hourlyRecordsAvailable: !!(state.generationData?.hourlyRecords?.length),
      }));
    }

    actions.goToStep(4);
  }

  // ── Step 4 handlers ────────────────────────────────────────────────────────
  function handleValidation(result: ReadinessResult, event: AuditEvent) {
    actions.setReadiness(result);
    actions.appendAuditEvent(event);
  }

  function handleValidationNext() {
    actions.goToStep(5);
  }

  // ── Step 5 handlers ────────────────────────────────────────────────────────
  function handleReportGenerated(artifact: ReportArtifact, events: AuditEvent[]) {
    actions.setReportArtifact(artifact);
    for (const event of events) {
      actions.appendAuditEvent(event);
    }
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      <Header />
      <StepNav
        currentStep={state.currentStep}
        unlockedSteps={unlockedSteps}
        onStepClick={handleStepClick}
      />
      <main className="max-w-5xl mx-auto px-6 py-8">
        {state.currentStep === 1 && (
          <FacilityOnboarding
            state={state}
            onSave={handleFacilitySave}
            onLookup={handleFacilityLookup}
            onNext={goNext}
          />
        )}
        {state.currentStep === 2 && (
          <GenerationUpload
            state={state}
            onCommit={handleGenerationCommit}
            onNext={goNext}
            onBack={goBack}
          />
        )}
        {state.currentStep === 3 && (
          <DisplacementCalculation
            state={state}
            onCalculate={handleCalculation}
            onNext={goNext}
            onBack={goBack}
          />
        )}
        {state.currentStep === 4 && (
          <ReadinessValidation
            state={state}
            onValidate={handleValidation}
            onNext={handleValidationNext}
            onBack={goBack}
          />
        )}
        {state.currentStep === 5 && (
          <ReportExport
            state={state}
            onGenerated={handleReportGenerated}
            onBack={goBack}
          />
        )}
      </main>
    </div>
  );
}
