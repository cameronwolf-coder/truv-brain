---
name: clay-enrichment
description: One-shot CSV-to-Clay-to-HubSpot enrichment pipeline. Upload a spreadsheet, enrich contacts (email, company URL), and sync to HubSpot — all automated via browser.
triggers:
  - clay enrichment
  - enrich spreadsheet
  - upload to clay
  - clay import
  - event attendee list
  - enrich contacts
---

# Clay Enrichment Pipeline

Automates the full Clay enrichment workflow via dev-browser browser automation:
**CSV → Clay table → enrich (Full Name, Company URL, Work Email) → HubSpot sync (Lookup → Update or Create)**

## Prerequisites

- Clay session must be authenticated. Auth state saved at `clay-auth.json` in project root.
- Browser session name: `clay`
- Clay workspace ID: `276559`
- HubSpot connection already configured in Clay (both native + HTTP API Headers)

## Input

User provides a CSV file path. The CSV should have at minimum:
- `First name` (or similar)
- `Last name` (or similar)
- `Job title` (or similar)
- `Company` (or similar)

Optional columns: `State`, `Email` (if already known)

---

## Pipeline Steps

### Step 1: Launch Browser & Load Auth

```bash
dev-browser -s=clay open https://app.clay.com/workspaces/276559/home --persistent --browser=chrome --headed
```

If login page appears, load saved state:
```bash
dev-browser -s=clay state-load clay-auth.json
dev-browser -s=clay goto https://app.clay.com/workspaces/276559/home
```

Verify logged in by checking snapshot for "Cam Wolf" in profile menu.

### Step 2: Create New Table via CSV Import

1. From the home page, click the **"Import data"** card
2. Select **"Import CSV"** from the dropdown menu
3. In the file upload dialog, use dev-browser `upload` command with the CSV path:
   ```bash
   dev-browser -s=clay upload /path/to/file.csv
   ```
4. Wait for Clay to parse the CSV and show column mapping preview
5. Take a snapshot to verify columns were detected correctly
6. Confirm the import by clicking the appropriate button
7. **Name the table** using the source file name (e.g., `ICE-X26-Registrants`)

### Step 3: Add Enrichment Columns (Order Matters)

After CSV is imported, add columns in this EXACT order. **Use "Save and don't run" for every column** — never save-and-run until all columns are configured.

#### 3a: Full Name (Merge Column)
- Click **"Add column"** → search **"Merge"** or **"Concatenation"**
- Formula: `{{First Name}} {{Last Name}}`
- Name: `Full Name`

#### 3b: Company URL (Waterfall Enrichment)
- Click **"Add column"** → search **"Find company domain"** or **"Company URL"**
- Use Clay's waterfall enrichment with 4 providers (Snov.io, Google, Clearbit, HG Insights)
- Input: `Company Name` column
- Cost: ~1 credit/row
- Name: `Company URL`

> **CRITICAL:** Company URL MUST be added BEFORE Work Email. The Work Email enrichment needs actual domain URLs (like `1stsource.com`), NOT company name text (like `1st Source Bank`).

#### 3c: Work Email (Waterfall Enrichment)
- Click **"Add column"** → search **"Find work email"**
- Uses 11 waterfall providers (~3 credits/row)
- **Input mapping:**
  - Full Name → `Full Name` column
  - **Company Domain → `Company URL` column** (NOT Company Name!)
- Name: `Work Email`

### Step 4: Add HubSpot Action Columns

**ALL HubSpot action columns need run conditions. Set these BEFORE running anything.**

#### 4a: Lookup Object (HubSpot)
- Click **"Add column"** → search **"HubSpot"** → **"Lookup object"**
- Object type: **Contact**
- Search by: **Email** = `Work Email` column
- **Run condition (Only run if):** `{{Work Email}}` (truthy — skips rows with no email)
- Name: `Lookup object`

#### 4b: Update Object (HubSpot)
- Click **"Add column"** → search **"HubSpot"** → **"Update object"**
- Object type: **Contact**
- **HubSpot Object ID:** `Lookup object > results > 0 > id`
  - In the dropdown: click Lookup object → results → "0" → **id**
  - This is the numeric HubSpot contact ID. Do NOT use the top-level Lookup object output.
- Map fields: First Name, Last Name, Email (Work Email), Job Title (Title)
- **Run condition (Only run if):** should depend on Lookup finding a result
- Name: `Update object`

