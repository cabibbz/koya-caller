"use client";

/**
 * Koya Caller - Onboarding Context
 * Manages state across all onboarding steps
 * Spec Reference: Part 5, Lines 211-214 (Navigation, Save & Exit)
 */

import {
  createContext,
  useContext,
  useReducer,
  useCallback,
  type ReactNode,
} from "react";
import {
  type OnboardingState,
  type OnboardingAction,
  type OnboardingStep,
  type Step2FormData,
  type Step3FormData,
  type Step4FormData,
  type Step5FormData,
  type Step6FormData,
  type Step7FormData,
  type Step8FormData,
  INITIAL_ONBOARDING_STATE,
  ONBOARDING_STEPS,
} from "@/types/onboarding";

// ============================================
// Reducer
// ============================================

function onboardingReducer(
  state: OnboardingState,
  action: OnboardingAction
): OnboardingState {
  switch (action.type) {
    case "SET_LOADING":
      return { ...state, isLoading: action.payload };
    
    case "SET_SAVING":
      return { ...state, isSaving: action.payload };
    
    case "SET_ERROR":
      return { ...state, error: action.payload };
    
    case "SET_BUSINESS_ID":
      return { ...state, businessId: action.payload };
    
    case "SET_CURRENT_STEP":
      return { ...state, currentStep: action.payload };
    
    case "COMPLETE_STEP":
      if (state.completedSteps.includes(action.payload)) {
        return state;
      }
      return {
        ...state,
        completedSteps: [...state.completedSteps, action.payload].sort(
          (a, b) => a - b
        ),
      };
    
    case "SET_BUSINESS_TYPE":
      return {
        ...state,
        businessType: action.payload.slug,
        businessTypeName: action.payload.name,
      };
    
    case "SET_TEMPLATE_LOADED":
      return { ...state, templateLoaded: action.payload };
    
    case "SET_STEP2_DATA":
      return { ...state, step2Data: action.payload };
    
    case "SET_STEP3_DATA":
      return { ...state, step3Data: action.payload };
    
    case "SET_STEP4_DATA":
      return { ...state, step4Data: action.payload };
    
    case "SET_STEP5_DATA":
      return { ...state, step5Data: action.payload };
    
    case "SET_STEP6_DATA":
      return { ...state, step6Data: action.payload };
    
    case "SET_STEP7_DATA":
      return { ...state, step7Data: action.payload };
    
    case "SET_STEP8_DATA":
      return { ...state, step8Data: action.payload };
    
    case "LOAD_SAVED_STATE":
      return { ...state, ...action.payload };
    
    default:
      return state;
  }
}

// ============================================
// Context Types
// ============================================

interface OnboardingContextValue {
  state: OnboardingState;
  
  // Navigation
  goToStep: (step: OnboardingStep) => void;
  goNext: () => void;
  goBack: () => void;
  canGoToStep: (step: OnboardingStep) => boolean;
  isStepComplete: (step: OnboardingStep) => boolean;
  
  // State setters
  setLoading: (loading: boolean) => void;
  setSaving: (saving: boolean) => void;
  setError: (error: string | null) => void;
  setBusinessId: (id: string) => void;
  setBusinessType: (slug: string, name: string) => void;
  setTemplateLoaded: (loaded: boolean) => void;
  completeStep: (step: OnboardingStep) => void;
  setStep2Data: (data: Step2FormData) => void;
  setStep3Data: (data: Step3FormData) => void;
  setStep4Data: (data: Step4FormData) => void;
  setStep5Data: (data: Step5FormData) => void;
  setStep6Data: (data: Step6FormData) => void;
  setStep7Data: (data: Step7FormData) => void;
  setStep8Data: (data: Step8FormData) => void;
  loadSavedState: (state: Partial<OnboardingState>) => void;
}

// ============================================
// Context
// ============================================

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

// ============================================
// Provider
// ============================================

interface OnboardingProviderProps {
  children: ReactNode;
  initialState?: Partial<OnboardingState>;
}

