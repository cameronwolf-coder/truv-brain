# Fire Enrich Integration Design

**Date**: 2026-01-26
**Author**: Cameron Wolf
**Status**: Approved

## Overview

Integration of Fire Enrich (open-source data enrichment tool) into Truv Brain as both a standalone tool and reusable enrichment service. Provides AI-powered company data enrichment through CSV upload workflow.

## Scope

**In Scope**:
- Standalone `/data-enrichment` page with CSV upload/download
- 4 specialized AI agents for comprehensive company data
- Real-time streaming enrichment UI
- Server-side API key management
- Source attribution for all enriched data

**Out of Scope** (Phase 2):
- HubSpot integration (read/write)
- List Builder integration
- User authentication/multi-user support
- Rate limiting/cost controls

## Architecture

### High-Level Structure

```
Frontend (React/Vite)
  ↓
Vercel Serverless Functions (SSE Streaming)
  ↓
Firecrawl (Web Scraping) + OpenAI (AI Extraction)
```

### Components

**Backend Services** (`/api/`):
- `enrichment-stream.ts` - SSE endpoint streaming enrichment results
- `enrichment-agents.ts` - 4 AI agent implementations

**Frontend** (`/src/`):
- `pages/DataEnrichment.tsx` - Main enrichment page
- `components/enrichment/` - UI components
- `services/enrichmentClient.ts` - SSE client
- `services/firecrawl.ts` - Firecrawl wrapper

## Data Model

### Input Requirements
- **Required**: Email address (for domain extraction)
- **Optional**: Company name, company domain (speeds enrichment)

### Enrichment Fields

**Company Research Agent**:
- company_name, industry, company_size, headquarters, description, website

**Fundraising Intelligence Agent**:
- funding_stage, total_funding, latest_round, investors, valuation

**People & Leadership Agent**:
- ceo_name, founders, key_executives, employee_count

**Product & Technology Agent**:
- tech_stack, main_products, integrations, target_market

### Field Bundles (Presets)
- "Quick Qualification" - company_name, industry, company_size, funding_stage
- "Sales Intelligence" - All Company + Fundraising fields
- "Executive Outreach" - Leadership + Company basics
- "Technical Fit" - Tech stack + Product fields
- "Full Enrichment" - All fields

### Result Structure

```typescript
interface EnrichmentResult {
  email: string;
  original_data: Record<string, any>;
  enriched_data: Record<string, {
    value: string | number | null;
    source_url: string;
    confidence: 'high' | 'medium' | 'low';
    agent: string;
  }>;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error?: string;
}
```

## AI Agent Architecture

### Agent Design

Each agent is a specialized function that:
1. Takes company domain/email
2. Uses Firecrawl to scrape relevant pages
3. Uses OpenAI to extract structured data
4. Returns results with source attribution

Agents run in parallel for speed (max 4 concurrent per contact).

### Agent Implementations

**Agent 1: Company Research**
- Sources: Homepage, About page, LinkedIn
- Extracts: Industry, size, HQ, description
- Prompt: "Extract factual company information. Be concise."

**Agent 2: Fundraising Intelligence**
- Sources: Crunchbase, TechCrunch, press releases
- Extracts: Funding rounds, investors, valuations
- Prompt: "Find most recent funding information with dates."

**Agent 3: People & Leadership**
- Sources: Leadership pages, LinkedIn executives
- Extracts: CEO, founders, C-suite names/titles
- Prompt: "Identify key decision makers and their roles."

**Agent 4: Product & Technology**
- Sources: Company site, job postings, BuiltWith
- Extracts: Tech stack, products, target market
- Prompt: "Identify technologies used and products offered."

### Execution Flow

1. Parse email → extract company domain
2. Dispatch relevant agents in parallel based on selected fields
3. Each agent: Firecrawl search → scrape URLs → OpenAI extraction
4. Stream results back as each agent completes
5. Aggregate results with source attribution

## API Implementation

### Endpoint: `/api/enrichment-stream.ts`

**Request**:
```typescript
interface EnrichmentRequest {
  contacts: Array<{
    email: string;
    [key: string]: any; // Pass-through data
  }>;
  fields: string[];
  source: 'csv';
}
```