#### 4c: Create Object (HubSpot)
- Click **"Add column"** → search **"HubSpot"** → **"Create object"**
- Object type: **Contact**
- Map fields: email = `Work Email`, firstname, lastname, jobtitle, company
- **Run condition (Only run if):** TWO conditions must be true:
  1. Lookup object returned "No objects found" (contact doesn't exist)
  2. Work Email is not empty (we have an email to create with)
- Name: `Create object`

> **CRITICAL:** Never create a HubSpot contact without an email. Contacts created without email are orphaned — they can't be found by lookup and create duplicates.

### Step 5: Run Enrichment (Staged)

Run in stages, waiting for each to complete before the next:

1. **Run Company URL + Full Name** — these have no dependencies
2. **Wait for completion**, then **Run Work Email** — needs Company URL results
3. **Wait for completion**, then **Run Lookup object** — needs Work Email results
4. **Wait for completion**, then **Run Update + Create object** — need Lookup results

Use **Sandbox Mode** (10-row test) for first run to validate the pipeline before running all rows.

### Step 6: Report Results

After all columns complete, summarize:
- Total rows in table
- Emails found vs. missing
- HubSpot contacts updated (existing)
- HubSpot contacts created (new)
- Any rows that failed or had missing inputs

---

## Critical Best Practices (Learned the Hard Way)

### Column Setup
1. **Always use "Save and don't run"** when configuring columns. The dropdown arrow next to Save has this option. Saving-and-running prematurely causes cascading issues with dependent columns.
2. **Column order matters.** Company URL → Work Email → Lookup → Update → Create. Each depends on the previous.
3. **Company Domain input for Work Email must be the Company URL column**, not Company Name. Company names are text strings, not domains.

### HubSpot Object ID Mapping
4. **Update object's HubSpot Object ID** must drill into `Lookup object > results > 0 > id`. The path in the dropdown is: Lookup object (2 items) → results (1 items) → "0" (7 items) → **id**. If you map it to the top-level Lookup object output, you get "Error: Object not found. objectId are usually numeric."

### Run Conditions (Non-Negotiable)
5. **Every HubSpot action column MUST have a run condition.** Without them:
   - Lookup runs on rows with no email → "Missing input" errors
   - Create runs on ALL rows regardless of Lookup result → duplicate contacts
   - Create runs on rows with no email → orphaned contacts in HubSpot
6. **Create object needs TWO guards:** Lookup returned "No objects found" AND Work Email exists.

### Cleanup
7. If bad contacts are created in HubSpot, clean up via Python:
   ```python
   from outreach_intel.hubspot_client import HubSpotClient
   import requests
   hs = HubSpotClient()
   # Search for contacts created after timestamp without email
   # Delete via: requests.delete(f'https://api.hubapi.com/crm/v3/objects/contacts/{id}', headers={'Authorization': f'Bearer {hs.api_token}'})
   ```

### Clay UI Gotchas
8. **Contenteditable fields** (like "Only run if") can't be cleared with keyboard shortcuts. Use `dev-browser run-code` to set `el.innerHTML = ''` and dispatch an input event.
9. **Clay auto-update:** Dependent columns auto-run when upstream columns produce results. This can cause cascading runs before you've finished configuring. Always configure ALL columns before running ANY.
10. **Column sub-field dropdowns:** Click the parent item to expand, then drill into sub-fields. The "N items" indicator shows how many sub-fields exist.

---

## Column Reference

| Column | Type | Input | Run Condition |
|--------|------|-------|---------------|
| Company Name | Text | CSV import | — |
| First Name | Text | CSV import | — |
| Last Name | Text | CSV import | — |
| Title | Text | CSV import | — |
| Full Name | Merge | First Name + Last Name | — |
| Company URL | Waterfall (4 providers) | Company Name | — |
| Work Email | Waterfall (11 providers) | Full Name + **Company URL** | — |
| Lookup object | HubSpot Action | Email = Work Email | `{{Work Email}}` exists |
| Update object | HubSpot Action | ID = Lookup > results > 0 > id | Lookup found result |
| Create object | HubSpot Action | All contact fields | Lookup = "No objects found" AND Work Email exists |

## HubSpot Action Results Key

- `Found 1 object(s)` → contact exists → Update runs, Create skipped
- `No objects found` → new contact → Create runs, Update skipped
- `Missing input` → no email found → all HubSpot actions skip (correct behavior)
- `Run condition not met` → guard prevented execution (correct behavior)

## Cost Estimate

- Company URL: ~1 credit/row
- Work Email: ~3 credits/row
- **Total: ~4 Clay credits/row**

## Important Notes

- Clay has NO public API. Everything must go through browser automation.
- The persistent browser profile keeps Google auth cookies.
- Auth state backup: `clay-auth.json` in project root.
- Clay workspace URL: `https://app.clay.com/workspaces/276559/`
- Always use `--headed` flag so user can observe and intervene if needed.
- Between steps, always take snapshots to verify state before proceeding.
