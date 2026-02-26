import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { CampaignSummary, RecipientActivity } from '../types/emailPerformance';
import { getCampaignDetail } from '../services/emailPerformanceClient';

function pct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function formatDate(ts: number): string {
  if (!ts) return '—';
  return new Date(ts * 1000).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatTimestamp(ts: number): string {
  if (!ts) return '—';
  return new Date(ts * 1000).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function statusText(summary: RecipientActivity['summary']): string {
  if (summary.bounced) return 'Bounced';
  if (summary.clicked) return 'Clicked';
  if (summary.opened) return 'Opened';
  if (summary.delivered) return 'Delivered';
  return 'Pending';
}

async function fetchAllRecipients(workflowKey: string): Promise<RecipientActivity[]> {
  const all: RecipientActivity[] = [];
  let offset = 0;
  const limit = 500;

  while (true) {
    const data = await getCampaignDetail(workflowKey, limit, offset);
    all.push(...data.recipients);
    if (all.length >= data.total || data.recipients.length < limit) break;
    offset += limit;
  }

  return all;
}

export async function exportCampaignPdf(
  campaign: CampaignSummary,
  onProgress?: (msg: string) => void,
): Promise<void> {
  const TRUV_BLUE = [44, 100, 227] as const;
  const DARK_NAVY = [15, 28, 71] as const;

  onProgress?.('Fetching all recipients...');
  const recipients = await fetchAllRecipients(campaign.workflow_key);

  onProgress?.('Generating PDF...');
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const m = campaign.metrics;

  // --- Header bar ---
  doc.setFillColor(...DARK_NAVY);
  doc.rect(0, 0, pageWidth, 28, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('Truv', 14, 14);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Email Performance Report', 14, 22);

  doc.setFontSize(9);
  doc.text(`Generated ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`, pageWidth - 14, 18, { align: 'right' });

  // --- Campaign title ---
  let y = 38;
  doc.setTextColor(15, 28, 71);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(campaign.name, 14, y);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(120, 120, 120);
  doc.text(`Workflow: ${campaign.workflow_key}`, 14, y + 6);

  const dateRange = `${formatDate(campaign.first_event)} – ${formatDate(campaign.last_event)}`;
  doc.text(dateRange, pageWidth - 14, y + 6, { align: 'right' });

  // --- Metric boxes ---
  y = 52;
  const metrics = [
    { label: 'Delivered', value: m.delivered.toLocaleString() },
    { label: 'Unique Opens', value: m.unique_opens.toLocaleString() },
    { label: 'Unique Clicks', value: m.unique_clicks.toLocaleString() },
    { label: 'Open Rate', value: pct(m.open_rate) },
    { label: 'Click Rate', value: pct(m.click_rate) },
    { label: 'Click-to-Open', value: pct(m.click_to_open) },
    { label: 'Bounces', value: m.bounces.toLocaleString() },
    { label: 'Bounce Rate', value: pct(m.bounce_rate) },
  ];

  const boxW = (pageWidth - 28 - 7 * 3) / 8;
  metrics.forEach((met, i) => {
    const bx = 14 + i * (boxW + 3);

    // Box background
    doc.setFillColor(245, 247, 250);
    doc.roundedRect(bx, y, boxW, 18, 2, 2, 'F');

    // Label
    doc.setFontSize(7);
    doc.setTextColor(120, 120, 120);
    doc.setFont('helvetica', 'normal');
    doc.text(met.label, bx + boxW / 2, y + 6, { align: 'center' });

    // Value
    doc.setFontSize(12);
    doc.setTextColor(15, 28, 71);
    doc.setFont('helvetica', 'bold');
    doc.text(met.value, bx + boxW / 2, y + 14, { align: 'center' });
  });

  // --- Recipient table ---
  y = 78;
  doc.setFontSize(11);
  doc.setTextColor(15, 28, 71);
  doc.setFont('helvetica', 'bold');
  doc.text(`Recipients (${recipients.length.toLocaleString()})`, 14, y);

  const tableData = recipients.map((r) => [
    r.email,
    statusText(r.summary),
    r.summary.delivered ? 'Yes' : '—',
    r.summary.opened ? 'Yes' : '—',
    r.summary.clicked ? 'Yes' : '—',
    formatTimestamp(r.summary.last_activity),
  ]);

  autoTable(doc, {
    startY: y + 3,
    head: [['Email', 'Status', 'Delivered', 'Opened', 'Clicked', 'Last Activity']],
    body: tableData,
    margin: { left: 14, right: 14 },
    styles: {
      fontSize: 8,
      cellPadding: 2.5,
      textColor: [50, 50, 50],
    },
    headStyles: {
      fillColor: [...TRUV_BLUE],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
    },
    alternateRowStyles: {
      fillColor: [248, 249, 252],
    },
    tableWidth: 'auto',
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { halign: 'center', cellWidth: 28 },
      2: { halign: 'center', cellWidth: 26 },
      3: { halign: 'center', cellWidth: 26 },
      4: { halign: 'center', cellWidth: 26 },
      5: { halign: 'right', cellWidth: 45 },
    },
    didParseCell(data) {
      // Color-code status column
      if (data.section === 'body' && data.column.index === 1) {
        const val = data.cell.raw as string;
        if (val === 'Clicked') data.cell.styles.textColor = [22, 163, 74];
        else if (val === 'Opened') data.cell.styles.textColor = [161, 98, 7];
        else if (val === 'Bounced') data.cell.styles.textColor = [220, 38, 38];
      }
    },
  });

  // --- Footer on each page ---
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const ph = doc.internal.pageSize.getHeight();
    doc.setFontSize(7);
    doc.setTextColor(160, 160, 160);
    doc.setFont('helvetica', 'normal');
    doc.text('Truv Email Performance Dashboard', 14, ph - 6);
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - 14, ph - 6, { align: 'right' });
  }

  const filename = `${campaign.workflow_key}-report-${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
}
