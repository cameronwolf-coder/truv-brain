---
name: case-study-landing-page
description: Create gated landing pages for Truv customer case studies. This skill should be used when users want to build a landing page for a customer case study PDF, create a lead generation page for case studies, or set up gated content downloads. Triggers on requests like "create a landing page for [customer] case study", "build a case study LP", "make a gated PDF page", or "set up a customer story landing page".
---

# Case Study Landing Page Builder

Build gated landing pages for Truv customer case studies that capture leads via HubSpot forms and deliver PDFs automatically on submission.

## When to Use

- Creating a new landing page for a customer case study
- Building a gated PDF download page
- Setting up lead generation for customer stories

## Required Inputs

Before starting, gather:

1. **Case study PDF** - The PDF file to gate behind the form
2. **Customer name** - Company name for the case study
3. **Key stats** - 3-4 metrics from the case study (e.g., "90% cost savings", "70% conversion rate")
4. **Quote** - Customer testimonial with attribution (name, title, company)
5. **Customer logo** - Check existing assets in `/wp-content/themes/twentytwentyone/assets_truv/images/customer-stories/`

## Workflow

### Step 1: Extract Content from PDF

Read the case study PDF and extract:

- **Headline stats** - Usually on the cover or results section
- **Customer quote** - Look for testimonial sections
- **Key benefits** - What the customer achieved (for "What you'll learn" section)
- **Company context** - For subtitle/description text

### Step 2: Generate PDF Cover Image

Convert the first page of the PDF to a PNG for the preview card:

```bash
sips -s format png --resampleHeight 800 "[pdf-path]" --out "public/resources/[customer]-case-study-cover.png"
```

### Step 3: Create the Landing Page

Create file at `src/pages/lp/[customer]-case-study.astro` using the template in `references/page-template.md`.

**File naming:** Use lowercase, hyphenated customer name (e.g., `prosperity-case-study.astro`)

### Step 4: Configure HubSpot Form

The landing page uses embedded HubSpot forms:

- **Portal ID:** 19933594
- **Form ID:** 3e13cb92-4a61-469a-bece-7c9fdc2dd710 (or create new for tracking)
- **Region:** na1

### Step 5: Place Assets

1. **PDF:** `public/resources/[customer]-case-study.pdf`
2. **Cover image:** `public/resources/[customer]-case-study-cover.png`
3. **Customer logo:** Check if exists, otherwise request from user

### Step 6: Test the Page

1. Run dev server: `pnpm dev`
2. Visit `/lp/[customer]-case-study`
3. Verify all functionality works

## Page Structure

1. **Hero** - Headline, subtitle, proof element (customer logo), inline HubSpot form
2. **Stats** - 4 animated counters with labels
3. **Preview** - Clickable PDF cover with "Download" badge and gated indicator
4. **What You'll Learn** - Checklist of key takeaways
5. **Quote** - Customer testimonial with avatar and attribution
6. **CTA** - Final call-to-action with modal trigger
7. **Modal** - Secondary form for visitors who scroll past hero

## Key Technical Details

### Auto-Download on Form Submit

```javascript
onFormSubmitted: function() {
    const link = document.createElement('a');
    link.href = pdfUrl;
    link.download = 'filename.pdf';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
```

### Brand Tokens

- **Primary:** #2C64E3
- **Dark:** #0F1C47
- **Grey:** #F4F4F2
- **Light Blue:** #C5D9F7
- **Font:** Gilroy

## Resources

- `references/page-template.md` - Complete Astro component template

## Checklist

- [ ] PDF placed in `public/resources/`
- [ ] Cover image generated and placed
- [ ] Customer logo available
- [ ] All stats populated from case study
- [ ] Quote and attribution filled in
- [ ] Page renders without errors
- [ ] Form submission works
- [ ] PDF downloads after submission
- [ ] Responsive layout verified
