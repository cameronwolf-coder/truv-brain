/**
 * Export a Campaign OS campaign report as a downloadable PDF.
 *
 * Data flow: tries Campaign OS analytics API first, then falls back to the
 * email performance API which queries Knock + SendGrid live. This ensures
 * the PDF always has real data even if Redis cache hasn't been populated.
 */
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Campaign } from '../types/campaign';
import type { CampaignAnalytics, CampaignHealth } from '../services/campaignClient';
import { getCampaignAnalytics, getCampaignHealth } from '../services/campaignClient';
import { getCampaigns, getTemplatePreview } from '../services/emailPerformanceClient';
import type { CampaignSummary } from '../types/emailPerformance';

const NAVY = [15, 28, 71] as const;
const LIGHT_BG = [245, 247, 250] as const;
const GRAY = [120, 120, 120] as const;

function pct(v: number): string {
  return `${(v * 100).toFixed(1)}%`;
}

function fmtDate(d: string | undefined | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtDateFromTs(ts: number): string {
  if (!ts) return '—';
  return new Date(ts * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

async function renderHtmlToImage(html: string): Promise<HTMLCanvasElement> {
  const { default: html2canvas } = await import('html2canvas');
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;left:-9999px;top:0;width:660px;height:1px;border:none;overflow:hidden';
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument!;
  doc.open();
  doc.write(html);
  doc.close();
  await new Promise((r) => { iframe.onload = r; setTimeout(r, 2500); });

  // Measure actual content height — no excess whitespace
  const body = doc.body;
  const contentHeight = body.scrollHeight;
  iframe.style.height = `${contentHeight}px`;

  // Small delay for reflow
  await new Promise((r) => setTimeout(r, 300));

  const canvas = await html2canvas(body, {
    width: 660,
    height: contentHeight,
    scale: 1.5,
    useCORS: true,
    allowTaint: true,
    logging: false,
  });

  document.body.removeChild(iframe);
  return canvas;
}

export async function exportCampaignOsPdf(
  campaign: Campaign,
  onProgress?: (msg: string) => void,
): Promise<void> {

  // ── Fetch data from multiple sources ──────────────

  onProgress?.('Fetching analytics...');

  // 1. Try Campaign OS analytics (Redis-cached)
  let analytics: CampaignAnalytics | null = null;
  try {
    analytics = await getCampaignAnalytics(campaign.id);
  } catch { /* no cached analytics */ }

  // 2. Check if analytics has real data or is all zeros
  const hasAnalyticsData = analytics &&
    (analytics.totals.delivered > 0 || analytics.totals.opens > 0 || analytics.totals.recipients > 0);

  // 3. If no data, fetch live from Knock + SendGrid via knock-status API
  //    This is the same endpoint the DeliveryStatus component uses
  interface KnockStatusResponse {
    stats: { total: number; delivered: number; sent: number; queued: number; failed: number };
    sendgridStats: {
      requests: number; delivered: number; opens: number; uniqueOpens: number;
      clicks: number; uniqueClicks: number; bounces: number; blocks: number;
      spamReports: number; unsubscribes: number;
      openRate: number; clickRate: number; bounceRate: number;
    } | null;
  }

  let knockData: KnockStatusResponse | null = null;
  const wfKey = campaign.workflow?.knockWorkflowKey;

  if (!hasAnalyticsData && wfKey) {
    onProgress?.('Fetching live data from Knock + SendGrid...');
    try {
      const res = await fetch(`/api/campaigns/knock-status?workflow=${wfKey}`);
      if (res.ok) knockData = await res.json();
    } catch { /* knock-status API not available */ }
  }

  // 4. Also try the email performance API as a second fallback
  let liveSummary: CampaignSummary | null = null;
  if (!hasAnalyticsData && !knockData) {
    try {
      const allCampaigns = await getCampaigns();
      const tplId = campaign.template?.sendgridTemplateId;
      liveSummary = allCampaigns.find(
        (c) => (wfKey && c.workflow_key === wfKey) || (tplId && c.template_id === tplId)
      ) || null;
    } catch { /* fallback failed */ }
  }

  // 4. Fetch health data
  let health: CampaignHealth | null = null;
  try {
    health = await getCampaignHealth(campaign.id);
  } catch { /* no health data */ }

  // 5. Fetch template preview
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

  // ── Build the PDF ──────────────────────────

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 14;
  const contentW = pageW - margin * 2;

  // ── Header bar ──────────────────────────
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

  // ── Campaign name + meta ──────────────────────────
  let y = 38;
  pdf.setTextColor(...NAVY);
  pdf.setFontSize(18);
  pdf.setFont('helvetica', 'bold');
  pdf.text(campaign.name, margin, y);

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

  // Date range from live data if available
  if (liveSummary) {
    y += 5;
    pdf.text(`Date range: ${fmtDateFromTs(liveSummary.first_event)} – ${fmtDateFromTs(liveSummary.last_event)}`, margin, y);
  }

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

  // Build KPIs from whichever source has data
  let kpis: Array<{ label: string; value: string }>;
  let dataSource = '';

  if (hasAnalyticsData && analytics) {
    const t = analytics.totals;
    kpis = [
      { label: 'Recipients', value: t.recipients.toLocaleString() },
      { label: 'Delivered', value: t.delivered.toLocaleString() },
      { label: 'Opens', value: t.opens.toLocaleString() },
      { label: 'Clicks', value: t.clicks.toLocaleString() },
      { label: 'Open Rate', value: pct(t.openRate) },
      { label: 'Click Rate', value: pct(t.clickRate) },
      { label: 'Bounces', value: t.bounces.toLocaleString() },
      { label: 'Sends', value: analytics.sends.length.toString() },
    ];
    dataSource = 'Campaign OS analytics cache';
  } else if (knockData) {
    // Use Knock + SendGrid live data
    const k = knockData.stats;
    const sg = knockData.sendgridStats;
    if (sg) {
      kpis = [
        { label: 'Sent (Knock)', value: k.total.toLocaleString() },
        { label: 'Delivered', value: sg.delivered.toLocaleString() },
        { label: 'Unique Opens', value: sg.uniqueOpens.toLocaleString() },
        { label: 'Unique Clicks', value: sg.uniqueClicks.toLocaleString() },
        { label: 'Open Rate', value: pct(sg.openRate) },
        { label: 'Click Rate', value: pct(sg.clickRate) },
        { label: 'Bounces', value: sg.bounces.toLocaleString() },
        { label: 'Blocks', value: sg.blocks.toLocaleString() },
      ];
    } else {
      kpis = [
        { label: 'Sent (Knock)', value: k.total.toLocaleString() },
        { label: 'Delivered', value: k.delivered.toLocaleString() },
        { label: 'Queued', value: k.queued.toLocaleString() },
        { label: 'Failed', value: k.failed.toLocaleString() },
      ];
    }
    dataSource = 'Knock + SendGrid (live)';
  } else if (liveSummary) {
    const m = liveSummary.metrics;
    kpis = [
      { label: 'Delivered', value: m.delivered.toLocaleString() },
      { label: 'Unique Opens', value: m.unique_opens.toLocaleString() },
      { label: 'Unique Clicks', value: m.unique_clicks.toLocaleString() },
      { label: 'Bounces', value: m.bounces.toLocaleString() },
      { label: 'Open Rate', value: pct(m.open_rate) },
      { label: 'Click Rate', value: pct(m.click_rate) },
      { label: 'Click-to-Open', value: pct(m.click_to_open) },
      { label: 'Bounce Rate', value: pct(m.bounce_rate) },
    ];
    dataSource = 'Email performance API';
  } else {
    kpis = [{ label: 'Status', value: 'No engagement data yet — check back after sends complete' }];
    dataSource = '';
  }

  if (kpis.length === 1 && kpis[0].label === 'Status') {
    // No data message
    pdf.setFontSize(11);
    pdf.setTextColor(...GRAY);
    pdf.text(kpis[0].value, margin, y + 5);
    y += 14;
  } else {
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
  }

  // ── Per-Send Breakdown Table (from Campaign OS analytics) ──────────────────────────
  if (hasAnalyticsData && analytics && analytics.sends.length > 0) {
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
  }

  // ── Email Template Preview (Page 2) — proper aspect ratio, no stretch ──────────────────────────
  if (templateCanvas) {
    pdf.addPage();
    let py = 16;

    pdf.setFontSize(12);
    pdf.setTextColor(...NAVY);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Email Template Preview', margin, py);
    py += 6;

    const imgData = templateCanvas.toDataURL('image/jpeg', 0.9);
    const canvasW = templateCanvas.width;
    const canvasH = templateCanvas.height;
    const aspect = canvasH / canvasW;

    // Fixed width, height derived from true aspect ratio — never stretch
    const imgW = Math.min(contentW * 0.85, 150);
    const imgH = imgW * aspect;
    const imgX = margin + (contentW - imgW) / 2;

    // If the image is taller than the page, scale down to fit
    const maxH = pageH - py - 16;
    let finalW = imgW;
    let finalH = imgH;
    if (finalH > maxH) {
      finalH = maxH;
      finalW = finalH / aspect;
    }
    const finalX = margin + (contentW - finalW) / 2;

    // Light border
    pdf.setDrawColor(220, 220, 220);
    pdf.setLineWidth(0.3);
    pdf.roundedRect(finalX - 1, py - 1, finalW + 2, finalH + 2, 1, 1, 'S');
    pdf.addImage(imgData, 'JPEG', finalX, py, finalW, finalH);
  }

  // ── Data source note ──────────────────────────
  if (dataSource) {
    pdf.setPage(1);
    const noteY = pageH - 14;
    pdf.setFontSize(7);
    pdf.setTextColor(180, 180, 180);
    pdf.text(`Data source: ${dataSource}`, margin, noteY);
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
