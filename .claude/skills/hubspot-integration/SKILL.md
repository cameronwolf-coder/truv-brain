---
name: hubspot-integration
description: Expert patterns for HubSpot CRM integration including OAuth authentication, CRM objects, associations, batch operations, webhooks, and custom objects. Covers Node.js and Python implementations with proper error handling. Use when working with HubSpot API, CRM data, contact management, deal pipelines, or any HubSpot-related development task.
---

# HubSpot Integration — Truv CRM

## Overview

All HubSpot operations MUST use the **Python client** (`outreach_intel/hubspot_client.py`) or **Vercel API routes** (`api/`). **NEVER use Pipedream MCP tools for HubSpot.**

## Routing Decision

| Task | Tool | Why |
|------|------|-----|
| Quick lookup (contact, deal, company) | Python client | Direct API, full control |
| Batch/scripted work | Python client | Loops, pagination, transforms |
| Web app features | Vercel API routes | Already deployed, CORS-ready |
| Anything else | Python client `get()`/`post()` | Generic methods hit any endpoint |

**NEVER:** `mcp__pipedream__hubspot-*`, `mcp__claude_ai_HubSpot__*`

## Python Client Quick Reference

**Location:** `outreach_intel/hubspot_client.py`
**Auth:** `HUBSPOT_API_TOKEN` env var (private app token)
**Activate:** `source venv/bin/activate`

```python
from outreach_intel.hubspot_client import HubSpotClient
client = HubSpotClient()
```

### Contacts
| Method | Description |
|--------|-------------|
| `client.get_contact(id)` | Single contact by ID |
| `client.get_contact_by_email("user@co.com")` | Lookup by email |
| `client.search_contacts(filters, sorts, properties, limit)` | Search with filters |
| `client.get_contacts(limit, properties, after)` | List contacts (paginated) |
| `client.update_contact(id, {"prop": "val"})` | Update properties |
| `client.batch_get_contacts([ids])` | Batch read (max 100) |
| `client.batch_update_contacts([{"id": "x", "properties": {...}}])` | Batch update (max 100) |

### Deals
| Method | Description |
|--------|-------------|
| `client.get_deal(id)` | Single deal by ID |
| `client.search_deals(filters, sorts, properties, limit)` | Search deals |
| `client.create_deal({"dealname": "x", "dealstage": "y", "pipeline": "z"})` | Create deal |
| `client.update_deal(id, {"amount": "5000"})` | Update deal |

### Companies
| Method | Description |
|--------|-------------|
| `client.get_company(id)` | Single company by ID |
| `client.search_companies(filters, sorts, properties, limit)` | Search companies |

### Associations
| Method | Description |
|--------|-------------|
| `client.get_contact_deals(contact_id)` | Deals linked to contact |
| `client.get_contact_company(contact_id)` | Primary company for contact |
| `client.get_deal_contacts(deal_id)` | Contacts on a deal |
| `client.get_company_contacts(company_id)` | Contacts at company |
| `client.get_associations(from_type, id, to_type)` | Generic association lookup |

### Lists
| Method | Description |
|--------|-------------|
| `client.create_list("Name")` | Create static list |
| `client.add_contacts_to_list(list_id, [contact_ids])` | Add to list |
| `client.get_lists()` | List all lists |
| `client.delete_list(list_id)` | Delete list |

### Other
| Method | Description |
|--------|-------------|
| `client.get_owners()` | List sales reps |
| `client.get(endpoint, params)` | Generic GET (any endpoint) |
| `client.post(endpoint, json_data)` | Generic POST (any endpoint) |

## Search Filter Pattern

All `search_*` methods accept the same filter structure:

```python
results = client.search_contacts(
    filters=[
        {"propertyName": "lifecyclestage", "operator": "EQ", "value": "lead"},
        {"propertyName": "company", "operator": "CONTAINS_TOKEN", "value": "bank"},
    ],
    sorts=[{"propertyName": "createdate", "direction": "DESCENDING"}],
    properties=["firstname", "lastname", "email", "company"],
    limit=50,
)
```

**Operators:** `EQ`, `NEQ`, `IN`, `NOT_IN`, `CONTAINS_TOKEN`, `GT`, `LT`, `GTE`, `LTE`, `HAS_PROPERTY`, `NOT_HAS_PROPERTY`