**SSE Events**:
- `start` - Contact enrichment begins
- `progress` - Field completed with value/source
- `complete` - Contact fully enriched
- `error` - Contact failed
- `done` - All contacts processed (summary stats)

### Processing Strategy

- Process contacts sequentially (1 at a time)
- Run agents in parallel per contact (4 max)
- 1-2 second delay between contacts for API respect
- Stream results in real-time via SSE

## Frontend UI

### Main Page: `/data-enrichment`

**CSV Upload Mode**:
1. Drag-and-drop CSV upload zone
2. Auto-detect email column (or manual selection)
3. Preview first 5 rows
4. Field selector with preset bundles
5. "Start Enrichment" button

### Components

**EnrichmentTable.tsx**:
- Real-time streaming table
- Shows loading → value + source link per cell
- Color coding: Green (high confidence), Yellow (medium), Red (failed)
- Click value to view source URL in modal

**FieldSelector.tsx**:
- Grouped checkboxes by agent category
- Preset bundle buttons
- Estimated cost per contact
- Select All / Clear All

**EnrichmentProgress.tsx**:
- Progress bar (X of Y contacts)
- Real-time stats (success rate, avg time)
- Pause / Resume / Cancel controls

**Post-Enrichment Actions**:
- Download as CSV
- Copy to clipboard (tab-separated)
- Save session to localStorage

## Environment Setup

### Environment Variables

```bash
OPENAI_API_KEY=sk-...
FIRECRAWL_API_KEY=fc-...
HUBSPOT_API_TOKEN=... # (existing)
```

### Dependencies

```json
{
  "dependencies": {
    "openai": "^4.28.0",
    "eventsource-parser": "^1.1.0"
  }
}
```

### Cost Estimates (per contact)
- OpenAI (GPT-4o mini): ~$0.02-0.05
- Firecrawl (2-4 pages): ~$0.01-0.04
- **Total**: ~$0.05-0.10 per fully enriched contact

## Error Handling

### Domain Extraction
- Personal emails (gmail.com): Mark as "Cannot enrich"
- Invalid domains: Try fallback company name search
- Unresolved: Allow manual domain entry

### API Failures
- OpenAI rate limits: Exponential backoff, 3 retries
- Firecrawl failures: Try alternative URLs
- Network errors: Pause with "Retry" button
- Invalid keys: Clear error message

### Data Quality
- "Not found" responses: Mark as empty with source
- Low confidence: Flag "Needs review"
- Always show source URL for verification

### CSV Edge Cases
- No email column: Prompt manual selection
- Duplicates: Warn and optionally dedupe
- Invalid format: Show parsing error
- Large files (>1000): Warn about time/cost

### Session Management
- Tab closed during enrichment: Save to localStorage
- Page reload: Offer to resume
- Cancellation: Export partial results

## File Structure

```
truv-brain/
├── api/
│   ├── enrichment-stream.ts        # SSE streaming endpoint
│   └── enrichment-agents.ts        # AI agent logic
├── src/
│   ├── pages/
│   │   └── DataEnrichment.tsx      # Main page
│   ├── components/enrichment/
│   │   ├── EnrichmentTable.tsx     # Results table
│   │   ├── FieldSelector.tsx       # Field picker
│   │   ├── UploadZone.tsx          # CSV upload
│   │   ├── EnrichmentProgress.tsx  # Progress UI
│   │   └── SourceModal.tsx         # Source viewer
│   ├── services/
│   │   ├── firecrawl.ts            # Firecrawl client
│   │   └── enrichmentClient.ts     # SSE client
│   ├── utils/
│   │   ├── csvParser.ts            # CSV parsing
│   │   ├── domainExtractor.ts      # Email → domain
│   │   └── csvExporter.ts          # Export enriched data
│   └── types/
│       └── enrichment.ts           # TypeScript types
```

## Future Enhancements (Phase 2)

- HubSpot integration (pull contacts, push enriched data)
- List Builder "Enrich" button integration
- Custom HubSpot property mapping
- Batch processing for large lists
- Enrichment history/caching
- Multi-user support with rate limiting

## Success Criteria

- Upload CSV with emails → enriched CSV download
- Real-time streaming updates in UI
- Source attribution for all data points
- <5% failure rate on valid business emails
- Average <30 seconds per contact enrichment
