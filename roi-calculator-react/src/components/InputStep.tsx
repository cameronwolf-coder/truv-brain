import { motion } from 'framer-motion';
import type { FormData } from '../types';

interface InputStepProps {
  formData: FormData;
  onChange: (data: FormData) => void;
  onCalculate: () => void;
}

const industries = [
  { value: 'mortgage', label: 'Mortgage Lending' },
  { value: 'credit_union', label: 'Credit Union' },
  { value: 'consumer', label: 'Consumer Lending' },
  { value: 'auto', label: 'Auto Lending' }
] as const;

export function InputStep({ formData, onChange, onCalculate }: InputStepProps) {
  const isValid = formData.fundedLoans > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
      className="space-y-10"
    >
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

        <div className="space-y-2">
          <label className="block text-[15px] font-medium text-dark">
            What industry are you in?
          </label>
          <select
            value={formData.industry}
            onChange={(e) => onChange({ ...formData, industry: e.target.value as FormData['industry'] })}
            className="w-full px-5 py-4 text-base border border-border rounded-xl focus:border-truv-blue focus:ring-2 focus:ring-truv-blue-glow outline-none transition-all bg-white"
          >
            {industries.map((ind) => (
              <option key={ind.value} value={ind.value}>
                {ind.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <motion.button
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
        onClick={onCalculate}
        disabled={!isValid}
        className={`w-full py-[18px] rounded-full text-base font-semibold transition-all ${
          isValid
            ? 'bg-truv-blue text-white hover:bg-truv-blue-dark'
            : 'bg-gray-200 text-gray-400 cursor-not-allowed'
        }`}
      >
        Continue
      </motion.button>
    </motion.div>
  );
}
