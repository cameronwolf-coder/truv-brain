import { motion } from 'framer-motion';
import type { FormData } from '../types';

interface UseCaseStepProps {
    onSelect: (industry: FormData['industry']) => void;
}

const useCases = [
    { label: 'Mortgage', value: 'mortgage' },
    { label: 'Public services', value: 'public_services' },
    { label: 'Consumer / Auto lending', value: 'consumer_auto' },
    { label: 'Fintech / Retail banking', value: 'fintech_retail' },
    { label: 'Tenant screening', value: 'tenant_screening' },
    { label: 'Background screening', value: 'background_screening' },
    { label: 'Other', value: 'other' },
] as const;

export function UseCaseStep({ onSelect }: UseCaseStepProps) {
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
                    What's your use case?
                </h1>
            </div>

            <div className="space-y-4">
                {useCases.map((useCase) => (
                    <motion.button
                        key={useCase.value}
                        whileHover={{ scale: 1.01, borderColor: '#2c64e3' }}
                        whileTap={{ scale: 0.99 }}
                        onClick={() => onSelect(useCase.value as FormData['industry'])}
                        className="w-full text-left px-6 py-5 text-lg font-medium text-dark bg-white border border-gray-200 rounded-xl hover:shadow-md transition-all outline-none focus:ring-2 focus:ring-truv-blue-glow"
                    >
                        {useCase.label}
                    </motion.button>
                ))}
            </div>
        </motion.div>
    );
}
