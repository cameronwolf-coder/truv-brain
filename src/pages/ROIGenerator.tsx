import { useState } from 'react';
import { useROICalculator } from '../hooks/useROICalculator';
import { generateROIReport } from '../utils/pdfGenerator';
import { formatCurrency, formatNumber, formatPercent } from '../utils/calculations';

export function ROIGenerator() {
  const {
    inputs,
    results,
    totalApplications,
    totalBorrowersToVerify,
    updateInput,
    updateAdvancedInput,
  } = useROICalculator();

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGeneratePDF = async () => {
    if (!inputs.companyName.trim()) {
      alert('Please enter a company name');
      return;
    }

    setIsGenerating(true);
    try {
      generateROIReport(
        results,
        inputs.fundedLoans,
        inputs.advancedInputs,
        inputs.companyName
      );
    } finally {
      setTimeout(() => setIsGenerating(false), 1000);
    }
  };

  const isValid = inputs.companyName.trim() && inputs.fundedLoans > 0;

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">ROI Generator</h1>
        <p className="text-gray-500 mt-1">
          Generate branded ROI analysis PDFs for prospects
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left Column - Input Form */}
        <div className="lg:col-span-2 space-y-6">
          {/* Company Name */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h2 className="font-medium text-gray-900 mb-4">Prospect Information</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Company Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={inputs.companyName}
                onChange={(e) => updateInput('companyName', e.target.value)}
                placeholder="Enter company name"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Loan Volume */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h2 className="font-medium text-gray-900 mb-4">Loan Volume</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Funded Loans Per Year
              </label>
              <input
                type="number"
                value={inputs.fundedLoans}
                onChange={(e) => updateInput('fundedLoans', parseInt(e.target.value) || 0)}
                min={0}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Advanced Settings */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
            >
              <span className="font-medium text-gray-900">Advanced Settings</span>
              <svg
                className={`w-5 h-5 text-gray-500 transition-transform ${showAdvanced ? 'rotate-180' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showAdvanced && (
              <div className="px-5 pb-5 space-y-4 border-t border-gray-100 pt-4">
                {/* Conversion Rate */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    End-to-End Conversion Rate (%)
                  </label>
                  <input
                    type="number"
                    value={inputs.advancedInputs.endToEndCR}
                    onChange={(e) => updateAdvancedInput('endToEndCR', parseFloat(e.target.value) || 0)}
                    min={1}
                    max={100}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">Apps to funded loans</p>
                </div>

                {/* Borrowers Per App */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Borrowers Per Application
                  </label>
                  <input
                    type="number"
                    value={inputs.advancedInputs.borrowersPerApp}
                    onChange={(e) => updateAdvancedInput('borrowersPerApp', parseFloat(e.target.value) || 0)}
                    min={1}
                    max={5}
                    step={0.1}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                {/* Pull Through Rate */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Pull Through Rate (%)
                  </label>
                  <input
                    type="number"
                    value={inputs.advancedInputs.pullThroughRate}
                    onChange={(e) => updateAdvancedInput('pullThroughRate', parseFloat(e.target.value) || 0)}
                    min={1}
                    max={100}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">Verification completion rate</p>
                </div>

                {/* W-2 Rate */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    W-2 Employee Rate (%)
                  </label>
                  <input
                    type="number"
                    value={inputs.advancedInputs.w2Rate}
                    onChange={(e) => updateAdvancedInput('w2Rate', parseFloat(e.target.value) || 0)}
                    min={0}
                    max={100}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">vs. self-employed</p>
                </div>

                {/* Retail/Wholesale Split */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Retail (%)
                    </label>
                    <input
                      type="number"
                      value={inputs.advancedInputs.retailPercent}
                      onChange={(e) => {
                        const retail = parseFloat(e.target.value) || 0;
                        updateAdvancedInput('retailPercent', retail);
                        updateAdvancedInput('wholesalePercent', 100 - retail);
                      }}
                      min={0}
                      max={100}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Wholesale (%)
                    </label>
                    <input
                      type="number"
                      value={inputs.advancedInputs.wholesalePercent}
                      onChange={(e) => {
                        const wholesale = parseFloat(e.target.value) || 0;
                        updateAdvancedInput('wholesalePercent', wholesale);
                        updateAdvancedInput('retailPercent', 100 - wholesale);
                      }}
                      min={0}
                      max={100}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column - Preview */}
        <div className="lg:col-span-3 space-y-6">
          {/* Results Summary */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h2 className="font-medium text-gray-900 mb-4">ROI Preview</h2>

            {/* Annual Savings Highlight */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl p-6 text-white mb-6">
              <p className="text-sm opacity-90 mb-1">Estimated Annual Savings</p>
              <p className="text-4xl font-bold">{formatCurrency(results.annualSavings)}</p>
              <p className="text-sm opacity-80 mt-2">
                {inputs.companyName || 'Company'} • {formatNumber(inputs.fundedLoans)} loans/year
              </p>
            </div>

            {/* Key Metrics Grid */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-gray-50 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(results.savingsPerLoan)}</p>
                <p className="text-xs text-gray-500 mt-1">Savings Per Loan</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-gray-900">{formatPercent(results.manualReduction)}</p>
                <p className="text-xs text-gray-500 mt-1">TWN Reduction</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-gray-900">{formatNumber(inputs.fundedLoans)}</p>
                <p className="text-xs text-gray-500 mt-1">Annual Loans</p>
              </div>
            </div>

            {/* Cost Comparison */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-500 mb-1">Current Cost (Legacy)</p>
                <p className="text-xl font-bold text-gray-900">{formatCurrency(results.currentCost)}</p>
              </div>
              <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                <p className="text-sm text-blue-600 mb-1">Future Cost (With Truv)</p>
                <p className="text-xl font-bold text-gray-900">{formatCurrency(results.futureCost)}</p>
              </div>
            </div>

            {/* Verification Breakdown */}
            <h3 className="text-sm font-medium text-gray-700 mb-3">Verification Breakdown</h3>
            <div className="space-y-2 mb-6">
              <div className="flex items-center justify-between py-2 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                  <span className="text-sm text-gray-600">Truv VOIEs</span>
                </div>
                <span className="font-medium text-gray-900">{formatNumber(results.truvVOIEs)}/yr</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                  <span className="text-sm text-gray-600">Truv VOAs</span>
                </div>
                <span className="font-medium text-gray-900">{formatNumber(results.truvVOAs)}/yr</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-gray-400 rounded-full"></span>
                  <span className="text-sm text-gray-600">TWN Fallback</span>
                </div>
                <span className="font-medium text-gray-900">{formatNumber(results.remainingTWNs)}/yr</span>
              </div>
            </div>

            {/* Funnel Info */}
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <p className="text-xs font-medium text-gray-500 mb-2">Why more verifications than loans?</p>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Applications started ({inputs.advancedInputs.endToEndCR}% CR)</span>
                <span className="font-medium">{formatNumber(totalApplications)}</span>
              </div>
              <div className="flex justify-between text-sm mt-1">
                <span className="text-gray-600">Borrowers to verify ({inputs.advancedInputs.borrowersPerApp}/app)</span>
                <span className="font-medium">{formatNumber(totalBorrowersToVerify)}</span>
              </div>
            </div>

            {/* Generate Button */}
            <button
              onClick={handleGeneratePDF}
              disabled={!isValid || isGenerating}
              className={`w-full py-3 px-4 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
                isValid && !isGenerating
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-gray-200 text-gray-500 cursor-not-allowed'
              }`}
            >
              {isGenerating ? (
                <>
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Generating PDF...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Generate PDF Report
                </>
              )}
            </button>
            {!inputs.companyName.trim() && (
              <p className="text-xs text-red-500 mt-2 text-center">Enter a company name to generate PDF</p>
            )}
          </div>

          {/* PDF Preview Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
            <h3 className="font-medium text-blue-900 mb-2">What's in the PDF?</h3>
            <div className="text-sm text-blue-700 space-y-2">
              <p><strong>Page 1:</strong> ROI Analysis Report with savings breakdown, cost comparison, and verification metrics</p>
              <p><strong>Page 2:</strong> Features & Benefits overview with VOIE/VOA capabilities and technical specs</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
