import { motion } from 'framer-motion';
import type { FormData } from '../types';

interface InputStepProps {
  formData: FormData;
  onChange: (data: FormData) => void;
  onCalculate: () => void;
  onBack: () => void;
}

export function InputStep({ formData, onChange, onCalculate, onBack }: InputStepProps) {
  const isValid = formData.fundedLoans > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
      className="space-y-10"
    >
      {/* Back button */}
      <button
        onClick={onBack}
        className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-900 transition-colors text-sm font-medium"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M19 12H5M12 19l-7-7 7-7"/>
        </svg>
        Back
      </button>

      <div className="text-center space-y-3">
        <h1 className="text-[42px] font-bold text-dark tracking-tight leading-tight">
          Calculate Your Savings
        </h1>
        <p className="text-gray text-lg">
          See how much you could save with Truv's verification platform
        </p>
      </div>

      <div className="space-y-6">
        <div className="space-y-2">
          <label className="block text-[15px] font-medium text-dark">
            How many loans do you fund annually?
          </label>
          <input
            type="number"
            value={formData.fundedLoans || ''}
            onChange={(e) => onChange({ ...formData, fundedLoans: parseInt(e.target.value) || 0 })}
            placeholder="e.g., 5000"
            className="w-full px-5 py-4 text-base border border-border rounded-xl focus:border-truv-blue focus:ring-2 focus:ring-truv-blue-glow outline-none transition-all"
          />
        </div>
      </div>

      <motion.button
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
        onClick={onCalculate}
        disabled={!isValid}
        className={`w-full py-[18px] rounded-full text-base font-semibold transition-all ${isValid
            ? 'bg-truv-blue text-white hover:bg-truv-blue-dark'
            : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          }`}
      >
        Continue
      </motion.button>
    </motion.div>
  );
}
