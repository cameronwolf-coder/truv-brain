import type { EnrichmentResult } from '../types/enrichment';

export function exportToCSV(results: EnrichmentResult[]): string {
  if (results.length === 0) return '';

  // Collect all unique fields from all results
  const allFields = new Set<string>();
  results.forEach(result => {
    Object.keys(result.original_data).forEach(key => allFields.add(key));
    Object.keys(result.enriched_data).forEach(key => allFields.add(key));
  });

  const headers = ['email', 'status', ...Array.from(allFields)];

  // Build CSV content
  const csvLines: string[] = [headers.join(',')];

  results.forEach(result => {
    const row: string[] = [
      escapeCSVValue(result.email),
      escapeCSVValue(result.status),
    ];

    allFields.forEach(field => {
      let value = '';

      // Check enriched data first, then original data
      if (result.enriched_data[field]) {
        value = String(result.enriched_data[field].value || '');
      } else if (result.original_data[field]) {
        value = String(result.original_data[field]);
      }

      row.push(escapeCSVValue(value));
    });

    csvLines.push(row.join(','));
  });

  return csvLines.join('\n');
}

export function downloadCSV(csvContent: string, filename: string): void {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function escapeCSVValue(value: any): string {
  const stringValue = String(value || '');

  // If value contains comma, newline, or quotes, wrap in quotes and escape quotes
  if (stringValue.includes(',') || stringValue.includes('\n') || stringValue.includes('"')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
}

export function copyToClipboard(results: EnrichmentResult[]): void {
  const tsvContent = exportToTSV(results);
  navigator.clipboard.writeText(tsvContent);
}

function exportToTSV(results: EnrichmentResult[]): string {
  if (results.length === 0) return '';

  const allFields = new Set<string>();
  results.forEach(result => {
    Object.keys(result.original_data).forEach(key => allFields.add(key));
    Object.keys(result.enriched_data).forEach(key => allFields.add(key));
  });

  const headers = ['email', 'status', ...Array.from(allFields)];
  const tsvLines: string[] = [headers.join('\t')];

  results.forEach(result => {
    const row: string[] = [result.email, result.status];

    allFields.forEach(field => {
      let value = '';
      if (result.enriched_data[field]) {
        value = String(result.enriched_data[field].value || '');
      } else if (result.original_data[field]) {
        value = String(result.original_data[field]);
      }
      row.push(value);
    });

    tsvLines.push(row.join('\t'));
  });

  return tsvLines.join('\n');
}
