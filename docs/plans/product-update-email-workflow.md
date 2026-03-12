# Product Update Email Workflow

## Overview
Monthly product update emails sent to technical decision-makers and customers via Knock + SendGrid.

**Architecture:** Notion (content) -> Parser (CLI/script) -> Knock workflow -> SendGrid dynamic template
**Frequency:** Monthly (or as needed after product team fills in Notion)

---

## Infrastructure

| Component | ID / Key | Details |
|-----------|----------|---------|
| **Notion Database** | `3f94409218a8434e9951075e9f9cda85` | [Product Update Emails](https://www.notion.so/3f94409218a8434e9951075e9f9cda85) |
| **SendGrid Template** | `d-c9d363eaac97470bb73ff78f1782005d` | Dynamic template with Handlebars conditionals |
| **HubSpot List** | `9230` | [Product Updates] All Recipients (dynamic, ~5,900 contacts) |
| **Knock Audience** | `product-updates-all` | Synced from HubSpot list 9230 |
| **Knock Workflow** | `product-update-monthly` | HTTP webhook step to SendGrid |
| **Knock Channel** | `sendgrid-customer-success` | HTTP webhook type |
| **ASM Group** | `29127` | Marketing Communications (unsubscribe group) |
| **Sender** | `insights@email.truv.com` / Truv | |
| **Image Hosting** | Cloudinary (`dc0r5pclf`) | `truv-emails/product-update-*` |

---

## HubSpot Audience (List 9230)

Dynamic list with three OR groups, all requiring contact within last 365 days and excluding bounce/unsubscribe lists:

| Group | Criteria |
|-------|----------|
| Dashboard customers | `has_dashboard_account = true` + company lifecycle = customer |
| Lending + tech | Use case = lending + technical job title + exec/director/VP level |
| Tech decision-makers | Technical job title + exec/director/VP + not @truv |

**Suppression lists applied globally:** Hard Bounces (4267, 3046), Email Bounces (8382), Unsubscribers (8311, 2997)

**Re-sync to Knock:** `python -m outreach_intel.knock_audience push 9230 --audience-key product-updates-all`

---

## Notion Database Schema

**Database:** "Product Update Emails" | **ID:** `3f94409218a8434e9951075e9f9cda85`

| Property | Type | Description | Example |
|----------|------|-------------|---------|
| `Name` | Title | Month identifier | "February 2026 Product Update" |
| `Status` | Select | Draft / Ready / Sent | "Ready" |
| `subject` | Rich Text | Email subject line | "Truv Product Update - February 2026" |
| `preview_text` | Rich Text | Email preview/preheader text | "Multi-product ordering, new notification feed, and more" |
| `hero_date` | Rich Text | Date shown in hero section | "February 2026" |
| `hero_button_text` | Rich Text | Hero CTA button label | "See What's New" |
| `cta_url` | URL | Primary CTA link (hero + bottom) | "https://truv.com/changelog" |
| `cta_button_text` | Rich Text | Bottom CTA button label | "View Full Changelog" |

---

## Page Body Format

Write the email content directly in the Notion page body. The parser reads blocks top-to-bottom.

### Structure

```
[Intro paragraph(s)]

- Highlight 1
- Highlight 2
- Highlight 3

## Section Title 1
[optional image]
- Bullet point with **bold text** and [links](https://example.com)

## Section Title 2
[optional image]
Paragraph text (for sections without bullets, like a case study spotlight)

[Outro paragraph(s)]
```

### Parsing Rules

| What you write in Notion | What it becomes in the email |
|--------------------------|-------------------------------|
| Paragraphs before the first bullet list | **Intro text** (after "Hi {firstName}") |
| Bullet list before the first heading | **Key Highlights** (up to 5) |
| Each `## Heading` | **Section title** (up to 5 sections) |
| Bullets under a heading | **Section bullet points** (up to 5 per section) |
| Paragraphs under a heading (no bullets) | **Section text** (rendered as paragraph) |
| Image under a heading | **Section image** |
| Paragraphs after all sections | **Outro text** (before bottom CTA) |

### Formatting

Notion formatting is preserved as HTML:

| Notion | Email output |
|--------|-------------|
| **bold** | `<strong>bold</strong>` |
| *italic* | `<em>italic</em>` |
| [link text](url) | `<a href="url">link text</a>` |
| ~~strikethrough~~ | `<s>strikethrough</s>` |

### Notes
- Use any heading level (H1, H2, H3) -- they all start a new section
- Leave out sections you don't need. The template hides empty sections automatically.
- Images must be externally hosted (Notion uploads expire). Use Cloudinary: upload with `truv-emails/` prefix.
- Sections can have either bullets OR paragraph text, not both. If a section has paragraphs and no bullets, it renders as `section_X_text`.

---

## Parser Code

This Node.js function reads a Notion page and produces the SendGrid template data object. Used by whatever orchestrator triggers the Knock workflow (CLI script, Pipedream, etc.).

```javascript
// --- Helpers ---

function getProp(props, name) {
  const prop = props[name];
  if (!prop) return "";
  if (prop.type === "rich_text") return prop.rich_text?.map(t => t.plain_text).join("") || "";
  if (prop.type === "title") return prop.title?.map(t => t.plain_text).join("") || "";
  if (prop.type === "url") return prop.url || "";
  return "";
}

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

// --- Parse blocks into structured content ---

function parseNotionBlocks(allBlocks) {
  let intro_parts = [];
  let highlights = [];
  let sections = [];
  let outro_parts = [];
  let currentSection = null;
  let foundFirstHeading = false;
  let foundFirstBullet = false;

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
      foundFirstHeading = true;
      if (currentSection) sections.push(currentSection);
      currentSection = {
        title: richTextToHtml(block[type].rich_text),
        bullets: [],
        paragraphs: [],
        image: null,
      };

    } else if (type === "bulleted_list_item") {
      foundFirstBullet = true;
      if (!foundFirstHeading) {
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
        intro_parts.push(html);
      } else if (currentSection && i <= lastHeadingIdx) {
        currentSection.paragraphs.push(html);
      } else if (foundFirstHeading && i > lastHeadingIdx) {
        outro_parts.push(html);
      }
    }
  }

  if (currentSection) sections.push(currentSection);
  return { intro_parts, highlights, sections, outro_parts };
}

// --- Build template data ---

function buildTemplateData(props, parsedContent) {
  const { intro_parts, highlights, sections, outro_parts } = parsedContent;

  const templateData = {
    subject: getProp(props, "subject"),
    preview_text: getProp(props, "preview_text"),
    hero_date: getProp(props, "hero_date"),
    hero_button_text: getProp(props, "hero_button_text"),
    cta_url: getProp(props, "cta_url"),
    cta_button_text: getProp(props, "cta_button_text"),
  };

  if (intro_parts.length > 0) {
    templateData.intro_text = intro_parts.join("<br>");
  }

  highlights.slice(0, 5).forEach((h, i) => {
    templateData[`highlight_${i + 1}`] = h;
  });

  sections.slice(0, 5).forEach((s, i) => {
    const n = i + 1;
    templateData[`section_${n}_title`] = s.title;
    if (s.image) templateData[`section_${n}_image`] = s.image;
    if (s.paragraphs.length > 0 && s.bullets.length === 0) {
      templateData[`section_${n}_text`] = s.paragraphs.join("<br>");
    } else {
      s.bullets.slice(0, 5).forEach((b, j) => {
        templateData[`section_${n}_bullet_${j + 1}`] = b;
      });
    }
  });

  if (outro_parts.length > 0) {
    templateData.outro_text = outro_parts.join("<br>");
  }

  // Strip empty values so SendGrid {{#if}} conditionals work
  const cleanedData = {};
  for (const [key, value] of Object.entries(templateData)) {
    if (value && String(value).trim() !== "") {
      cleanedData[key] = value;
    }
  }

  return cleanedData;
}
```

---

## Triggering the Knock Workflow

The Knock workflow `product-update-monthly` accepts the parsed template data as its `data` payload and sends to all subscribers of the `product-updates-all` audience.

### Trigger via Knock API

```bash
curl -X POST "https://api.knock.app/v1/workflows/product-update-monthly/trigger" \
  -H "Authorization: Bearer $KNOCK_SERVICE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "recipients": [{"collection": "audiences", "id": "product-updates-all"}],
    "data": {
      "subject": "Truv Product Update — February 2026",
      "preview_text": "Multi-product ordering in Encompass, new Dashboard notification feed, and a CMG case study",
      "hero_date": "February 2026",
      "hero_button_text": "See What's New",
      "cta_url": "https://truv.com/changelog",
      "cta_button_text": "View Full Changelog",
      "intro_text": "February release continues the momentum...",
      "highlight_1": "<strong>Encompass Improvements</strong> - Multi-Product Orders",
      "highlight_2": "<strong>Truv Dashboard Updates</strong> - New Notification Feed",
      "highlight_3": "<strong>Truv Bridge & Orders</strong> - Enhanced Labels",
      "section_1_title": "Encompass Improvements",
      "section_1_image": "https://res.cloudinary.com/dc0r5pclf/image/upload/v.../truv-emails/product-update-feb2026-encompass.png",
      "section_1_bullet_1": "<strong>Create Multi-Product Orders:</strong> ...",
      "section_2_title": "Truv Dashboard Updates",
      "section_2_image": "https://res.cloudinary.com/dc0r5pclf/image/upload/v.../truv-emails/product-update-feb2026-dashboard.png",
      "section_2_bullet_1": "<strong>Notification Feed & Preference Center:</strong> ...",
      "section_4_title": "Customer Spotlight",
      "section_4_image": "https://res.cloudinary.com/dc0r5pclf/image/upload/v.../truv-emails/product-update-feb2026-cmg.png",
      "section_4_text": "Before partnering with Truv, CMG was spending <strong>$1.1 million per month</strong>...",
      "outro_text": "Check out the full <a href=\"https://truv.com/changelog\">Product Update</a> and reach out to the Truv Team if you have any questions."
    }
  }'
```

### Trigger via Python CLI

```bash
source venv/bin/activate
python -m outreach_intel.knock_audience trigger product-update-monthly product-updates-all --data-file /tmp/template_data.json
```

---

## Monthly Process

### Each Month

1. Product team creates a new row in the [Notion database](https://www.notion.so/3f94409218a8434e9951075e9f9cda85)
2. Fill in properties (subject, preview_text, hero_date, button text, CTA URL)
3. Write the page body (intro, highlights, sections with formatting/images, outro)
4. Re-host any Notion images to Cloudinary (`truv-emails/` prefix)
5. Parse the Notion page into template data (using parser code above)
6. Re-sync audience if needed: `python -m outreach_intel.knock_audience push 9230 --audience-key product-updates-all`
7. Trigger the Knock workflow with the parsed data
8. Update Notion Status to "Sent"

### Testing

1. Use `cameron-test-audience` in Knock for test sends (safe for CLI sends per project rules)
2. Verify bold/italic/links render correctly
3. Verify empty sections are hidden
4. Verify `firstName` falls back correctly
5. Test on desktop and mobile email clients
6. Check preview text in inbox view

### Occasional Maintenance

- HubSpot list 9230 is dynamic -- audience updates automatically based on filter criteria
- Re-sync to Knock when you want to pick up new HubSpot list members
- Update SendGrid template HTML if the email design changes
- The page body format is flexible -- no code changes needed to add/remove sections

---

## Template Variable Reference

| Variable | Source | Required |
|----------|--------|----------|
| `subject` | Notion property | Yes |
| `preview_text` | Notion property | Yes |
| `hero_date` | Notion property | Yes |
| `hero_button_text` | Notion property | No |
| `cta_url` | Notion property | No |
| `cta_button_text` | Notion property | No |
| `firstName` | Knock recipient (from HubSpot) | No (falls back to name) |
| `intro_text` | Page body (paragraphs before bullets) | Yes |
| `highlight_1` through `highlight_5` | Page body (bullets before first heading) | At least 1 |
| `section_N_title` | Page body (headings) | No |
| `section_N_bullet_1` through `section_N_bullet_5` | Page body (bullets under headings) | No |
| `section_N_text` | Page body (paragraphs under headings, when no bullets) | No |
| `section_N_image` | Page body (images under headings) | No |
| `outro_text` | Page body (paragraphs after all sections) | No |

Content fields use triple braces `{{{variable}}}` in the SendGrid template so HTML formatting renders correctly. Metadata fields use double braces `{{variable}}`.

---

## Error Handling

- **Missing Notion properties:** Parser validates required fields (subject, preview_text, hero_date) and exits with a clear message
- **No highlights found:** Parser exits if no bullet list before the first heading
- **No intro text:** Parser exits if no paragraphs before the bullet list
- **Expired images:** Use Cloudinary-hosted URLs, not Notion uploads
- **SendGrid 403:** Check that `insights@email.truv.com` domain is verified in SendGrid
- **Formatting not showing:** Ensure SendGrid template uses `{{{triple_braces}}}` for content fields
