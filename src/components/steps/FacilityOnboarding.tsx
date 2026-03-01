import React, { useState } from 'react';
import { Building2, Info } from 'lucide-react';
import { AppState, Facility } from '../../types';
import { EGRID_SUBREGIONS, SUBREGION_LABELS, getEmissionFactor } from '../../data/egrid';
import { generateUUID } from '../../lib/crypto';
import { createAuditEvent } from '../../lib/auditLog';
import { AuditEvent } from '../../types';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { FieldRow } from '../ui/FieldRow';

interface Props {
  state: AppState;
  onSave: (facility: Facility, event: AuditEvent) => void;
  onNext: () => void;
}

interface FormValues {
  name: string;
  capacityMw: string;
  egridSubregion: string;
  commercialOperationDate: string;
}

const INITIAL_FORM: FormValues = {
  name: '',
  capacityMw: '',
  egridSubregion: '',
  commercialOperationDate: '',
};

export function FacilityOnboarding({ state, onSave, onNext }: Props) {
  const [form, setForm] = useState<FormValues>(INITIAL_FORM);
  const [errors, setErrors] = useState<Partial<FormValues>>({});
  const [submitting, setSubmitting] = useState(false);

  const facility = state.facility;
  const isEditing = !facility;

  function validate(): boolean {
    const errs: Partial<FormValues> = {};
    if (!form.name.trim()) errs.name = 'Project name is required';
    const mw = parseFloat(form.capacityMw);
    if (!form.capacityMw || isNaN(mw) || mw <= 0) errs.capacityMw = 'Capacity must be a positive number';
    if (!form.egridSubregion) errs.egridSubregion = 'eGRID subregion is required';
    if (!form.commercialOperationDate) errs.commercialOperationDate = 'Commercial operation date is required';
    else {
      const d = new Date(form.commercialOperationDate);
      if (isNaN(d.getTime())) errs.commercialOperationDate = 'Invalid date';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);

    const ef = getEmissionFactor(form.egridSubregion)!;
    const newFacility: Facility = {
      id: generateUUID(),
      name: form.name.trim(),
      capacityMw: parseFloat(form.capacityMw),
      egridSubregion: form.egridSubregion,
      commercialOperationDate: form.commercialOperationDate,
      emissionFactor: ef,
      createdAt: new Date().toISOString(),
    };

    const event = createAuditEvent('facility_created', {
      facilityId: newFacility.id,
      name: newFacility.name,
      egridSubregion: newFacility.egridSubregion,
      co2LbsPerMwh: ef.co2LbsPerMwh,
      datasetVersion: ef.datasetVersion,
    });

    onSave(newFacility, event);
    setSubmitting(false);
  }

  function handleEdit() {
    if (facility) {
      setForm({
        name: facility.name,
        capacityMw: String(facility.capacityMw),
        egridSubregion: facility.egridSubregion,
        commercialOperationDate: facility.commercialOperationDate,
      });
    }
  }

  const selectedEf = form.egridSubregion ? getEmissionFactor(form.egridSubregion) : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Building2 size={20} className="text-blue-600" />
        <div>
          <h2 className="text-lg font-semibold text-neutral-900">Step 1 — Facility Onboarding</h2>
          <p className="text-sm text-neutral-500">Register the solar facility and lock the emission factor</p>
        </div>
      </div>

      {facility && (
        <Card
          title="Registered Facility"
          subtitle={`Facility ID: ${facility.id}`}
          headerRight={
            <Button variant="ghost" size="sm" onClick={handleEdit}>
              Edit
            </Button>
          }
        >
          <div className="space-y-0.5">
            <FieldRow label="Project Name" value={facility.name} locked />
            <FieldRow label="Capacity" value={`${facility.capacityMw} MW AC`} locked />
            <FieldRow label="eGRID Subregion" value={facility.egridSubregion} locked />
            <FieldRow label="Commercial Operation" value={new Date(facility.commercialOperationDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })} locked />
            <FieldRow
              label="CO₂ Factor"
              value={`${facility.emissionFactor.co2LbsPerMwh} lb/MWh`}
              mono
              locked
              secondary={facility.emissionFactor.datasetVersion}
            />
            <FieldRow label="eGRID Rate ID" value={facility.emissionFactor.egridRateId} mono locked />
            <FieldRow label="Created At" value={new Date(facility.createdAt).toLocaleString()} />
          </div>
          <div className="mt-4 pt-4 border-t border-neutral-100 flex justify-end">
            <Button variant="primary" onClick={onNext}>
              Continue to Generation Data
            </Button>
          </div>
        </Card>
      )}

      {isEditing && (
        <Card title="Facility Details">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Project Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Prairie Wolf Solar"
                className="w-full border border-neutral-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Capacity (MW AC) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={form.capacityMw}
                onChange={e => setForm(f => ({ ...f, capacityMw: e.target.value }))}
                placeholder="e.g. 40"
                className="w-full border border-neutral-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              {errors.capacityMw && <p className="mt-1 text-xs text-red-600">{errors.capacityMw}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                eGRID Subregion <span className="text-red-500">*</span>
              </label>
              <select
                value={form.egridSubregion}
                onChange={e => setForm(f => ({ ...f, egridSubregion: e.target.value }))}
                className="w-full border border-neutral-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
              >
                <option value="">Select subregion…</option>
                {EGRID_SUBREGIONS.map(ef => (
                  <option key={ef.subregionCode} value={ef.subregionCode}>
                    {SUBREGION_LABELS[ef.subregionCode] ?? ef.subregionCode} — {ef.co2LbsPerMwh} lb/MWh
                  </option>
                ))}
              </select>
              {errors.egridSubregion && <p className="mt-1 text-xs text-red-600">{errors.egridSubregion}</p>}

              {selectedEf && (
                <div className="mt-2 p-3 bg-blue-50 border border-blue-100 rounded-md">
                  <div className="flex items-start gap-2">
                    <Info size={14} className="text-blue-600 mt-0.5 shrink-0" />
                    <div className="text-xs text-blue-700 space-y-0.5">
                      <p><span className="font-medium">CO₂ Factor:</span> {selectedEf.co2LbsPerMwh} lb CO₂/MWh</p>
                      <p><span className="font-medium">Rate ID:</span> <span className="font-mono">{selectedEf.egridRateId}</span></p>
                      <p><span className="font-medium">Dataset:</span> {selectedEf.datasetVersion}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Commercial Operation Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={form.commercialOperationDate}
                onChange={e => setForm(f => ({ ...f, commercialOperationDate: e.target.value }))}
                className="w-full border border-neutral-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              {errors.commercialOperationDate && (
                <p className="mt-1 text-xs text-red-600">{errors.commercialOperationDate}</p>
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <Button type="submit" variant="primary" size="md" loading={submitting}>
                Register Facility
              </Button>
            </div>
          </form>
        </Card>
      )}

      <Card title="About Emission Factors" className="bg-neutral-50 border-neutral-100">
        <p className="text-xs text-neutral-500 leading-relaxed">
          Emission factors are sourced from the EPA eGRID 2023 Rev 2 dataset and represent the CO₂ output emission
          rate (lb/MWh) for each NERC subregion. Once a facility is registered, the emission factor is locked
          to the active dataset version and cannot be changed without re-registering the facility.
        </p>
      </Card>
    </div>
  );
}