export function OnboardingProvider({
  children,
  initialState,
}: OnboardingProviderProps) {
  const [state, dispatch] = useReducer(onboardingReducer, {
    ...INITIAL_ONBOARDING_STATE,
    ...initialState,
  });

  // Navigation helpers
  const canGoToStep = useCallback(
    (step: OnboardingStep): boolean => {
      // Can always go to current step
      if (step === state.currentStep) return true;
      // Can go to any completed step
      if (state.completedSteps.includes(step)) return true;
      // Can go to the next step after last completed
      const maxCompleted = Math.max(0, ...state.completedSteps);
      return step === maxCompleted + 1;
    },
    [state.currentStep, state.completedSteps]
  );

  const isStepComplete = useCallback(
    (step: OnboardingStep): boolean => {
      return state.completedSteps.includes(step);
    },
    [state.completedSteps]
  );

  const goToStep = useCallback(
    (step: OnboardingStep) => {
      if (canGoToStep(step)) {
        dispatch({ type: "SET_CURRENT_STEP", payload: step });
      }
    },
    [canGoToStep]
  );

  const goNext = useCallback(() => {
    const currentIndex = ONBOARDING_STEPS.findIndex(
      (s) => s.step === state.currentStep
    );
    if (currentIndex < ONBOARDING_STEPS.length - 1) {
      const nextStep = ONBOARDING_STEPS[currentIndex + 1].step;
      dispatch({ type: "COMPLETE_STEP", payload: state.currentStep });
      dispatch({ type: "SET_CURRENT_STEP", payload: nextStep });
    }
  }, [state.currentStep]);

  const goBack = useCallback(() => {
    const currentIndex = ONBOARDING_STEPS.findIndex(
      (s) => s.step === state.currentStep
    );
    if (currentIndex > 0) {
      const prevStep = ONBOARDING_STEPS[currentIndex - 1].step;
      dispatch({ type: "SET_CURRENT_STEP", payload: prevStep });
    }
  }, [state.currentStep]);

  // State setters
  const setLoading = useCallback((loading: boolean) => {
    dispatch({ type: "SET_LOADING", payload: loading });
  }, []);

  const setSaving = useCallback((saving: boolean) => {
    dispatch({ type: "SET_SAVING", payload: saving });
  }, []);

  const setError = useCallback((error: string | null) => {
    dispatch({ type: "SET_ERROR", payload: error });
  }, []);

  const setBusinessId = useCallback((id: string) => {
    dispatch({ type: "SET_BUSINESS_ID", payload: id });
  }, []);

  const setBusinessType = useCallback((slug: string, name: string) => {
    dispatch({ type: "SET_BUSINESS_TYPE", payload: { slug, name } });
  }, []);

  const setTemplateLoaded = useCallback((loaded: boolean) => {
    dispatch({ type: "SET_TEMPLATE_LOADED", payload: loaded });
  }, []);

  const completeStep = useCallback((step: OnboardingStep) => {
    dispatch({ type: "COMPLETE_STEP", payload: step });
  }, []);

  const setStep2Data = useCallback((data: Step2FormData) => {
    dispatch({ type: "SET_STEP2_DATA", payload: data });
  }, []);

  const setStep3Data = useCallback((data: Step3FormData) => {
    dispatch({ type: "SET_STEP3_DATA", payload: data });
  }, []);

  const setStep4Data = useCallback((data: Step4FormData) => {
    dispatch({ type: "SET_STEP4_DATA", payload: data });
  }, []);

  const setStep5Data = useCallback((data: Step5FormData) => {
    dispatch({ type: "SET_STEP5_DATA", payload: data });
  }, []);

  const setStep6Data = useCallback((data: Step6FormData) => {
    dispatch({ type: "SET_STEP6_DATA", payload: data });
  }, []);

  const setStep7Data = useCallback((data: Step7FormData) => {
    dispatch({ type: "SET_STEP7_DATA", payload: data });
  }, []);

  const setStep8Data = useCallback((data: Step8FormData) => {
    dispatch({ type: "SET_STEP8_DATA", payload: data });
  }, []);

  const loadSavedState = useCallback((savedState: Partial<OnboardingState>) => {
    dispatch({ type: "LOAD_SAVED_STATE", payload: savedState });
  }, []);

  const value: OnboardingContextValue = {
    state,
    goToStep,
    goNext,
    goBack,
    canGoToStep,
    isStepComplete,
    setLoading,
    setSaving,
    setError,
    setBusinessId,
    setBusinessType,
    setTemplateLoaded,
    completeStep,
    setStep2Data,
    setStep3Data,
    setStep4Data,
    setStep5Data,
    setStep6Data,
    setStep7Data,
    setStep8Data,
    loadSavedState,
  };

  return (
    <OnboardingContext.Provider value={value}>
      {children}
    </OnboardingContext.Provider>
  );
}

// ============================================
// Hook
// ============================================

export function useOnboarding() {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error("useOnboarding must be used within an OnboardingProvider");
  }
  return context;
}
