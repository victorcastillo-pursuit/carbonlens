import { useAppState } from './hooks/useAppState';
import { Header } from './components/Layout/Header';
import { StepNav } from './components/Layout/StepNav';
import { FacilityOnboarding } from './components/steps/FacilityOnboarding';
import { GenerationUpload } from './components/steps/GenerationUpload';
import { DisplacementCalculation } from './components/steps/DisplacementCalculation';
import { ReadinessValidation } from './components/steps/ReadinessValidation';
import { ReportExport } from './components/steps/ReportExport';
import { Facility, GenerationData, Calculation, ReadinessResult, ReportArtifact, AuditEvent } from './types';

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

  // ── Step 2 handlers ────────────────────────────────────────────────────────
  function handleGenerationCommit(data: GenerationData, event: AuditEvent) {
    // If re-uploading, reset downstream state
    if (state.generationData) {
      actions.resetFromStep(3);
    }
    actions.setGenerationData(data);
    actions.appendAuditEvent(event);
  }

  // ── Step 3 handlers ────────────────────────────────────────────────────────
  function handleCalculation(calc: Calculation, event: AuditEvent) {
    // Reset downstream validation/report
    if (state.calculation) {
      actions.resetFromStep(4);
    }
    actions.setCalculation(calc);
    actions.appendAuditEvent(event);
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
