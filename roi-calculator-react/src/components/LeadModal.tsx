import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { LeadFormData } from '../types';

interface LeadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: LeadFormData) => void;
}

export function LeadModal({ isOpen, onClose, onSubmit }: LeadModalProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [formData, setFormData] = useState<LeadFormData>({
    name: '',
    company: '',
    email: '',
    phone: '',
    jobTitle: '',
    losSystem: '',
    posSystem: ''
  });

  const handleChange = (field: keyof LeadFormData) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setFormData((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const isStep1Valid = formData.name && formData.company && formData.email && formData.jobTitle;
  const isStep2Valid = true; // LOS/POS are optional

  const handleNext = () => {
    if (step === 1 && isStep1Valid) {
      setStep(2);
    } else if (step === 2) {
      onSubmit(formData);
    }
  };

  const losSystems = [
    { value: '', label: 'Select your LOS...' },
    { value: 'encompass', label: 'Encompass' },
    { value: 'byte', label: 'Byte' },
    { value: 'empower', label: 'Empower' },
    { value: 'meridianlink', label: 'MeridianLink' },
    { value: 'custom', label: 'Custom/Other' }
  ];

  const posSystems = [
    { value: '', label: 'Select your POS...' },
    { value: 'blend', label: 'Blend' },
    { value: 'ice', label: 'ICE Mortgage' },
    { value: 'maxwell', label: 'Maxwell' },
    { value: 'floify', label: 'Floify' },
    { value: 'custom', label: 'Custom/Other' }
  ];

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-[20px] shadow-2xl w-full max-w-[520px] overflow-hidden"
      >
        {/* Header */}
        <div className="p-8 border-b border-border">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[32px] font-bold text-dark tracking-tight">Unlock Your Full Report</h2>
            <button
              onClick={onClose}
              className="text-gray hover:text-dark transition-colors"
            >
              <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Step Indicator */}
          <div className="flex items-center justify-center gap-2">
            <div className={`w-2 h-2 rounded-full transition-colors ${step === 1 ? 'bg-truv-blue' : 'bg-gray-300'}`} />
            <div className={`w-2 h-2 rounded-full transition-colors ${step === 2 ? 'bg-truv-blue' : 'bg-gray-300'}`} />
          </div>
        </div>

        {/* Form Content */}
        <div className="p-6">
          <AnimatePresence mode="wait">
            {step === 1 ? (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-4"
              >
                <div>
                  <label className="block text-sm font-medium text-dark mb-1">Full Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={handleChange('name')}
                    className="w-full px-4 py-3 border border-border rounded-xl focus:border-truv-blue focus:ring-2 focus:ring-truv-blue-glow outline-none transition-all"
                    placeholder="John Smith"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-dark mb-1">Company *</label>
                  <input
                    type="text"
                    value={formData.company}
                    onChange={handleChange('company')}
                    className="w-full px-4 py-3 border border-border rounded-xl focus:border-truv-blue focus:ring-2 focus:ring-truv-blue-glow outline-none transition-all"
                    placeholder="Acme Lending"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-dark mb-1">Work Email *</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={handleChange('email')}
                    className="w-full px-4 py-3 border border-border rounded-xl focus:border-truv-blue focus:ring-2 focus:ring-truv-blue-glow outline-none transition-all"
                    placeholder="john@acmelending.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-dark mb-1">Job Title *</label>
                  <input
                    type="text"
                    value={formData.jobTitle}
                    onChange={handleChange('jobTitle')}
                    className="w-full px-4 py-3 border border-border rounded-xl focus:border-truv-blue focus:ring-2 focus:ring-truv-blue-glow outline-none transition-all"
                    placeholder="VP of Operations"
                  />
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <p className="text-gray text-sm mb-4">
                  Help us provide a more tailored recommendation (optional)
                </p>

                <div>
                  <label className="block text-sm font-medium text-dark mb-1">Phone</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={handleChange('phone')}
                    className="w-full px-4 py-3 border border-border rounded-xl focus:border-truv-blue focus:ring-2 focus:ring-truv-blue-glow outline-none transition-all"
                    placeholder="(555) 123-4567"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-dark mb-1">
                    Loan Origination System (LOS)
                  </label>
                  <select
                    value={formData.losSystem}
                    onChange={handleChange('losSystem')}
                    className="w-full px-4 py-3 border border-border rounded-xl focus:border-truv-blue focus:ring-2 focus:ring-truv-blue-glow outline-none transition-all bg-white"
                  >
                    {losSystems.map((sys) => (
                      <option key={sys.value} value={sys.value}>{sys.label}</option>
                    ))}
                  </select>
                  {formData.losSystem && formData.losSystem !== 'custom' && (
                    <p className="text-xs text-success mt-1">
                      ✓ Native integration available
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-dark mb-1">
                    Point of Sale System (POS)
                  </label>
                  <select
                    value={formData.posSystem}
                    onChange={handleChange('posSystem')}
                    className="w-full px-4 py-3 border border-border rounded-xl focus:border-truv-blue focus:ring-2 focus:ring-truv-blue-glow outline-none transition-all bg-white"
                  >
                    {posSystems.map((sys) => (
                      <option key={sys.value} value={sys.value}>{sys.label}</option>
                    ))}
                  </select>
                  {formData.posSystem && formData.posSystem !== 'custom' && (
                    <p className="text-xs text-success mt-1">
                      ✓ Native integration available
                    </p>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="p-8 border-t border-border flex flex-col gap-4">
          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            onClick={handleNext}
            disabled={step === 1 ? !isStep1Valid : !isStep2Valid}
            className={`w-full py-[18px] rounded-full font-semibold transition-all ${
              (step === 1 ? isStep1Valid : isStep2Valid)
                ? 'bg-truv-blue text-white hover:bg-truv-blue-dark'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            {step === 1 ? 'Continue' : 'Get My Report'}
          </motion.button>
          {step === 2 && (
            <button
              type="button"
              onClick={() => setStep(1)}
              className="w-full text-truv-blue font-medium text-base hover:underline"
            >
              Back
            </button>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
