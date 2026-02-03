# Natural Language HubSpot List Builder - Design Document

## Overview

A conversational interface that lets users describe what records they need in plain English, then automatically researches HubSpot properties, builds the correct query, pulls all matching records with full pagination, presents results for approval, and creates a static or active list in HubSpot.

## User Flow

1. User types natural language query (e.g., "Get me all government companies in California, Texas, and New York")
2. System discovers HubSpot properties, sends to Gemini 2.0 Flash for parsing
3. If ambiguous, system asks clarifying questions (hybrid approach - only when needed)
4. System executes HubSpot Search API with full pagination (handles >10k with batching)
5. System displays summary + 15-20 sample records for preview
6. User can export to Google Sheets for team review
7. User edits suggested list name and clicks "Create Static List" or "Create Active List"
8. System creates list in HubSpot, returns URL

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  ListBuilder.tsx (React Page)                               │
│  - QueryInput: text input for natural language              │
│  - Clarification: shows when Gemini needs more info         │
│  - ResultsPreview: summary + sample table                   │
│  - ListActions: name input + action buttons                 │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  Vercel Serverless API Endpoints                            │
│  - POST /api/list-builder/parse      → Gemini NLP parsing   │
│  - GET  /api/list-builder/properties → Property discovery   │
│  - POST /api/list-builder/search     → HubSpot search       │
│  - POST /api/list-builder/export-sheet → Google Sheets      │
│  - POST /api/list-builder/create     → List creation        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  External APIs                                              │
│  - Gemini 2.0 Flash (NLP parsing)                          │
│  - HubSpot Properties API (discovery)                       │
│  - HubSpot Search API (querying)                           │
│  - HubSpot Lists API (creation)                            │
│  - Google Sheets API (export)                              │
└─────────────────────────────────────────────────────────────┘
```

## File Structure

```
/api/list-builder/
  parse.ts          # Gemini NLP parsing
  search.ts         # HubSpot search with full pagination
  properties.ts     # HubSpot property discovery + caching
  export-sheet.ts   # Google Sheets export
  create.ts         # List creation (static or active)

/src/pages/
  ListBuilder.tsx   # Main page component

/src/components/list-builder/
  QueryInput.tsx       # Text input + submit button
  Clarification.tsx    # Clarification question UI
  ResultsPreview.tsx   # Summary stats + sample table
  ListActions.tsx      # Name input + action buttons
```

## API Endpoints

### GET /api/list-builder/properties

**Query params:** `objectType` (companies | contacts | deals)

**Response:**
```json
{
  "properties": [
    {
      "name": "sales_vertical",
      "label": "Sales Vertical",
      "type": "enumeration",
      "options": [
        { "value": "Government", "label": "Government" },
        { "value": "Mortgage", "label": "Mortgage" }
      ]
    }
  ]
}
```

**Caching:** 1 hour in-memory cache per object type.

### POST /api/list-builder/parse

**Request:**
```json
{
  "query": "All government companies in California, Texas, and New York",
  "objectType": "companies",
  "clarificationResponse": { "question_id": "selected_option" }
}
```

**Response (resolved):**
```json
{
  "resolved": true,
  "objectType": "companies",
  "filters": [
    { "propertyName": "sales_vertical", "operator": "EQ", "value": "Government" },
    { "propertyName": "state", "operator": "IN", "values": ["California", "Texas", "New York"] }
  ],
  "suggestedName": "Gov Companies - CA, TX, NY - Feb 2025",
  "canBeActiveList": true
}
```

**Response (needs clarification):**
```json
{
  "resolved": false,
  "clarifications": [
    {
      "id": "state_ambiguity",
      "question": "Did you mean California or Colorado?",
      "options": ["California", "Colorado", "Both"]
    }
  ]
}
```

### POST /api/list-builder/search

**Request:**
```json
{
  "objectType": "companies",
  "filters": [...],
  "associations": {
    "fromObjectType": "companies",
    "toObjectType": "contacts"
  }
}
```

**Response:**
```json
{
  "records": [
    { "id": "123", "name": "Acme Gov Inc", "state": "California", ... }
  ],
  "total": 113,
  "summary": {
    "byState": { "California": 38, "Texas": 45, "New York": 30 },
    "byLifecycle": { "lead": 60, "subscriber": 48, "mql": 5 },
    "dateRange": { "oldest": "2023-01-15", "newest": "2025-02-01" }
  },
  "cacheKey": "abc123"
}
```

**Batching:** For >10k results, queries in batches by `lastmodifieddate` ranges (newest first), dedupes by record ID.

### POST /api/list-builder/export-sheet

**Request:**
```json
{
  "records": [...],
  "name": "Gov Companies - CA, TX, NY - Feb 2025",
  "columns": ["id", "name", "state", "sales_vertical", "lastmodifieddate"]
}
```

**Response:**
```json
{
  "sheetUrl": "https://docs.google.com/spreadsheets/d/...",
  "sheetId": "abc123"
}
```

### POST /api/list-builder/create

**Request:**
```json
{
  "name": "Gov Companies - CA, TX, NY - Feb 2025",
  "recordIds": ["123", "456", ...],
  "objectType": "companies",
  "listType": "static"
}
```

Or for active list:
```json
{
  "name": "Gov Companies - CA, TX, NY - Feb 2025",
  "objectType": "companies",
  "listType": "active",
  "filters": [...]
}
```

**Response:**
```json
{
  "listId": "789",
  "listUrl": "https://app.hubspot.com/contacts/19933594/lists/789",
  "listType": "static",
  "recordCount": 113
}
```

## Gemini System Prompt

```
You are a HubSpot query parser. Given a natural language request and available HubSpot properties, output a JSON structure.

