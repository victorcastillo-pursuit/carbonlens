import { useReducer } from 'react';
import { AppState, Facility, GenerationData, Calculation, ReadinessResult, ReportArtifact, AuditEvent } from '../types';

// ── Action types ─────────────────────────────────────────────────────────────

type Action =
  | { type: 'SET_FACILITY'; payload: Facility }
  | { type: 'SET_GENERATION_DATA'; payload: GenerationData }
  | { type: 'SET_CALCULATION'; payload: Calculation }
  | { type: 'SET_READINESS'; payload: ReadinessResult }
  | { type: 'SET_REPORT_ARTIFACT'; payload: ReportArtifact }
  | { type: 'APPEND_AUDIT_EVENT'; payload: AuditEvent }
  | { type: 'GO_TO_STEP'; payload: 1 | 2 | 3 | 4 | 5 }
  | { type: 'RESET_FROM_STEP'; payload: 1 | 2 | 3 | 4 | 5 };

// ── Initial state ────────────────────────────────────────────────────────────

const INITIAL_STATE: AppState = {
  currentStep: 1,
  facility: null,
  generationData: null,
  calculation: null,
  readiness: null,
  reportArtifact: null,
  auditLog: [],
  gridMixData: null,
  facilityLookup: null,
};

// ── Reducer ──────────────────────────────────────────────────────────────────

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_FACILITY':
      return { ...state, facility: action.payload };

    case 'SET_GENERATION_DATA':
      return { ...state, generationData: action.payload };

    case 'SET_CALCULATION':
      return {
        ...state,
        calculation: action.payload,
        // Supersede any previous calculation in the audit trail context
      };

    case 'SET_READINESS':
      return { ...state, readiness: action.payload };

    case 'SET_REPORT_ARTIFACT':
      return { ...state, reportArtifact: action.payload };

    case 'APPEND_AUDIT_EVENT':
      return { ...state, auditLog: [...state.auditLog, action.payload] };

    case 'GO_TO_STEP':
      return { ...state, currentStep: action.payload };

    case 'RESET_FROM_STEP': {
      // Clear all state at and after the given step
      const step = action.payload;
      return {
        ...state,
        currentStep: step,
        ...(step <= 1 ? { facility: null } : {}),
        ...(step <= 2 ? { generationData: null } : {}),
        ...(step <= 3 ? { calculation: null } : {}),
        ...(step <= 4 ? { readiness: null } : {}),
        ...(step <= 5 ? { reportArtifact: null } : {}),
      };
    }

    default:
      return state;
  }
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useAppState() {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);

  const actions = {
    setFacility: (facility: Facility) =>
      dispatch({ type: 'SET_FACILITY', payload: facility }),

    setGenerationData: (data: GenerationData) =>
      dispatch({ type: 'SET_GENERATION_DATA', payload: data }),

    setCalculation: (calc: Calculation) =>
      dispatch({ type: 'SET_CALCULATION', payload: calc }),

    setReadiness: (result: ReadinessResult) =>
      dispatch({ type: 'SET_READINESS', payload: result }),

    setReportArtifact: (artifact: ReportArtifact) =>
      dispatch({ type: 'SET_REPORT_ARTIFACT', payload: artifact }),

    appendAuditEvent: (event: AuditEvent) =>
      dispatch({ type: 'APPEND_AUDIT_EVENT', payload: event }),

    goToStep: (step: 1 | 2 | 3 | 4 | 5) =>
      dispatch({ type: 'GO_TO_STEP', payload: step }),

    resetFromStep: (step: 1 | 2 | 3 | 4 | 5) =>
      dispatch({ type: 'RESET_FROM_STEP', payload: step }),
  };

  // Derived: which steps are unlocked
  const unlockedSteps: Set<number> = new Set([1]);
  if (state.facility) unlockedSteps.add(2);
  if (state.generationData) unlockedSteps.add(3);
  if (state.calculation) unlockedSteps.add(4);
  if (state.readiness?.status === 'READY_FOR_REPORT') unlockedSteps.add(5);

  return { state, actions, unlockedSteps };
}
