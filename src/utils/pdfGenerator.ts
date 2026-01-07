import html2pdf from 'html2pdf.js';
import type { CalculationResults, AdvancedInputs } from '../types';
import { formatCurrency, formatNumber, formatPercent } from './calculations';
import { Analytics } from './analytics';

export function generateROIReport(
    results: CalculationResults,
    fundedLoans: number,
    advancedInputs: AdvancedInputs
): void {
    // 1. Track the download event
    Analytics.trackEvent('roi_pdf_download');

    // Create container element
    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.left = '0';
    container.style.top = '0';
    container.style.zIndex = '-9999';

    const dateStr = new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    const logoSvg = `
        <svg width="100" height="36" viewBox="0 0 69 25" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M5.85522 23.7673C4.18138 23.7673 2.86445 23.2873 1.90445 22.3273C0.969068 21.3673 0.501372 20.0627 0.501372 18.4135V0.210419H4.71061V18.2289C4.71061 18.795 4.88292 19.2627 5.22753 19.632C5.57215 19.9766 6.02753 20.1489 6.59368 20.1489H10.5444V23.7673H5.85522ZM0.5 8.55503V4.93657H10.5814V8.55503H0.5Z" fill="white"/>
            <path d="M14.4254 23.7673V10.2904C14.4254 8.61657 14.8931 7.31196 15.8285 6.37657C16.7885 5.41657 18.1054 4.93657 19.7792 4.93657H24.3208V8.55503H20.5546C19.9638 8.55503 19.4962 8.72734 19.1515 9.07196C18.8315 9.41657 18.6716 9.88427 18.6716 10.475V23.7673H14.4254Z" fill="white"/>
            <path d="M36.2746 24.2104C34.4531 24.2104 32.8654 23.8535 31.5115 23.1397C30.1577 22.4012 29.1115 21.392 28.3731 20.112C27.6346 18.832 27.2654 17.392 27.2654 15.792V4.93657H31.5115V15.755C31.5115 16.715 31.7208 17.5643 32.1392 18.3027C32.5823 19.0166 33.1608 19.5827 33.8746 20.0012C34.6131 20.395 35.4131 20.592 36.2746 20.592C37.1361 20.592 37.9238 20.395 38.6377 20.0012C39.3761 19.5827 39.9546 19.0166 40.373 18.3027C40.8161 17.5643 41.0377 16.715 41.0377 15.755V4.93657H45.2838V15.792C45.2838 17.392 44.9023 18.832 44.1392 20.112C43.4007 21.392 42.3546 22.4012 41.0007 23.1397C39.6715 23.8535 38.0961 24.2104 36.2746 24.2104Z" fill="white"/>
            <path d="M58.4645 24.2104C57.4799 24.2104 56.5937 23.9397 55.806 23.3981C55.0429 22.8566 54.4891 22.1304 54.1445 21.2196L48.3845 4.93657H52.9999L57.9106 19.5581C57.9845 19.7304 58.0706 19.8535 58.1691 19.9273C58.2676 20.0012 58.3783 20.0381 58.5014 20.0381C58.6245 20.0381 58.7352 20.0012 58.8337 19.9273C58.9568 19.8535 59.0429 19.7304 59.0922 19.5581L64.0399 4.93657H68.5814L62.7845 21.2196C62.4645 22.1304 61.9106 22.8566 61.1229 23.3981C60.3352 23.9397 59.4491 24.2104 58.4645 24.2104Z" fill="white"/>
        </svg>
    `;

    const commonStyles = `
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
        
        @font-face {
            font-family: 'Gilroy';
            src: url('/fonts/Gilroy-Medium.woff2') format('woff2'),
                 url('/fonts/Gilroy-Medium.woff') format('woff');
            font-weight: 500;
            font-style: normal;
        }

        @font-face {
            font-family: 'Gilroy';
            src: url('/fonts/Gilroy-SemiBold.woff2') format('woff2'),
                 url('/fonts/Gilroy-SemiBold.woff') format('woff');
            font-weight: 700;
            font-style: normal;
        }

        .page {
            width: 210mm;
            height: 296mm; /* Slightly less than 297mm to prevent blank page overflow */
            background: #ffffff;
            font-family: 'Inter', system-ui, -apple-system, sans-serif;
            color: #1E293B;
            line-height: 1.5;
            box-sizing: border-box;
            position: relative;
            overflow: hidden;
        }

        .header-art {
            height: 80mm;
            width: 100%;
            background: linear-gradient(135deg, #0F172A 0%, #1E3A8A 100%);
            border-radius: 0 0 24px 24px;
            position: relative;
            display: flex;
            align-items: center;
            padding-left: 56px;
            box-sizing: border-box;
        }
        
        .header-title {
            color: white;
            font-size: 36px;
            font-weight: 700;
            margin: 0;
            font-family: 'Gilroy', sans-serif;
        }

        .main-content {
            padding: 40px 56px 40px 56px;
            display: grid;
            grid-template-columns: 1fr 1.3fr;
            gap: 60px;
        }

        .col-left {
            display: flex;
            flex-direction: column;
        }

        h1 {
            font-family: 'Gilroy', sans-serif;
            font-size: 42px;
            font-weight: 700;
            color: #2C64E3;
            margin: 0 0 32px 0;
            line-height: 1.1;
            letter-spacing: -0.02em;
        }

        .highlight-text {
            font-family: 'Gilroy', sans-serif;
            font-size: 18px;
            line-height: 1.6;
            color: #0B0F19;
            margin-bottom: 24px;
            padding-left: 20px;
            border-left: 3px solid #2C64E3;
        }

        .narrative-p {
            font-size: 14px;
            color: #64748B;
            line-height: 1.8;
            margin-bottom: 24px;
        }

        .stat-block {
            margin-top: 40px;
        }

        .stat-row {
            display: flex;
            justify-content: space-between;
            border-bottom: 1px solid #E2E8F0;
            padding: 12px 0;
        }

        .stat-label {
            font-size: 12px;
            font-weight: 600;
            color: #64748B;
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }

        .stat-val {
            font-family: 'Gilroy', sans-serif;
            font-weight: 700;
            color: #2C64E3;
            font-size: 14px;
        }

        .col-right {
            padding-top: 12px;
        }

        h2 {
            font-family: 'Gilroy', sans-serif;
            font-size: 14px;
            font-weight: 700;
            color: #64748B;
            text-transform: uppercase;
            letter-spacing: 0.15em;
            margin: 0 0 32px 0;
            display: flex;
            align-items: center;
        }

        h2::after {
            content: '';
            flex: 1;
            height: 1px;
            background: #E2E8F0;
            margin-left: 16px;
        }

        .capability-group {
            margin-bottom: 32px;
        }

        .cap-title {
            font-family: 'Gilroy', sans-serif;
            font-size: 18px;
            font-weight: 700;
            color: #0B0F19;
            margin: 0 0 8px 0;
        }

        .cap-desc {
            font-size: 14px;
            color: #1E293B;
            line-height: 1.5;
            margin-bottom: 12px;
        }

        .feature-list {
            list-style: none;
            padding: 0;
            margin: 0;
        }

        .feature-item {
            display: flex;
            align-items: baseline;
            gap: 10px;
            font-size: 13px;
            color: #64748B;
            margin-bottom: 8px;
        }

        .bullet {
            color: #2C64E3;
            font-size: 10px;
        }

        .tech-specs {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin-top: 40px;
            border-top: 1px solid #E2E8F0;
            padding-top: 24px;
        }

        .spec-item strong {
            display: block;
            font-size: 11px;
            color: #64748B;
            text-transform: uppercase;
            margin-bottom: 4px;
            font-weight: 600;
        }

        .spec-item span {
            font-family: 'Gilroy', sans-serif;
            font-weight: 600;
            color: #0B0F19;
            font-size: 13px;
        }

        .footer {
            position: absolute;
            bottom: 0;
            left: 0;
            right: 0;
            padding: 0 56px 40px 56px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 11px;
            color: #94A3B8;
        }
    `;

    // Construct the HTML for both pages
    container.innerHTML = `
        <div id="pdf-wrapper">
            <style>${commonStyles}</style>

            <!-- PAGE 1: ROI ANALYSIS -->
            <div class="page" style="page-break-after: always;">
                <div class="header-art">
                    <div style="position: absolute; top: 40px; right: 40px; z-index: 10;">
                        ${logoSvg}
                    </div>
                    <div class="header-title">ROI Analysis Report</div>
                </div>

                <div class="main-content">
                    <!-- LEFT COLUMN -->
                    <div class="col-left">
                        <h1>Annual Savings</h1>

                        <div class="highlight-text">
                            Estimated annual savings of <span style="font-weight: 700; color: #2C64E3;">${formatCurrency(results.annualSavings)}</span> by switching to Truv's direct-to-source verification platform.
                        </div>

                        <p class="narrative-p">
                            Traditional verification methods are manual, slow, and expensive. By leveraging Truv's direct payroll connections, you can reduce reliance on high-cost bureau data (TWN) by ${Math.round(results.manualReduction)}%.
                        </p>

                        <div class="stat-block">
                            <div class="stat-row">
                                <span class="stat-label">Savings Per Loan</span>
                                <span class="stat-val">${formatCurrency(results.savingsPerLoan)}</span>
                            </div>
                            <div class="stat-row">
                                <span class="stat-label">TWN Reduction</span>
                                <span class="stat-val">${formatPercent(results.manualReduction)}</span>
                            </div>
                            <div class="stat-row">
                                <span class="stat-label">Annual Volume</span>
                                <span class="stat-val">${formatNumber(fundedLoans)} loans</span>
                            </div>
                            <div class="stat-row">
                                <span class="stat-label">Date Prepared</span>
                                <span class="stat-val" style="color: #64748B; font-weight: 500;">${dateStr}</span>
                            </div>
                        </div>
                    </div>

                    <!-- RIGHT COLUMN -->
                    <div class="col-right">
                        <h2>Cost Analysis</h2>

                        <div class="capability-group" style="display: flex; gap: 16px;">
                            <div style="flex: 1; background: #F8FAFC; padding: 20px; border-radius: 12px;">
                                <div class="cap-title" style="font-size: 13px; color: #64748B; margin-bottom: 4px;">Current Cost</div>
                                <div style="font-size: 24px; font-weight: 700; color: #0F172A;">${formatCurrency(results.currentCost)}</div>
                                <div class="cap-desc" style="font-size: 12px; margin: 0;">Legacy Process</div>
                            </div>
                            <div style="flex: 1; background: #EFF6FF; padding: 20px; border-radius: 12px; border: 1px solid #BFDBFE;">
                                <div class="cap-title" style="font-size: 13px; color: #2C64E3; margin-bottom: 4px;">Future Cost</div>
                                <div style="font-size: 24px; font-weight: 700; color: #0F172A;">${formatCurrency(results.futureCost)}</div>
                                <div class="cap-desc" style="font-size: 12px; margin: 0;">With Truv</div>
                            </div>
                        </div>

                        <h2>Verification Logic</h2>

                        <div class="capability-group">
                            <div style="display: flex; justify-content: space-between; margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px dashed #E2E8F0;">
                                <div>
                                    <div style="font-weight: 600; color: #0F172A;">Truv Income (VOIE)</div>
                                    <div style="font-size: 12px; color: #64748B;">Direct payroll connections</div>
                                </div>
                                <div style="font-weight: 700; color: #2C64E3;">${formatNumber(results.truvVOIEs)}</div>
                            </div>
                            <div style="display: flex; justify-content: space-between; margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px dashed #E2E8F0;">
                                <div>
                                    <div style="font-weight: 600; color: #0F172A;">Truv Assets (VOA)</div>
                                    <div style="font-size: 12px; color: #64748B;">Direct financial institution connections</div>
                                </div>
                                <div style="font-weight: 700; color: #2C64E3;">${formatNumber(results.truvVOAs)}</div>
                            </div>
                            <div style="display: flex; justify-content: space-between;">
                                <div>
                                    <div style="font-weight: 600; color: #64748B;">TWN Fallback</div>
                                    <div style="font-size: 12px; color: #64748B;">Remaining manual verification</div>
                                </div>
                                <div style="font-weight: 700; color: #64748B;">${formatNumber(results.remainingTWNs)}</div>
                            </div>
                        </div>

                        <div class="tech-specs">
                            <div class="spec-item">
                                <strong>Retail / Wholesale</strong>
                                <span>${advancedInputs.retailPercent}% / ${advancedInputs.wholesalePercent}%</span>
                            </div>
                            <div class="spec-item">
                                <strong>Borrowers / App</strong>
                                <span>${advancedInputs.borrowersPerApp.toFixed(1)}</span>
                            </div>
                            <div class="spec-item">
                                <strong>Pull Through</strong>
                                <span>${advancedInputs.pullThroughRate}%</span>
                            </div>
                            <div class="spec-item">
                                <strong>W-2 Rate</strong>
                                <span>${advancedInputs.w2Rate}%</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="footer">
                    <span>Truv Inc. Confidential</span>
                    <span class="page-num">01 / ANALYSIS</span>
                </div>
            </div>

            <!-- PAGE 2: THE TRUV ADVANTAGE -->
            <div class="page">
                <div class="header-art">
                    <div style="position: absolute; top: 40px; right: 40px; z-index: 10;">
                        ${logoSvg}
                    </div>
                    <div class="header-title">Features and Benefits</div>
                </div>

                <div class="main-content">
                    <!-- LEFT COLUMN -->
                    <div class="col-left">
                        <h1>The Truv Advantage</h1>

                        <div class="highlight-text">
                            "The primary goal of this platform is to verify income, employment, and assets with 100% data integrity."
                        </div>

                        <p class="narrative-p">
                            Traditional verification methods are manual, slow, and prone to fraud. Truv replaces these outdated waterfalls with a single, direct-to-source connection. By connecting to 45+ payroll providers and 13,000+ financial institutions, we empower lenders to make decisions in seconds, not days.
                        </p>

                        <p class="narrative-p">
                            Our platform is built for speed and security, ensuring that every data point retrieved is verified directly from the source—eliminating the risk of manipulated documents.
                        </p>

                        <div style="display: flex; gap: 12px; margin-top: 24px;">
                            <div style="flex: 1; background: #F0F9FF; padding: 16px; border-radius: 8px; text-align: center;">
                                <div style="font-size: 24px; font-weight: 700; color: #2C64E3;">96%</div>
                                <div style="font-size: 11px; color: #64748B; text-transform: uppercase;">Workforce Coverage</div>
                            </div>
                            <div style="flex: 1; background: #F0F9FF; padding: 16px; border-radius: 8px; text-align: center;">
                                <div style="font-size: 24px; font-weight: 700; color: #2C64E3;">80%</div>
                                <div style="font-size: 11px; color: #64748B; text-transform: uppercase;">Cost Savings</div>
                            </div>
                        </div>
                    </div>

                    <!-- RIGHT COLUMN -->
                    <div class="col-right">
                        <h2>Capabilities Overview</h2>

                        <div class="capability-group">
                            <div class="cap-title">Income & Employment (VOIE)</div>
                            <p class="cap-desc">Direct access to payroll data for real-time verification of income, employment status, and pay history.</p>
                            <ul class="feature-list">
                                <li class="feature-item"><span class="bullet">●</span> 45+ Payroll Integrations (ADP, Workday, etc.)</li>
                                <li class="feature-item"><span class="bullet">●</span> Live data pull (No 60-day stale records)</li>
                                <li class="feature-item"><span class="bullet">●</span> PDF Paystub generation included</li>
                            </ul>
                        </div>

                        <div class="capability-group">
                            <div class="cap-title">Asset Verification (VOA)</div>
                            <p class="cap-desc">A complete view of borrower assets, transaction history, and cash flow for smarter underwriting.</p>
                            <ul class="feature-list">
                                <li class="feature-item"><span class="bullet">●</span> 12-24 months of transaction history</li>
                                <li class="feature-item"><span class="bullet">●</span> Automated Cash Flow Analysis (CFA)</li>
                                <li class="feature-item"><span class="bullet">●</span> 100% Fraud detection on bank data</li>
                            </ul>
                        </div>

                        <div class="tech-specs">
                            <div class="spec-item">
                                <strong>API Speed</strong>
                                <span>&lt; 2 Seconds</span>
                            </div>
                            <div class="spec-item">
                                <strong>Integrations</strong>
                                <span>Encompass, nCino</span>
                            </div>
                            <div class="spec-item">
                                <strong>Security</strong>
                                <span>SOC 2 Type II</span>
                            </div>
                            <div class="spec-item">
                                <strong>Uptime</strong>
                                <span>99.9% SLA</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="footer">
                    <span>Truv Inc. Confidential</span>
                    <span class="page-num">02 / OVERVIEW</span>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(container);

    const contentToPrint = document.getElementById('pdf-wrapper');

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
        .from(contentToPrint || container)
        .save()
        .then(() => {
            document.body.removeChild(container);
        })
        .catch((err: Error) => {
            console.error('PDF generation error:', err);
            document.body.removeChild(container);
        });
}
