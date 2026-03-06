import { useState } from 'react';
import { FileDown, Package, FileText, Database, ShieldCheck, ScrollText, CheckCircle2 } from 'lucide-react';
import { AppState, ReportArtifact, AuditEvent } from '../../types';
import { buildExportPackage, downloadExportZip } from '../../lib/zipExport';
import { createAuditEvent } from '../../lib/auditLog';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { FieldRow } from '../ui/FieldRow';
import { HashDisplay } from '../ui/HashDisplay';

interface Props {
  state: AppState;
  onGenerated: (artifact: ReportArtifact, events: AuditEvent[]) => void;
  onBack: () => void;
}

export function ReportExport({ state, onGenerated, onBack }: Props) {
  const [generating, setGenerating] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { reportArtifact, facility } = state;

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    try {
      const artifact = await buildExportPackage(state);

      const genEvent = createAuditEvent('report_generated', {
        reportId: artifact.reportId,
        generatedAt: artifact.generatedAt,
        manifestCount: artifact.manifest.length,
      });

      onGenerated(artifact, [genEvent]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error generating report');
    } finally {
      setGenerating(false);
    }
  }

  async function handleExport() {
    if (!reportArtifact || !facility) return;
    setExporting(true);
    setError(null);
    try {
      await downloadExportZip(reportArtifact, facility.name);

      const exportEvent = createAuditEvent('report_exported', {
        reportId: reportArtifact.reportId,
        exportedAt: new Date().toISOString(),
        facilityName: facility.name,
      });

      onGenerated(reportArtifact, [exportEvent]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error exporting package');
    } finally {
      setExporting(false);
    }
  }

  const zipFileEntries = [
    { icon: FileText, name: 'monitoring_report.pdf', desc: 'CDM AMS I.D formatted report' },
    { icon: Database, name: 'monitoring_report.json', desc: 'Machine-readable report data' },
    { icon: ScrollText, name: 'generation_data.csv', desc: 'Original uploaded generation file' },
    { icon: ShieldCheck, name: 'audit_trail.json', desc: 'Complete append-only event log' },
    { icon: CheckCircle2, name: 'manifest.txt', desc: 'SHA-256 checksums + verify commands' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <FileDown size={20} className="text-blue-600" />
        <div>
          <h2 className="text-lg font-semibold text-neutral-900">Step 5 — Report & Export</h2>
          <p className="text-sm text-neutral-500">Generate PDF and download the complete audit package</p>
        </div>
      </div>

      {/* Report artifact details */}
      {reportArtifact ? (
        <>
          <Card title="Generated Report">
            <div className="space-y-0.5">
              <FieldRow label="Report ID" value={reportArtifact.reportId} mono locked />
              <FieldRow label="Generated At" value={new Date(reportArtifact.generatedAt).toLocaleString()} locked />
              <FieldRow label="Facility" value={facility?.name ?? '—'} locked />
              {state.calculation && (
                <FieldRow
                  label="Calculation Mode"
                  value={state.calculation.mode === 'hourly_marginal' ? 'Hourly Marginal (V2)' : 'Annual Flat Rate (V1)'}
                  locked
                />
              )}
              {state.calculation?.balancingAuthority && (
                <FieldRow label="Balancing Authority" value={state.calculation.balancingAuthority} mono locked />
              )}
              <FieldRow label="Files in Package" value={`${reportArtifact.manifest.length} files`} />
            </div>
          </Card>

          <Card title="Manifest — SHA-256 Checksums">
            <div className="space-y-3">
              {reportArtifact.manifest.map(entry => (
                <div key={entry.filename} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-neutral-700 font-mono">{entry.filename}</span>
                    <span className="text-xs text-neutral-400">{(entry.sizeBytes / 1024).toFixed(1)} KB</span>
                  </div>
                  <HashDisplay hash={entry.sha256} truncate />
                </div>
              ))}
            </div>
          </Card>

          <div className="flex justify-between items-center">
            <Button variant="ghost" onClick={onBack}>Back</Button>
            <div className="flex gap-3">
              <Button variant="secondary" loading={generating} onClick={handleGenerate}>
                Regenerate
              </Button>
              <Button variant="primary" size="lg" loading={exporting} onClick={handleExport}>
                <Package size={16} />
                Download Export ZIP
              </Button>
            </div>
          </div>
        </>
      ) : (
        <>
          <Card title="Export Package Contents">
            <div className="space-y-3">
              {zipFileEntries.map(entry => {
                const Icon = entry.icon;
                return (
                  <div key={entry.name} className="flex items-center gap-3">
                    <Icon size={16} className="text-neutral-400 shrink-0" />
                    <div>
                      <p className="text-sm font-mono font-medium text-neutral-800">{entry.name}</p>
                      <p className="text-xs text-neutral-400">{entry.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          <Card className="bg-blue-50 border-blue-100">
            <p className="text-xs text-blue-700 leading-relaxed">
              The export package includes a tamper-evident manifest with SHA-256 checksums for every file.
              Use the verification commands in <span className="font-mono">manifest.txt</span> to confirm
              file integrity after download.
            </p>
          </Card>

          <div className="flex justify-between items-center">
            <Button variant="ghost" onClick={onBack}>Back</Button>
            <Button variant="primary" size="lg" loading={generating} onClick={handleGenerate}>
              <FileDown size={16} />
              Generate Report
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
