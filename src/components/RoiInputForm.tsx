
import React from 'react';
import type { ROIInputs } from '../utils/roiCalculator';

interface Props {
    inputs: ROIInputs;
    onChange: (inputs: ROIInputs) => void;
}

export const RoiInputForm: React.FC<Props> = ({ inputs, onChange }) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        onChange({
            ...inputs,
            // Handle empty string to avoid NaN in controlled inputs
            [name]: value === '' ? 0 : parseFloat(value),
        });
    };

    return (
        <div className="bg-white rounded-2xl shadow-sm p-8 border border-gray-100">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Calculator Inputs</h2>

            <div className="space-y-6">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Funded Loans (Annually)
                    </label>
                    <input
                        type="number"
                        name="fundedLoans"
                        value={inputs.fundedLoans}
                        onChange={handleChange}
                        className="block w-full rounded-lg border-gray-200 shadow-sm focus:border-truv-blue focus:ring-truv-blue sm:text-sm p-3"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Pull-through Rate (%)
                    </label>
                    <input
                        type="number"
                        name="pullThroughRate"
                        step="0.01"
                        value={inputs.pullThroughRate}
                        onChange={handleChange}
                        className="block w-full rounded-lg border-gray-200 shadow-sm focus:border-truv-blue focus:ring-truv-blue sm:text-sm p-3"
                    />
                    <p className="mt-1 text-xs text-gray-500">Apps Submitted → Funded (e.g., 0.7)</p>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        E2E Conversion Rate
                    </label>
                    <input
                        type="number"
                        name="e2eConversionRate"
                        step="0.01"
                        value={inputs.e2eConversionRate}
                        onChange={handleChange}
                        className="block w-full rounded-lg border-gray-200 shadow-sm focus:border-truv-blue focus:ring-truv-blue sm:text-sm p-3"
                    />
                    <p className="mt-1 text-xs text-gray-500">Apps Started → Funded (e.g., 0.5)</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Borrowers per App
                        </label>
                        <input
                            type="number"
                            name="borrowersPerApp"
                            step="0.1"
                            value={inputs.borrowersPerApp}
                            onChange={handleChange}
                            className="block w-full rounded-lg border-gray-200 shadow-sm focus:border-truv-blue focus:ring-truv-blue sm:text-sm p-3"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            W-2 Borrower Rate
                        </label>
                        <input
                            type="number"
                            name="w2BorrowerRate"
                            step="0.01"
                            value={inputs.w2BorrowerRate}
                            onChange={handleChange}
                            className="block w-full rounded-lg border-gray-200 shadow-sm focus:border-truv-blue focus:ring-truv-blue sm:text-sm p-3"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};
