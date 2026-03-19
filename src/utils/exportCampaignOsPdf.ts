/**
 * Export a Campaign OS campaign report as a branded PDF.
 *
 * Uses html2pdf.js (same as ROI generator) for Gilroy font rendering,
 * Truv brand colors, and pixel-perfect layout matching our case study PDFs.
 */
import html2pdf from 'html2pdf.js';
import type { Campaign } from '../types/campaign';
import { getCampaignAnalytics, getCampaignHealth } from '../services/campaignClient';
import { getTemplatePreview } from '../services/emailPerformanceClient';

function pct(v: number): string {
  return `${(v * 100).toFixed(1)}%`;
}

function fmtDate(d: string | undefined | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const LOGO_SVG = `<svg width="80" height="28" viewBox="0 0 69 25" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M5.85522 23.7673C4.18138 23.7673 2.86445 23.2873 1.90445 22.3273C0.969068 21.3673 0.501372 20.0627 0.501372 18.4135V0.210419H4.71061V18.2289C4.71061 18.795 4.88292 19.2627 5.22753 19.632C5.57215 19.9766 6.02753 20.1489 6.59368 20.1489H10.5444V23.7673H5.85522ZM0.5 8.55503V4.93657H10.5814V8.55503H0.5Z" fill="white"/><path d="M14.4254 23.7673V10.2904C14.4254 8.61657 14.8931 7.31196 15.8285 6.37657C16.7885 5.41657 18.1054 4.93657 19.7792 4.93657H24.3208V8.55503H20.5546C19.9638 8.55503 19.4962 8.72734 19.1515 9.07196C18.8315 9.41657 18.6716 9.88427 18.6716 10.475V23.7673H14.4254Z" fill="white"/><path d="M36.2746 24.2104C34.4531 24.2104 32.8654 23.8535 31.5115 23.1397C30.1577 22.4012 29.1115 21.392 28.3731 20.112C27.6346 18.832 27.2654 17.392 27.2654 15.792V4.93657H31.5115V15.755C31.5115 16.715 31.7208 17.5643 32.1392 18.3027C32.5823 19.0166 33.1608 19.5827 33.8746 20.0012C34.6131 20.395 35.4131 20.592 36.2746 20.592C37.1361 20.592 37.9238 20.395 38.6377 20.0012C39.3761 19.5827 39.9546 19.0166 40.373 18.3027C40.8161 17.5643 41.0377 16.715 41.0377 15.755V4.93657H45.2838V15.792C45.2838 17.392 44.9023 18.832 44.1392 20.112C43.4007 21.392 42.3546 22.4012 41.0007 23.1397C39.6715 23.8535 38.0961 24.2104 36.2746 24.2104Z" fill="white"/><path d="M58.4645 24.2104C57.4799 24.2104 56.5937 23.9397 55.806 23.3981C55.0429 22.8566 54.4891 22.1304 54.1445 21.2196L48.3845 4.93657H52.9999L57.9106 19.5581C57.9845 19.7304 58.0706 19.8535 58.1691 19.9273C58.2676 20.0012 58.3783 20.0381 58.5014 20.0381C58.6245 20.0381 58.7352 20.0012 58.8337 19.9273C58.9568 19.8535 59.0429 19.7304 59.0922 19.5581L64.0399 4.93657H68.5814L62.7845 21.2196C62.4645 22.1304 61.9106 22.8566 61.1229 23.3981C60.3352 23.9397 59.4491 24.2104 58.4645 24.2104Z" fill="white"/></svg>`;

export async function exportCampaignOsPdf(
  campaign: Campaign,
  onProgress?: (msg: string) => void,
): Promise<void> {

  // ── Fetch all data ──────────────────────────
  onProgress?.('Fetching analytics...');

  // Campaign OS analytics
  let analytics: Awaited<ReturnType<typeof getCampaignAnalytics>> | null = null;
  try { analytics = await getCampaignAnalytics(campaign.id); } catch {}
  const hasAnalytics = analytics && (analytics.totals.delivered > 0 || analytics.totals.opens > 0);

  // Knock + SendGrid live data
  interface KnockStatusRes {
    stats: { total: number; delivered: number; sent: number; queued: number; failed: number };
    sendgridStats: { requests: number; delivered: number; opens: number; uniqueOpens: number; clicks: number; uniqueClicks: number; bounces: number; blocks: number; spamReports: number; unsubscribes: number; openRate: number; clickRate: number; bounceRate: number } | null;
  }
  let knockData: KnockStatusRes | null = null;
  const wfKey = campaign.workflow?.knockWorkflowKey;
  if (!hasAnalytics && wfKey) {
    onProgress?.('Fetching live Knock + SendGrid data...');
    try {
      const res = await fetch(`/api/campaigns/knock-status?workflow=${wfKey}`);
      if (res.ok) knockData = await res.json();
    } catch {}
  }

  // Health data
  let health: Awaited<ReturnType<typeof getCampaignHealth>> | null = null;
  try { health = await getCampaignHealth(campaign.id); } catch {}

  // Template preview
  let templateName = '';
  let templateSubject = '';
  let templateHtml = '';
  if (campaign.template?.sendgridTemplateId) {
    onProgress?.('Fetching template...');
    try {
      const p = await getTemplatePreview(campaign.template.sendgridTemplateId);
      templateName = p.name;
      templateSubject = p.subject;
      templateHtml = p.html_content || '';
    } catch {}
  }

  onProgress?.('Generating PDF...');

  // ── Determine KPIs ──────────────────────────
  let kpis: Array<{ label: string; value: string; highlight?: boolean }> = [];
  let dataSource = '';

  if (hasAnalytics && analytics) {
    const t = analytics.totals;
    kpis = [
      { label: 'Recipients', value: t.recipients.toLocaleString() },
      { label: 'Delivered', value: t.delivered.toLocaleString() },
      { label: 'Unique Opens', value: t.opens.toLocaleString() },
      { label: 'Unique Clicks', value: t.clicks.toLocaleString() },
      { label: 'Open Rate', value: pct(t.openRate), highlight: true },
      { label: 'Click Rate', value: pct(t.clickRate), highlight: true },
      { label: 'Bounces', value: t.bounces.toLocaleString() },
      { label: 'Sends', value: analytics.sends.length.toString() },
    ];
    dataSource = 'Campaign OS analytics';
  } else if (knockData?.sendgridStats) {
    const sg = knockData.sendgridStats;
    const k = knockData.stats;
    kpis = [
      { label: 'Sent (Knock)', value: k.total.toLocaleString() },
      { label: 'Delivered', value: sg.delivered.toLocaleString() },
      { label: 'Unique Opens', value: sg.uniqueOpens.toLocaleString() },
      { label: 'Unique Clicks', value: sg.uniqueClicks.toLocaleString() },
      { label: 'Open Rate', value: pct(sg.openRate), highlight: true },
      { label: 'Click Rate', value: pct(sg.clickRate), highlight: true },
      { label: 'Bounces', value: sg.bounces.toLocaleString() },
      { label: 'Blocks', value: sg.blocks.toLocaleString() },
    ];
    dataSource = 'Knock + SendGrid (live)';
  } else if (knockData) {
    const k = knockData.stats;
    kpis = [
      { label: 'Total Sent', value: k.total.toLocaleString() },
      { label: 'Delivered', value: k.delivered.toLocaleString() },
      { label: 'Queued', value: k.queued.toLocaleString() },
      { label: 'Failed', value: k.failed.toLocaleString() },
    ];
    dataSource = 'Knock (SendGrid stats unavailable)';
  }

  // ── Build send breakdown rows ──────────────────────────
  let sendRows = '';
  if (hasAnalytics && analytics && analytics.sends.length > 0) {
    sendRows = analytics.sends.map(s => `
      <div class="stat-row">
        <span class="stat-label" style="flex:2">${s.name}</span>
        <span class="stat-label" style="flex:1; text-align:right">${fmtDate(s.sentAt)}</span>
        <span class="stat-val" style="flex:1; text-align:right">${s.recipients.toLocaleString()}</span>
        <span class="stat-val" style="flex:1; text-align:right">${pct(s.openRate)}</span>
        <span class="stat-val" style="flex:1; text-align:right">${pct(s.clickRate)}</span>
      </div>
    `).join('');
  }

  // ── Build delivery error rows ──────────────────────────
  let errorRows = '';
  if (health && health.deliveryErrors.length > 0) {
    errorRows = health.deliveryErrors.slice(0, 15).map(e => `
      <div style="display:flex; gap:12px; padding:6px 0; border-bottom:1px solid #E2E8F0; font-size:11px;">
        <span style="flex:2; color:#1E293B;">${e.email}</span>
        <span style="flex:1; color:#DC2626; font-weight:600;">${e.type}</span>
        <span style="flex:2; color:#64748B;">${(e.reason || '').slice(0, 50)}</span>
      </div>
    `).join('');
  }

  const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  // ── HTML Template (matches ROI/Case Study brand) ──────────────────────────
  const container = document.createElement('div');
  container.style.cssText = 'position:fixed;left:0;top:0;z-index:-9999';

  container.innerHTML = `
    <div id="campaign-pdf">
      <style>
        @font-face {
          font-family: 'Gilroy';
          src: url('/fonts/Gilroy-Medium.woff2') format('woff2'), url('/fonts/Gilroy-Medium.woff') format('woff');
          font-weight: 500;
          font-style: normal;
        }
        @font-face {
          font-family: 'Gilroy';
          src: url('/fonts/Gilroy-SemiBold.woff2') format('woff2'), url('/fonts/Gilroy-SemiBold.woff') format('woff');
          font-weight: 700;
          font-style: normal;
        }

        .page {
          width: 210mm;
          height: 296mm;
          background: #ffffff;
          font-family: 'Gilroy', 'Inter', system-ui, sans-serif;
          color: #1E293B;
          line-height: 1.5;
          box-sizing: border-box;
          position: relative;
          overflow: hidden;
        }

        .header-art {
          height: 72mm;
          width: 100%;
          background: linear-gradient(135deg, #0F172A 0%, #1E3A8A 100%);
          border-radius: 0 0 24px 24px;
          position: relative;
          display: flex;
          flex-direction: column;
          justify-content: center;
          padding: 0 56px;
          box-sizing: border-box;
        }

        .header-title {
          color: white;
          font-size: 32px;
          font-weight: 700;
          font-family: 'Gilroy', sans-serif;
          margin: 0;
          line-height: 1.2;
        }

        .header-subtitle {
          color: rgba(255,255,255,0.7);
          font-size: 14px;
          margin-top: 6px;
        }

        .main-content {
          padding: 28px 56px 40px 56px;
        }

        .kpi-grid {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr 1fr;
          gap: 12px;
          margin-bottom: 28px;
        }

        .kpi-box {
          background: #F8FAFC;
          border-radius: 12px;
          padding: 16px;
          text-align: center;
        }

        .kpi-box.highlight {
          background: #EFF6FF;
          border: 1px solid #BFDBFE;
        }

        .kpi-label {
          font-size: 11px;
          font-weight: 600;
          color: #64748B;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: 4px;
        }

        .kpi-value {
          font-family: 'Gilroy', sans-serif;
          font-weight: 700;
          font-size: 24px;
          color: #0F172A;
        }

        .kpi-box.highlight .kpi-value {
          color: #2C64E3;
        }

        .section-title {
          font-family: 'Gilroy', sans-serif;
          font-size: 12px;
          font-weight: 700;
          color: #64748B;
          text-transform: uppercase;
          letter-spacing: 0.15em;
          margin: 0 0 12px 0;
          display: flex;
          align-items: center;
        }

        .section-title::after {
          content: '';
          flex: 1;
          height: 1px;
          background: #E2E8F0;
          margin-left: 16px;
        }

        .stat-row {
          display: flex;
          justify-content: space-between;
          border-bottom: 1px solid #E2E8F0;
          padding: 10px 0;
        }

        .stat-label {
          font-size: 12px;
          font-weight: 600;
          color: #64748B;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .stat-val {
          font-family: 'Gilroy', sans-serif;
          font-weight: 700;
          color: #2C64E3;
          font-size: 13px;
        }

        .template-box {
          background: #F8FAFC;
          border-radius: 12px;
          padding: 16px 20px;
          margin-bottom: 20px;
        }

        .template-label {
          font-size: 10px;
          color: #94A3B8;
          text-transform: uppercase;
          letter-spacing: 0.1em;
        }

        .template-name {
          font-family: 'Gilroy', sans-serif;
          font-size: 16px;
          font-weight: 700;
          color: #0F172A;
          margin-top: 2px;
        }

        .template-subject {
          font-size: 13px;
          color: #64748B;
          margin-top: 2px;
        }

        .footer {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          padding: 16px 56px 24px 56px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 11px;
          color: #94A3B8;
          background: white;
        }

        .error-header {
          display: flex;
          gap: 12px;
          padding: 8px 0;
          border-bottom: 2px solid #E2E8F0;
          font-size: 11px;
          font-weight: 700;
          color: #64748B;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
      </style>

      <!-- PAGE 1: Campaign Report -->
      <div class="page" style="page-break-after: ${templateHtml ? 'always' : 'auto'};">
        <div class="header-art">
          <div style="position: absolute; top: 32px; right: 40px;">${LOGO_SVG}</div>
          <div class="header-title">${campaign.name}</div>
          <div class="header-subtitle">Campaign Performance Report • ${dateStr}</div>
        </div>

        <div class="main-content">
          <!-- Campaign meta -->
          <div style="display:flex; gap:24px; margin-bottom:20px;">
            <div>
              <div style="font-size:10px; color:#94A3B8; text-transform:uppercase; letter-spacing:0.1em;">Channel</div>
              <div style="font-size:14px; font-weight:700; color:#0F172A; text-transform:capitalize;">${campaign.channel}</div>
            </div>
            <div>
              <div style="font-size:10px; color:#94A3B8; text-transform:uppercase; letter-spacing:0.1em;">Status</div>
              <div style="font-size:14px; font-weight:700; color:#22C55E; text-transform:capitalize;">${campaign.status}</div>
            </div>
            <div>
              <div style="font-size:10px; color:#94A3B8; text-transform:uppercase; letter-spacing:0.1em;">Audience</div>
              <div style="font-size:14px; font-weight:700; color:#0F172A;">${campaign.audience?.count?.toLocaleString() || '—'}</div>
            </div>
            ${campaign.sentAt ? `<div>
              <div style="font-size:10px; color:#94A3B8; text-transform:uppercase; letter-spacing:0.1em;">Sent</div>
              <div style="font-size:14px; font-weight:700; color:#0F172A;">${fmtDate(campaign.sentAt)}</div>
            </div>` : ''}
          </div>

          <!-- Template -->
          ${templateName ? `
            <div class="template-box">
              <div class="template-label">Template</div>
              <div class="template-name">${templateName}</div>
              ${templateSubject ? `<div class="template-subject">Subject: ${templateSubject}</div>` : ''}
            </div>
          ` : ''}

          <!-- KPIs -->
          ${kpis.length > 0 ? `
            <div class="section-title">Performance Metrics</div>
            <div class="kpi-grid">
              ${kpis.map(k => `
                <div class="kpi-box ${k.highlight ? 'highlight' : ''}">
                  <div class="kpi-label">${k.label}</div>
                  <div class="kpi-value">${k.value}</div>
                </div>
              `).join('')}
            </div>
          ` : `
            <div style="background:#FEF3C7; border:1px solid #FDE68A; border-radius:12px; padding:20px; text-align:center; margin-bottom:24px;">
              <div style="font-size:14px; color:#92400E; font-weight:600;">No engagement data yet</div>
              <div style="font-size:12px; color:#A16207; margin-top:4px;">Check back after sends complete and SendGrid processes events.</div>
            </div>
          `}

          <!-- Send breakdown -->
          ${sendRows ? `
            <div class="section-title">Send Breakdown</div>
            <div class="stat-row" style="border-bottom:2px solid #E2E8F0;">
              <span class="stat-label" style="flex:2">Send Name</span>
              <span class="stat-label" style="flex:1; text-align:right">Date</span>
              <span class="stat-label" style="flex:1; text-align:right">Recipients</span>
              <span class="stat-label" style="flex:1; text-align:right">Open Rate</span>
              <span class="stat-label" style="flex:1; text-align:right">Click Rate</span>
            </div>
            ${sendRows}
          ` : ''}

          <!-- Delivery errors -->
          ${errorRows ? `
            <div class="section-title" style="margin-top:20px;">Delivery Errors (${health!.deliveryErrors.length})</div>
            <div class="error-header">
              <span style="flex:2">Email</span>
              <span style="flex:1">Type</span>
              <span style="flex:2">Reason</span>
            </div>
            ${errorRows}
          ` : ''}
        </div>

        <div class="footer">
          <span>Truv Inc. Confidential${dataSource ? ` • Data: ${dataSource}` : ''}</span>
          <span>01 / PERFORMANCE</span>
        </div>
      </div>

      <!-- PAGE 2: Email Preview (only if template exists) -->
      ${templateHtml ? `
        <div class="page">
          <div style="padding: 40px 56px 0;">
            <div class="section-title">Email Template Preview</div>
            <div style="border: 1px solid #E2E8F0; border-radius: 12px; overflow: hidden; max-height: 240mm;">
              <div style="width: 100%; overflow: hidden;">
                ${templateHtml}
              </div>
            </div>
          </div>
          <div class="footer">
            <span>Truv Inc. Confidential</span>
            <span>02 / TEMPLATE</span>
          </div>
        </div>
      ` : ''}
    </div>
  `;

  document.body.appendChild(container);

  const content = document.getElementById('campaign-pdf');

  await html2pdf()
    .set({
      margin: 0,
      filename: `${campaign.name.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}-report-${new Date().toISOString().slice(0, 10)}.pdf`,
      image: { type: 'jpeg', quality: 0.95 },
      html2canvas: { scale: 2, useCORS: true, letterRendering: true, logging: false },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    })
    .from(content || container)
    .save();

  document.body.removeChild(container);
}
