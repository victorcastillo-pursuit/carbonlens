import JSZip from 'jszip';
import { AppState, ManifestEntry, ReportArtifact } from '../types';
import { generateMonitoringReportPdf } from './pdfGenerator';
import { auditLogToJson } from './auditLog';
import { sha256HexFromBlob, sha256Hex, generateUUID } from './crypto';

function buildJsonReport(state: AppState): string {
  const { facility, generationData, calculation, readiness } = state;
  return JSON.stringify(
    {
      reportId: state.reportArtifact?.reportId,
      generatedAt: new Date().toISOString(),
      facility,
      generationData: {
        ...generationData,
        rawCsvContent: undefined, // omit raw CSV from JSON (included separately)
      },
      calculation,
      readiness,
    },
    null,
    2
  );
}

function buildManifestText(entries: ManifestEntry[]): string {
  const lines: string[] = [
    'CarbonLens Export Manifest',
    '==========================',
    `Generated: ${new Date().toISOString()}`,
    '',
    'SHA-256 Checksums',
    '-----------------',
  ];

  for (const entry of entries) {
    lines.push(`${entry.sha256}  ${entry.filename}  (${entry.sizeBytes} bytes)`);
  }

  lines.push('');
  lines.push('Verification (Linux/macOS):');
  lines.push('  sha256sum monitoring_report.pdf monitoring_report.json generation_data.csv audit_trail.json');
  lines.push('');
  lines.push('Verification (Windows):');
  for (const entry of entries.filter(e => e.filename !== 'manifest.txt')) {
    lines.push(`  CertUtil -hashfile ${entry.filename} SHA256`);
    lines.push(`  Expected: ${entry.sha256}`);
  }

  return lines.join('\n');
}

export async function buildExportPackage(state: AppState): Promise<ReportArtifact> {
  if (!state.facility || !state.generationData || !state.calculation || !state.readiness) {
    throw new Error('Incomplete state — cannot build export package');
  }

  const reportId = generateUUID();
  const generatedAt = new Date().toISOString();

  // Inject reportId into state snapshot for PDF
  const stateWithId: AppState = {
    ...state,
    reportArtifact: state.reportArtifact
      ? { ...state.reportArtifact, reportId, generatedAt }
      : { reportId, generatedAt, pdfBlob: new Blob(), jsonData: '', csvContent: '', auditJson: '', manifest: [] },
  };

  const pdfBlob = await generateMonitoringReportPdf(stateWithId);
  const csvContent = state.generationData.rawCsvContent;
  const auditJson = auditLogToJson(state.auditLog);
  const jsonData = buildJsonReport(stateWithId);

  // Compute SHA-256 for each file
  const csvBlob = new Blob([csvContent], { type: 'text/csv' });
  const jsonBlob = new Blob([jsonData], { type: 'application/json' });
  const auditBlob = new Blob([auditJson], { type: 'application/json' });

  const [pdfHash, csvHash, jsonHash, auditHash] = await Promise.all([
    sha256HexFromBlob(pdfBlob),
    sha256HexFromBlob(csvBlob),
    sha256HexFromBlob(jsonBlob),
    sha256HexFromBlob(auditBlob),
  ]);

  const manifest: ManifestEntry[] = [
    { filename: 'monitoring_report.pdf', sha256: pdfHash, sizeBytes: pdfBlob.size },
    { filename: 'monitoring_report.json', sha256: jsonHash, sizeBytes: jsonBlob.size },
    { filename: 'generation_data.csv', sha256: csvHash, sizeBytes: csvBlob.size },
    { filename: 'audit_trail.json', sha256: auditHash, sizeBytes: auditBlob.size },
  ];

  const manifestText = buildManifestText(manifest);
  const manifestHash = await sha256Hex(manifestText);
  manifest.push({ filename: 'manifest.txt', sha256: manifestHash, sizeBytes: new Blob([manifestText]).size });

  return {
    reportId,
    generatedAt,
    pdfBlob,
    jsonData,
    csvContent,
    auditJson,
    manifest,
  };
}

export async function downloadExportZip(artifact: ReportArtifact, facilityName: string): Promise<void> {
  const zip = new JSZip();

  zip.file('monitoring_report.pdf', artifact.pdfBlob);
  zip.file('monitoring_report.json', artifact.jsonData);
  zip.file('generation_data.csv', artifact.csvContent);
  zip.file('audit_trail.json', artifact.auditJson);

  const manifestEntries = artifact.manifest.filter(e => e.filename !== 'manifest.txt');
  zip.file('manifest.txt', buildManifestText(manifestEntries));

  const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  const url = URL.createObjectURL(zipBlob);
  const a = document.createElement('a');
  const safeName = facilityName.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
  a.href = url;
  a.download = `carbonlens_${safeName}_${new Date().toISOString().slice(0, 10)}.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
