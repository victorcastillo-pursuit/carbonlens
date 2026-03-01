import jsPDF from 'jspdf';
import { AppState } from '../types';
import { projectRevenue } from './calculation';

const BRAND_BLUE: [number, number, number] = [37, 99, 235];    // blue-600
const BRAND_DARK: [number, number, number] = [23, 23, 23];     // neutral-900
const BRAND_MID: [number, number, number] = [82, 82, 82];      // neutral-600
const BRAND_LIGHT: [number, number, number] = [245, 245, 245]; // neutral-100
const BRAND_GREEN: [number, number, number] = [5, 150, 105];   // emerald-600

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  });
}

function formatNum(n: number, decimals = 2): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function formatUSD(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

export async function generateMonitoringReportPdf(state: AppState): Promise<Blob> {
  const { facility, generationData, calculation, readiness, auditLog } = state;
  if (!facility || !generationData || !calculation || !readiness) {
    throw new Error('Incomplete state — cannot generate PDF');
  }

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentW = pageW - margin * 2;
  let y = 0;

  // ── Helpers ────────────────────────────────────────────────────────────────
  function newPage() {
    doc.addPage();
    y = margin;
    addPageFooter();
  }

  function checkY(needed: number) {
    if (y + needed > pageH - 25) newPage();
  }

  function addPageFooter() {
    const pageNum = doc.getNumberOfPages();
    doc.setFontSize(8);
    doc.setTextColor(...BRAND_MID);
    doc.text(`CarbonLens | CDM AMS I.D Monitoring Report | Page ${pageNum}`, margin, pageH - 10);
    doc.text(`Generated: ${new Date().toISOString()}`, pageW - margin, pageH - 10, { align: 'right' });
  }

  function sectionHeader(title: string) {
    checkY(16);
    doc.setFillColor(...BRAND_BLUE);
    doc.rect(margin, y, contentW, 8, 'F');
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text(title.toUpperCase(), margin + 3, y + 5.5);
    doc.setTextColor(...BRAND_DARK);
    y += 12;
  }

  function kv(label: string, value: string, mono = false) {
    checkY(8);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...BRAND_MID);
    doc.text(label, margin, y);
    doc.setFont(mono ? 'courier' : 'helvetica', 'normal');
    doc.setTextColor(...BRAND_DARK);
    doc.text(value, margin + 65, y, { maxWidth: contentW - 65 });
    y += 6.5;
  }

  function note(text: string) {
    checkY(10);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(...BRAND_MID);
    const lines = doc.splitTextToSize(text, contentW) as string[];
    doc.text(lines, margin, y);
    y += lines.length * 4.5;
  }

  function divider() {
    checkY(6);
    doc.setDrawColor(220, 220, 220);
    doc.line(margin, y, pageW - margin, y);
    y += 5;
  }

  // ── Cover ──────────────────────────────────────────────────────────────────
  y = 30;
  doc.setFillColor(...BRAND_BLUE);
  doc.rect(0, 0, pageW, 20, 'F');
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('CARBONLENS', margin, 13);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('Solar Carbon Credit Documentation Platform', margin + 42, 13);

  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...BRAND_DARK);
  doc.text('CDM AMS I.D — Monitoring Report', margin, y);
  y += 8;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...BRAND_MID);
  doc.text('Renewable Energy — Solar Photovoltaic', margin, y);
  y += 16;

  // Status banner
  const bannerColor: [number, number, number] = readiness.status === 'READY_FOR_REPORT'
    ? BRAND_GREEN : [220, 38, 38];
  doc.setFillColor(...bannerColor);
  doc.rect(margin, y, contentW, 10, 'F');
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  const statusText = readiness.status === 'READY_FOR_REPORT'
    ? 'READY FOR REPORT — All readiness checks passed'
    : `BLOCKED — ${readiness.blockingCount} blocking issue(s) detected`;
  doc.text(statusText, pageW / 2, y + 6.5, { align: 'center' });
  y += 18;

  addPageFooter();

  // ── 1. Project Information ─────────────────────────────────────────────────
  sectionHeader('1. Project Information');
  kv('Project Name', facility.name);
  kv('Facility ID', facility.id, true);
  kv('Report ID', state.reportArtifact?.reportId ?? 'Pending', true);
  kv('Report Generated', formatDate(new Date().toISOString()));
  kv('CDM Methodology', 'AMS I.D — Grid connected renewable electricity generation');
  kv('Applicability', 'Small-scale solar photovoltaic');
  y += 4;

  // ── 2. Baseline Methodology ────────────────────────────────────────────────
  sectionHeader('2. Baseline Methodology');
  kv('Methodology', 'CDM AMS I.D Rev 19');
  kv('Baseline Type', 'Displaced grid electricity (operating margin + build margin)');
  kv('Emission Factor Source', 'EPA eGRID 2023 Rev 2');
  kv('Dataset Version', calculation.datasetVersion, true);
  kv('Subregion', facility.egridSubregion);
  kv('Formula Version', calculation.formulaVersion, true);
  note('Baseline emission factor represents the CO₂ emission intensity of the regional grid displaced by solar generation. Source: U.S. Environmental Protection Agency eGRID database.');
  y += 4;

  // ── 3. Monitoring Period ───────────────────────────────────────────────────
  sectionHeader('3. Monitoring Period');
  kv('Start Date', formatDate(generationData.dateRange.start));
  kv('End Date', formatDate(generationData.dateRange.end));
  kv('Record Count', `${generationData.records.length} daily entries`);
  kv('Commercial Operation', formatDate(facility.commercialOperationDate));
  kv('Capacity', `${facility.capacityMw} MW AC`);
  y += 4;

  // ── 4. Generation Data ─────────────────────────────────────────────────────
  sectionHeader('4. Generation Data');
  kv('Source File', generationData.fileName);
  kv('File Size', `${(generationData.fileSize / 1024).toFixed(1)} KB`);
  kv('File SHA-256', generationData.fileHash, true);
  kv('Total Generation', `${formatNum(generationData.totalMwh)} MWh`);
  kv('Data Committed', formatDate(generationData.committedAt));
  note('Generation data has been cryptographically hashed upon upload. The SHA-256 hash above serves as a tamper-evident seal for audit purposes.');
  y += 4;

  // ── 5. Emission Factor ─────────────────────────────────────────────────────
  sectionHeader('5. Emission Factor');
  kv('eGRID Subregion', facility.egridSubregion);
  kv('eGRID Rate ID', calculation.egridRateId, true);
  kv('CO₂ Factor', `${calculation.co2LbsPerMwh} lb CO₂ / MWh`);
  kv('Dataset', calculation.datasetVersion, true);
  y += 4;

  // ── 6. Displacement Calculation ────────────────────────────────────────────
  sectionHeader('6. Displacement Calculation');
  kv('Formula', 'CO₂ MT = (Total MWh × CO₂ lb/MWh) ÷ 2,204.62');
  kv('Total MWh', `${formatNum(calculation.totalMwh)} MWh`);
  kv('CO₂ Factor', `${calculation.co2LbsPerMwh} lb/MWh`);
  kv('Divisor', '2,204.62 lb/MT');
  divider();
  kv('Raw CO₂ MT', `${formatNum(calculation.rawMt)} MT CO₂`);
  kv('Adjustment Factor', `${calculation.adjustmentFactor}`);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...BRAND_BLUE);
  checkY(10);
  doc.text(`Adjusted CO₂ MT: ${formatNum(calculation.adjustedMt)} MT`, margin, y);
  y += 10;
  doc.setTextColor(...BRAND_DARK);
  kv('Calculation ID', calculation.id, true);
  kv('Calculated At', formatDate(calculation.calculatedAt));
  kv('Status', calculation.status.toUpperCase());
  y += 4;

  // ── 7. Revenue Projections ─────────────────────────────────────────────────
  sectionHeader('7. Revenue Projections');
  const mt = calculation.adjustedMt;
  const rev7 = projectRevenue(mt, 7);
  const rev20 = projectRevenue(mt, 20);

  // Table
  doc.setFillColor(...BRAND_LIGHT);
  doc.rect(margin, y, contentW, 8, 'F');
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...BRAND_DARK);
  doc.text('Price / MT', margin + 5, y + 5.5);
  doc.text('Gross Revenue', margin + 45, y + 5.5);
  doc.text('Fee (15%)', margin + 90, y + 5.5);
  doc.text('Net Revenue', margin + 135, y + 5.5);
  y += 10;

  function revenueRow(label: string, rev: ReturnType<typeof projectRevenue>) {
    checkY(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...BRAND_DARK);
    doc.text(label, margin + 5, y + 5.5);
    doc.text(formatUSD(rev.grossRevenue), margin + 45, y + 5.5);
    doc.text(formatUSD(rev.feeAmount), margin + 90, y + 5.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...BRAND_GREEN);
    doc.text(formatUSD(rev.netRevenue), margin + 135, y + 5.5);
    doc.setTextColor(...BRAND_DARK);
    y += 8;
  }

  revenueRow('$7 / MT', rev7);
  revenueRow('$20 / MT', rev20);
  doc.setFont('helvetica', 'normal');
  note('Revenue projections are illustrative. Actual prices depend on market conditions. A 15% platform fee is applied to gross revenue to determine net proceeds.');
  y += 4;

  // ── 8. Readiness Summary ───────────────────────────────────────────────────
  if (y > pageH - 60) newPage();
  sectionHeader('8. Readiness Summary');
  kv('Overall Status', readiness.status);
  kv('Blocking Issues', `${readiness.blockingCount}`);
  kv('Validated At', formatDate(readiness.validatedAt));
  y += 3;

  const grouped: Record<string, typeof readiness.checks> = {};
  for (const check of readiness.checks) {
    if (!grouped[check.category]) grouped[check.category] = [];
    grouped[check.category].push(check);
  }

  for (const [category, categoryChecks] of Object.entries(grouped)) {
    checkY(12);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...BRAND_MID);
    doc.text(category.toUpperCase(), margin, y);
    y += 5;

    for (const check of categoryChecks) {
      checkY(7);
      const color: [number, number, number] = check.severity === 'PASS' ? BRAND_GREEN
        : check.severity === 'BLOCK' ? [220, 38, 38] : [217, 119, 6];
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...color);
      doc.text(`[${check.severity}]`, margin + 3, y);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...BRAND_DARK);
      doc.text(check.label, margin + 22, y);
      doc.setTextColor(...BRAND_MID);
      doc.setFont('helvetica', 'italic');
      doc.text(check.message, margin + 22, y + 4, { maxWidth: contentW - 22 });
      y += 10;
    }
    y += 2;
  }

  // ── 9. Cryptographic Verification ─────────────────────────────────────────
  if (y > pageH - 60) newPage();
  sectionHeader('9. Cryptographic Verification');
  kv('Generation File Hash', generationData.fileHash, true);
  note('The SHA-256 hash above was computed from the raw CSV bytes at upload time and is immutable for the lifetime of this calculation. Verify with: sha256sum generation_data.csv');
  y += 4;

  // ── 10. Audit Trail Reference ──────────────────────────────────────────────
  if (y > pageH - 60) newPage();
  sectionHeader('10. Audit Trail Reference');
  kv('Total Events', `${auditLog.length}`);
  y += 3;

  for (const event of auditLog) {
    checkY(7);
    doc.setFontSize(8);
    doc.setFont('courier', 'normal');
    doc.setTextColor(...BRAND_MID);
    doc.text(`${event.timestamp}`, margin, y);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...BRAND_DARK);
    doc.text(event.eventType, margin + 55, y);
    doc.setFont('courier', 'normal');
    doc.setTextColor(...BRAND_MID);
    doc.text(event.id.slice(0, 8) + '…', margin + 115, y);
    y += 5.5;
  }

  y += 6;
  note('The complete audit trail is included in audit_trail.json within the export package. Each event is append-only and contains a full payload for independent verification.');

  return doc.output('blob');
}
