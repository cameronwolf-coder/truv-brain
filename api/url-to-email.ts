import type { VercelRequest, VercelResponse } from '@vercel/node';

const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY;
const GOOGLE_AI_API_KEY = process.env.GOOGLE_AI_API_KEY;

interface EmailContent {
  subject: string;
  preview_text: string;
  hero_date: string;
  hero_image: string;
  intro_text: string;
  highlights: string[];
  sections: Array<{
    title: string;
    image?: string;
    bullets: string[];
  }>;
  outro_text: string;
  images: string[];
}

async function scrapeWithFirecrawl(url: string, apiKey: string): Promise<{ markdown: string; html: string; images: string[] }> {
  // Use Firecrawl REST API directly
  const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      url,
      formats: ['markdown', 'html'],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Firecrawl error: ${response.status} - ${errorText}`);
  }

  const result = await response.json();

  if (!result.success) {
    throw new Error(result.error || 'Failed to scrape URL');
  }

  // Extract images from the HTML
  const images: string[] = [];
  const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
  const html = result.data?.html || '';
  let match;
  while ((match = imgRegex.exec(html)) !== null) {
    const src = match[1];
    if (src &&
        (src.includes('ctfassets.net') || src.includes('truv.com')) &&
        !src.includes('logo') &&
        !src.includes('icon') &&
        !src.includes('avatar') &&
        !src.includes('favicon')) {
      images.push(src);
    }
  }

  return {
    markdown: result.data?.markdown || '',
    html,
    images: [...new Set(images)],
  };
}

// Clean markdown formatting from text
function cleanMarkdown(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, '$1')  // Remove bold **text**
    .replace(/\*([^*]+)\*/g, '$1')       // Remove italic *text*
    .replace(/__([^_]+)__/g, '$1')       // Remove bold __text__
    .replace(/_([^_]+)_/g, '$1')         // Remove italic _text_
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')  // Remove links [text](url) -> text
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '')   // Remove images ![alt](url)
    .replace(/`([^`]+)`/g, '$1')         // Remove inline code
    .replace(/^>\s*/gm, '')              // Remove blockquotes
    .replace(/\n{3,}/g, '\n\n')          // Normalize multiple newlines
    .trim();
}

// Use Gemini AI to extract and structure email content
async function extractWithGemini(markdown: string, images: string[], apiKey: string): Promise<EmailContent> {
  const prompt = `You are a marketing email content specialist. Analyze this blog post/article content and extract the key information to create a compelling product update email.

CONTENT TO ANALYZE:
${markdown.slice(0, 8000)}

Extract and return a JSON object with this exact structure:
{
  "subject": "A compelling email subject line (max 60 chars)",
  "preview_text": "Preview text that appears in inbox (max 100 chars)",
  "hero_date": "The date mentioned in the article, or today's date in format 'Month Day, Year'",
  "intro_text": "A warm, engaging introduction paragraph (2-3 sentences) that summarizes the key announcement and gets the reader excited",
  "highlights": ["3-5 key bullet points highlighting the most important takeaways"],
  "sections": [
    {
      "title": "Section heading",
      "bullets": ["2-4 detailed bullet points for this section"]
    }
  ],
  "outro_text": "A brief closing paragraph encouraging the reader to learn more (1-2 sentences)"
}

Guidelines:
- Write in a professional but friendly B2B tone
- Focus on benefits and value, not just features
- Keep bullet points concise but informative
- Create 2-4 sections based on the main topics covered
- The intro should hook the reader immediately
- Remove any markdown formatting from the text

Return ONLY valid JSON, no other text.`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 2048,
        },
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Gemini API error:', errorText);
    throw new Error(`Gemini API error: ${response.status}`);
  }

  const result = await response.json();
  const textContent = result.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!textContent) {
    throw new Error('No content returned from Gemini');
  }

  // Extract JSON from the response (handle potential markdown code blocks)
  let jsonStr = textContent;
  const jsonMatch = textContent.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1];
  }

  const parsed = JSON.parse(jsonStr.trim());

  // Add images to sections
  const sectionsWithImages = (parsed.sections || []).map((section: any, idx: number) => ({
    ...section,
    image: images[idx] || undefined,
    bullets: section.bullets || [],
  }));

  return {
    subject: parsed.subject || 'Product Update',
    preview_text: parsed.preview_text || '',
    hero_date: parsed.hero_date || new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
    hero_image: images[0] || '',
    intro_text: parsed.intro_text || '',
    highlights: parsed.highlights || [],
    sections: sectionsWithImages,
    outro_text: parsed.outro_text || '',
    images,
  };
}

