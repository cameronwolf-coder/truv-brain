import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';

function corsHeaders(res: VercelResponse): void {}

const NOTION_API_KEY = process.env.NOTION_API_KEY;
const CLOUDINARY_CLOUD = process.env.CLOUDINARY_CLOUD_NAME || '';
const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY || '';
const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET || '';

async function uploadToCloudinary(imageUrl: string, publicId: string): Promise<string> {
  // Download image
  const imgRes = await fetch(imageUrl);
  if (!imgRes.ok) throw new Error(`Failed to download image: ${imgRes.status}`);
  const buffer = Buffer.from(await imgRes.arrayBuffer());

  // Generate signature
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const toSign = `public_id=${publicId}&timestamp=${timestamp}${CLOUDINARY_API_SECRET}`;
  const signature = crypto.createHash('sha1').update(toSign).digest('hex');

  // Upload
  const form = new FormData();
  form.append('file', new Blob([buffer]), 'image.png');
  form.append('public_id', publicId);
  form.append('api_key', CLOUDINARY_API_KEY);
  form.append('timestamp', timestamp);
  form.append('signature', signature);

  const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`, {
    method: 'POST',
    body: form,
  });

  if (!uploadRes.ok) throw new Error(`Cloudinary upload failed: ${uploadRes.status}`);
  const data = await uploadRes.json();
  return data.secure_url;
}

function extractPageId(urlOrId: string): string {
  // Handle full Notion URLs
  const match = urlOrId.match(/([a-f0-9]{32}|[a-f0-9-]{36})(?:\?|$)/i);
  if (match) {
    return match[1].replace(/-/g, '');
  }
  // Try extracting from end of URL path
  const pathMatch = urlOrId.match(/([a-f0-9]{32})$/i);
  if (pathMatch) return pathMatch[1];
  // Could be a raw ID
  return urlOrId.replace(/-/g, '');
}

interface NotionBlock {
  type: string;
  [key: string]: unknown;
}

function richTextToHtml(richText: Array<{ plain_text: string; annotations?: { bold?: boolean; italic?: boolean; code?: boolean; underline?: boolean }; href?: string | null }>): string {
  return richText.map((t) => {
    let text = t.plain_text;
    if (t.annotations?.bold) text = `<strong>${text}</strong>`;
    if (t.annotations?.italic) text = `<em>${text}</em>`;
    if (t.annotations?.code) text = `<code>${text}</code>`;
    if (t.href) text = `<a href="${t.href}">${text}</a>`;
    return text;
  }).join('');
}

async function blocksToContent(blocks: NotionBlock[], campaignSlug: string): Promise<{ text: string; images: string[] }> {
  const lines: string[] = [];
  const images: string[] = [];

  for (const block of blocks) {
    const type = block.type;
    const data = block[type] as { rich_text?: Array<{ plain_text: string; annotations?: Record<string, boolean>; href?: string | null }>; type?: string; file?: { url: string }; external?: { url: string }; children?: NotionBlock[] };

    if (!data) continue;

    if (type === 'paragraph' && data.rich_text) {
      const html = richTextToHtml(data.rich_text);
      if (html) lines.push(html);
    } else if (type === 'heading_1' && data.rich_text) {
      lines.push(`## ${richTextToHtml(data.rich_text)}`);
    } else if (type === 'heading_2' && data.rich_text) {
      lines.push(`### ${richTextToHtml(data.rich_text)}`);
    } else if (type === 'heading_3' && data.rich_text) {
      lines.push(`#### ${richTextToHtml(data.rich_text)}`);
    } else if (type === 'bulleted_list_item' && data.rich_text) {
      lines.push(`- ${richTextToHtml(data.rich_text)}`);
    } else if (type === 'numbered_list_item' && data.rich_text) {
      lines.push(`1. ${richTextToHtml(data.rich_text)}`);
    } else if (type === 'image') {
      const imgUrl = data.type === 'file' ? data.file?.url : data.external?.url;
      if (imgUrl) {
        try {
          const publicId = `truv-emails/${campaignSlug}-img-${images.length + 1}`;
          const cloudinaryUrl = await uploadToCloudinary(imgUrl, publicId);
          images.push(cloudinaryUrl);
          lines.push(`[IMAGE: ${cloudinaryUrl}]`);
        } catch {
          lines.push(`[IMAGE: ${imgUrl}]`);
        }
      }
    } else if (type === 'divider') {
      lines.push('---');
    }
  }

  return { text: lines.join('\n\n'), images };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  corsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    if (!NOTION_API_KEY) throw new Error('Notion API key not configured');

    const { notionUrl, campaignSlug } = req.body;
    if (!notionUrl) return res.status(400).json({ error: 'Notion URL is required' });

    const pageId = extractPageId(notionUrl);

    // Fetch page properties
    const pageRes = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
      headers: {
        Authorization: `Bearer ${NOTION_API_KEY}`,
        'Notion-Version': '2022-06-28',
      },
    });
    if (!pageRes.ok) throw new Error(`Notion page not found: ${pageRes.status}`);
    const pageData = await pageRes.json();

    // Get page title
    let title = '';
    const titleProp = Object.values(pageData.properties || {}).find((p: unknown) => (p as { type: string }).type === 'title') as { title: Array<{ plain_text: string }> } | undefined;
    if (titleProp?.title) {
      title = titleProp.title.map((t) => t.plain_text).join('');
    }

    // Fetch page blocks (content)
    const blocksRes = await fetch(`https://api.notion.com/v1/blocks/${pageId}/children?page_size=100`, {
      headers: {
        Authorization: `Bearer ${NOTION_API_KEY}`,
        'Notion-Version': '2022-06-28',
      },
    });
    if (!blocksRes.ok) throw new Error(`Failed to fetch blocks: ${blocksRes.status}`);
    const blocksData = await blocksRes.json();

    const slug = campaignSlug || title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const { text, images } = await blocksToContent(blocksData.results || [], slug);

    return res.status(200).json({
      title,
      content: text,
      images,
      blockCount: (blocksData.results || []).length,
    });
  } catch (error) {
    console.error('Fetch Notion error:', error);
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' });
  }
}
