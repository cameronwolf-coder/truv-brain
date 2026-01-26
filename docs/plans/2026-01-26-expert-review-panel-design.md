# Expert Review Panel - Design Spec

**Date:** 2026-01-26
**Status:** Approved
**Owner:** Cameron Wolf

---

## Overview

A new "Expert Review" page in Truv Brain's Tools section. Users submit any creative work (text, images, PDFs) and receive feedback from a simulated panel of 10 world-class advertising/marketing experts. For text content, the system automatically iterates improvements until achieving a 90+ average score.

## Location

- **Route:** `/expert-review`
- **Sidebar:** Tools section (alongside ROI Generator and Data Enrichment)
- **Page component:** `src/pages/ExpertReview.tsx`
- **API endpoint:** `api/expert-review.ts`

## Core Flow

```
User submits content
       ↓
API sends to OpenAI with expert panel prompt
       ↓
Each expert scores (0-100) + provides feedback
       ↓
Calculate average score
       ↓
If avg < 90 AND content is text → AI improves → re-review
If avg ≥ 90 OR content is image → return final results
       ↓
Display final version + summary
```

## Input Methods

1. **Text/paste** - User pastes copy, describes a design concept, or enters any text
2. **File upload** - Images (PNG, JPG, WebP), PDFs, documents

## UI Components

### 1. Input State
- Large text area with placeholder: "Paste your copy, landing page text, email draft, ad concept, or describe what you want reviewed..."
- File upload zone below (drag-drop or click)
- "Review with Expert Panel" button (disabled until input provided)
- Helper text: "Text content will be automatically improved until it scores 90+. Images receive detailed feedback only."

### 2. Processing State
- Progress indicator showing current iteration (e.g., "Round 2 of review...")
- Live-streaming expert feedback via SSE
- Each expert appears as a card with name, score, and feedback snippet
- Running average score displayed prominently

### 3. Results State
- **Score banner:** "Final Score: 94/100" with iteration count
- **Final content:** Clean, copyable format (text) or original image
- **Change summary:** Bulleted list of key improvements made
- **Expert breakdown:** Collapsible grid of all 10 experts with scores and verdicts
- "Start New Review" button

## The Expert Panel

Fixed roster of 10 experts, each evaluating through their specific lens:

| # | Expert | Focus Area |
|---|--------|------------|
| 1 | **David Ogilvy** | Headline power, clarity, persuasion |
| 2 | **Claude Hopkins** | Measurable results, offers, CTAs |
| 3 | **Robert Cialdini** | Persuasion triggers, cognitive biases |
| 4 | **Don Norman** | Clarity, friction, user comprehension |
| 5 | **Peep Laja** | Conversion optimization, testing mindset |
| 6 | **Paula Scher** | Visual hierarchy, typography, layout |
| 7 | **Eugene Schwartz** | Audience sophistication, message-market fit |
| 8 | **Joanna Wiebe** | Voice of customer, specificity, emotion |
| 9 | **Steve Krug** | "Don't make me think", cognitive load |
| 10 | **Seth Godin** | Remarkable-ness, story, differentiation |

### Expert Evaluation Output

Each expert returns:
- **Score** (0-100): Numeric rating based on their criteria
- **Verdict** (1 sentence): Quick summary of their take
- **Strengths** (2-3 bullets): What's working from their perspective
- **Improvements** (2-3 bullets): Specific, actionable fixes tied to their score

### Scoring Criteria

| Expert | Scores High When... | Scores Low When... |
|--------|--------------------|--------------------|
| Ogilvy | Headlines sell, copy is specific and benefit-driven | Vague, clever-but-empty, buries the lead |
| Hopkins | Clear offer, strong CTA, reasons to act now | No urgency, weak/missing call-to-action |
| Cialdini | Uses social proof, scarcity, authority effectively | Misses persuasion opportunities, feels pushy |
| Norman | Instantly understandable, no confusion | Jargon, unclear hierarchy, cognitive friction |
| Laja | Focused, testable, addresses objections | Tries to do too much, ignores conversion basics |
| Scher | Strong visual hierarchy, typography serves message | Cluttered, poor contrast, type fights content |
| Schwartz | Matches audience awareness level perfectly | Misreads where the audience is, wrong angle |
| Wiebe | Sounds like the customer, specific and emotional | Generic, corporate-speak, no voice |
| Krug | Simple, scannable, obvious next step | Overloaded, makes user think too hard |
| Godin | Remarkable, has a story worth sharing | Forgettable, blends in, no hook |

## Iteration Loop (Text Content Only)

When text content scores below 90 average:

1. **Aggregate feedback**: Collect all expert critiques, weighted by distance from 90
2. **Generate revision**: AI receives original + current version + all feedback
3. **Re-evaluate**: Send revised version through all 10 experts
4. **Repeat or finish**:
   - If avg >= 90 → done
   - If avg < 90 → another round
   - **Safety cap:** Maximum 5 iterations

### Change Tracking

Each round logs what changed. Final summary distills into bullets like:
- "Strengthened headline with specific benefit (Round 1)"
- "Added social proof element (Round 2)"
- "Simplified CTA language (Round 3)"

## API Design

### Endpoint

```
POST /api/expert-review
Body: {
  content: string,           // text content or base64 image
  contentType: "text" | "image" | "pdf"
}
```

### Response (SSE Stream)

```typescript
// Expert evaluation
{ type: "expert", name: "Ogilvy", score: 78, verdict: "...", strengths: [...], improvements: [...] }

// Round complete
{ type: "round_complete", average: 81, iteration: 1 }

// Improvement in progress (text only)
{ type: "improving", message: "Revising based on feedback..." }

// New revision
{ type: "revision", content: "..." }

// Final result
{ type: "complete", finalScore: 92, iterations: 3, finalContent: "...", summary: [...] }
```

## Technical Details

- **Model:** GPT-4o (handles both text and images)
- **Prompt structure:** Single prompt with all 10 expert personas, returns structured JSON
- **Token usage:** ~2-4K tokens per evaluation round
- **Cost estimate:** ~$0.05-0.15 per review (depending on iterations and content length)

## Files to Create

1. `src/pages/ExpertReview.tsx` - Main page component
2. `api/expert-review.ts` - Serverless API endpoint
3. `src/types/expertReview.ts` - TypeScript types
4. Update `src/components/Layout.tsx` - Add sidebar link
5. Update `src/main.tsx` - Add route

## Out of Scope

- Image generation/editing (AI cannot modify uploaded images)
- URL scraping (text/file input only)
- Customizable expert panels (fixed roster)
- Iteration history UI (final version + summary only)
