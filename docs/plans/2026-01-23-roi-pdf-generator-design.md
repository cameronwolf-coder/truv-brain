# ROI PDF Generator Design

**Date:** 2026-01-23
**Status:** Approved
**Owner:** Cameron Wolf

## Overview

Add PDF generation capabilities to Truv Brain dashboard, starting with ROI Calculator PDFs. Marketing and sales can generate branded, personalized leave-behinds for prospects.

## Audience

- **Marketing** - generating collateral for campaigns and events
- **Sales** - personalized leave-behinds after prospect calls

## Requirements

- Company name personalization (required field)
- Advanced mode with full control over all calculation inputs
- Live preview of calculated results
- Two-page branded PDF matching existing Truv design language

## Page Structure

**Location:** `/roi-generator` in Tools section of sidebar

**Layout:**
- Left side (40%): Input form
  - Company name (required)
  - Funded loans per year
  - Collapsible "Advanced Settings" with detailed inputs
- Right side (60%): Live preview
  - Annual savings, savings per loan, TWN reduction %
  - Verification breakdown (Truv VOIEs, VOAs, TWN fallback)

**Actions:**
- "Generate PDF" button downloads 2-page branded PDF
- Results update in real-time as inputs change

## Calculation Inputs

| Input | Default | Description |
|-------|---------|-------------|
| Company name | (required) | Appears on PDF header |
| Funded loans/year | - | Annual loan volume |
| End-to-end conversion rate | 25% | Apps to funded loans |
| Borrowers per application | 1.3 | Average borrowers |
| Retail % | 70% | Retail vs wholesale split |
| Wholesale % | 30% | Retail vs wholesale split |
| W-2 employee rate | 85% | W-2 vs self-employed |
| Pull-through rate | 65% | Verification completion |
| TWN cost per verification | $55 | Current provider cost |
| Truv cost per verification | $15 | Truv pricing |

## Calculated Outputs

- Total applications (funded loans / conversion rate)
- Total borrowers to verify (applications × borrowers per app)
- Truv VOIEs (based on coverage and W-2 rate)
- Truv VOAs (based on coverage)
- Remaining TWN fallback count
- Current annual cost (legacy process)
- Future annual cost (with Truv)
- Annual savings
- Savings per loan
- TWN reduction percentage

## PDF Structure

### Page 1 - ROI Analysis
- Blue gradient header with Truv logo
- "ROI Analysis Report for [Company Name]"
- Annual savings headline with narrative
- Key metrics: savings per loan, TWN reduction, annual volume
- Cost comparison: Current vs Future
- Verification breakdown cards
- Technical specs grid

### Page 2 - The Truv Advantage
- Blue gradient header with "Features and Benefits"
- Value proposition narrative
- VOIE capabilities (payroll integrations, live data, PDF paystubs)
- VOA capabilities (transaction history, cash flow analysis, fraud detection)
- Tech specs (API speed, integrations, security, uptime)

## File Structure

```
src/
├── pages/
│   └── ROIGenerator.tsx       # Main page with form + preview
├── utils/
│   └── roiCalculator.ts       # Calculation logic
│   └── roiPdfGenerator.ts     # PDF generation with html2pdf.js
├── hooks/
│   └── useROICalculator.ts    # React hook for live calculations
└── types/
    └── roi.ts                 # TypeScript types
```

## Dependencies

- `html2pdf.js` - Client-side PDF generation

## Implementation Notes

- Port calculation logic from gtm_automation/roi-calculator
- Reuse PDF template styling from existing pdfGenerator.ts
- All calculations happen client-side (no backend needed)
