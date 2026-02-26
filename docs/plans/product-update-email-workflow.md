# Product Update Email - Pipedream Workflow

## Overview
Manual workflow that pulls monthly product update content from Notion, combines it with HubSpot contact data, and sends personalized emails via SendGrid dynamic templates.

**Trigger:** Manual (click "Run" in Pipedream)
**Frequency:** Monthly (or as needed after product team fills in Notion)
**Template:** SendGrid dynamic template with Handlebars conditionals

---

## Prerequisites

Before running the workflow each month:

1. **Product team** fills in a new entry in the Notion database and writes the email body in the page (see format below)
2. **HubSpot list** exists with the target recipients (e.g., "Product Update - Monthly Recipients")
3. **SendGrid dynamic template** is created and the template ID is saved in the workflow
4. **Pipedream connected accounts:** Notion, HubSpot, SendGrid

---

## Notion Database Schema

The database **"Product Update Emails"** has been created with just metadata properties. All email body content (intro, highlights, sections, outro) is written in the **page body** using normal Notion formatting.

**Database ID:** `3f94409218a8434e9951075e9f9cda85`
**Notion URL:** https://www.notion.so/3f94409218a8434e9951075e9f9cda85

| Property | Type | Description | Example |
|----------|------|-------------|---------|
| `Name` | Title | Month identifier | "January 2026 Product Update" |
| `Status` | Select | Draft / Ready / Sent | "Ready" |
| `subject` | Rich Text | Email subject line | "Truv Product Update - January 2026" |
| `preview_text` | Rich Text | Email preview/preheader text | "New API endpoints, faster processing, and more" |
| `hero_date` | Rich Text | Date shown in the hero section | "January 2026" |
| `hero_button_text` | Rich Text | Hero CTA button label | "See What's New" |
| `cta_url` | URL | Primary CTA link (hero + bottom button) | "https://truv.com/changelog" |
| `cta_button_text` | Rich Text | Bottom CTA button label | "Learn More" |

---

## Page Body Format

The email body content is written directly in the Notion page using normal formatting. The Pipedream code step reads the page blocks and maps them to the SendGrid template automatically.

### Structure

Write the page body in this order:

```
[Intro paragraph(s)]

- Highlight 1
- Highlight 2
- Highlight 3

## Section Title 1
[optional image]
- Bullet point with **bold text** and [links](https://example.com)
- Another bullet point

## Section Title 2
[optional image]
- Bullet point
- Another bullet point

[Outro paragraph(s)]
```

### Parsing Rules

The code step reads the page blocks top-to-bottom and maps them like this:

| What you write in Notion | What it becomes in the email |
|--------------------------|-------------------------------|
| Paragraphs before the first bullet list | **Intro text** (after "Hi {firstName}") |
| Bullet list before the first heading | **Key Highlights** (up to 5) |
| Each `## Heading` | **Section title** (up to 5 sections) |
| Bullets under a heading | **Section bullet points** (up to 5 per section) |
| Image under a heading | **Section image** |
| Paragraphs after all sections | **Outro text** (before bottom CTA) |

### Formatting

Notion formatting is preserved as HTML in the email:

| Notion formatting | Email output |
|-------------------|-------------|
| **bold** | `<strong>bold</strong>` |
| *italic* | `<em>italic</em>` |
| ~~strikethrough~~ | `<s>strikethrough</s>` |
| `code` | `<code>code</code>` |
| [link text](url) | `<a href="url">link text</a>` |

### Example Page

Here's what a complete page body looks like in Notion:

