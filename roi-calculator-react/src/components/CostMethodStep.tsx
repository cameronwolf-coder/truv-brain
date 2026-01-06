import { motion } from 'framer-motion';
import type { CostMethod } from '../types';

interface CostMethodStepProps {
  selectedMethod: CostMethod['id'];
  customCost: number | undefined;
  onSelectMethod: (method: CostMethod['id']) => void;
  onCustomCostChange: (cost: number) => void;
  onContinue: () => void;
}

const costMethods: CostMethod[] = [
  {
    id: 'benchmark',
    label: 'Use industry benchmarks',
    description: '$10/VOA, $62/TWN verification',
    icon: ''
  },
  {
    id: 'per_loan',
    label: 'I know my cost per funded loan',
    description: 'Total verification cost per loan',
    icon: ''
  },
  {
    id: 'total_spend',
    label: 'I know my total annual spend',
    description: 'Total verification budget per year',
    icon: ''
  },
  {
    id: 'per_verification',
    label: 'I know my cost per verification',
    description: 'What you pay TWN or similar',
    icon: ''
  }
];

const placeholders: Record<CostMethod['id'], string> = {
  benchmark: '',
  per_loan: 'e.g., $120',
  total_spend: 'e.g., $500,000',
  per_verification: 'e.g., $35'
};

export function CostMethodStep({
  selectedMethod,
  customCost,
  onSelectMethod,
  onCustomCostChange,
  onContinue
}: CostMethodStepProps) {
  const needsInput = selectedMethod !== 'benchmark';
  const isValid = selectedMethod === 'benchmark' || (customCost && customCost > 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
      className="space-y-10"
    >
      <div className="text-center space-y-3">
        <h2 className="text-[42px] font-bold text-dark tracking-tight leading-tight">
          Your Current Costs
        </h2>
        <p className="text-gray text-lg">
          Choose how you'd like to input your verification costs
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {costMethods.map((method, index) => (
          <motion.button
            key={method.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05, duration: 0.3 }}
            onClick={() => onSelectMethod(method.id)}
            className={`relative p-5 rounded-xl border text-left transition-all overflow-hidden ${
              selectedMethod === method.id
                ? 'border-truv-blue bg-white'
                : 'border-border hover:border-gray-300'
            }`}
          >
            {/* Left accent bar */}
            <div className={`absolute left-0 top-0 bottom-0 w-1 transition-colors ${
              selectedMethod === method.id ? 'bg-truv-blue' : 'bg-transparent'
            }`} />

            <div className="flex items-center gap-4">
              {/* Radio button */}
              <div className={`w-[22px] h-[22px] rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                selectedMethod === method.id
                  ? 'border-truv-blue bg-truv-blue'
                  : 'border-gray-300'
              }`}>
                {selectedMethod === method.id && (
                  <div className="w-2 h-2 rounded-full bg-white" />
                )}
              </div>

              <div className="flex-1">
                <div className="font-medium text-dark text-base">{method.label}</div>
                <div className="text-sm text-gray-light">{method.description}</div>
              </div>
            </div>
          </motion.button>
        ))}
      </div>

      {needsInput && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="space-y-2"
        >
          <label className="block text-[15px] font-medium text-dark">
            Enter amount
          </label>
          <input
            type="number"
            value={customCost || ''}
            onChange={(e) => onCustomCostChange(parseInt(e.target.value) || 0)}
            placeholder={placeholders[selectedMethod]}
            className="w-full px-5 py-4 text-base border border-border rounded-xl focus:border-truv-blue focus:ring-2 focus:ring-truv-blue-glow outline-none transition-all"
          />
        </motion.div>
      )}

      <div className="space-y-4">
        <motion.button
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          onClick={onContinue}
          disabled={!isValid}
          className={`w-full py-[18px] rounded-full text-base font-semibold transition-all ${
            isValid
              ? 'bg-truv-blue text-white hover:bg-truv-blue-dark'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          }`}
        >
          Continue
        </motion.button>

        <button
          type="button"
          onClick={() => window.history.back()}
          className="w-full text-truv-blue font-medium text-base hover:underline"
        >
          Back
        </button>
      </div>
    </motion.div>
  );
}
