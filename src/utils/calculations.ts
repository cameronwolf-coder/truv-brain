
import type { FormData, AdvancedInputs, CalculationResults } from '../types';

// Pricing / Costs (defaults)
const VOA_COST = 10;
const DEFAULT_TWN_COST = 62; // The Work Number cost per transaction

// Conversion rates - Standard / Legacy
const CURRENT_VOA_CONVERSION = 0.50;
const CURRENT_SSV_CONVERSION = 0.20;
const CURRENT_TWN_CONVERSION = 0.60;

// Conversion rates - Future State (Truv Verified)
const TRUV_VOA_CONVERSION = 0.60;
const TRUV_SSV_CONVERSION = 0.24;
const TRUV_VOIE_CONVERSION = 0.42; // Verified Success Rate
const TRUV_TWN_CONVERSION = 0.36;  // Verified Fallback Rate

// Pricing Tiers (Per Funded Loan)
const PRICING_TIERS = [
    { max: 1999, bundle: 70 },
    { max: 2999, bundle: 67.50 },
    { max: 4499, bundle: 62.50 },
    { max: 7499, bundle: 60.00 },
    { max: 9999, bundle: 55.00 },
    { max: 14999, bundle: 52.50 },
    { max: 24999, bundle: 45.00 },
    { max: 34999, bundle: 40.00 },
    { max: 49999, bundle: 35.00 },
    { max: Infinity, bundle: 30.00 },
];

export const DEFAULT_ADVANCED_INPUTS: AdvancedInputs = {
    retailPercent: 100,
    wholesalePercent: 0,
    borrowersPerApp: 1.5,
    endToEndCR: 50,     // 0.5
    pullThroughRate: 70, // 0.7
    w2Rate: 75          // 0.75
};

export function calculateROI(
    formData: FormData,
    advancedInputs: AdvancedInputs = DEFAULT_ADVANCED_INPUTS,
    costMethod: 'benchmark' | 'per_loan' | 'total_spend' | 'per_verification' = 'benchmark',
    customCost?: number,
    twnCost: number = DEFAULT_TWN_COST
): CalculationResults {
    const { fundedLoans } = formData;
    const { borrowersPerApp, endToEndCR, pullThroughRate, w2Rate } = advancedInputs;
    const TWN_COST = twnCost;

    // Calculate funnel metrics
    const e2eCR = endToEndCR / 100;
    const ptRate = pullThroughRate / 100;
    const w2Percent = w2Rate / 100;

    const retailPct = 1.0;

    const appsStarted = fundedLoans / e2eCR;
    const appSubmissionCR = e2eCR / ptRate;

    // Volume Calculations
    const voasDuringApp = appsStarted * borrowersPerApp * retailPct;
    const w2AppsSubmitted = (fundedLoans / ptRate) * w2Percent;
    const voiesAfterSubmission = w2AppsSubmitted * borrowersPerApp * retailPct;

    // --- Current Cost (Legacy Waterfall) ---
    const currentVOAs = voasDuringApp * CURRENT_VOA_CONVERSION;
    const currentSSV = currentVOAs * CURRENT_SSV_CONVERSION;
    const voiesRequiredAfterSSV = voiesAfterSubmission - (currentSSV * appSubmissionCR);

    const currentTWNInitial = Math.max(0, voiesRequiredAfterSSV * CURRENT_TWN_CONVERSION);
    const currentTWNReverify = currentTWNInitial * ptRate;
    const currentTWNs = currentTWNInitial + currentTWNReverify;

    const currentVOACost = currentVOAs * VOA_COST;
    const currentTWNCost = currentTWNs * TWN_COST;
    const currentCost = currentVOACost + currentTWNCost;


    // --- Future Cost (Truv PFL Bundle + Fallback) ---
    const truvVOAs = voasDuringApp * TRUV_VOA_CONVERSION;
    const truvSSV = truvVOAs * TRUV_SSV_CONVERSION;
    const truvVOIEs = voasDuringApp * w2Percent * TRUV_VOIE_CONVERSION;

    const voiesStillNeeded = voiesAfterSubmission - ((truvSSV + truvVOIEs) * appSubmissionCR);
    const futureTWNInitial = Math.max(0, voiesStillNeeded * TRUV_TWN_CONVERSION);
    const futureTWNReverify = futureTWNInitial * ptRate;
    const remainingTWNs = futureTWNInitial + futureTWNReverify;

    // Cost Calculation

    // A. Bundle Cost (Platform Price)
    const tier = PRICING_TIERS.find(t => fundedLoans <= t.max) || PRICING_TIERS[PRICING_TIERS.length - 1];
    const truvBundlePrice = tier.bundle;
    const truvBundleCost = fundedLoans * truvBundlePrice;

    // B. Fallback Cost (TWN)
    const futureTWNCost = remainingTWNs * TWN_COST;

    const futureCost = truvBundleCost + futureTWNCost;

    // --- Savings ---
    let annualSavings = currentCost - futureCost;

    // Adjust based on cost method if custom cost provided (Legacy Logic kept for compatibility)
    if (customCost && costMethod !== 'benchmark') {
        let comparisonBaseCost = currentCost; // Default

        if (costMethod === 'per_loan') {
            comparisonBaseCost = customCost * fundedLoans;
        } else if (costMethod === 'total_spend') {
            comparisonBaseCost = customCost;
        } else if (costMethod === 'per_verification') {
            // Rough estimate proxy
            const totalVerifications = currentVOAs + currentTWNs;
            comparisonBaseCost = customCost * totalVerifications;
        }

        annualSavings = comparisonBaseCost - futureCost;
    }

    const savingsPerLoan = fundedLoans > 0 ? annualSavings / fundedLoans : 0;
    const manualReduction = currentTWNs > 0 ? ((currentTWNs - remainingTWNs) / currentTWNs) * 100 : 0;

    return {
        annualSavings: Math.round(annualSavings),
        savingsPerLoan: Math.round(savingsPerLoan),
        manualReduction: Math.round(manualReduction),
        currentCost: Math.round(currentCost),
        futureCost: Math.round(futureCost),
        currentVOAs: Math.round(currentVOAs),
        currentTWNs: Math.round(currentTWNs),
        truvVOAs: Math.round(truvVOAs),
        truvVOIEs: Math.round(truvVOIEs),
        remainingTWNs: Math.round(remainingTWNs)
    };
}

export function formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(value);
}

export function formatNumber(value: number): string {
    return new Intl.NumberFormat('en-US').format(value);
}

export function formatPercent(value: number): string {
    return `${Math.round(value)}%`;
}
