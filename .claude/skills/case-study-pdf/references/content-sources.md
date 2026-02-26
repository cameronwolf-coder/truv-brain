# Content Sources & Data Accuracy Rules

## Source Hierarchy

When building a case study PDF, content MUST be sourced from these locations in priority order:

1. **Primary Source (Required):** The customer's web case study HTML at
   `/Users/cameronwolf/Downloads/Projects/truv.com-master/src/shortcodes/customer-stories/{customer-slug}.html`
2. **Content Reference:** `/Users/cameronwolf/Downloads/Projects/truv-brain/docs/content-reference.md`
3. **Proof Points:** `/Users/cameronwolf/Downloads/Projects/truv-brain/docs/proof-points.md`

## Data Accuracy Rules (Non-Negotiable)

1. **Every metric MUST trace to the primary source document.** If a number does not appear in the source HTML, it cannot appear in the PDF.
2. **No fabricated specifics.** Do not invent details like specific GSE program names (e.g., "Fannie Mae DU", "Freddie Mac LPA") unless the source document explicitly states them.
3. **No unverified dates.** Do not add years (e.g., "In 2024") unless the source document provides them.
4. **Platform-level claims must come from proof-points.md.** Metrics like "96% workforce coverage", "80% cost savings", "<2s API response", "Free re-verifications within 120 days" are Truv platform stats, NOT customer-specific results. Always attribute them to Truv, never to the customer.
5. **Quotes must be exact.** Copy quotes verbatim from the source document. Do not paraphrase, combine, or invent quotes.
6. **No quote repetition.** Each quote may appear exactly once across the entire document. Assign each quote to a specific page and do not reuse it.
7. **Before/After comparisons** must only use metrics sourced from the customer's document. General Truv stats (e.g., "30 seconds verification") should not appear in customer-specific Before/After tables unless the source explicitly provides that data for this customer.

## Audit Checklist

Before finalizing any case study PDF, perform a line-by-line audit:

- [ ] Every metric traces to the primary source document
- [ ] No invented specifics or elaborations
- [ ] No unverified dates or years
- [ ] Platform-level stats attributed to Truv (not the customer)
- [ ] All quotes are verbatim from source
- [ ] No quote appears more than once
- [ ] Before/After data is customer-specific
- [ ] At a Glance facts are not duplicated across sections
