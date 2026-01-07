
import React from 'react';
import type { ROIOutputs } from '../utils/roiCalculator';

interface Props {
    results: ROIOutputs;
}

const formatCurrency = (val: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);

export const RoiResults: React.FC<Props> = ({ results }) => {
    return (
        <div className="bg-white rounded-2xl shadow-sm p-8 border border-gray-100 h-full">
            <div className="bg-blue-50/50 rounded-xl p-8 text-center mb-10 border border-blue-100">
                <h3 className="text-gray-900 font-medium mb-4">Estimated Annual Savings</h3>
                <div className="text-5xl font-bold text-truv-blue mb-4 tracking-tight">
                    {formatCurrency(results.annualSavings)}
                </div>
                <div className="flex justify-center items-center gap-2 text-sm font-medium">
                    <span className="text-green-600 bg-green-50 px-3 py-1 rounded-full">
                        {results.savingsPercent.toFixed(1)}% Reduction
                    </span>
                    <span className="text-gray-500">
                        {formatCurrency(results.savingsPerLoan)} / loan
                    </span>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-8">
                <div className="bg-gray-50 rounded-xl p-6 text-center">
                    <span className="block text-sm text-gray-500 mb-1">Current Cost</span>
                    <span className="block text-xl font-bold text-red-500">{formatCurrency(results.totalCurrentCost)}</span>
                </div>
                <div className="bg-green-50 rounded-xl p-6 text-center">
                    <span className="block text-sm text-gray-500 mb-1">Truv Cost</span>
                    <span className="block text-xl font-bold text-green-600">{formatCurrency(results.totalTruvCost)}</span>
                </div>
            </div>

            <div>
                <h4 className="font-semibold text-gray-900 mb-4">Cost Breakdown</h4>
                <div className="overflow-hidden">
                    <table className="min-w-full">
                        <thead>
                            <tr className="border-b border-gray-100 text-left">
                                <th className="py-3 text-sm font-medium text-gray-500">Item</th>
                                <th className="py-3 text-sm font-medium text-gray-500">Current</th>
                                <th className="py-3 text-sm font-medium text-gray-500">With Truv</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            <tr>
                                <td className="py-4 text-sm text-gray-900">VOA (Checks)</td>
                                <td className="py-4 text-sm text-gray-600">{formatCurrency(results.currentVOACost)}</td>
                                <td className="py-4 text-sm text-gray-400">—</td>
                            </tr>
                            <tr>
                                <td className="py-4 text-sm text-gray-900">VOIE (Income)</td>
                                <td className="py-4 text-sm text-gray-400">—</td>
                                <td className="py-4 text-sm text-gray-600">{formatCurrency(results.truvVOIECost)} (Bundle)</td>
                            </tr>
                            <tr>
                                <td className="py-4 text-sm text-gray-900">TWN (Legacy)</td>
                                <td className="py-4 text-sm text-gray-600">{formatCurrency(results.currentTWNCost)}</td>
                                <td className="py-4 text-sm text-gray-600">{formatCurrency(results.truvTWNCost)}</td>
                            </tr>
                            <tr className="font-semibold bg-gray-50/50">
                                <td className="py-4 pl-2 text-sm text-gray-900">Total</td>
                                <td className="py-4 text-sm text-gray-900">{formatCurrency(results.totalCurrentCost)}</td>
                                <td className="py-4 text-sm text-gray-900">{formatCurrency(results.totalTruvCost)}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
