import html2pdf from 'html2pdf.js';
import type { CalculationResults, AdvancedInputs } from '../types';
import { formatCurrency, formatNumber, formatPercent } from './calculations';

export function generateROIReport(
    results: CalculationResults,
    fundedLoans: number,
    advancedInputs: AdvancedInputs
): void {
    // Create container element
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    container.style.top = '0';

    // Build the PDF content
    container.innerHTML = `
        <div style="
            width: 210mm;
            min-height: 297mm;
            background: #ffffff;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            color: #171717;
            line-height: 1.5;
        ">
            <!-- Header with dark gradient -->
            <div style="
                background: linear-gradient(135deg, #020617 0%, #0F1C47 40%, #172554 100%);
                padding: 32px 40px;
                color: white;
            ">
                <div style="font-size: 28px; font-weight: 700; margin-bottom: 24px;">truv</div>
                <div style="font-size: 32px; font-weight: 700; margin-bottom: 8px;">ROI Analysis Report</div>
                <div style="font-size: 16px; opacity: 0.8;">Your personalized savings breakdown</div>
                <div style="position: absolute; top: 32px; right: 40px; font-size: 13px; opacity: 0.7; color: white;">
                    ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                </div>
            </div>

            <!-- Content -->
            <div style="padding: 40px;">
                <!-- Hero savings card -->
                <div style="
                    background: linear-gradient(135deg, #2C64E3 0%, #0F1C47 100%);
                    border-radius: 16px;
                    padding: 32px;
                    color: white;
                    text-align: center;
                    margin-bottom: 32px;
                ">
                    <div style="font-size: 14px; opacity: 0.9; margin-bottom: 8px;">Estimated Annual Savings</div>
                    <div style="font-size: 48px; font-weight: 700; letter-spacing: -2px; margin-bottom: 8px;">
                        ${formatCurrency(results.annualSavings)}
                    </div>
                    <div style="font-size: 14px; opacity: 0.85;">
                        Based on ${formatNumber(fundedLoans)} funded loans per year
                    </div>
                </div>

                <!-- ROI pills -->
                <div style="display: flex; gap: 12px; margin-bottom: 32px;">
                    <div style="
                        flex: 1;
                        background: linear-gradient(135deg, #dcfce7 0%, #f0fdf4 100%);
                        border: 1px solid #86efac;
                        border-radius: 12px;
                        padding: 20px;
                        text-align: center;
                    ">
                        <div style="font-size: 24px; font-weight: 700; color: #16a34a; margin-bottom: 4px;">
                            ${formatCurrency(results.savingsPerLoan)}
                        </div>
                        <div style="font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">
                            Per Funded Loan
                        </div>
                    </div>
                    <div style="
                        flex: 1;
                        background: #f8fafc;
                        border: 1px solid #e2e8f0;
                        border-radius: 12px;
                        padding: 20px;
                        text-align: center;
                    ">
                        <div style="font-size: 24px; font-weight: 700; color: #171717; margin-bottom: 4px;">
                            ${formatPercent(results.manualReduction)}
                        </div>
                        <div style="font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">
                            TWN Reduction
                        </div>
                    </div>
                    <div style="
                        flex: 1;
                        background: #f8fafc;
                        border: 1px solid #e2e8f0;
                        border-radius: 12px;
                        padding: 20px;
                        text-align: center;
                    ">
                        <div style="font-size: 24px; font-weight: 700; color: #171717; margin-bottom: 4px;">
                            ${formatNumber(results.truvVOIEs + results.truvVOAs)}
                        </div>
                        <div style="font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">
                            Truv Verifications
                        </div>
                    </div>
                </div>

                <!-- Cost comparison section title -->
                <div style="
                    font-size: 18px;
                    font-weight: 600;
                    color: #171717;
                    margin-bottom: 16px;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                ">
                    <span style="width: 4px; height: 20px; background: #2C64E3; border-radius: 2px; display: inline-block;"></span>
                    Cost Comparison
                </div>

                <!-- Cost comparison cards -->
                <div style="display: flex; gap: 16px; margin-bottom: 32px;">
                    <div style="
                        flex: 1;
                        background: #f8fafc;
                        border-radius: 12px;
                        padding: 24px;
                        border: 1px solid #e2e8f0;
                    ">
                        <div style="font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; margin-bottom: 12px;">
                            Current Cost
                        </div>
                        <div style="font-size: 28px; font-weight: 700; color: #171717; margin-bottom: 4px;">
                            ${formatCurrency(results.currentCost)}
                        </div>
                        <div style="font-size: 13px; color: #64748b;">Legacy verification process</div>
                    </div>
                    <div style="
                        flex: 1;
                        background: linear-gradient(135deg, #eff6ff 0%, #f8fafc 100%);
                        border-radius: 12px;
                        padding: 24px;
                        border: 1px solid #93c5fd;
                        border-top: 3px solid #2C64E3;
                    ">
                        <div style="font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #2C64E3; margin-bottom: 12px;">
                            With Truv
                        </div>
                        <div style="font-size: 28px; font-weight: 700; color: #171717; margin-bottom: 4px;">
                            ${formatCurrency(results.futureCost)}
                        </div>
                        <div style="font-size: 13px; color: #64748b;">PFL Bundle + Fallback</div>
                    </div>
                </div>

                <!-- Verification breakdown header -->
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                    <div style="
                        font-size: 18px;
                        font-weight: 600;
                        color: #171717;
                        display: flex;
                        align-items: center;
                        gap: 8px;
                    ">
                        <span style="width: 4px; height: 20px; background: #2C64E3; border-radius: 2px; display: inline-block;"></span>
                        How Truv Handles Your Verifications
                    </div>
                    <div style="
                        background: #dcfce7;
                        color: #16a34a;
                        font-size: 12px;
                        font-weight: 600;
                        padding: 6px 12px;
                        border-radius: 20px;
                    ">
                        ${formatPercent(results.manualReduction)} less TWN usage
                    </div>
                </div>

                <!-- Verification items -->
                <div style="
                    display: flex;
                    align-items: center;
                    padding: 16px;
                    border-radius: 10px;
                    margin-bottom: 8px;
                    background: #ffffff;
                    border: 1px solid #C5D9F7;
                ">
                    <div style="
                        width: 32px;
                        height: 32px;
                        border-radius: 50%;
                        background: #C5D9F7;
                        color: #2C64E3;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        margin-right: 16px;
                        font-size: 14px;
                        font-weight: bold;
                    ">✓</div>
                    <div style="flex: 1;">
                        <div style="font-size: 14px; font-weight: 600; color: #171717; margin-bottom: 2px;">
                            Income verified by Truv
                        </div>
                        <div style="font-size: 12px; color: #64748b;">
                            Direct payroll connections via 1,700+ employers
                        </div>
                    </div>
                    <div style="font-size: 16px; font-weight: 700; color: #2C64E3;">
                        ${formatNumber(results.truvVOIEs)}
                    </div>
                </div>

                <div style="
                    display: flex;
                    align-items: center;
                    padding: 16px;
                    border-radius: 10px;
                    margin-bottom: 8px;
                    background: #ffffff;
                    border: 1px solid #C5D9F7;
                ">
                    <div style="
                        width: 32px;
                        height: 32px;
                        border-radius: 50%;
                        background: #C5D9F7;
                        color: #2C64E3;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        margin-right: 16px;
                        font-size: 14px;
                        font-weight: bold;
                    ">✓</div>
                    <div style="flex: 1;">
                        <div style="font-size: 14px; font-weight: 600; color: #171717; margin-bottom: 2px;">
                            Assets verified by Truv
                        </div>
                        <div style="font-size: 12px; color: #64748b;">
                            Direct bank connections via 16,000+ institutions
                        </div>
                    </div>
                    <div style="font-size: 16px; font-weight: 700; color: #2C64E3;">
                        ${formatNumber(results.truvVOAs)}
                    </div>
                </div>

                <div style="
                    display: flex;
                    align-items: center;
                    padding: 16px;
                    border-radius: 10px;
                    margin-bottom: 32px;
                    background: #f3f4f6;
                ">
                    <div style="
                        width: 32px;
                        height: 32px;
                        border-radius: 50%;
                        background: #e5e7eb;
                        color: #6b7280;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        margin-right: 16px;
                        font-size: 14px;
                    ">↻</div>
                    <div style="flex: 1;">
                        <div style="font-size: 14px; font-weight: 600; color: #171717; margin-bottom: 2px;">
                            TWN fallback required
                        </div>
                        <div style="font-size: 12px; color: #64748b;">
                            Manual process when direct isn't available
                        </div>
                    </div>
                    <div style="font-size: 16px; font-weight: 700; color: #6b7280;">
                        ${formatNumber(results.remainingTWNs)}
                    </div>
                </div>

                <!-- Specs section -->
                <div style="
                    background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
                    border-radius: 16px;
                    padding: 28px;
                    color: white;
                ">
                    <div style="font-size: 14px; font-weight: 600; margin-bottom: 20px; opacity: 0.9;">
                        Calculation Assumptions
                    </div>
                    <div style="display: flex; gap: 16px;">
                        <div style="flex: 1; text-align: center;">
                            <div style="font-size: 11px; opacity: 0.6; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.5px;">
                                Funded Loans
                            </div>
                            <div style="font-size: 15px; font-weight: 600;">
                                ${formatNumber(fundedLoans)}/year
                            </div>
                        </div>
                        <div style="flex: 1; text-align: center;">
                            <div style="font-size: 11px; opacity: 0.6; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.5px;">
                                Retail / Wholesale
                            </div>
                            <div style="font-size: 15px; font-weight: 600;">
                                ${advancedInputs.retailPercent}% / ${advancedInputs.wholesalePercent}%
                            </div>
                        </div>
                        <div style="flex: 1; text-align: center;">
                            <div style="font-size: 11px; opacity: 0.6; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.5px;">
                                Borrowers per App
                            </div>
                            <div style="font-size: 15px; font-weight: 600;">
                                ${advancedInputs.borrowersPerApp.toFixed(1)}
                            </div>
                        </div>
                    </div>
                    <div style="display: flex; gap: 16px; margin-top: 16px;">
                        <div style="flex: 1; text-align: center;">
                            <div style="font-size: 11px; opacity: 0.6; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.5px;">
                                End-to-End CR
                            </div>
                            <div style="font-size: 15px; font-weight: 600;">
                                ${advancedInputs.endToEndCR}%
                            </div>
                        </div>
                        <div style="flex: 1; text-align: center;">
                            <div style="font-size: 11px; opacity: 0.6; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.5px;">
                                Pull-Through Rate
                            </div>
                            <div style="font-size: 15px; font-weight: 600;">
                                ${advancedInputs.pullThroughRate}%
                            </div>
                        </div>
                        <div style="flex: 1; text-align: center;">
                            <div style="font-size: 11px; opacity: 0.6; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.5px;">
                                W-2 Borrower Rate
                            </div>
                            <div style="font-size: 15px; font-weight: 600;">
                                ${advancedInputs.w2Rate}%
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Footer -->
            <div style="
                border-top: 1px solid #e2e8f0;
                padding: 24px 40px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                background: #f8fafc;
            ">
                <div style="font-size: 20px; font-weight: 700; color: #171717;">truv</div>
                <div style="font-size: 12px; color: #64748b;">Ready to start saving? Visit truv.com/demo</div>
                <div style="font-size: 13px; color: #2C64E3; font-weight: 500;">truv.com</div>
            </div>
        </div>
    `;

    document.body.appendChild(container);

    const pageElement = container.firstElementChild as HTMLElement;

    const opt = {
        margin: 0,
        filename: `truv-roi-report-${new Date().toISOString().split('T')[0]}.pdf`,
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: {
            scale: 2,
            useCORS: true,
            letterRendering: true,
            logging: false
        },
        jsPDF: {
            unit: 'mm' as const,
            format: 'a4' as const,
            orientation: 'portrait' as const
        }
    };

    html2pdf()
        .set(opt)
        .from(pageElement)
        .save()
        .then(() => {
            document.body.removeChild(container);
        })
        .catch((err: Error) => {
            console.error('PDF generation error:', err);
            document.body.removeChild(container);
        });
}
