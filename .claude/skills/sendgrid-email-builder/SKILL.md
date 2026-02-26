---
name: sendgrid-email-builder
description: Use when creating marketing email HTML templates for SendGrid. Triggers on "build an email", "create an email template", "email for [campaign/launch/announcement]", "SendGrid template", or "marketing email". Also use when adapting an existing email template for a new campaign.
---

# SendGrid Email Builder

Build branded, mobile-responsive HTML email templates for Truv marketing campaigns using the established Truv email design system.

## When to Use

- Creating a new marketing email (whitepaper launch, product update, webinar invite, etc.)
- Adapting an existing email template for a new campaign
- Building a SendGrid-ready HTML template from Notion copy

## Required Inputs

Before starting, gather:

1. **Email copy** - Notion page URL or inline content
2. **Campaign type** - What kind of email (whitepaper, product update, webinar, etc.)
3. **CTA URL** - Landing page or destination link
4. **UTM campaign name** - For tracking (e.g., `whitepaper-verification-cost`)
5. **Hero style** - Light (product-bg image) or dark (navy gradient) — ask if unclear
6. **Images** - Any hero images, section images, or mockups (Cloudinary URLs preferred)

## Workflow

### Step 1: Fetch Email Copy

If a Notion URL is provided, use the Notion MCP to fetch content:

```
mcp__claude_ai_Notion__notion-fetch with the page URL
```

Extract: greeting, body sections, bullet lists, CTAs, sign-off.

### Step 2: Choose Base Template

Pick the closest existing template from `docs/`:

| Campaign Type | Base Template |
|---|---|
| Product update | `docs/sendgrid-product-update-jan2026.html` |
| Whitepaper/content launch | `docs/sendgrid-whitepaper-launch-email.html` |
| Webinar invite | `docs/sendgrid-encompass-webinar-template.html` |
| Survey/NPS | `docs/sendgrid-nps-survey-template.html` |

Read the base template to use as the HTML structure.

### Step 3: Build the Email

Create a new file at `docs/sendgrid-[campaign-name].html`.

**Adapt the template by replacing:**
- `<title>` tag
- Preview text (`display: none` div)
- Hero section (title, subtitle, CTA button)
- Body content (sections, bullets, images, HRs)
- Bottom CTA button
- Footer tagline
- All UTM parameters across every link

### Step 4: Configure UTMs

Apply UTMs to ALL links (hero CTA, body links, bottom CTA, footer links):

```
?utm_source=email&utm_medium=email&utm_campaign=[campaign-name]
```

In HTML, encode as `&amp;` between parameters.

### Step 5: Save and Report

Save to `docs/sendgrid-[campaign-name].html`. Report what placeholders (if any) need to be replaced.

## Brand Design System

### Fonts

Gilroy loaded via `@font-face` from HubSpot CDN:
- **Medium (500):** Body text, subtitles, buttons
- **Bold (600):** Headings, badges — use sparingly, Truv style leans toward 500

```
https://hs-19933594.f.hubspotemail.net/hubfs/19933594/Truv/Font%20Gilroy/Gilroy-Medium.woff2
https://hs-19933594.f.hubspotemail.net/hubfs/19933594/Truv/Font%20Gilroy/Gilroy-Bold.woff2
```

### Colors

| Token | Hex | Usage |
|---|---|---|
| Truv Blue | `#2c64e3` | CTA buttons, links, badges |
| Dark Navy | `#0f1c47` | Dark hero backgrounds |
| Light Blue | `#c5d9f7` | Subtitle text on dark backgrounds |
| Body Text | `#171717` | Default text color |
| Muted Text | `#878a92` | Footer text |
| Page BG | `#e0e0e0` | Email outer background |
| Card BG | `#ffffff` | Body section background |
| Footer BG | `#f5f5f5` | Footer section background |

### Logos

