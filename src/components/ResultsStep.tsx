import { motion } from 'framer-motion';
import { useState } from 'react';
import type { CalculationResults, AdvancedInputs } from '../types';
import { formatCurrency, formatNumber, formatPercent } from '../utils/calculations';

interface ResultsStepProps {
    results: CalculationResults;
    fundedLoans: number;
    isGated: boolean;
    onUnlock: () => void;
    advancedInputs: AdvancedInputs;
    onAdvancedInputsChange: (inputs: AdvancedInputs) => void;
}

export function ResultsStep({
    results,
    fundedLoans,
    isGated,
    onUnlock,
    advancedInputs,
    onAdvancedInputsChange
}: ResultsStepProps) {
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [showCalculationDetails, setShowCalculationDetails] = useState(false);

    // Calculate per-loan costs for explanation
    const currentCostPerLoan = fundedLoans > 0 ? results.currentCost / fundedLoans : 0;
    const truvCostPerLoan = fundedLoans > 0 ? results.futureCost / fundedLoans : 0;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-8"
        >
            {/* Always visible: Headline savings */}
            <div className="text-center space-y-3">
                <h2 className="text-3xl font-bold text-dark">Your Potential Savings</h2>
                <div className="text-5xl font-bold text-truv-blue tracking-tight py-4">
                    {formatCurrency(results.annualSavings)}
                    <span className="text-lg text-gray-500 font-normal ml-2">/ year</span>
                </div>
                <p className="text-gray-600">
                    Based on a <span className="font-semibold text-gray-900">{formatCurrency(results.savingsPerLoan)}</span> cost reduction per loan at <span className="font-semibold text-gray-900">{formatNumber(fundedLoans)}</span> loans/year
                </p>

                {/* Expandable calculation explanation */}
                <div className="pt-2">
                    <button
                        onClick={() => setShowCalculationDetails(!showCalculationDetails)}
                        className="inline-flex items-center gap-1 text-sm text-truv-blue hover:text-truv-blue-dark transition-colors"
                    >
                        <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            className={`transition-transform ${showCalculationDetails ? 'rotate-180' : ''}`}
                        >
                            <path d="M6 9l6 6 6-6"/>
                        </svg>
                        {showCalculationDetails ? 'Hide calculation' : 'How we calculated this'}
                    </button>

                    {showCalculationDetails && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="mt-4 p-4 bg-gray-50 rounded-xl text-left text-sm"
                        >
                            <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-600">Your current cost per loan</span>
                                    <span className="font-medium text-gray-900">{formatCurrency(Math.round(currentCostPerLoan))}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-600">Truv cost per loan</span>
                                    <span className="font-medium text-truv-blue">{formatCurrency(Math.round(truvCostPerLoan))}</span>
                                </div>
                                <div className="border-t border-gray-200 pt-3 flex justify-between items-center">
                                    <span className="font-medium text-gray-900">Savings per loan</span>
                                    <span className="font-bold text-green-600">{formatCurrency(results.savingsPerLoan)}</span>
                                </div>
                                <p className="text-xs text-gray-500 pt-2">
                                    Current costs include VOA fees ($10/each) and TWN fees ($62/each) based on industry conversion rates.
                                    Truv pricing uses PFL bundle pricing plus fallback TWN costs for verifications that require it.
                                </p>
                            </div>
                        </motion.div>
                    )}
                </div>
            </div>

            {/* Gated Content Section */}
            {isGated ? (
                <div className="relative">
                    {/* Blurred Preview */}
                    <div className="filter blur-sm opacity-60 pointer-events-none select-none">
                        <div className="grid grid-cols-2 gap-4 p-5 bg-gray-50 rounded-xl">
                            <div className="text-center">
                                <div className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">Current Cost</div>
                                <div className="text-xl font-bold text-gray-900">{formatCurrency(results.currentCost)}</div>
                            </div>
                            <div className="text-center">
                                <div className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">With Truv</div>
                                <div className="text-xl font-bold text-green-600">{formatCurrency(results.futureCost)}</div>
                            </div>
                        </div>
                        <div className="h-32 bg-gray-100 rounded-xl mt-4"></div>
                    </div>

                    {/* Gated Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/90 to-white flex flex-col items-center justify-center p-10 text-center">
                        <h3 className="text-xl font-semibold text-dark mb-2">See the full breakdown</h3>
                        <p className="text-sm text-gray-500 mb-6">Line-by-line costs, funnel visualization & more</p>
                        <button
                            onClick={onUnlock}
                            className="inline-flex items-center gap-2 bg-truv-blue text-white font-semibold py-4 px-8 rounded-xl shadow-lg hover:bg-truv-blue-dark transition-all transform hover:scale-[1.02]"
                        >
                            Unlock Full Report
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                            </svg>
                        </button>
                    </div>
                </div>
            ) : (
                /* Unlocked Full Results */
                <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="p-6 rounded-2xl bg-white border border-gray-100 shadow-sm text-center">
                            <h3 className="text-gray-500 font-medium text-sm uppercase tracking-wider mb-2">Current Cost</h3>
                            <div className="text-2xl font-bold text-gray-900">{formatCurrency(results.currentCost)}</div>
                            <div className="text-sm text-gray-400 mt-1">Legacy Process</div>
                        </div>

                        <div className="p-6 rounded-2xl bg-white border border-truv-blue shadow-sm text-center relative overflow-hidden">
                            <div className="absolute top-0 left-0 right-0 h-1 bg-truv-blue" />
                            <h3 className="text-truv-blue font-medium text-sm uppercase tracking-wider mb-2">Truv Cost</h3>
                            <div className="text-2xl font-bold text-truv-blue">{formatCurrency(results.futureCost)}</div>
                            <div className="text-sm text-gray-400 mt-1">PFL Bundle + Fallback</div>
                        </div>
                    </div>

                    <div className="bg-gray-50 rounded-2xl p-6">
                        <div className="flex justify-between items-center mb-2">
                            <h3 className="font-semibold text-gray-900">How Truv Handles Your Verifications</h3>
                            <span className="text-sm text-green-600 font-medium bg-green-50 px-3 py-1 rounded-full">
                                {formatPercent(results.manualReduction)} less TWN usage
                            </span>
                        </div>
                        <p className="text-xs text-gray-500 mb-4">
                            Estimated annual verification volume based on your loan count
                        </p>

                        <div className="space-y-3 text-sm">
                            <div className="flex justify-between items-start">
                                <div>
                                    <span className="text-gray-900 font-medium">Income verified by Truv</span>
                                    <p className="text-xs text-gray-500">Direct payroll connections (VOIE)</p>
                                </div>
                                <span className="font-semibold text-truv-blue">{formatNumber(results.truvVOIEs)}</span>
                            </div>
                            <div className="flex justify-between items-start">
                                <div>
                                    <span className="text-gray-900 font-medium">Assets verified by Truv</span>
                                    <p className="text-xs text-gray-500">Bank account connections (VOA)</p>
                                </div>
                                <span className="font-semibold text-truv-blue">{formatNumber(results.truvVOAs)}</span>
                            </div>
                            <div className="flex justify-between items-start border-t border-gray-200 pt-3 mt-3">
                                <div>
                                    <span className="text-gray-900 font-medium">TWN fallback required</span>
                                    <p className="text-xs text-gray-500">When direct verification isn't available</p>
                                </div>
                                <span className="font-medium text-gray-600">{formatNumber(results.remainingTWNs)}</span>
                            </div>
                        </div>
                    </div>

                    {showAdvanced ? (
                        <div className="border-t border-gray-200 pt-6">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="font-semibold text-gray-900">Adjust Assumptions</h3>
                                <button
                                    onClick={() => setShowAdvanced(false)}
                                    className="text-sm text-gray-500 hover:text-gray-900"
                                >
                                    Hide
                                </button>
                            </div>

                            <div className="space-y-6">
                                {/* Retail vs Wholesale */}
                                <div>
                                    <div className="flex justify-between items-center mb-2">
                                        <label className="text-sm font-medium text-gray-700">Retail vs Wholesale</label>
                                        <span className="text-sm text-gray-500">{advancedInputs.retailPercent}% / {advancedInputs.wholesalePercent}%</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="0"
                                        max="100"
                                        value={advancedInputs.retailPercent}
                                        onChange={(e) => {
                                            const retail = Number(e.target.value);
                                            onAdvancedInputsChange({ ...advancedInputs, retailPercent: retail, wholesalePercent: 100 - retail });
                                        }}
                                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-truv-blue"
                                    />
                                    <div className="flex justify-between text-xs text-gray-400 mt-1">
                                        <span>Retail</span>
                                        <span>Wholesale</span>
                                    </div>
                                </div>

                                {/* Borrowers per App */}
                                <div>
                                    <div className="flex justify-between items-center mb-2">
                                        <label className="text-sm font-medium text-gray-700">Borrowers per Application</label>
                                        <span className="text-sm text-gray-500">{advancedInputs.borrowersPerApp.toFixed(1)}</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="1"
                                        max="2.5"
                                        step="0.1"
                                        value={advancedInputs.borrowersPerApp}
                                        onChange={(e) => onAdvancedInputsChange({ ...advancedInputs, borrowersPerApp: Number(e.target.value) })}
                                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-truv-blue"
                                    />
                                    <div className="flex justify-between text-xs text-gray-400 mt-1">
                                        <span>1.0</span>
                                        <span>2.5</span>
                                    </div>
                                </div>

                                {/* End-to-End Conversion Rate */}
                                <div>
                                    <div className="flex justify-between items-center mb-2">
                                        <label className="text-sm font-medium text-gray-700">End-to-End Conversion Rate</label>
                                        <span className="text-sm text-gray-500">{advancedInputs.endToEndCR}%</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="20"
                                        max="80"
                                        value={advancedInputs.endToEndCR}
                                        onChange={(e) => onAdvancedInputsChange({ ...advancedInputs, endToEndCR: Number(e.target.value) })}
                                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-truv-blue"
                                    />
                                    <div className="flex justify-between text-xs text-gray-400 mt-1">
                                        <span>20%</span>
                                        <span>80%</span>
                                    </div>
                                </div>

                                {/* Pull-Through Rate */}
                                <div>
                                    <div className="flex justify-between items-center mb-2">
                                        <label className="text-sm font-medium text-gray-700">Pull-Through Rate</label>
                                        <span className="text-sm text-gray-500">{advancedInputs.pullThroughRate}%</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="40"
                                        max="90"
                                        value={advancedInputs.pullThroughRate}
                                        onChange={(e) => onAdvancedInputsChange({ ...advancedInputs, pullThroughRate: Number(e.target.value) })}
                                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-truv-blue"
                                    />
                                    <div className="flex justify-between text-xs text-gray-400 mt-1">
                                        <span>40%</span>
                                        <span>90%</span>
                                    </div>
                                </div>

                                {/* W-2 Borrower Rate */}
                                <div>
                                    <div className="flex justify-between items-center mb-2">
                                        <label className="text-sm font-medium text-gray-700">W-2 Borrower Rate</label>
                                        <span className="text-sm text-gray-500">{advancedInputs.w2Rate}%</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="50"
                                        max="95"
                                        value={advancedInputs.w2Rate}
                                        onChange={(e) => onAdvancedInputsChange({ ...advancedInputs, w2Rate: Number(e.target.value) })}
                                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-truv-blue"
                                    />
                                    <div className="flex justify-between text-xs text-gray-400 mt-1">
                                        <span>50%</span>
                                        <span>95%</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <button
                            onClick={() => setShowAdvanced(true)}
                            className="text-sm text-truv-blue hover:text-truv-blue-dark underline flex items-center justify-center w-full gap-1"
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M12 3v18M3 12h18"/>
                            </svg>
                            Adjust Assumptions
                        </button>
                    )}

                    <div className="pt-4 space-y-3">
                        <button
                            className="w-full bg-truv-blue text-white font-semibold py-4 rounded-full shadow-lg hover:bg-truv-blue-dark transition-all transform hover:scale-[1.02]"
                        >
                            Download Full Report
                        </button>
                        <button
                            className="w-full bg-white text-truv-blue font-semibold py-4 rounded-full border-2 border-truv-blue hover:bg-truv-blue-light transition-all"
                        >
                            Talk to Sales
                        </button>
                        <button
                            onClick={() => window.location.reload()}
                            className="w-full text-gray-500 hover:text-gray-900 font-medium py-2"
                        >
                            Start Over
                        </button>
                    </div>
                </>
            )}
        </motion.div>
    );
}
