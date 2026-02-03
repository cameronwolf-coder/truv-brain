import type { VercelRequest, VercelResponse } from '@vercel/node';
import { google } from 'googleapis';

interface Record {
  id: string;
  properties: Record<string, string>;
}

function getServiceAccountCredentials(): { client_email: string; private_key: string; project_id: string } | null {
  const jsonStr = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!jsonStr) return null;

  try {
    // Handle both raw JSON and base64-encoded JSON
    let parsed;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      // Try base64 decode
      parsed = JSON.parse(Buffer.from(jsonStr, 'base64').toString('utf-8'));
    }
    return parsed;
  } catch {
    return null;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const credentials = getServiceAccountCredentials();
  if (!credentials) {
    return res.status(500).json({ error: 'Google service account not configured' });
  }

  try {
    const { records, name, columns, shareWithEmail, objectType = 'companies' } = req.body as {
      records: Record[];
      name: string;
      columns?: string[];
      shareWithEmail?: string;
      objectType?: string;
    };

    if (!records || !Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ error: 'Records array is required' });
    }

    if (!name) {
      return res.status(400).json({ error: 'Sheet name is required' });
    }

    // Authenticate with Google
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: [
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/drive.file',
      ],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    const drive = google.drive({ version: 'v3', auth });

    // Determine columns from first record if not specified
    const cols = columns || ['id', ...Object.keys(records[0]?.properties || {})];

    // Build header row
    const headerRow = cols.map((col) => {
      if (col === 'id') return 'HubSpot ID';
      // Convert camelCase/snake_case to Title Case
      return col
        .replace(/_/g, ' ')
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, (s) => s.toUpperCase())
        .trim();
    });

    // Add HubSpot URL column header
    headerRow.push('HubSpot URL');

    // Build data rows
    const portalId = '19933594';
    const objectPath = objectType === 'contacts' ? 'contact' : objectType === 'deals' ? 'deal' : 'company';

    const dataRows = records.map((record) => {
      const row = cols.map((col) => {
        if (col === 'id') return record.id;
        return record.properties[col] || '';
      });
      // Add HubSpot URL
      row.push(`https://app.hubspot.com/contacts/${portalId}/${objectPath}/${record.id}`);
      return row;
    });

    // Create spreadsheet
    const spreadsheet = await sheets.spreadsheets.create({
      requestBody: {
        properties: { title: name },
        sheets: [
          {
            properties: { title: 'Records' },
            data: [
              {
                startRow: 0,
                startColumn: 0,
                rowData: [
                  { values: headerRow.map((v) => ({ userEnteredValue: { stringValue: v } })) },
                  ...dataRows.map((row) => ({
                    values: row.map((v) => ({ userEnteredValue: { stringValue: String(v) } })),
                  })),
                ],
              },
            ],
          },
        ],
      },
    });

    const spreadsheetId = spreadsheet.data.spreadsheetId;
    const spreadsheetUrl = spreadsheet.data.spreadsheetUrl;

    // Make it accessible via link (anyone with link can view)
    await drive.permissions.create({
      fileId: spreadsheetId!,
      requestBody: {
        role: 'reader',
        type: 'anyone',
      },
    });

    // Optionally share with specific email as editor
    if (shareWithEmail) {
      await drive.permissions.create({
        fileId: spreadsheetId!,
        requestBody: {
          role: 'writer',
          type: 'user',
          emailAddress: shareWithEmail,
        },
        sendNotificationEmail: false,
      });
    }

    return res.status(200).json({
      success: true,
      sheetId: spreadsheetId,
      sheetUrl: spreadsheetUrl,
      recordCount: records.length,
    });
  } catch (error) {
    console.error('Error creating sheet:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
