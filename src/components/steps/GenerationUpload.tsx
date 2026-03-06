import React, { useState, useRef } from 'react';
import { Upload, FileText, AlertCircle, CheckCircle2, Clock, Zap, Loader2 } from 'lucide-react';
import { AppState, GenerationData, AuditEvent } from '../../types';
import { parseCsv } from '../../lib/csvParser';
import { getPrimaryBA } from '../../data/egridCrosswalk';
import { sha256Hex } from '../../lib/crypto';
import { createAuditEvent } from '../../lib/auditLog';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { FieldRow } from '../ui/FieldRow';
import { HashDisplay } from '../ui/HashDisplay';

interface Props {
  state: AppState;
  onCommit: (data: GenerationData, event: AuditEvent) => void;
  onNext: () => void;
  onBack: () => void;
}

export function GenerationUpload({ state, onCommit, onNext, onBack }: Props) {
  const [dragging, setDragging] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [preview, setPreview] = useState<{ fileName: string; totalMwh: number; recordCount: number; dateRange: { start: string; end: string }; hash: string; rawContent: string; granularity: 'hourly' | 'daily' } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const ba = state.facility ? getPrimaryBA(state.facility.egridSubregion) : null;
  const gridMixData = state.gridMixData;
  const generationData = state.generationData;

  // EIA fetch status derived from state
  const eiaStatus: 'idle' | 'fetching' | 'success' | 'failed' | 'unsupported' = (() => {
    if (!generationData) return 'idle';
    if (!ba) return 'unsupported';
    if (gridMixData && gridMixData.length > 0) return 'success';
    if (gridMixData && gridMixData.length === 0) return 'failed';
    return 'fetching';
  })();

  async function processFile(file: File) {
    setParsing(true);
    setParseErrors([]);
    setPreview(null);

    const rawContent = await file.text();
    const result = parseCsv(rawContent);

    if (!result.success) {
      setParseErrors(result.errors);
      setParsing(false);
      return;
    }

    const hash = await sha256Hex(rawContent);
    setPreview({
      fileName: file.name,
      totalMwh: result.totalMwh,
      recordCount: result.records.length,
      dateRange: result.dateRange!,
      hash,
      rawContent,
      granularity: result.granularity,
    });
    setParsing(false);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith('.csv')) processFile(file);
  }

  async function handleCommit() {
    if (!preview) return;
    setParsing(true);

    const rawContent = preview.rawContent;
    const result = parseCsv(rawContent);
    if (!result.success) return;

    const hash = await sha256Hex(rawContent);
    const blob = new Blob([rawContent]);

    const data: GenerationData = {
      fileHash: hash,
      fileName: preview.fileName,
      fileSize: blob.size,
      records: result.records,
      totalMwh: result.totalMwh,
      dateRange: result.dateRange!,
      committedAt: new Date().toISOString(),
      rawCsvContent: rawContent,
      granularity: 'daily',
      hourlyRecords: null,
      interpolated: false,
    };

    const event = createAuditEvent('generation_data_uploaded', {
      fileName: data.fileName,
      fileHash: data.fileHash,
      fileSize: data.fileSize,
      totalMwh: data.totalMwh,
      recordCount: data.records.length,
      dateRange: data.dateRange,
    });

    onCommit(data, event);
    setPreview(null);
    setParsing(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Upload size={20} className="text-blue-600" />
        <div>
          <h2 className="text-lg font-semibold text-neutral-900">Step 2 — Generation Data Upload</h2>
          <p className="text-sm text-neutral-500">Upload daily generation CSV and lock it with a SHA-256 hash</p>
        </div>
      </div>

      {generationData && !preview && (
        <>
          <Card
            title="Committed Generation Data"
            subtitle={`File hash locked at: ${new Date(generationData.committedAt).toLocaleString()}`}
          >
            <div className="space-y-0.5">
              <FieldRow label="File Name" value={generationData.fileName} locked />
              <FieldRow label="File Size" value={`${(generationData.fileSize / 1024).toFixed(1)} KB`} locked />
              <FieldRow label="Records" value={`${generationData.records.length} ${generationData.granularity === 'hourly' ? 'hourly' : 'daily'} entries`} locked />
              <FieldRow label="Total Generation" value={`${generationData.totalMwh.toLocaleString(undefined, { maximumFractionDigits: 2 })} MWh`} mono locked />
              <FieldRow label="Date Range" value={`${generationData.dateRange.start} → ${generationData.dateRange.end}`} locked />
            </div>

            {/* Granularity badge */}
            <div className="mt-3 flex items-center gap-2">
              {generationData.granularity === 'hourly' ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <Zap size={11} /> Hourly Data Detected
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                  <Clock size={11} /> Daily Data — Interpolated to Hourly
                </span>
              )}
              {generationData.interpolated && (
                <p className="text-xs text-neutral-500">Daily values distributed across daylight hours using a standard solar profile.</p>
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-neutral-100">
              <HashDisplay hash={generationData.fileHash} label="SHA-256:" />
            </div>
            <div className="mt-4 flex justify-between items-center">
              <Button variant="ghost" size="sm" onClick={() => fileRef.current?.click()}>
                Replace File
              </Button>
              <Button variant="primary" onClick={onNext}>
                Continue to Calculation
              </Button>
            </div>
            <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFileChange} />
          </Card>

          {/* EIA grid mix fetch status */}
          {eiaStatus === 'fetching' && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-blue-50 border border-blue-100 text-sm text-blue-700">
              <Loader2 size={15} className="animate-spin shrink-0" />
              Fetching hourly grid data from EIA for {ba}…
            </div>
          )}
          {eiaStatus === 'success' && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-emerald-50 border border-emerald-100 text-sm text-emerald-700">
              <CheckCircle2 size={15} className="shrink-0" />
              EIA grid mix data loaded — {gridMixData!.length.toLocaleString()} records for {ba}. Hourly marginal calculation ready.
            </div>
          )}
          {eiaStatus === 'failed' && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-amber-50 border border-amber-100 text-sm text-amber-700">
              <AlertCircle size={15} className="shrink-0" />
              EIA data unavailable for {ba}. Calculation will use flat annual rate as fallback.
            </div>
          )}
          {eiaStatus === 'unsupported' && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-neutral-50 border border-neutral-200 text-sm text-neutral-600">
              <AlertCircle size={15} className="shrink-0" />
              No EIA balancing authority for this subregion. Flat annual rate will be used.
            </div>
          )}
        </>
      )}

      {!generationData && !preview && (
        <>
          <Card title="Upload CSV File">
            <div
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
              className={[
                'border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition-colors',
                dragging ? 'border-blue-500 bg-blue-50' : 'border-neutral-300 hover:border-neutral-400 hover:bg-neutral-50',
              ].join(' ')}
            >
              <FileText size={32} className="mx-auto text-neutral-400 mb-3" />
              <p className="text-sm font-medium text-neutral-700">Drop your CSV file here, or click to browse</p>
              <p className="text-xs text-neutral-400 mt-1">Required columns: <span className="font-mono">date</span> (YYYY-MM-DD), <span className="font-mono">mwh</span> (numeric)</p>
              <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFileChange} />
            </div>
            {parsing && (
              <p className="mt-3 text-sm text-neutral-500 text-center">Parsing file…</p>
            )}
          </Card>

          {parseErrors.length > 0 && (
            <Card title="Validation Errors">
              <div className="flex items-start gap-2 mb-3">
                <AlertCircle size={16} className="text-red-500 mt-0.5 shrink-0" />
                <p className="text-sm text-red-700 font-medium">{parseErrors.length} error(s) found — fix and re-upload</p>
              </div>
              <ul className="space-y-1">
                {parseErrors.map((err, i) => (
                  <li key={i} className="text-xs font-mono text-red-600 bg-red-50 rounded px-2 py-1">
                    {err}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card title="CSV Format" className="bg-neutral-50 border-neutral-100">
            <p className="text-xs text-neutral-500 mb-3">Your CSV must have these exact header columns:</p>
            <pre className="text-xs font-mono bg-white border border-neutral-200 rounded p-3 text-neutral-700">
{`date,mwh
2023-01-01,960
2023-01-02,1024
2023-01-03,888`}
            </pre>
            <ul className="mt-3 text-xs text-neutral-500 space-y-1 list-disc list-inside">
              <li>One row per day, no gaps allowed</li>
              <li>Dates must be in YYYY-MM-DD format</li>
              <li>MWh values must be non-negative numbers</li>
              <li>No future dates permitted</li>
              <li>No duplicate dates</li>
            </ul>
          </Card>
        </>
      )}

      {preview && (
        <Card title="Preview — Pending Commit">
          <div className="flex items-start gap-2 mb-4">
            <CheckCircle2 size={16} className="text-emerald-600 mt-0.5 shrink-0" />
            <p className="text-sm text-emerald-700 font-medium">File validated successfully — review and commit</p>
          </div>
          <div className="space-y-0.5">
            <FieldRow label="File Name" value={preview.fileName} />
            <FieldRow label="Records" value={`${preview.recordCount} ${preview.granularity === 'hourly' ? 'hourly' : 'daily'} entries`} />
            <FieldRow label="Total Generation" value={`${preview.totalMwh.toLocaleString(undefined, { maximumFractionDigits: 2 })} MWh`} mono />
            <FieldRow label="Date Range" value={`${preview.dateRange.start} → ${preview.dateRange.end}`} />
          </div>
          <div className="mt-3 flex items-center gap-2">
            {preview.granularity === 'hourly' ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                <Zap size={11} /> Hourly Data Detected
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                <Clock size={11} /> Daily Data — Will Interpolate to Hourly
              </span>
            )}
          </div>
          {preview.granularity === 'daily' && (
            <p className="mt-2 text-xs text-neutral-500">Daily generation values will be distributed across daylight hours using a standard solar profile for hourly marginal calculation.</p>
          )}
          <div className="mt-4 pt-3 border-t border-neutral-100">
            <HashDisplay hash={preview.hash} label="SHA-256 (preview):" />
            <p className="text-xs text-neutral-400 mt-1">This hash will be locked permanently upon commit.</p>
          </div>
          <div className="mt-4 flex justify-between">
            <Button variant="secondary" onClick={() => setPreview(null)}>Cancel</Button>
            <Button variant="primary" loading={parsing} onClick={handleCommit}>
              Commit Generation Data
            </Button>
          </div>
        </Card>
      )}

      <div className="flex justify-between">
        <Button variant="ghost" onClick={onBack}>Back</Button>
        {generationData && !preview && (
          <Button variant="primary" onClick={onNext}>Continue</Button>
        )}
      </div>
    </div>
  );
}