| Variant | URL |
|---|---|
| Dark (default) | `https://truv.com/wp-content/themes/twentytwentyone/assets_truv/images/logo/logo-truv.png` |
| White (dark hero) | `https://res.cloudinary.com/dc0r5pclf/image/upload/v1768234665/logo-truv-white_s1kr8v.svg` |

### Hero Styles

**Light hero** (product updates, general):
```css
background-image: url('https://truv.com/wp-content/themes/twentytwentyone/assets_truv/images/letter/letter-product-bg.png');
background-color: #f6f6f6;
/* Use dark logo, dark text (#171717) */
```

**Dark hero** (whitepapers, launches, premium content):
```css
background: linear-gradient(180deg, #0a1232 0%, #162257 50%, #1e3a6e 100%);
background-color: #0f1c47; /* fallback */
/* Use white logo, white text, #c5d9f7 subtitles */
```

### CTA Buttons

```html
<a href="[URL]" style="font-style: normal; text-decoration: none; font-weight: 500;
  display: inline-block; background-color: #2c64e3; color: #ffffff;
  border-radius: 50px; border-width: 0; font-size: 17px; height: 17px;
  min-width: 140px; text-align: center; line-height: 100%;
  font-family: Gilroy,sans-serif; padding: 16px 15px;">Button Text</a>
```

## Email Structure

Every Truv email has 3 sections:

```
┌──────────────────────────┐
│ HERO (rounded top)       │  Logo + Title + Subtitle + CTA
│ bg: gradient or image    │  Optional: two-column with mockup image
├──────────────────────────┤
│ BODY (white card)        │  Greeting + Content sections + Bottom CTA
│ bg: #ffffff              │  Use <hr> between sections
├──────────────────────────┤
│ FOOTER (rounded bottom)  │  Tagline + Links + Social + Address + Unsub
│ bg: #f5f5f5              │  {{{unsubscribe}}} for SendGrid
└──────────────────────────┘
```

Container: `max-width: 660px`, centered, with `border-radius: 20px` on top/bottom.

## Mobile Responsive Rules

Use classes on elements, then override with `!important` in `@media screen and (max-width: 640px)`:

- **Never put `text-align` inline on h1/p** — put it on the parent `<td>` with a class so mobile media queries can override it
- Use `align="left"` sparingly — prefer class-based alignment
- Two-column layouts: use `display: block !important; width: 100% !important;` to stack
- Center everything on mobile: badge, title, subtitle, CTA, images

```css
@media screen and (max-width: 640px) {
    .wdth-mob-100 { width: 100% !important; }
    .mob-center { text-align: center !important; }
    .hero-text { text-align: center !important; }
    .hero-badge { text-align: center !important; }
    .hero-badge-table { margin: 0 auto !important; }
    .hero-cta { text-align: center !important; }
    /* Stack two-column hero */
    .product-main tr { display: block !important; }
    .product-main td[width="55%"],
    .product-main td[width="45%"] {
        display: block !important; width: 100% !important;
        padding-right: 0 !important; text-align: center !important;
    }
}
```

## Footer Template

Footer is identical across all emails. Only change:
- **Tagline text** (contextual to campaign)
- **UTM campaign parameter** on footer links

Links always included: Help Center, Quickstart Guide, Changelog, Blog, Service Terms, Privacy Policy, Contact Truv.

Social: LinkedIn (`/company/truvhq`) + X (`/TruvHQ`).

Unsubscribe: `{{{unsubscribe}}}` (triple-brace, SendGrid syntax).

## Common Mistakes

- **Inline `text-align: left` on h1/p** — media queries can't override inline styles in many email clients. Put alignment on the parent `<td>` with a class instead.
- **Missing `&amp;` encoding** — UTM params in `href` attributes must use `&amp;` not `&`
- **SVG logos in email** — Some clients don't render SVGs. Test or provide PNG fallback.
- **CSS gradients** — Always include a `background-color` fallback for Outlook
- **Forgetting `{{{unsubscribe}}}`** — Required for CAN-SPAM compliance