RULES:
1. Map user terms to actual property names (e.g., "government" → sales_vertical = "Government")
2. Use the correct operator for each property type:
   - Enum: EQ, NEQ, IN, NOT_IN
   - Text: EQ, NEQ, CONTAINS, NOT_CONTAINS
   - Number: EQ, NEQ, GT, GTE, LT, LTE, BETWEEN
   - Date: EQ, NEQ, GT, GTE, LT, LTE, BETWEEN
   - Boolean: EQ, NEQ
3. If a term is ambiguous or doesn't match any property/value, add a clarification
4. Generate a descriptive list name based on the filters
5. Determine if the filters can be represented as a HubSpot active list

OUTPUT FORMAT:
{
  "resolved": boolean,
  "objectType": "companies" | "contacts" | "deals",
  "filters": [{ "propertyName": string, "operator": string, "value"?: string, "values"?: string[] }],
  "suggestedName": string,
  "canBeActiveList": boolean,
  "clarifications": [{ "id": string, "question": string, "options": string[] }]
}

AVAILABLE PROPERTIES:
{properties_json}

USER QUERY:
{user_query}
```

## Batching Strategy (>10k Results)

1. First query: sort by `lastmodifieddate` DESC, collect up to 10k
2. Note the oldest `lastmodifieddate` in that batch
3. Next query: add filter `lastmodifieddate < [oldest from batch 1]`
4. Repeat until no more results
5. Dedupe by record ID

This ensures most recently active records come first.

## Active List Compatibility

Active lists support a subset of filter operators. The following can be converted:

| Search API Operator | Active List Support |
|---------------------|---------------------|
| EQ                  | Yes                 |
| NEQ                 | Yes                 |
| IN                  | Yes                 |
| NOT_IN              | Yes                 |
| CONTAINS            | Yes (text only)     |
| GT, GTE, LT, LTE    | Yes                 |
| HAS_PROPERTY        | Yes                 |
| NOT_HAS_PROPERTY    | Yes                 |
| BETWEEN             | No (split into GT + LT) |

Association-based queries (e.g., "contacts at government companies") cannot be active lists.

## Error Handling

| Scenario | Response |
|----------|----------|
| Unknown property | Gemini returns clarification with similar properties |
| Ambiguous enum value | Show valid options: "Did you mean 'Government'?" |
| Zero results | Show filters used, suggest adjustments |
| >10k results | Auto-batch, show progress indicator |
| HubSpot API error | Display error, offer retry |
| List creation fails | Show error, offer "Copy IDs to clipboard" fallback |
| Google Sheets error | Show error, offer CSV download fallback |
| Active list incompatible | Disable active button, show tooltip explaining why |

## UI Layout

```
┌─────────────────────────────────────────────────────────────┐
│  Header: "List Builder"                              [Back] │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ Describe what you need...                             │  │
│  │ e.g., "All government companies in CA, TX, NY"        │  │
│  └───────────────────────────────────────────────────────┘  │
│                                        [Build Query]        │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  (Clarification area - only shows when needed)              │
│  "Did you mean California or Colorado?"  [CA] [CO] [Both]   │
├─────────────────────────────────────────────────────────────┤
│  Results Preview                                            │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Found 113 companies                                    │ │
│  │ States: CA (38), TX (45), NY (30)                      │ │
│  │ Lifecycle: Lead (60), Subscriber (48), MQL (5)         │ │
│  │ Modified: Jan 2024 → Feb 2025                          │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                             │
│  Sample Records (15 of 113)                                 │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Name          │ State      │ Vertical   │ Modified   │   │
│  │ Acme Gov Inc  │ California │ Government │ Feb 2025   │   │
│  │ ...           │ ...        │ ...        │ ...        │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  List Name: [Gov Companies - CA, TX, NY - Feb 2025    ]     │
│                                                             │
│  [Export to Sheets]  [Create Static List] [Create Active*]  │
│                                          *disabled if N/A   │
└─────────────────────────────────────────────────────────────┘
```

## Environment Variables

```
# Existing
HUBSPOT_API_TOKEN=xxx

# New
GEMINI_API_KEY=xxx
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}
```

## Dependencies to Add

```json
{
  "googleapis": "^140.0.0"
}
```

Note: Gemini API uses fetch directly, no SDK needed.

## HubSpot Instance Context

- Portal ID: 19933594
- Key properties:
  - `sales_vertical` on companies (Government, Mortgage, etc.)
  - `state` uses full state names (California) - ~94% coverage
  - `state_` uses abbreviations but only ~8% populated - avoid
- Objects: companies, contacts, deals, tickets
