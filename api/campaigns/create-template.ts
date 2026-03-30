import type { VercelRequest, VercelResponse } from '@vercel/node';
import OpenAI from 'openai';

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/openai/';

function corsHeaders(res: VercelResponse): void {}

const EMAIL_SYSTEM_PROMPT = `You are an email HTML builder for Truv, a consumer permissioned data platform. Generate a complete, production-ready HTML email template using the Truv brand design system.

BRAND RULES:
- Font: Gilroy loaded via @font-face from HubSpot CDN
  Medium (500): https://hs-19933594.f.hubspotemail.net/hubfs/19933594/Truv/Font%20Gilroy/Gilroy-Medium.woff2
  Bold (600): https://hs-19933594.f.hubspotemail.net/hubfs/19933594/Truv/Font%20Gilroy/Gilroy-Bold.woff2
- Colors: Truv Blue #2c64e3, Dark Navy #0f1c47, Light Blue #c5d9f7, Body #171717, Muted #878a92, Page BG #e0e0e0, Card #ffffff, Footer #f5f5f5
- Logo (dark hero): https://truv.com/wp-content/themes/twentytwentyone/assets_truv/images/logo/logo-truv-white.png
- Container: max-width 660px, centered
- CTA buttons: #2c64e3 bg, white text, border-radius 50px, padding 16px 28px, font-weight 500
- Hero: dark gradient (linear-gradient(180deg, #0a1232, #162257, #1e3a6e)), border-radius 20px top
- Body: white background
- Footer: #f5f5f5, border-radius 20px bottom, includes {{{unsubscribe}}} link

STRUCTURE:
1. HERO: Logo + badge text + h1 title + subtitle + CTA button (white bg on dark hero)
2. BODY: "Hey {{firstName}}," greeting + content paragraphs + bullet lists + optional HR sections + bottom CTA (blue)
3. FOOTER: "Truv · Consumer Permissioned Data" + unsubscribe link

RULES:
- Use {{firstName}} for personalization (SendGrid dynamic template data)
- Use {{{unsubscribe}}} for the unsubscribe link (triple braces, SendGrid syntax)
- All CTA URLs should include utm_source=email&utm_medium=email&utm_campaign=CAMPAIGN_SLUG (use &amp; in href)
- Use table-based layout for email client compatibility
- Include mobile responsive @media queries
- Output ONLY the complete HTML, no explanation or markdown fences`;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  corsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    if (!SENDGRID_API_KEY) throw new Error('SendGrid API key not configured');

    const { name, subject, content, ctaUrl, ctaText, heroStyle, campaignSlug, cloneFromId } = req.body;
    if (!name) return res.status(400).json({ error: 'Template name is required' });

    // Clone mode: copy HTML structure from existing template, regenerate content with Gemini
    if (cloneFromId) {
      const srcRes = await fetch(`https://api.sendgrid.com/v3/templates/${cloneFromId}`, {
        headers: { Authorization: `Bearer ${SENDGRID_API_KEY}` },
      });
      if (!srcRes.ok) throw new Error(`Source template ${cloneFromId} not found`);
      const srcData = await srcRes.json();
      const activeVersion = (srcData.versions || []).find((v: { active: number }) => v.active === 1);
      if (!activeVersion) throw new Error('Source template has no active version');

      let finalHtml = activeVersion.html_content;

      // If content is provided, use Gemini to rewrite the HTML with new content
      if (content && GEMINI_API_KEY) {
        const client = new OpenAI({ apiKey: GEMINI_API_KEY, baseURL: GEMINI_BASE_URL });

        const rewriteResponse = await client.chat.completions.create({
          model: 'gemini-2.0-flash',
          max_tokens: 12000,
          messages: [
            {
              role: 'system',
              content: `You are an HTML email editor. You will receive an existing HTML email template and new content. Your job is to keep the EXACT same HTML structure, CSS styles, layout, hero design, footer, and brand elements — but replace the text content (title, subtitle, body paragraphs, bullet points, section headings, CTA text) with the new content provided.

RULES:
- Keep ALL CSS, @font-face, @media queries, table structure, colors, images, logos EXACTLY as-is
- Keep {{firstName}} personalization and {{{unsubscribe}}} link
- Replace the <title> tag text
- Replace hero h1, subtitle, badge text, and CTA button text
- Replace body paragraphs, bullet lists, section headings with new content
- Replace bottom CTA button text
- Update UTM campaign slug if a new one is provided
- Output ONLY the complete modified HTML, no explanation or markdown fences
- If the new content has fewer sections than the original, remove extra sections
- If the new content has more sections, add them following the same HTML pattern as existing sections`,
            },
            {
              role: 'user',
              content: `EXISTING HTML TEMPLATE:
${activeVersion.html_content}

---

NEW CONTENT TO USE:
Template name: ${name}
Subject: ${subject || name}
Campaign slug: ${campaignSlug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}
CTA URL: ${ctaUrl || 'https://truv.com'}
CTA button text: ${ctaText || 'Learn More'}

${content}

Rewrite the HTML template with this new content, keeping the exact same design and structure.`,
            },
          ],
        });

        const rewrittenHtml = rewriteResponse.choices[0]?.message?.content || '';
        if (rewrittenHtml && (rewrittenHtml.includes('<!DOCTYPE') || rewrittenHtml.includes('<html'))) {
          finalHtml = rewrittenHtml.replace(/^```html?\n?/i, '').replace(/\n?```$/i, '').trim();
        }
      }

      // Create new template
      const createRes = await fetch('https://api.sendgrid.com/v3/templates', {
        method: 'POST',
        headers: { Authorization: `Bearer ${SENDGRID_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, generation: 'dynamic' }),
      });
      if (!createRes.ok) throw new Error(`SendGrid error: ${createRes.status}`);
      const newTemplate = await createRes.json();

      const versionRes = await fetch(`https://api.sendgrid.com/v3/templates/${newTemplate.id}/versions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${SENDGRID_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'v1',
          subject: subject || name,
          html_content: finalHtml,
          active: 1,
        }),
      });
      if (!versionRes.ok) throw new Error(`Version creation failed: ${(await versionRes.text()).slice(0, 200)}`);

      return res.status(201).json({
        templateId: newTemplate.id,
        name: newTemplate.name,
        editUrl: `https://mc.sendgrid.com/dynamic-templates/${newTemplate.id}`,
        generated: !!content,
        clonedFrom: cloneFromId,
        clonedFromName: srcData.name,
      });
    }

    // If no content provided, just create an empty template
    if (!content) {
      const createRes = await fetch('https://api.sendgrid.com/v3/templates', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${SENDGRID_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, generation: 'dynamic' }),
      });

      if (!createRes.ok) {
        const errText = await createRes.text();
        throw new Error(`SendGrid error: ${createRes.status} - ${errText}`);
      }

      const template = await createRes.json();
      return res.status(201).json({
        templateId: template.id,
        name: template.name,
        editUrl: `https://mc.sendgrid.com/dynamic-templates/${template.id}`,
        generated: false,
      });
    }

    // Generate HTML with Gemini — using reference template for quality
    if (!GEMINI_API_KEY) throw new Error('Gemini API key not configured');

    const client = new OpenAI({ apiKey: GEMINI_API_KEY, baseURL: GEMINI_BASE_URL });

    // Step 1: Fetch a reference template from SendGrid (most recent, as a structural example)
    let referenceHtml = '';
    try {
      const listRes = await fetch(
        'https://api.sendgrid.com/v3/templates?generations=dynamic&page_size=10',
        { headers: { Authorization: `Bearer ${SENDGRID_API_KEY}` } }
      );
      if (listRes.ok) {
        const listData = await listRes.json();
        const templates = listData.templates || listData.result || [];
        // Pick one with an active version
        for (const t of templates) {
          if (referenceHtml) break;
          const activeVersion = (t.versions || []).find((v: { active: number }) => v.active === 1);
          if (activeVersion?.html_content) {
            referenceHtml = activeVersion.html_content;
          } else if (t.id) {
            // Fetch full template to get HTML
            const fullRes = await fetch(`https://api.sendgrid.com/v3/templates/${t.id}`, {
              headers: { Authorization: `Bearer ${SENDGRID_API_KEY}` },
            });
            if (fullRes.ok) {
              const fullData = await fullRes.json();
              const av = (fullData.versions || []).find((v: { active: number }) => v.active === 1);
              if (av?.html_content) referenceHtml = av.html_content;
            }
          }
        }
      }
    } catch { /* reference is optional */ }

    // Step 2: Build the prompt with reference template context
    const slug = campaignSlug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

    const userPrompt = referenceHtml
      ? `You have two jobs:
1. Study the REFERENCE TEMPLATE below to understand the exact HTML structure, CSS patterns, table layout, font loading, hero design, body section patterns, CTA button styles, footer structure, and mobile responsive patterns used by this brand.
2. Create a NEW email using that exact same HTML/CSS structure but with the NEW CONTENT provided.

REFERENCE TEMPLATE (use this as your structural blueprint):
${referenceHtml}

---

NEW EMAIL TO CREATE:
Template name: ${name}
Subject line: ${subject || name}
Campaign slug (for UTMs): ${slug}
Hero style: ${heroStyle || 'dark'}
CTA URL: ${ctaUrl || 'https://truv.com'}
CTA button text: ${ctaText || 'Learn More'}

EMAIL CONTENT:
${content}

IMPORTANT:
- Copy the EXACT same HTML structure, CSS, @font-face declarations, table nesting, border-radius values, padding, colors, and responsive breakpoints from the reference template.
- Only change the text content, subject, hero title/subtitle/badge, body paragraphs, bullet points, CTA URLs, CTA button text, and UTM campaign slug.
- Keep {{firstName}} for personalization and {{{unsubscribe}}} for the unsubscribe link.
- Do NOT invent new CSS or layout patterns. Match the reference exactly.
- Output ONLY the complete HTML.`
      : `Create a Truv branded email template with these details:

Template name: ${name}
Subject line: ${subject || name}
Campaign slug (for UTMs): ${slug}
Hero style: ${heroStyle || 'dark'}
CTA URL: ${ctaUrl || 'https://truv.com'}
CTA button text: ${ctaText || 'Learn More'}

EMAIL CONTENT:
${content}

Generate the complete HTML email.`;

    const response = await client.chat.completions.create({
      model: 'gemini-2.0-flash',
      max_tokens: 12000,
      messages: [
        { role: 'system', content: EMAIL_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
    });

    let html = response.choices[0]?.message?.content || '';

    // Strip markdown fences if wrapped
    html = html.replace(/^```html?\n?/i, '').replace(/\n?```$/i, '').trim();

    if (!html.includes('<!DOCTYPE') && !html.includes('<html')) {
      throw new Error('Generated content does not look like valid HTML');
    }

    // Create SendGrid template
    const createRes = await fetch('https://api.sendgrid.com/v3/templates', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SENDGRID_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name, generation: 'dynamic' }),
    });

    if (!createRes.ok) {
      const errText = await createRes.text();
      throw new Error(`SendGrid template creation error: ${createRes.status} - ${errText}`);
    }

    const template = await createRes.json();

    // Add version with generated HTML
    const versionRes = await fetch(`https://api.sendgrid.com/v3/templates/${template.id}/versions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SENDGRID_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'v1',
        subject: subject || name,
        html_content: html,
        active: 1,
      }),
    });

    if (!versionRes.ok) {
      const errText = await versionRes.text();
      throw new Error(`SendGrid version error: ${versionRes.status} - ${errText}`);
    }

    return res.status(201).json({
      templateId: template.id,
      name: template.name,
      editUrl: `https://mc.sendgrid.com/dynamic-templates/${template.id}`,
      generated: true,
      subject: subject || name,
      htmlLength: html.length,
    });
  } catch (error) {
    console.error('Create template error:', error);
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' });
  }
}
