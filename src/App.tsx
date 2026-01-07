
import { useState, useMemo } from 'react';
import { RoiInputForm } from './components/RoiInputForm';
import { RoiResults } from './components/RoiResults';
import type { ROIInputs } from './utils/roiCalculator';
import { calculateROI } from './utils/roiCalculator';

function App() {
  const [inputs, setInputs] = useState<ROIInputs>({
    fundedLoans: 2500,
    pullThroughRate: 0.7,
    e2eConversionRate: 0.5,
    borrowersPerApp: 1.5,
    w2BorrowerRate: 0.75,
  });

  const results = useMemo(() => calculateROI(inputs), [inputs]);

  return (
    <div className="min-h-screen py-16 px-4 sm:px-6 lg:px-8 bg-background font-sans">
      <div className="max-w-6xl mx-auto">
        <header className="text-center mb-16">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Truv <span className="text-truv-blue">ROI Calculator</span>
          </h1>
          <p className="text-lg text-gray-600">
            Estimate your savings by switching to the modern verification platform.
          </p>
        </header>

        <main className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-5">
            <RoiInputForm inputs={inputs} onChange={setInputs} />
          </div>
          <div className="lg:col-span-7">
            <RoiResults results={results} />
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;
