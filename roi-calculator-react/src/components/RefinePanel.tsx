import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { AdvancedInputs } from '../types';

interface RefinePanelProps {
  inputs: AdvancedInputs;
  onChange: (inputs: AdvancedInputs) => void;
}

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  onChange: (value: number) => void;
}

function Slider({ label, value, min, max, step = 1, suffix = '%', onChange }: SliderProps) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span className="text-gray">{label}</span>
        <span className="font-mono font-medium text-dark">{value}{suffix}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-truv-blue"
      />
    </div>
  );
}

export function RefinePanel({ inputs, onChange }: RefinePanelProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleChange = (key: keyof AdvancedInputs) => (value: number) => {
    onChange({ ...inputs, [key]: value });
  };

  return (
    <div className="rounded-2xl border border-border overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-6 py-4 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
      >
        <span className="font-semibold text-dark">Refine Your Numbers</span>
        <motion.svg
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="text-gray"
        >
          <path d="M6 9l6 6 6-6" />
        </motion.svg>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="p-6 space-y-8 bg-white">
              {/* Volume & Mix */}
              <div>
                <h4 className="text-sm font-semibold text-dark mb-4 uppercase tracking-wide">
                  Volume & Mix
                </h4>
                <div className="space-y-4">
                  <Slider
                    label="Retail %"
                    value={inputs.retailPercent}
                    min={0}
                    max={100}
                    onChange={handleChange('retailPercent')}
                  />
                  <Slider
                    label="Wholesale %"
                    value={inputs.wholesalePercent}
                    min={0}
                    max={100}
                    onChange={handleChange('wholesalePercent')}
                  />
                  <Slider
                    label="Borrowers per Application"
                    value={inputs.borrowersPerApp}
                    min={1}
                    max={3}
                    step={0.1}
                    suffix=""
                    onChange={handleChange('borrowersPerApp')}
                  />
                </div>
              </div>

              {/* Funnel Efficiency */}
              <div>
                <h4 className="text-sm font-semibold text-dark mb-4 uppercase tracking-wide">
                  Funnel Efficiency
                </h4>
                <div className="space-y-4">
                  <Slider
                    label="End-to-End Conversion Rate"
                    value={inputs.endToEndCR}
                    min={10}
                    max={60}
                    onChange={handleChange('endToEndCR')}
                  />
                  <Slider
                    label="Pull-Through Rate"
                    value={inputs.pullThroughRate}
                    min={30}
                    max={90}
                    onChange={handleChange('pullThroughRate')}
                  />
                </div>
              </div>

              {/* Income Mix */}
              <div>
                <h4 className="text-sm font-semibold text-dark mb-4 uppercase tracking-wide">
                  Income Mix
                </h4>
                <div className="space-y-4">
                  <Slider
                    label="W-2 Borrower Rate"
                    value={inputs.w2Rate}
                    min={50}
                    max={100}
                    onChange={handleChange('w2Rate')}
                  />
                </div>
              </div>

              <p className="text-xs text-gray-light">
                Adjust these values to match your specific business metrics for a more accurate estimate.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
