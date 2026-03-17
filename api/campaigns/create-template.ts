import type { VercelRequest, VercelResponse } from '@vercel/node';
import Anthropic from '@anthropic-ai/sdk';

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

function corsHeaders(res: VercelResponse): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

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
    if (!ANTHROPIC_API_KEY) throw new Error('Anthropic API key not configured');

    const { name, subject, content, ctaUrl, ctaText, heroStyle, campaignSlug } = req.body;
    if (!name) return res.status(400).json({ error: 'Template name is required' });

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

    // Generate HTML with Claude
    const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

    const userPrompt = `Create a Truv branded email template with these details:

Template name: ${name}
Subject line: ${subject || name}
Campaign slug (for UTMs): ${campaignSlug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}
Hero style: ${heroStyle || 'dark'}
CTA URL: ${ctaUrl || 'https://truv.com'}
CTA button text: ${ctaText || 'Learn More'}

EMAIL CONTENT:
${content}

Generate the complete HTML email.`;

    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8000,
      system: EMAIL_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    });

    let html = '';
    for (const block of message.content) {
      if (block.type === 'text') html += block.text;
    }

    // Strip markdown fences if Claude wrapped it
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
