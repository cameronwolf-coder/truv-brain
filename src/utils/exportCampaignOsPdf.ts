/**
 * Export a Campaign OS campaign report as a downloadable PDF.
 *
 * Includes: header, campaign metadata, KPI summary, per-send breakdown table,
 * delivery errors (if any), and email template preview.
 */
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Campaign } from '../types/campaign';
import type { CampaignAnalytics, CampaignHealth } from '../services/campaignClient';
import { getCampaignAnalytics, getCampaignHealth } from '../services/campaignClient';
import { getTemplatePreview } from '../services/emailPerformanceClient';

const NAVY = [15, 28, 71] as const;
const BLUE = [44, 100, 227] as const;
const GRAY = [120, 120, 120] as const;
const LIGHT_BG = [245, 247, 250] as const;

function pct(v: number): string {
  return `${(v * 100).toFixed(1)}%`;
}

function fmtDate(d: string | undefined | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

async function renderHtmlToImage(html: string): Promise<HTMLCanvasElement> {
  const { default: html2canvas } = await import('html2canvas');
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;left:-9999px;top:0;width:660px;height:2000px;border:none';
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument!;
  doc.open();
  doc.write(html);
  doc.close();
  await new Promise((r) => { iframe.onload = r; setTimeout(r, 2000); });
  const canvas = await html2canvas(doc.body, { width: 660, scale: 1.5, useCORS: true, allowTaint: true, logging: false });
  document.body.removeChild(iframe);
  return canvas;
}

export async function exportCampaignOsPdf(
  campaign: Campaign,
  onProgress?: (msg: string) => void,
): Promise<void> {
  onProgress?.('Fetching analytics...');
  let analytics: CampaignAnalytics | null = null;
  let health: CampaignHealth | null = null;

  try {
    analytics = await getCampaignAnalytics(campaign.id);
  } catch { /* no analytics yet */ }

  try {
    health = await getCampaignHealth(campaign.id);
  } catch { /* no health data */ }

  // Fetch template preview
  let templateName = '';
  let templateSubject = '';
  let templateCanvas: HTMLCanvasElement | null = null;

  if (campaign.template?.sendgridTemplateId) {
    onProgress?.('Rendering email preview...');
    try {
      const preview = await getTemplatePreview(campaign.template.sendgridTemplateId);
      templateName = preview.name;
      templateSubject = preview.subject;
      if (preview.html_content) {
        templateCanvas = await renderHtmlToImage(preview.html_content);
      }
    } catch { /* skip preview */ }
  }

  onProgress?.('Generating PDF...');

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 14;
  const contentW = pageW - margin * 2;

  // ── PAGE 1: Header + KPIs ──────────────────────────

  // Header bar
  pdf.setFillColor(...NAVY);
  pdf.rect(0, 0, pageW, 28, 'F');
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(18);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Truv', margin, 14);
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  pdf.text('Campaign Report', margin, 22);
  pdf.setFontSize(9);
  pdf.text(new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }), pageW - margin, 18, { align: 'right' });

  // Campaign name
  let y = 38;
  pdf.setTextColor(...NAVY);
  pdf.setFontSize(18);
  pdf.setFont('helvetica', 'bold');
  pdf.text(campaign.name, margin, y);

  // Metadata line
  y += 7;
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(...GRAY);
  const meta = [
    `Channel: ${campaign.channel}`,
    `Status: ${campaign.status}`,
    campaign.audience?.count ? `Audience: ${campaign.audience.count.toLocaleString()}` : null,
    campaign.sentAt ? `Sent: ${fmtDate(campaign.sentAt)}` : null,
  ].filter(Boolean).join('  •  ');
  pdf.text(meta, margin, y);

  // Template info
  if (templateName || campaign.template?.name) {
    y += 8;
    pdf.setFillColor(...LIGHT_BG);
    pdf.roundedRect(margin, y - 3, contentW, templateSubject ? 16 : 10, 2, 2, 'F');
    pdf.setFontSize(8);
    pdf.setTextColor(...GRAY);
    pdf.text('Template', margin + 4, y + 1);
    pdf.setFontSize(10);
    pdf.setTextColor(50, 50, 50);
    pdf.setFont('helvetica', 'bold');
    pdf.text(templateName || campaign.template?.name || '', margin + 4, y + 6);
    if (templateSubject) {
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9);
      pdf.setTextColor(80, 80, 80);
      pdf.text(`Subject: ${templateSubject}`, margin + 4, y + 11);
    }
    y += templateSubject ? 18 : 12;
  }

  // ── KPI Cards ──────────────────────────
  y += 6;

  if (analytics) {
    const t = analytics.totals;
    const kpis = [
      { label: 'Recipients', value: t.recipients.toLocaleString() },
      { label: 'Delivered', value: t.delivered.toLocaleString() },
      { label: 'Opens', value: t.opens.toLocaleString() },
      { label: 'Clicks', value: t.clicks.toLocaleString() },
      { label: 'Open Rate', value: pct(t.openRate) },
      { label: 'Click Rate', value: pct(t.clickRate) },
      { label: 'Bounces', value: t.bounces.toLocaleString() },
      { label: 'Sends', value: analytics.sends.length.toString() },
    ];

    const cols = 4;
    const gap = 4;
    const boxW = (contentW - gap * (cols - 1)) / cols;
    const boxH = 20;

    kpis.forEach((kpi, i) => {
      const row = Math.floor(i / cols);
      const col = i % cols;
      const bx = margin + col * (boxW + gap);
      const by = y + row * (boxH + gap);

      pdf.setFillColor(...LIGHT_BG);
      pdf.roundedRect(bx, by, boxW, boxH, 2, 2, 'F');

      pdf.setFontSize(8);
      pdf.setTextColor(...GRAY);
      pdf.setFont('helvetica', 'normal');
      pdf.text(kpi.label, bx + boxW / 2, by + 7, { align: 'center' });

      pdf.setFontSize(16);
      pdf.setTextColor(...NAVY);
      pdf.setFont('helvetica', 'bold');
      pdf.text(kpi.value, bx + boxW / 2, by + 16, { align: 'center' });
    });

    y += Math.ceil(kpis.length / cols) * (boxH + gap) + 4;
  } else {
    pdf.setFontSize(10);
    pdf.setTextColor(...GRAY);
    pdf.text('No analytics data available yet.', margin, y + 5);
    y += 12;
  }

  // ── Per-Send Breakdown Table ──────────────────────────
  if (analytics && analytics.sends.length > 0) {
    y += 4;
    pdf.setFontSize(12);
    pdf.setTextColor(...NAVY);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Send Breakdown', margin, y);
    y += 2;

    autoTable(pdf, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [['Send', 'Date', 'Recipients', 'Delivered', 'Opens', 'Clicks', 'Open %', 'Click %', 'Bounces']],
      body: analytics.sends.map((s) => [
        s.name,
        fmtDate(s.sentAt),
        s.recipients.toLocaleString(),
        s.delivered.toLocaleString(),
        s.opens.toLocaleString(),
        s.clicks.toLocaleString(),
        pct(s.openRate),
        pct(s.clickRate),
        s.bounces.toLocaleString(),
      ]),
      headStyles: { fillColor: NAVY as unknown as number[], fontSize: 8, fontStyle: 'bold' },
      bodyStyles: { fontSize: 8 },
      alternateRowStyles: { fillColor: [250, 250, 252] },
      styles: { cellPadding: 2 },
    });

    y = (pdf as any).lastAutoTable?.finalY + 8 || y + 40;
  }

  // ── Delivery Errors ──────────────────────────
  if (health && health.deliveryErrors.length > 0) {
    if (y > pageH - 60) { pdf.addPage(); y = 20; }

    pdf.setFontSize(12);
    pdf.setTextColor(...NAVY);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Delivery Errors', margin, y);
    y += 2;

    autoTable(pdf, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [['Email', 'Type', 'Reason']],
      body: health.deliveryErrors.slice(0, 20).map((e) => [
        e.email,
        e.type,
        (e.reason || '').slice(0, 60),
      ]),
      headStyles: { fillColor: [220, 50, 50], fontSize: 8, fontStyle: 'bold' },
      bodyStyles: { fontSize: 7 },
      styles: { cellPadding: 2 },
    });

    y = (pdf as any).lastAutoTable?.finalY + 8 || y + 30;

    if (health.deliveryErrors.length > 20) {
      pdf.setFontSize(8);
      pdf.setTextColor(...GRAY);
      pdf.text(`Showing 20 of ${health.deliveryErrors.length} errors`, margin, y);
      y += 6;
    }
  }

  // ── Email Template Preview (Page 2) ──────────────────────────
  if (templateCanvas) {
    pdf.addPage();
    let py = 16;

    pdf.setFontSize(12);
    pdf.setTextColor(...NAVY);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Email Template Preview', margin, py);
    py += 6;

    const imgData = templateCanvas.toDataURL('image/jpeg', 0.85);
    const aspect = templateCanvas.height / templateCanvas.width;
    const imgW = Math.min(contentW, 160);
    const imgH = imgW * aspect;
    const imgX = margin + (contentW - imgW) / 2;

    pdf.setDrawColor(220, 220, 220);
    pdf.setLineWidth(0.3);
    pdf.roundedRect(imgX - 1, py - 1, imgW + 2, Math.min(imgH, pageH - py - 20) + 2, 1, 1, 'S');
    pdf.addImage(imgData, 'JPEG', imgX, py, imgW, Math.min(imgH, pageH - py - 20));
  }

  // ── Footers ──────────────────────────
  const totalPages = pdf.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);
    pdf.setFontSize(7);
    pdf.setTextColor(160, 160, 160);
    pdf.setFont('helvetica', 'normal');
    pdf.text('Truv Campaign Report', margin, pageH - 6);
    pdf.text(`Page ${i} of ${totalPages}`, pageW - margin, pageH - 6, { align: 'right' });
  }

  const filename = `${campaign.name.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}-report-${new Date().toISOString().slice(0, 10)}.pdf`;
  pdf.save(filename);
}