**Multiple filter groups (OR logic):** Use generic `post()`:
```python
client.post("/crm/v3/objects/contacts/search", json_data={
    "filterGroups": [
        {"filters": [{"propertyName": "lifecyclestage", "operator": "EQ", "value": "lead"}]},
        {"filters": [{"propertyName": "lifecyclestage", "operator": "EQ", "value": "subscriber"}]},
    ],
    "properties": ["email"],
    "limit": 100,
})
```

## Vercel API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `api/hubspot-check.ts` | POST `{emails: [...]}` | Batch email lookup |
| `api/search-contacts.ts` | POST | Contact search with persona/vertical/engagement filters |
| `api/search-companies.ts` | POST | Company search with industry/firmographic filters |
| `api/search-company.ts` | POST | Single company search |
| `api/create-list.ts` | POST | Create static list from contact IDs |
| `api/list-builder/search.ts` | POST | List builder search |
| `api/list-builder/create.ts` | POST | List builder create |
| `api/list-builder/export-sheet.ts` | POST | Export to Google Sheets |
| `api/list-builder/properties.ts` | GET | Available HubSpot properties |
| `api/list-builder/parse.ts` | POST | Parse uploaded CSV |

## Key IDs

**Portal:** `19933594` | **Test list:** `101845508`

### Lifecycle Stages
| ID | Name |
|----|------|
| `subscriber` | New/Subscriber |
| `lead` | Lead |
| `marketingqualifiedlead` | MQL |
| `salesqualifiedlead` | SAL |
| `opportunity` / `1154636674` | Opportunity |
| `customer` / `1154761341` | Customer (Implementing) |
| `268792390` | Live Customer |
| `1012659574` | Indirect Customer |
| `1070076549` | Advocate |
| `268636563` | Closed Lost |
| `268798100` | Churned Customer |
| `other` | Disqualified/Opt-Out |

### Deal Pipelines (Closed Won IDs)
| ID | Pipeline |
|----|----------|
| `1f7d22d8-b3fd-4918-82c3-ddaa9bdb8a52` | Enterprise Sales |
| `1092340356` | Self-Service |
| `979907381` | Renewals |

### Custom Properties
| Property | Description |
|----------|-------------|
| `sales_vertical` | Industry vertical |
| `mortgage_los__new_` | Mortgage LOS system |
| `mortgage_pos__new_` | Mortgage POS system |
| `mortgage_loan_volume` | Annual loan volume |
| `smartlead_category` | SmartLead campaign status |

## Common Recipes

### Find all MQLs at a company
```python
contacts = client.search_contacts(
    filters=[
        {"propertyName": "company", "operator": "CONTAINS_TOKEN", "value": "acme"},
        {"propertyName": "lifecyclestage", "operator": "EQ", "value": "marketingqualifiedlead"},
    ]
)
```

### Get a contact's full picture (contact + company + deals)
```python
contact = client.get_contact_by_email("jane@acme.com")
company_ref = client.get_contact_company(contact["id"])
company = client.get_company(company_ref["toObjectId"]) if company_ref else None
deal_refs = client.get_contact_deals(contact["id"])
deals = [client.get_deal(d["toObjectId"]) for d in deal_refs]
```

### Build a list from closed-lost deals
```python
deals = client.search_deals(
    filters=[{"propertyName": "dealstage", "operator": "EQ", "value": "268636563"}]
)
contact_ids = []
for deal in deals:
    refs = client.get_deal_contacts(deal["id"])
    contact_ids.extend(r["toObjectId"] for r in refs)
lst = client.create_list("Closed Lost Re-engagement")
client.add_contacts_to_list(lst["listId"], list(set(contact_ids)))
```

### Paginate through all results
```python
all_results = []
after = None
while True:
    batch = client.search_contacts(
        filters=[{"propertyName": "lifecyclestage", "operator": "EQ", "value": "lead"}],
        limit=100,
        after=after,
    )
    all_results.extend(batch)
    if len(batch) < 100:
        break
    after = batch[-1].get("paging", {}).get("next", {}).get("after")
```

## Gotchas

1. **Search limit is 100 per request** — always paginate for larger result sets
2. **Search API max 10,000 results** — use more specific filters if you hit this
3. **Lifecycle stage filtering** — search API can't filter by custom lifecycle stage IDs directly; fetch and filter in code
4. **Filter groups = OR, filters within group = AND** — use generic `post()` for OR logic
5. **Batch operations max 100 items** — chunk larger lists
6. **Association responses** return `toObjectId` — you need a second call to get full object details
7. **Date properties** use Unix timestamps in milliseconds for search filters
8. **`CONTAINS_TOKEN`** matches whole words, not substrings — use for company names