> Here's what's new at Truv this month. We've been focused on speed, security, and making your integration easier.
>
> - New **bulk verification API**
> - 50% faster processing times
> - Enhanced security dashboard
>
> ## New Bulk Verification API
> [screenshot image]
> - Process up to **10,000 verifications** in a single call
> - Async processing with [webhook callbacks](https://docs.truv.com/webhooks)
> - Full audit trail included
>
> ## Enhanced Security Dashboard
> - Real-time threat monitoring
> - **SOC 2** compliance reporting
> - Role-based access controls
>
> Thanks for building with Truv. Questions? [Reach out anytime](https://truv.com/contact).

**Notes:**
- Use any heading level (H1, H2, H3) -- they all start a new section
- Leave out sections you don't need. The template hides empty sections automatically.
- Images must be externally hosted (not Notion uploads, which expire). Use your image hosting platform and paste the URL, or embed external images in Notion.
- The `Status` property lets the product team mark content as "Ready" before you run the workflow.

---

## Setup Instructions

### Step 1: Create New Workflow
1. Go to https://pipedream.com/new
2. Click "New Workflow"

### Step 2: Add Manual Trigger
- **Trigger Type:** Manual
- This lets you click "Run" in Pipedream whenever content is ready
- No schedule needed -- you control when it fires

---

### Step 3: Notion - Query Database
- **App:** Notion
- **Action:** Query a Database
- **Database ID:** `3f94409218a8434e9951075e9f9cda85`
- **Filter:** Status equals "Ready"
- **Sort:** Created Time, Descending
- **Page Size:** 1 (we only want the latest entry)

This retrieves the most recent "Ready" entry from the Notion database.

---

### Step 4: Code Step - Parse Notion Page into SendGrid Variables
- **Language:** Node.js

This step does two things:
1. Reads the database properties for email metadata (subject, hero_date, etc.)
2. Fetches the page's content blocks and parses them into the template structure, converting Notion rich text formatting to HTML

```javascript
export default defineComponent({
  props: {
    notion: {
      type: "app",
      app: "notion",
    },
  },
  async run({ steps, $ }) {
    const pages = steps.query_a_database.$return_value?.results;

    if (!pages || pages.length === 0) {
      $.flow.exit("No Notion pages with Status = 'Ready' found. Mark the entry as Ready first.");
    }

    const page = pages[0];
    const props = page.properties;

    // --- Helpers ---

    // Extract plain text from a Notion property
    function getProp(name) {
      const prop = props[name];
      if (!prop) return "";
      if (prop.type === "rich_text") return prop.rich_text?.map(t => t.plain_text).join("") || "";
      if (prop.type === "title") return prop.title?.map(t => t.plain_text).join("") || "";
      if (prop.type === "url") return prop.url || "";
      return "";
    }

    // Convert Notion rich text array to HTML (preserves bold, italic, links, etc.)
    function richTextToHtml(richTextArray) {
      if (!richTextArray || richTextArray.length === 0) return "";
      return richTextArray.map(rt => {
        let text = rt.plain_text || "";
        text = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        if (rt.annotations?.bold) text = `<strong>${text}</strong>`;
        if (rt.annotations?.italic) text = `<em>${text}</em>`;
        if (rt.annotations?.underline) text = `<u>${text}</u>`;
        if (rt.annotations?.strikethrough) text = `<s>${text}</s>`;
        if (rt.annotations?.code) text = `<code>${text}</code>`;
        if (rt.href) text = `<a href="${rt.href}" style="color:#2c64e3;">${text}</a>`;
        return text;
      }).join("");
    }

    // --- Fetch page blocks ---

    const headers = {
      "Authorization": `Bearer ${this.notion.$auth.oauth_access_token}`,
      "Notion-Version": "2022-06-28",
    };

    let allBlocks = [];
    let nextCursor = undefined;
    let hasMore = true;

    while (hasMore) {
      const url = new URL(`https://api.notion.com/v1/blocks/${page.id}/children`);
      url.searchParams.set("page_size", "100");
      if (nextCursor) url.searchParams.set("start_cursor", nextCursor);

      const resp = await fetch(url.toString(), { headers });
      const data = await resp.json();

      if (!resp.ok) {
        $.flow.exit(`Failed to fetch page blocks: ${data.message || resp.statusText}`);
      }

      allBlocks = allBlocks.concat(data.results || []);
      hasMore = data.has_more;
      nextCursor = data.next_cursor;
    }

    // --- Parse blocks into structured content ---

    let intro_parts = [];
    let highlights = [];
    let sections = [];
    let outro_parts = [];
    let currentSection = null;
    let foundFirstHeading = false;
    let foundFirstBullet = false;

    // Find the last heading index to detect outro paragraphs
    let lastHeadingIdx = -1;
    for (let i = allBlocks.length - 1; i >= 0; i--) {
      if (allBlocks[i].type?.startsWith("heading_")) {
        lastHeadingIdx = i;
        break;
      }
    }

    for (let i = 0; i < allBlocks.length; i++) {
      const block = allBlocks[i];
      const type = block.type;

      if (type?.startsWith("heading_")) {
        // Any heading starts a new section
        foundFirstHeading = true;
        if (currentSection) sections.push(currentSection);
        currentSection = {
          title: richTextToHtml(block[type].rich_text),
          bullets: [],
          image: null,
        };

      } else if (type === "bulleted_list_item") {
        foundFirstBullet = true;
        if (!foundFirstHeading) {
          // Bullets before any heading = highlights
          highlights.push(richTextToHtml(block.bulleted_list_item.rich_text));
        } else if (currentSection) {
          currentSection.bullets.push(richTextToHtml(block.bulleted_list_item.rich_text));
        }

      } else if (type === "image") {
        if (currentSection) {
          const imgUrl = block.image.type === "external"
            ? block.image.external?.url
            : block.image.file?.url;
          if (imgUrl) currentSection.image = imgUrl;
        }

      } else if (type === "paragraph") {
        const html = richTextToHtml(block.paragraph?.rich_text);
        if (!html.trim()) continue;

        if (!foundFirstBullet && !foundFirstHeading) {
          // Paragraphs before any bullets or headings = intro
          intro_parts.push(html);
        } else if (foundFirstHeading && i > lastHeadingIdx) {
          // Paragraphs after the last heading (and its bullets) = outro
          outro_parts.push(html);
        }

      }
      // Dividers and other block types are skipped
    }

    // Push the last section
    if (currentSection) sections.push(currentSection);

    // --- Build template data ---

    const templateData = {
      subject: getProp("subject"),
      preview_text: getProp("preview_text"),
      hero_date: getProp("hero_date"),
      hero_button_text: getProp("hero_button_text"),
      cta_url: getProp("cta_url"),
      cta_button_text: getProp("cta_button_text"),
    };

    // Intro
    if (intro_parts.length > 0) {
      templateData.intro_text = intro_parts.join("<br>");
    }

    // Highlights (up to 5)
    highlights.slice(0, 5).forEach((h, i) => {
      templateData[`highlight_${i + 1}`] = h;
    });

    // Sections (up to 5)
    sections.slice(0, 5).forEach((s, i) => {
      const n = i + 1;
      templateData[`section_${n}_title`] = s.title;
      if (s.image) templateData[`section_${n}_image`] = s.image;
      s.bullets.slice(0, 5).forEach((b, j) => {
        templateData[`section_${n}_bullet_${j + 1}`] = b;
      });
    });

    // Outro
    if (outro_parts.length > 0) {
      templateData.outro_text = outro_parts.join("<br>");
    }

    // --- Validation ---

    const required = ["subject", "preview_text", "hero_date"];
    const missing = required.filter(f => !templateData[f]);
    if (missing.length > 0) {
      $.flow.exit(`Missing required database properties: ${missing.join(", ")}`);
    }

    if (highlights.length === 0) {
      $.flow.exit("No highlights found. Add a bullet list before the first heading in the page body.");
    }

    if (!templateData.intro_text) {
      $.flow.exit("No intro text found. Add a paragraph before the bullet list in the page body.");
    }

    // Strip empty values so SendGrid {{#if}} conditionals work
    const cleanedData = {};
    for (const [key, value] of Object.entries(templateData)) {
      if (value && String(value).trim() !== "") {
        cleanedData[key] = value;
      }
    }

    return {
      templateData: cleanedData,
      notionPageId: page.id,
      emailSubject: cleanedData.subject,
      fieldCount: Object.keys(cleanedData).length,
      highlightCount: highlights.length,
      sectionCount: sections.length,
    };
  },
});
```

---

### Step 5: HubSpot - Get List Contacts
- **App:** HubSpot
- **Action:** Custom API Request (GET)
- **Method:** GET
- **Endpoint:** `/contacts/v1/lists/YOUR_LIST_ID/contacts/all`
- **Query Parameters:**
  - `count`: `100`
  - `property`: `firstname`
  - `property`: `email`

Alternatively, use the **List Memberships** action if available, or page through results for lists larger than 100 contacts.

For larger lists, use this code step instead:

```javascript
export default defineComponent({
  props: {
    hubspot: {
      type: "app",
      app: "hubspot",
    },
  },
  async run({ steps, $ }) {
    const listId = "YOUR_LIST_ID";
    let allContacts = [];
    let hasMore = true;
    let vidOffset = 0;

    while (hasMore) {
      const response = await this.hubspot.makeRequest({
        method: "GET",
        path: `/contacts/v1/lists/${listId}/contacts/all`,
        params: {
          count: 100,
          vidOffset: vidOffset,
          property: ["firstname", "email"],
        },
      });

      const contacts = response.contacts || [];
      allContacts = allContacts.concat(contacts);
      hasMore = response["has-more"] || false;
      vidOffset = response["vid-offset"] || 0;
    }

    // Extract just email + firstName for each contact
    const recipients = allContacts
      .map(c => ({
        email: c.properties?.email?.value || "",
        firstName: c.properties?.firstname?.value || "",
      }))
      .filter(c => c.email); // Skip contacts with no email

    return {
      recipients: recipients,
      totalContacts: recipients.length,
    };
  },
});
```

---

### Step 6: SendGrid - Loop and Send Emails
- **Language:** Node.js

```javascript
export default defineComponent({
  props: {
    sendgrid: {
      type: "app",
      app: "sendgrid",
    },
  },
  async run({ steps, $ }) {
    const templateData = steps.parse_notion_page.$return_value.templateData;
    const recipients = steps.get_hubspot_contacts.$return_value.recipients;
    const TEMPLATE_ID = "d-c9d363eaac97470bb73ff78f1782005d";
    const FROM_EMAIL = "updates@truv.com";
    const FROM_NAME = "Truv";

    let sent = 0;
    let failed = 0;
    const errors = [];

    for (const contact of recipients) {
      // Merge Notion template data with per-contact firstName
      const personalizedData = {
        ...templateData,
        firstName: contact.firstName || "there",
      };

      try {
        await this.sendgrid.makeRequest({
          method: "POST",
          path: "/v3/mail/send",
          data: {
            from: {
              email: FROM_EMAIL,
              name: FROM_NAME,
            },
            personalizations: [
              {
                to: [{ email: contact.email }],
                dynamic_template_data: personalizedData,
              },
            ],
            template_id: TEMPLATE_ID,
          },
        });

        sent++;
      } catch (err) {
        failed++;
        errors.push({
          email: contact.email,
          error: err.message || "Unknown error",
        });
      }

      // Rate limiting: SendGrid allows 600 requests/min on most plans
      // Add a small delay to stay well under the limit
      if (sent % 50 === 0) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return {
      sent: sent,
      failed: failed,
      total: recipients.length,
      errors: errors.slice(0, 10), // Return first 10 errors for debugging
      summary: `Sent ${sent}/${recipients.length} emails. ${failed} failed.`,
    };
  },
});
```

---

## Configuration Values

| Setting | Value |
|---------|-------|
| Trigger | Manual (click Run) |
| Notion Database ID | `3f94409218a8434e9951075e9f9cda85` |
| HubSpot List ID | `YOUR_LIST_ID` |
| SendGrid Template ID | `d-c9d363eaac97470bb73ff78f1782005d` |
| From Email | updates@truv.com |
| From Name | Truv |
| Rate Limit Pause | 1 second every 50 emails |

---

## Error Handling

### Notion Step
- If no pages have Status = "Ready", the workflow exits with a clear message
- If required properties (subject, preview_text, hero_date) are missing, the workflow exits and lists what's missing
- If the page body has no highlights (no bullets before the first heading), the workflow exits with instructions
- If the page body has no intro text (no paragraphs before the bullets), the workflow exits with instructions

### HubSpot Step
- Contacts without an email address are filtered out
- Pagination handles lists larger than 100 contacts

### SendGrid Step
- Each email send is wrapped in try/catch so one failure does not stop the rest
- Failed sends are logged with the email address and error message
- First 10 errors are returned in the step output for debugging
- Rate limiting delay prevents hitting SendGrid API limits

### Common Issues
- **"No Notion pages found"** -- Make sure the entry Status is set to "Ready" (not "Draft")
- **"No highlights found"** -- Add a bullet list in the page body before the first heading
- **"No intro text found"** -- Add a paragraph at the top of the page body before the bullet list
- **SendGrid 403 error** -- Check that the from email domain is verified in SendGrid
- **Formatting not showing** -- Make sure the SendGrid template uses triple braces `{{{variable}}}` for content fields (already configured in the updated template)
- **Images not loading** -- Use permanent, externally hosted image URLs (not Notion uploads, which expire)

---

## Walkthrough: February 2026 Product Update

This is a complete example of populating and sending one monthly product update email.

### 1. Create a new row in the Notion database

Open the [Product Update Emails](https://www.notion.so/3f94409218a8434e9951075e9f9cda85) database and click **+ New**. Fill in the properties:

| Property | Value |
|----------|-------|
| **Name** | February 2026 Product Update |
| **Status** | Draft |
| **subject** | Truv Product Update — February 2026 |
| **preview_text** | Batch verifications, new payroll connectors, and a refreshed developer portal |
| **hero_date** | February 2026 |
| **hero_button_text** | See What's New |
| **cta_url** | https://truv.com/changelog |
| **cta_button_text** | View Full Changelog |

> Leave Status as **Draft** while you're writing. Change it to **Ready** only when the content is finalized.

### 2. Write the page body

Open the page you just created and write the email content using normal Notion formatting. Here's exactly what you'd type:

---

#### Intro (paragraphs before the first bullet list)

```
Here's what's new at Truv this month. We shipped batch verifications, expanded payroll coverage, and launched a redesigned developer portal to get you building faster.
```

This becomes the greeting text right after "Hi {firstName}".

---

#### Key Highlights (bullet list before the first heading)

```
- New **Batch Verification API** for high-volume processing
- 12 new payroll connectors including Paycom and Paylocity
- Redesigned [Developer Portal](https://docs.truv.com) with interactive guides
```

These render as the "Key Highlights" bullet list at the top of the email. You can have up to 5 bullets. Use **bold** and [links](url) freely — they carry through to the email.

---

#### Sections (headings with bullets and optional images)

Each `## Heading` starts a new section in the email. Under each heading, add bullets and optionally an image. You can have up to 5 sections, each with up to 5 bullets.

**Section 1:**

```
## Batch Verification API

- Submit up to **10,000 verification requests** in a single API call
- Async processing with [webhook callbacks](https://docs.truv.com/docs/webhooks) when results are ready
- Built-in deduplication — no charge for duplicate records within the same batch
- Full audit trail and per-record status tracking in the dashboard
```

If you have a screenshot, paste an externally-hosted image right after the heading and before the bullets:

```
## Batch Verification API
[paste image here]
- Submit up to **10,000 verification requests** in a single API call
...
```

> **Important:** Don't use Notion-uploaded images (drag and drop). Those URLs expire. Instead, host screenshots on your website, S3, or image CDN and paste the external URL.

**Section 2:**

```
## Expanded Payroll Coverage

- Added **Paycom**, **Paylocity**, and **Ceridian Dayforce**
- 9 additional regional payroll providers across the Southeast
- Coverage now includes **94% of the U.S. workforce**
```

**Section 3:**

```
## Redesigned Developer Portal

- Interactive [API explorer](https://docs.truv.com/api) — test endpoints directly in the browser
- Step-by-step integration guides with **copy-paste code samples**
- New troubleshooting section with common error patterns and fixes
```

You don't need to use all 5 sections. The template hides any that are empty.

---

#### Outro (paragraphs after the last section)

```
Questions about any of these updates? Reach out to your CSM or [contact us](https://truv.com/request-a-demo) anytime. We're here to help.
```

This appears at the bottom of the email, right before the final CTA button.

---

### 3. Review the full page

Your completed Notion page body should look like this top-to-bottom:

```
Here's what's new at Truv this month. We shipped batch verifications,
expanded payroll coverage, and launched a redesigned developer portal
to get you building faster.

- New **Batch Verification API** for high-volume processing
- 12 new payroll connectors including Paycom and Paylocity
- Redesigned [Developer Portal](https://docs.truv.com) with interactive guides

## Batch Verification API
- Submit up to **10,000 verification requests** in a single API call
- Async processing with [webhook callbacks](https://docs.truv.com/docs/webhooks)
  when results are ready
- Built-in deduplication — no charge for duplicate records within the same batch
- Full audit trail and per-record status tracking in the dashboard

## Expanded Payroll Coverage
- Added **Paycom**, **Paylocity**, and **Ceridian Dayforce**
- 9 additional regional payroll providers across the Southeast
- Coverage now includes **94% of the U.S. workforce**

## Redesigned Developer Portal
- Interactive [API explorer](https://docs.truv.com/api) — test endpoints
  directly in the browser
- Step-by-step integration guides with **copy-paste code samples**
- New troubleshooting section with common error patterns and fixes

Questions about any of these updates? Reach out to your CSM or
[contact us](https://truv.com/request-a-demo) anytime.
We're here to help.
```

### 4. What the parser produces

The Pipedream code step reads this page and outputs the following SendGrid template data:

```json
{
  "subject": "Truv Product Update — February 2026",
  "preview_text": "Batch verifications, new payroll connectors, and a refreshed developer portal",
  "hero_date": "February 2026",
  "hero_button_text": "See What's New",
  "cta_url": "https://truv.com/changelog",
  "cta_button_text": "View Full Changelog",

  "intro_text": "Here's what's new at Truv this month. We shipped batch verifications, expanded payroll coverage, and launched a redesigned developer portal to get you building faster.",

  "highlight_1": "New <strong>Batch Verification API</strong> for high-volume processing",
  "highlight_2": "12 new payroll connectors including Paycom and Paylocity",
  "highlight_3": "Redesigned <a href=\"https://docs.truv.com\" style=\"color:#2c64e3;\">Developer Portal</a> with interactive guides",

  "section_1_title": "Batch Verification API",
  "section_1_bullet_1": "Submit up to <strong>10,000 verification requests</strong> in a single API call",
  "section_1_bullet_2": "Async processing with <a href=\"https://docs.truv.com/docs/webhooks\" style=\"color:#2c64e3;\">webhook callbacks</a> when results are ready",
  "section_1_bullet_3": "Built-in deduplication — no charge for duplicate records within the same batch",
  "section_1_bullet_4": "Full audit trail and per-record status tracking in the dashboard",

  "section_2_title": "Expanded Payroll Coverage",
  "section_2_bullet_1": "Added <strong>Paycom</strong>, <strong>Paylocity</strong>, and <strong>Ceridian Dayforce</strong>",
  "section_2_bullet_2": "9 additional regional payroll providers across the Southeast",
  "section_2_bullet_3": "Coverage now includes <strong>94% of the U.S. workforce</strong>",

  "section_3_title": "Redesigned Developer Portal",
  "section_3_bullet_1": "Interactive <a href=\"https://docs.truv.com/api\" style=\"color:#2c64e3;\">API explorer</a> — test endpoints directly in the browser",
  "section_3_bullet_2": "Step-by-step integration guides with <strong>copy-paste code samples</strong>",
  "section_3_bullet_3": "New troubleshooting section with common error patterns and fixes",

  "outro_text": "Questions about any of these updates? Reach out to your CSM or <a href=\"https://truv.com/request-a-demo\" style=\"color:#2c64e3;\">contact us</a> anytime. We're here to help."
}
```

Sections 4 and 5 are absent, so the `{{#if}}` conditionals in the SendGrid template hide them automatically. No empty headings or blank space.

Each recipient gets a personalized `firstName` from HubSpot (falls back to "there" if missing).

### 5. Mark as Ready and send

1. Change the **Status** property to **Ready**
2. Open [Pipedream](https://pipedream.com) and click **Run** on the Product Update workflow
3. The parse step output shows `highlightCount: 3` and `sectionCount: 3` — verify these match what you wrote
4. Check the send step output for `sent` vs `failed` counts
5. Go back to Notion and change **Status** to **Sent**

### Quick checklist before hitting Run

- [ ] All properties filled in (subject, preview_text, hero_date at minimum)
- [ ] Page body has intro paragraph(s) before the bullet list
- [ ] Page body has at least 1 highlight bullet before the first heading
- [ ] Any images are externally hosted (not Notion uploads)
- [ ] Bold/italic/links look correct in Notion (they'll carry through)
- [ ] Status is set to **Ready**
- [ ] HubSpot recipient list is up to date

---

## Testing

### Test with a Small List First
1. Create a HubSpot list called "Product Update - Test" with 2-3 internal email addresses
2. Point the workflow at this test list ID
3. Create a Notion entry with Status = "Ready", fill in the properties, and write the page body
4. Click "Run" in Pipedream
5. Check the step outputs -- the parse step shows `highlightCount` and `sectionCount` so you can verify it parsed correctly
6. Verify the test emails arrive and render correctly

### Verify Template Rendering
- Check that **bold**, *italic*, and [links](url) render correctly in the email
- Check that empty sections are properly hidden (no blank headings or empty bullet lists)
- Check that `firstName` falls back to "there" for contacts without a first name
- Test on both desktop and mobile email clients
- Check the preview text shows correctly in inbox view

### Switch to Production
Once testing passes, update the HubSpot List ID to your production recipient list and run again.

---

## Monthly vs. One-Time Setup

### One-Time Setup (do once)
- Create the Pipedream workflow with all steps
- Notion database already created (ID: `3f94409218a8434e9951075e9f9cda85`)
- SendGrid dynamic template already created (ID: `d-c9d363eaac97470bb73ff78f1782005d`)
- Create the HubSpot recipient list
- Save the HubSpot list ID in the workflow
- Connect Notion, HubSpot, and SendGrid accounts in Pipedream
- Create a test list and run a test send

### Monthly Process (repeat each month)
1. Create a new row in the Notion database
2. Fill in the properties (Name, subject, preview_text, hero_date, button text, CTA URL)
3. Open the page and write the body content (intro, highlights, sections with formatting/images, outro)
4. Set Status to "Ready"
5. Open Pipedream and click "Run"
6. Verify the step outputs show successful sends
7. Optionally update the Notion entry Status to "Sent"

### Occasional Maintenance
- Update the HubSpot list if the recipient audience changes
- Update the SendGrid template HTML if the email design changes
- The page body format is flexible -- no code changes needed to add/remove sections

---

## Template Variable Reference

Quick reference of all SendGrid dynamic template variables and where they come from:

| Variable | Source | Required |
|----------|--------|----------|
| `subject` | Notion property | Yes |
| `preview_text` | Notion property | Yes |
| `hero_date` | Notion property | Yes |
| `hero_button_text` | Notion property | No |
| `cta_url` | Notion property | No |
| `cta_button_text` | Notion property | No |
| `firstName` | HubSpot | No (falls back to "there") |
| `intro_text` | Page body (paragraphs before bullets) | Yes |
| `highlight_1` through `highlight_5` | Page body (bullets before first heading) | At least 1 |
| `section_N_title` | Page body (headings) | No |
| `section_N_bullet_1` through `section_N_bullet_5` | Page body (bullets under headings) | No |
| `section_N_image` | Page body (images under headings) | No |
| `outro_text` | Page body (paragraphs after all sections) | No |

Content fields use triple braces `{{{variable}}}` in the template so HTML formatting (bold, links, etc.) renders correctly. Metadata fields use double braces `{{variable}}` since they're plain text.
