import jsPDF from 'jspdf';
import type { CampaignSummary } from '../types/emailPerformance';
import { getTemplatePreview } from '../services/emailPerformanceClient';

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

async function renderHtmlToImage(html: string): Promise<HTMLCanvasElement> {
  // Render the email HTML in a hidden iframe and capture with html2canvas
  const { default: html2canvas } = await import('html2canvas');

  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.left = '-9999px';
  iframe.style.top = '0';
  iframe.style.width = '660px';
  iframe.style.height = '2000px';
  iframe.style.border = 'none';
  document.body.appendChild(iframe);

  const iframeDoc = iframe.contentDocument!;
  iframeDoc.open();
  iframeDoc.write(html);
  iframeDoc.close();

  // Wait for images and fonts to load
  await new Promise((resolve) => {
    iframe.onload = resolve;
    setTimeout(resolve, 2000);
  });

  const body = iframeDoc.body;
  const canvas = await html2canvas(body, {
    width: 660,
    scale: 1.5,
    useCORS: true,
    allowTaint: true,
    logging: false,
  });

  document.body.removeChild(iframe);
  return canvas;
}

export async function exportCampaignPdf(
  campaign: CampaignSummary,
  onProgress?: (msg: string) => void,
): Promise<void> {
  const DARK_NAVY = [15, 28, 71] as const;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const m = campaign.metrics;
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;

  // --- Fetch template preview if available ---
  let templateName = '';
  let templateSubject = '';
  let templateCanvas: HTMLCanvasElement | null = null;

  if (campaign.template_id) {
    onProgress?.('Fetching email template...');
    try {
      const preview = await getTemplatePreview(campaign.template_id);
      templateName = preview.name;
      templateSubject = preview.subject;

      if (preview.html_content) {
        onProgress?.('Rendering email preview...');
        templateCanvas = await renderHtmlToImage(preview.html_content);
      }
    } catch {
      // Template preview not available, continue without it
    }
  }

  onProgress?.('Generating PDF...');

  // --- Page 1: Header + Metrics ---

  // Header bar
  doc.setFillColor(...DARK_NAVY);
  doc.rect(0, 0, pageWidth, 28, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('Truv', margin, 14);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Email Performance Report', margin, 22);

  doc.setFontSize(9);
  doc.text(
    `Generated ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`,
    pageWidth - margin,
    18,
    { align: 'right' },
  );

  // Campaign name
  let y = 40;
  doc.setTextColor(15, 28, 71);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(campaign.name, margin, y);

  // Workflow key and date range
  y += 7;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(120, 120, 120);
  doc.text(`Workflow: ${campaign.workflow_key}`, margin, y);

  const dateRange = `${formatDate(campaign.first_event)} – ${formatDate(campaign.last_event)}`;
  doc.text(dateRange, pageWidth - margin, y, { align: 'right' });

  // Template info
  if (templateName || templateSubject) {
    y += 10;
    doc.setFillColor(245, 247, 250);
    doc.roundedRect(margin, y - 4, contentWidth, templateSubject ? 18 : 12, 2, 2, 'F');

    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text('Template', margin + 4, y + 1);

    doc.setFontSize(10);
    doc.setTextColor(50, 50, 50);
    doc.setFont('helvetica', 'bold');
    doc.text(templateName || campaign.template_id, margin + 4, y + 6);

    if (templateSubject) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(80, 80, 80);
      doc.text(`Subject: ${templateSubject}`, margin + 4, y + 11);
    }

    y += templateSubject ? 20 : 14;
  } else {
    y += 6;
  }

  // --- Metric boxes (2 rows of 4) ---
  y += 4;
  const metrics = [
    { label: 'Delivered', value: m.delivered.toLocaleString() },
    { label: 'Unique Opens', value: m.unique_opens.toLocaleString() },
    { label: 'Unique Clicks', value: m.unique_clicks.toLocaleString() },
    { label: 'Bounces', value: m.bounces.toLocaleString() },
    { label: 'Open Rate', value: pct(m.open_rate) },
    { label: 'Click Rate', value: pct(m.click_rate) },
    { label: 'Click-to-Open', value: pct(m.click_to_open) },
    { label: 'Bounce Rate', value: pct(m.bounce_rate) },
  ];

  const cols = 4;
  const gap = 4;
  const boxW = (contentWidth - gap * (cols - 1)) / cols;
  const boxH = 20;

  metrics.forEach((met, i) => {
    const row = Math.floor(i / cols);
    const col = i % cols;
    const bx = margin + col * (boxW + gap);
    const by = y + row * (boxH + gap);

    doc.setFillColor(245, 247, 250);
    doc.roundedRect(bx, by, boxW, boxH, 2, 2, 'F');

    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.setFont('helvetica', 'normal');
    doc.text(met.label, bx + boxW / 2, by + 7, { align: 'center' });

    doc.setFontSize(16);
    doc.setTextColor(15, 28, 71);
    doc.setFont('helvetica', 'bold');
    doc.text(met.value, bx + boxW / 2, by + 16, { align: 'center' });
  });

  y += 2 * (boxH + gap) + 4;

  // --- Email template preview ---
  if (templateCanvas) {
    doc.setFontSize(11);
    doc.setTextColor(15, 28, 71);
    doc.setFont('helvetica', 'bold');
    doc.text('Email Template Preview', margin, y);
    y += 4;

    const imgData = templateCanvas.toDataURL('image/jpeg', 0.85);
    const canvasAspect = templateCanvas.height / templateCanvas.width;

    // Scale to fit the remaining page width (centered, with a max width)
    const maxImgWidth = Math.min(contentWidth, 140);
    let imgW = maxImgWidth;
    let imgH = imgW * canvasAspect;

    // If the image is too tall for the remaining space, start a new page
    const remainingHeight = pageHeight - y - 12;
    if (imgH > remainingHeight) {
      // If the image is very tall, cap and let it span pages
      if (imgH > pageHeight - 40) {
        imgH = pageHeight - 40;
        imgW = imgH / canvasAspect;
      } else {
        doc.addPage();
        y = 14;
      }
    }

    // Center the preview
    const imgX = margin + (contentWidth - imgW) / 2;

    // Add a light border around the preview
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.3);
    doc.roundedRect(imgX - 1, y - 1, imgW + 2, imgH + 2, 1, 1, 'S');

    doc.addImage(imgData, 'JPEG', imgX, y, imgW, imgH);
  }

  // --- Footer on each page ---
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(160, 160, 160);
    doc.setFont('helvetica', 'normal');
    doc.text('Truv Email Performance Dashboard', margin, pageHeight - 6);
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - margin, pageHeight - 6, { align: 'right' });
  }

  const filename = `${campaign.workflow_key}-report-${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
}
