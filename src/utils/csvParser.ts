import * as XLSX from 'xlsx';

export interface ParsedCSV {
  headers: string[];
  rows: Record<string, string>[];
  emailColumn: string | null;
  nameColumn: string | null;
  companyColumn: string | null;
}

export function parseCSV(csvContent: string): ParsedCSV {
  const lines = csvContent.split('\n').filter(line => line.trim());

  if (lines.length === 0) {
    return { headers: [], rows: [], emailColumn: null, nameColumn: null, companyColumn: null };
  }

  // Parse headers
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));

  // Detect columns
  const emailColumn = detectEmailColumn(headers);
  const nameColumn = detectNameColumn(headers);
  const companyColumn = detectCompanyColumn(headers);

  // Parse rows
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length !== headers.length) continue; // Skip malformed rows

    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });
    rows.push(row);
  }

  return { headers, rows, emailColumn, nameColumn, companyColumn };
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

function detectNameColumn(headers: string[]): string | null {
  const namePatterns = ['name', 'first_name', 'firstname', 'full_name', 'fullname', 'contact_name', 'first name'];

  for (const header of headers) {
    const lowerHeader = header.toLowerCase().trim();
    if (namePatterns.some(pattern => lowerHeader === pattern)) {
      return header;
    }
  }

  return null;
}

function detectCompanyColumn(headers: string[]): string | null {
  const companyPatterns = ['company', 'organization', 'org', 'business', 'account', 'company_name'];

  for (const header of headers) {
    const lowerHeader = header.toLowerCase().trim();
    if (companyPatterns.some(pattern => lowerHeader === pattern)) {
      return header;
    }
  }

  return null;
}

function detectEmailColumn(headers: string[]): string | null {
  const emailPatterns = ['email', 'e-mail', 'mail', 'contact'];

  for (const header of headers) {
    const lowerHeader = header.toLowerCase();
    if (emailPatterns.some(pattern => lowerHeader.includes(pattern))) {
      return header;
    }
  }

  return null;
}

export function parseXLSX(buffer: ArrayBuffer): ParsedCSV {
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });

  if (jsonData.length === 0) {
    return { headers: [], rows: [], emailColumn: null, nameColumn: null, companyColumn: null };
  }

  const headers = Object.keys(jsonData[0]);
  const rows = jsonData.map(row => {
    const stringRow: Record<string, string> = {};
    headers.forEach(h => {
      stringRow[h] = String(row[h] ?? '');
    });
    return stringRow;
  });

  const emailColumn = detectEmailColumn(headers);
  const nameColumn = detectNameColumn(headers);
  const companyColumn = detectCompanyColumn(headers);

  return { headers, rows, emailColumn, nameColumn, companyColumn };
}

export async function parseFile(file: File): Promise<ParsedCSV> {
  if (file.name.endsWith('.csv')) {
    const text = await file.text();
    return parseCSV(text);
  }
  const buffer = await file.arrayBuffer();
  return parseXLSX(buffer);
}

export function validateEmailColumn(rows: Record<string, string>[], columnName: string): boolean {
  if (rows.length === 0) return false;

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const validEmails = rows.filter(row => emailRegex.test(row[columnName]));

  // At least 50% of rows should have valid emails
  return validEmails.length / rows.length >= 0.5;
}