function extractContentFromMarkdown(markdown: string, images: string[]): EmailContent {
  const lines = markdown.split('\n').filter(line => line.trim());

  // Extract title (first h1)
  const titleMatch = markdown.match(/^#\s+(.+)$/m);
  const title = titleMatch ? cleanMarkdown(titleMatch[1].trim()) : 'Product Update';

  // Extract date - look for common date patterns
  const dateMatch = markdown.match(/(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}/i);
  const heroDate = dateMatch ? dateMatch[0] : new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  // Extract headings (h2s) as sections
  const h2Regex = /^##\s+(.+)$/gm;
  const headings: string[] = [];
  let h2Match;
  while ((h2Match = h2Regex.exec(markdown)) !== null) {
    const heading = cleanMarkdown(h2Match[1].trim());
    // Skip common non-content headings
    if (!heading.toLowerCase().includes('related') &&
        !heading.toLowerCase().includes('share') &&
        !heading.toLowerCase().includes('about the author')) {
      headings.push(heading);
    }
  }

  // Extract bullet points from markdown
  const bulletRegex = /^[\-\*]\s+(.+)$/gm;
  const allBullets: string[] = [];
  let bulletMatch;
  while ((bulletMatch = bulletRegex.exec(markdown)) !== null) {
    const bullet = cleanMarkdown(bulletMatch[1].trim());
    if (bullet.length > 10 && bullet.length < 200) {
      allBullets.push(bullet);
    }
  }

  // Extract paragraphs for intro/outro
  const paragraphs = lines
    .filter(line =>
      !line.startsWith('#') &&
      !line.startsWith('-') &&
      !line.startsWith('*') &&
      !line.startsWith('|') &&
      !line.startsWith('[') &&
      !line.startsWith('!') &&
      !line.includes('](') &&
      line.length > 50
    )
    .map(p => cleanMarkdown(p));

  // Build highlights from first few bullets or first sentences
  const highlights = allBullets.slice(0, 5);
  if (highlights.length < 3 && paragraphs.length > 0) {
    // Extract key sentences as highlights
    const firstPara = paragraphs[0];
    const sentences = firstPara.split(/\.\s+/).filter(s => s.length > 20);
    highlights.push(...sentences.slice(0, 3 - highlights.length));
  }

  // Build sections from headings
  const sections: EmailContent['sections'] = [];
  const sectionCount = Math.min(headings.length, 4);

  for (let i = 0; i < sectionCount; i++) {
    const heading = headings[i];
    const headingIndex = markdown.indexOf(`## ${heading}`);
    const nextHeadingIndex = headings[i + 1]
      ? markdown.indexOf(`## ${headings[i + 1]}`)
      : markdown.length;

    const sectionContent = markdown.slice(headingIndex, nextHeadingIndex);

    // Get bullets from this section
    const sectionBullets: string[] = [];
    const sectionBulletRegex = /^[\-\*]\s+(.+)$/gm;
    let sBulletMatch;
    while ((sBulletMatch = sectionBulletRegex.exec(sectionContent)) !== null) {
      const bullet = cleanMarkdown(sBulletMatch[1].trim());
      if (bullet.length > 10 && bullet.length < 200) {
        sectionBullets.push(bullet);
      }
    }

    // If no bullets, extract sentences from paragraphs
    if (sectionBullets.length === 0) {
      const sectionParas = sectionContent.split('\n').filter(line =>
        !line.startsWith('#') &&
        !line.startsWith('-') &&
        line.length > 30
      );
      if (sectionParas.length > 0) {
        const sentences = sectionParas.join(' ').split(/\.\s+/).filter(s => s.length > 20);
        sectionBullets.push(...sentences.slice(0, 3).map(s => s.trim() + (s.endsWith('.') ? '' : '.')));
      }
    }

    sections.push({
      title: heading,
      image: images[i] || undefined,
      bullets: sectionBullets.slice(0, 4),
    });
  }

  // Generate intro text
  const introText = paragraphs[0]
    ? paragraphs[0].slice(0, 300) + (paragraphs[0].length > 300 ? '...' : '')
    : `We're excited to share our latest updates with you. Here's what's new at Truv.`;

  // Generate outro text
  const outroText = `Want to learn more? Click below to read the full article and discover how these updates can benefit your organization.`;

  // Generate subject and preview
  const subject = title.length > 60 ? title.slice(0, 57) + '...' : title;
  const previewText = introText.slice(0, 100);

  return {
    subject,
    preview_text: previewText,
    hero_date: heroDate,
    hero_image: images[0] || '',
    intro_text: introText,
    highlights: highlights.length > 0 ? highlights : ['New features and improvements', 'Enhanced performance', 'Better user experience'],
    sections,
    outro_text: outroText,
    images,
  };
}

function generateEmailHtml(content: EmailContent, sourceUrl: string): string {
  const highlightsHtml = content.highlights
    .map(h => `<li>${h}</li>`)
    .join('\n                                                    ');

  const sectionsHtml = content.sections
    .map((section, idx) => {
      const imageHtml = section.image
        ? `<p style="margin-bottom: 1em;"><img src="${section.image}" width="100%" alt="" style="height: auto; max-width: 100%; border-radius: 8px;"></p>`
        : '';

      const bulletsHtml = section.bullets
        .map(b => `<li style="margin-bottom: 8px;">${b}</li>`)
        .join('\n                                                    ');

      return `
                                                <!-- ======================== -->
                                                <!-- SECTION ${idx + 1} -->
                                                <!-- ======================== -->
                                                <hr>
                                                <h3 style="font-family: Gilroy, sans-serif; font-size: 22px; font-weight: 600;">${section.title}</h3>

                                                ${imageHtml}

                                                <ul style="font-size: 16px; line-height: 160%; padding-left: 20px;">
                                                    ${bulletsHtml}
                                                </ul>`;
    })
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <title>${content.subject}</title>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="x-apple-disable-message-reformatting">

    <style>
        @font-face {
            font-family: 'Gilroy';
            src: url('https://hs-19933594.f.hubspotemail.net/hubfs/19933594/Truv/Font%20Gilroy/Gilroy-Medium.woff2') format('woff2'),
                url('https://hs-19933594.f.hubspotemail.net/hubfs/19933594/Truv/Font%20Gilroy/Gilroy-Medium.woff') format('woff');
            font-weight: 500;
            font-style: normal;
        }

        @font-face {
            font-family: 'Gilroy';
            src: url('https://hs-19933594.f.hubspotemail.net/hubfs/19933594/Truv/Font%20Gilroy/Gilroy-Bold.woff2') format('woff2'),
                url('https://hs-19933594.f.hubspotemail.net/hubfs/19933594/Truv/Font%20Gilroy/Gilroy-Bold.woff') format('woff');
            font-weight: 600;
            font-style: normal;
        }

        body, * {
            font-family: Gilroy, sans-serif !important;
            line-height: 120%;
        }

        p { margin: 0; }
        a { color: #2c64e3; }
        hr { margin-top: 25px; margin-bottom: 25px; border: none; border-top: 1px solid #e0e0e0; }
        .im { color: inherit !important; }

        @media only screen and (min-width:640px) {
            .hse-column-container {
                max-width: 660px !important;
                width: 660px !important;
            }
        }

        .footer-links a:hover { color: #2c64e3 !important; }
        img { max-width: 100% !important; }

        @media screen and (max-width: 640px) {
            .mobile-no-bg { background-image: none !important; }
            .wdth-mob-100 { width: 100% !important; }
            .mob-center { text-align: center !important; }
            .border-rd-mob-0 { border-radius: 0 !important; }
            .footer-links { padding-bottom: 0 !important; }
            .footer-links a { display: block !important; padding-top: 10px; }
            .footer-links .spr { display: none; }
            .pd-top-mob-0 { padding-top: 0 !important; }
            .pd-bot-mob-0 { padding-bottom: 0 !important; }
            .product-main h1 { text-align: center !important; font-size: 32px !important; }
            .product-main p { text-align: center !important; font-size: 20px !important; }
        }
    </style>
</head>

<body bgcolor="#E0E0E0" style="margin: 0; padding: 0; font-family: Gilroy, sans-serif; background-color: #E0E0E0; font-size:16px; color: #171717; word-break:break-word;">

    <!-- Preview text -->
    <div style="display:none!important">${content.preview_text}</div>

    <div style="background-color:#E0E0E0" bgcolor="#E0E0E0">
        <table role="presentation" width="100%" bgcolor="#E0E0E0" cellpadding="0" cellspacing="0" border="0" style="border-spacing:0 !important; border-collapse:collapse; margin:0; padding:0; width:100% !important; min-width:320px !important; height:100% !important; background-color:#E0E0E0;" height="100%">
            <tbody>
                <tr>
                    <td class="pd-top-mob-0 pd-bot-mob-0" align="center" valign="top" style="border-collapse:collapse; font-family:Gilroy, sans-serif; font-size:16px; word-break:break-word; color: #171717; padding-top: 40px; padding-bottom: 40px;">

                        <!-- ============================================ -->
                        <!-- HERO SECTION -->
                        <!-- ============================================ -->
                        <div style="background-color:#E0E0E0;">
                            <div class="hse-column-container" style="min-width:280px; max-width:660px; width:100%; Margin-left:auto; Margin-right:auto; border-collapse:collapse; border-spacing:0; background-color:#E0E0E0; font-family: Gilroy,sans-serif;" bgcolor="#E0E0E0">
                                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" align="center" style="width:100%; border-spacing:0; border-collapse:collapse;">
                                    <tbody>
                                        <tr>
                                            <td class="mobile-no-bg border-rd-mob-0" align="center" style="color:#171717; background-image: url(https://truv.com/wp-content/themes/twentytwentyone/assets_truv/images/letter/letter-product-bg.png); background-Color: #f6f6f6; background-repeat: no-repeat; background-size: cover; background-position: top; vertical-align: top; border-radius: 20px 20px 0 0;">

                                                <!-- LOGO -->
                                                <table class="header" role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" align="center" style="width:100%; border-spacing:0; border-collapse:collapse;">
                                                    <tbody>
                                                        <tr>
                                                            <td style="padding:20px 20px">
                                                                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                                                                    <tbody>
                                                                        <tr>
                                                                            <th width="50%" valign="middle" style="font-weight:normal">
                                                                                <table cellspacing="0" cellpadding="0" border="0" role="presentation" width="100%" align="left" style="width:100%; border-spacing:0; border-collapse:collapse;">
                                                                                    <tbody>
                                                                                        <tr>
                                                                                            <td align="left">
                                                                                                <a href="https://truv.com" target="_blank" style="text-decoration: none; display: inline-block; width: 65px;">
                                                                                                    <img src="https://truv.com/wp-content/themes/twentytwentyone/assets_truv/images/logo/logo-truv.png" width="65" alt="Truv Logo" border="0" style="display:block; max-width:65px; height: auto;">
                                                                                                </a>
                                                                                            </td>
                                                                                        </tr>
                                                                                    </tbody>
                                                                                </table>
                                                                            </th>
                                                                        </tr>
                                                                    </tbody>
                                                                </table>
                                                            </td>
                                                        </tr>
                                                    </tbody>
                                                </table>

                                                <!-- HERO TITLE + DATE + BUTTON -->
                                                <table class="product-main" role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" align="center" style="width:100%; border-spacing:0; border-collapse:collapse;">
                                                    <tbody>
                                                        <tr>
                                                            <td class="wdth-mob-100" style="width:320px; padding-left: 35px; padding-right: 35px; padding-top: 15px; padding-bottom: 50px; color:#171717;">
                                                                <table class="wdth-mob-100" cellspacing="0" cellpadding="0" border="0" role="presentation" style="width:320px; border-spacing:0; border-collapse:collapse;">
                                                                    <tbody>
                                                                        <tr>
                                                                            <td width="100%">
                                                                                <h1 style="color: #171717; text-align: left; font-size: 38px; margin-top: 0; margin-bottom: 10px; font-weight: 600; font-family: Gilroy,sans-serif;">Product Update</h1>
                                                                            </td>
                                                                        </tr>
                                                                        <tr>
                                                                            <td width="100%" style="padding-bottom: 30px;">
                                                                                <p style="color: #171717; text-align: left; font-size: 22px; margin: 0; font-weight: 500; line-height: 135%; font-family: Gilroy,sans-serif;">${content.hero_date}</p>
                                                                            </td>
                                                                        </tr>
                                                                        <tr>
                                                                            <td class="mob-center" align="left" valign="middle" style="color:#171717; width:100%;">
                                                                                <a href="${sourceUrl}" target="_blank" style="font-style:normal; text-decoration: none; font-weight:500; word-break:break-word; border-style:solid; display:inline-block; background-color:#2C64E3; color:#ffffff; border-radius:50px; border-width:0; font-size:17px; height:17px; padding-left: 15px; padding-right: 15px; padding-bottom:16px; padding-top:16px; min-width: 140px; max-width: 100%; text-align: center; line-height: 100%; font-family: Gilroy,sans-serif;">Read Full Article</a>
                                                                            </td>
                                                                        </tr>
                                                                    </tbody>
                                                                </table>
                                                            </td>
                                                        </tr>
                                                    </tbody>
                                                </table>
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        <!-- /HERO SECTION -->

                        <!-- ============================================ -->
                        <!-- BODY SECTION -->
                        <!-- ============================================ -->
                        <div style="background-color:#E0E0E0;">
                            <div class="hse-column-container" style="min-width:280px; max-width:660px; width:100%; Margin-left:auto; Margin-right:auto; border-collapse:collapse; border-spacing:0; background-color:#ffffff; font-family: Gilroy,sans-serif;" bgcolor="#ffffff">
                                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" align="center" style="width:100%; border-spacing:0; border-collapse:collapse;">
                                    <tbody>
                                        <tr>
                                            <td style="padding-left: 35px; padding-right: 35px; padding-top: 40px; padding-bottom: 40px; background-color: #ffffff; color:#171717;">

                                                <!-- INTRO -->
                                                <div style="font-size: 22px; font-weight: 600; margin-bottom: 16px; font-family: Gilroy, sans-serif;">Hi there,</div>
                                                <div style="font-size: 16px; line-height: 140%; margin-bottom: 20px;">${content.intro_text}</div>

                                                <!-- KEY HIGHLIGHTS -->
                                                <h4 style="text-align: left; font-family: Gilroy, sans-serif; margin-bottom: 10px;">Key Highlights:</h4>
                                                <ul style="font-size: 16px; line-height: 160%; padding-left: 20px; margin-bottom: 10px;">
                                                    ${highlightsHtml}
                                                </ul>

                                                ${sectionsHtml}

                                                <!-- OUTRO -->
                                                <hr>
                                                <p style="margin-bottom: 1em; font-size: 16px; line-height: 140%;">${content.outro_text}</p>

                                                <!-- BOTTOM CTA BUTTON -->
                                                <table width="100%" cellspacing="0" cellpadding="0" border="0" role="presentation">
                                                    <tbody>
                                                        <tr>
                                                            <td align="left" style="padding-top: 15px; padding-bottom: 0;">
                                                                <a href="${sourceUrl}" target="_blank" style="font-style:normal; text-decoration: none; font-weight:500; word-break:break-word; border-style:solid; display:inline-block; background-color:#2C64E3; color:#ffffff; border-radius:50px; border-width:0; font-size:17px; height:17px; padding-left: 15px; padding-right: 15px; padding-bottom:16px; padding-top:16px; min-width: 140px; max-width: 100%; text-align: center; line-height: 100%; font-family: Gilroy,sans-serif;">Read Full Article</a>
                                                            </td>
                                                        </tr>
                                                    </tbody>
                                                </table>

                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        <!-- /BODY SECTION -->

                        <!-- ============================================ -->
                        <!-- FOOTER SECTION -->
                        <!-- ============================================ -->
                        <div style="background-color:#E0E0E0;">
                            <div class="hse-column-container" style="min-width:280px; max-width:660px; width:100%; Margin-left:auto; Margin-right:auto; border-collapse:collapse; border-spacing:0; background: #E0E0E0;" bgcolor="#E0E0E0">
                                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" align="center" style="width:100%; border-spacing:0; border-collapse:collapse; background-color:#E0E0E0;" bgcolor="#E0E0E0">
                                    <tbody>
                                        <tr>
                                            <td class="border-rd-mob-0" align="center" style="padding-right: 35px; padding-left: 35px; padding-top: 30px; padding-bottom: 30px; background-color: #F5F5F5; color:#171717; border-radius: 0 0 20px 20px;">

                                                <!-- Footer tagline -->
                                                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" align="center" style="width:100%; background-color:#F5F5F5;">
                                                    <tbody>
                                                        <tr>
                                                            <td align="center" style="padding-top: 15px; padding-bottom: 20px;">
                                                                <p style="text-align: center; font-size: 14px; margin: 0; font-family: Gilroy,sans-serif; color:#878A92;">Stay up to date on the latest Truv features, enhancements, and product updates!</p>
                                                            </td>
                                                        </tr>
                                                    </tbody>
                                                </table>

                                                <!-- Footer links row 1 -->
                                                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" align="center" style="width:100%; background-color:#F5F5F5;">
                                                    <tbody>
                                                        <tr>
                                                            <td align="center" style="padding-bottom: 10px;">
                                                                <p class="footer-links" style="color: #171717; text-align: center; font-size: 14px; margin: 0; font-weight: 500; line-height: 120%; font-family: Gilroy,sans-serif;">
                                                                    <a href="https://help.truv.com" style="color:#171717;text-decoration:none; font-weight: 500; font-size:14px;" target="_blank">Help&nbsp;Center</a>
                                                                    <span class="spr" style="color:#808080; font-size:14px; padding: 0 3px;">|</span>
                                                                    <a href="https://docs.truv.com/docs/quickstart-guide" style="color:#171717;text-decoration:none; font-weight: 500; font-size:14px;" target="_blank">Quickstart&nbsp;Guide</a>
                                                                    <span class="spr" style="color:#808080; font-size:14px; padding: 0 3px;">|</span>
                                                                    <a href="https://truv.com/changelog" style="color:#171717;text-decoration:none; font-weight: 500; font-size:14px;" target="_blank">Changelog</a>
                                                                    <span class="spr" style="color:#808080; font-size:14px; padding: 0 3px;">|</span>
                                                                    <a href="https://truv.com/blog" style="color:#171717;text-decoration:none; font-weight: 500; font-size:14px;" target="_blank">Blog</a>
                                                                </p>
                                                            </td>
                                                        </tr>
                                                        <tr>
                                                            <td align="center" style="padding-bottom: 20px;">
                                                                <p class="footer-links" style="color: #171717; text-align: center; font-size: 14px; margin: 0; font-weight: 500; line-height:120%; font-family: Gilroy,sans-serif;">
                                                                    <a href="https://truv.com/terms" style="color:#171717; text-decoration:none; font-weight: 500; font-size:14px;" target="_blank">Service&nbsp;Terms</a>
                                                                    <span class="spr" style="color:#808080; font-size:14px; padding: 0 3px;">|</span>
                                                                    <a href="https://truv.com/privacy" style="color:#171717; text-decoration:none; font-weight: 500; font-size:14px;" target="_blank">Privacy&nbsp;Policy</a>
                                                                    <span class="spr" style="color:#808080; font-size:14px; padding: 0 3px;">|</span>
                                                                    <a href="https://truv.com/request-a-demo" style="color:#171717; text-decoration:none; font-weight: 500; font-size:14px;" target="_blank">Contact&nbsp;Truv</a>
                                                                </p>
                                                            </td>
                                                        </tr>
                                                    </tbody>
                                                </table>

                                                <!-- Social icons -->
                                                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" align="center" style="width:100%; background-color:#F5F5F5;">
                                                    <tbody>
                                                        <tr>
                                                            <td align="center" style="padding-top: 5px; padding-bottom: 20px;">
                                                                <table role="presentation" width="90" cellspacing="0" cellpadding="0" border="0" align="center">
                                                                    <tbody>
                                                                        <tr>
                                                                            <td align="center" width="30">
                                                                                <a href="https://www.linkedin.com/company/truvhq" style="display: inline-block; text-decoration:none" target="_blank">
                                                                                    <img src="https://truv.com/wp-content/themes/twentytwentyone/assets_truv/images/letter/letter-linkedin-icon.png" width="30" border="0" style="display:block; width:30px" alt="LinkedIn">
                                                                                </a>
                                                                            </td>
                                                                            <td width="30">&nbsp;</td>
                                                                            <td align="center" width="30">
                                                                                <a href="https://x.com/TruvHQ" style="display: inline-block; text-decoration:none" target="_blank">
                                                                                    <img src="https://truv.com/wp-content/themes/twentytwentyone/assets_truv/images/letter/letter-x-icon.png" width="30" border="0" style="display:block; width:30px" alt="X">
                                                                                </a>
                                                                            </td>
                                                                        </tr>
                                                                    </tbody>
                                                                </table>
                                                            </td>
                                                        </tr>
                                                    </tbody>
                                                </table>

                                                <!-- Separator -->
                                                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" align="center">
                                                    <tbody>
                                                        <tr>
                                                            <td style="padding-bottom:10px; padding-top:5px;">
                                                                <div style="border-top: 1px solid #c5c5c5;"></div>
                                                            </td>
                                                        </tr>
                                                    </tbody>
                                                </table>

                                                <!-- Company address -->
                                                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" align="center" style="background-color:#F5F5F5;">
                                                    <tbody>
                                                        <tr>
                                                            <td align="center" style="padding-top: 15px; padding-bottom: 8px;">
                                                                <p style="color:#878A92; text-align:center; font-size:12px; margin:0; font-weight: 500;">
                                                                    Truv Inc., 218 NW 24th Street, 2nd and 3rd Floors Miami, FL 33127, US
                                                                </p>
                                                            </td>
                                                        </tr>
                                                    </tbody>
                                                </table>

                                                <!-- Unsubscribe -->
                                                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" align="center" style="background-color:#F5F5F5;">
                                                    <tbody>
                                                        <tr>
                                                            <td align="center">
                                                                <p style="margin: 0; text-align: center; font-size: 13px; color: #8c9298; font-family: Gilroy,sans-serif;">
                                                                    If you'd like me to stop sending you emails, please <a href="{{{unsubscribe}}}" style="color: #8c9298;" target="_blank">click here</a>
                                                                </p>
                                                            </td>
                                                        </tr>
                                                    </tbody>
                                                </table>

                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        <!-- /FOOTER SECTION -->

                    </td>
                </tr>
            </tbody>
        </table>
    </div>

</body>
</html>`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!FIRECRAWL_API_KEY) {
    return res.status(500).json({ error: 'FIRECRAWL_API_KEY not configured' });
  }

  const { url } = req.body as { url: string };

  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  try {
    new URL(url);
  } catch {
    return res.status(400).json({ error: 'Invalid URL format' });
  }

  try {
    // Step 1: Scrape the URL with Firecrawl
    const { markdown, images } = await scrapeWithFirecrawl(url, FIRECRAWL_API_KEY);

    if (!markdown) {
      return res.status(400).json({ error: 'Failed to extract content from URL' });
    }

    // Step 2: Extract content - use Gemini AI if available, otherwise rule-based
    let emailContent: EmailContent;
    let usedAI = false;

    if (GOOGLE_AI_API_KEY) {
      try {
        console.log('Using Gemini AI for content extraction...');
        emailContent = await extractWithGemini(markdown, images, GOOGLE_AI_API_KEY);
        usedAI = true;
      } catch (aiError) {
        console.error('Gemini extraction failed, falling back to rule-based:', aiError);
        emailContent = extractContentFromMarkdown(markdown, images);
      }
    } else {
      console.log('No GOOGLE_AI_API_KEY configured, using rule-based extraction');
      emailContent = extractContentFromMarkdown(markdown, images);
    }

    // Step 3: Generate the final HTML
    const html = generateEmailHtml(emailContent, url);

    return res.status(200).json({
      success: true,
      content: emailContent,
      html,
      sourceUrl: url,
      usedAI,
    });
  } catch (error) {
    console.error('URL to Email conversion error:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Conversion failed',
    });
  }
}
