import { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Header } from './components/Header';
import { UseCaseStep } from './components/UseCaseStep';
import { InputStep } from './components/InputStep';
import { CostMethodStep } from './components/CostMethodStep';
import { ResultsStep } from './components/ResultsStep';
import { LeadModal } from './components/LeadModal';
import { CalculatingSpinner } from './components/CalculatingSpinner';
import { calculateROI, DEFAULT_ADVANCED_INPUTS } from './utils/calculations';
import type { FormData, CostMethod, Step, CalculationResults, LeadFormData, AdvancedInputs } from './types';

function App() {
  const [step, setStep] = useState<Step>(0);
  const [isCalculating, setIsCalculating] = useState(false);
  const [isGated, setIsGated] = useState(true);
  const [showLeadModal, setShowLeadModal] = useState(false);

  const [formData, setFormData] = useState<FormData>({
    fundedLoans: 0,
    industry: 'mortgage' // Default, updated by UseCaseStep
  });

  const [costMethod, setCostMethod] = useState<CostMethod['id']>('benchmark');
  const [customCost, setCustomCost] = useState<number | undefined>();
  const [advancedInputs, setAdvancedInputs] = useState<AdvancedInputs>(DEFAULT_ADVANCED_INPUTS);

  const [results, setResults] = useState<CalculationResults | null>(null);

  // Recalculate when advanced inputs change
  const handleAdvancedInputsChange = (newInputs: AdvancedInputs) => {
    setAdvancedInputs(newInputs);
    const calculatedResults = calculateROI(
      formData,
      newInputs,
      costMethod,
      customCost
    );
    setResults(calculatedResults);
  };

  const handleUseCaseSelect = (industry: FormData['industry']) => {
    setFormData(prev => ({ ...prev, industry }));
    setStep(1);
  };

  const handleCalculate = () => {
    setIsCalculating(true);

    // Simulate calculation time for effect
    setTimeout(() => {
      setStep(2);
      setIsCalculating(false);
    }, 1200);
  };

  const handleCostMethodContinue = () => {
    setIsCalculating(true);

    setTimeout(() => {
      const calculatedResults = calculateROI(
        formData,
        advancedInputs,
        costMethod,
        customCost
      );
      setResults(calculatedResults);
      setStep(3);
      setIsCalculating(false);
    }, 1500);
  };

  const handleUnlock = () => {
    setShowLeadModal(true);
  };

  const handleLeadSubmit = (leadData: LeadFormData) => {
    console.log('Lead submitted:', leadData);
    setShowLeadModal(false);
    setIsGated(false);
  };

  return (
    <div className="min-h-screen bg-white">
      <Header />

      <main className="max-w-[680px] mx-auto px-6 py-5 pb-0">
        <div className="bg-white p-0">
          <AnimatePresence mode="wait">
            {step === 0 && (
              <UseCaseStep
                key="use-case"
                onSelect={handleUseCaseSelect}
              />
            )}

            {step === 1 && (
              <InputStep
                key="input"
                formData={formData}
                onChange={setFormData}
                onCalculate={handleCalculate}
                onBack={() => setStep(0)}
              />
            )}

            {step === 2 && (
              <CostMethodStep
                key="cost"
                selectedMethod={costMethod}
                customCost={customCost}
                onSelectMethod={setCostMethod}
                onCustomCostChange={setCustomCost}
                onContinue={handleCostMethodContinue}
                onBack={() => setStep(1)}
              />
            )}

            {step === 3 && results && (
              <ResultsStep
                key="results"
                results={results}
                fundedLoans={formData.fundedLoans}
                isGated={isGated}
                onUnlock={handleUnlock}
                onBack={() => setStep(1)}
                advancedInputs={advancedInputs}
                onAdvancedInputsChange={handleAdvancedInputsChange}
              />
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Partner Logos Footer */}
      <footer className="partner-logos">
        <span className="partner-logo-text">accurate.</span>
        <span className="partner-logo-text green">Associated Bank</span>
        <span className="partner-logo-text red">AFN</span>
        <span className="partner-logo-text">Happy Money</span>
        <span className="partner-logo-text blue">Compass Mortgage</span>
      </footer>
      <div className="privacy-notice">
        By clicking "Continue" you agree to Truv's <a href="#">Privacy Notice</a>.
      </div>

      <AnimatePresence>
        <CalculatingSpinner isVisible={isCalculating} />
      </AnimatePresence>

      <AnimatePresence>
        {showLeadModal && (
          <LeadModal
            isOpen={showLeadModal}
            onClose={() => setShowLeadModal(false)}
            onSubmit={handleLeadSubmit}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

export default App;
