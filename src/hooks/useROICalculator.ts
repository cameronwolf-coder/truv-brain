import { useState, useMemo } from 'react';
import { calculateROI, DEFAULT_ADVANCED_INPUTS } from '../utils/calculations';
import type { AdvancedInputs, CalculationResults } from '../types';

export type CostMethodType = 'benchmark' | 'per_loan' | 'total_spend' | 'per_verification';

export interface ROIFormInputs {
  companyName: string;
  fundedLoans: number;
  costMethod: CostMethodType;
  customCost: number | null;
  twnCost: number;
  advancedInputs: AdvancedInputs;
}

const DEFAULT_FORM_INPUTS: ROIFormInputs = {
  companyName: '',
  fundedLoans: 5000,
  costMethod: 'benchmark',
  customCost: null,
  twnCost: 62,
  advancedInputs: DEFAULT_ADVANCED_INPUTS,
};

export function useROICalculator() {
  const [inputs, setInputs] = useState<ROIFormInputs>(DEFAULT_FORM_INPUTS);

  const results: CalculationResults = useMemo(() => {
    if (inputs.fundedLoans <= 0) {
      return {
        annualSavings: 0,
        savingsPerLoan: 0,
        manualReduction: 0,
        currentCost: 0,
        futureCost: 0,
        currentVOAs: 0,
        currentTWNs: 0,
        truvVOAs: 0,
        truvVOIEs: 0,
        remainingTWNs: 0,
      };
    }

    return calculateROI(
      { fundedLoans: inputs.fundedLoans, industry: 'mortgage' },
      inputs.advancedInputs,
      inputs.costMethod,
      inputs.customCost ?? undefined,
      inputs.twnCost
    );
  }, [inputs.fundedLoans, inputs.advancedInputs, inputs.costMethod, inputs.customCost, inputs.twnCost]);

  const totalApplications = useMemo(() => {
    if (inputs.fundedLoans <= 0) return 0;
    return Math.round(inputs.fundedLoans / (inputs.advancedInputs.endToEndCR / 100));
  }, [inputs.fundedLoans, inputs.advancedInputs.endToEndCR]);

  const totalBorrowersToVerify = useMemo(() => {
    return Math.round(totalApplications * inputs.advancedInputs.borrowersPerApp);
  }, [totalApplications, inputs.advancedInputs.borrowersPerApp]);

  const updateInput = <K extends keyof ROIFormInputs>(
    key: K,
    value: ROIFormInputs[K]
  ) => {
    setInputs((prev) => ({ ...prev, [key]: value }));
  };

  const updateAdvancedInput = <K extends keyof AdvancedInputs>(
    key: K,
    value: AdvancedInputs[K]
  ) => {
    setInputs((prev) => ({
      ...prev,
      advancedInputs: { ...prev.advancedInputs, [key]: value },
    }));
  };

  const resetToDefaults = () => {
    setInputs(DEFAULT_FORM_INPUTS);
  };

  return {
    inputs,
    results,
    totalApplications,
    totalBorrowersToVerify,
    updateInput,
    updateAdvancedInput,
    resetToDefaults,
  };
}
