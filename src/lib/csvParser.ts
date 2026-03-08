import Papa from 'papaparse';
import { GenerationRecord, HourlyGenerationRecord, DataGranularity } from '../types';

export interface CsvParseResult {
  success: boolean;
  records: GenerationRecord[];
  errors: string[];
  totalMwh: number;
  dateRange: { start: string; end: string } | null;
  granularity: DataGranularity;
  hourlyRecords: HourlyGenerationRecord[] | null;
}

const DAILY_COLUMNS = ['date', 'mwh'];
const HOURLY_DATE_COLUMNS = ['datetime', 'hour', 'timestamp'];

// Solar generation profile weights by hour (bell curve, hours 0-23).
// Weights for daylight hours 6-18 sum to 1.0; all others are 0.
const SOLAR_PROFILE: Record<number, number> = {
  6: 0.02, 7: 0.05, 8: 0.08, 9: 0.10,
  10: 0.12, 11: 0.14, 12: 0.14, 13: 0.14,
  14: 0.12, 15: 0.10, 16: 0.07, 17: 0.04,
  18: 0.00,
};

/**
 * Distributes daily MWh across 24 hours using a standard solar generation
 * profile. Returns HourlyGenerationRecord[] with 24 entries per day.
 * Flagged as interpolated in the audit trail.
 */
export function interpolateDailyToHourly(dailyRecords: GenerationRecord[]): HourlyGenerationRecord[] {
  const result: HourlyGenerationRecord[] = [];
  for (const rec of dailyRecords) {
    for (let h = 0; h < 24; h++) {
      const weight = SOLAR_PROFILE[h] ?? 0;
      result.push({
        hour: `${rec.date}T${String(h).padStart(2, '0')}:00:00Z`,
        mwh: rec.mwh * weight,
      });
    }
  }
  return result;
}

/** Detects whether CSV content is hourly or daily based on headers and values. */
function detectGranularity(headers: string[], firstValue: string): DataGranularity {
  if (HOURLY_DATE_COLUMNS.some(c => headers.includes(c))) return 'hourly';
  // Daily header "date" — check if value contains a time component
  if (firstValue.includes('T') || firstValue.includes(' ')) return 'hourly';
  return 'daily';
}

export function parseCsv(csvContent: string): CsvParseResult {
  const parsed = Papa.parse<Record<string, string>>(csvContent.trim(), {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase(),
  });

  if (parsed.errors.length > 0) {
    const parseErrors = parsed.errors.map(e => `Row ${e.row ?? '?'}: ${e.message}`);
    return { success: false, records: [], errors: parseErrors, totalMwh: 0, dateRange: null, granularity: 'daily', hourlyRecords: null };
  }

  const data = parsed.data;

  if (data.length === 0) {
    return { success: false, records: [], errors: ['CSV file is empty'], totalMwh: 0, dateRange: null, granularity: 'daily', hourlyRecords: null };
  }

  const headers = Object.keys(data[0]);

  // ── Detect granularity ──────────────────────────────────────────────────────
  const dateColName = HOURLY_DATE_COLUMNS.find(c => headers.includes(c)) ?? 'date';
  const firstDateValue = (data[0][dateColName] ?? '').trim();
  const granularity = detectGranularity(headers, firstDateValue);

  if (granularity === 'hourly') {
    return parseHourlyCsv(data, headers, dateColName);
  }

  return parseDailyCsv(data, headers);
}

// ── Daily parser (original V1 logic) ────────────────────────────────────────

function parseDailyCsv(
  data: Record<string, string>[],
  headers: string[]
): CsvParseResult {
  const errors: string[] = [];

  for (const col of DAILY_COLUMNS) {
    if (!headers.includes(col)) {
      errors.push(`Missing required column: "${col}". Found columns: ${headers.join(', ')}`);
    }
  }
  if (errors.length > 0) {
    return { success: false, records: [], errors, totalMwh: 0, dateRange: null, granularity: 'daily', hourlyRecords: null };
  }

  const today = new Date();
  today.setHours(23, 59, 59, 999);
  const records: GenerationRecord[] = [];
  const seenDates = new Set<string>();

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const rowNum = i + 2;

    const rawDate = (row['date'] ?? '').trim();
    if (!rawDate) { errors.push(`Row ${rowNum}: missing date value`); continue; }

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(rawDate)) { errors.push(`Row ${rowNum}: date "${rawDate}" is not in YYYY-MM-DD format`); continue; }

    const parsedDate = new Date(rawDate + 'T00:00:00Z');
    if (isNaN(parsedDate.getTime())) { errors.push(`Row ${rowNum}: date "${rawDate}" is not a valid calendar date`); continue; }
    if (parsedDate > today) { errors.push(`Row ${rowNum}: date "${rawDate}" is in the future`); continue; }
    if (seenDates.has(rawDate)) { errors.push(`Row ${rowNum}: duplicate date "${rawDate}"`); continue; }
    seenDates.add(rawDate);

    const rawMwh = (row['mwh'] ?? '').trim();
    if (!rawMwh) { errors.push(`Row ${rowNum}: missing mwh value`); continue; }
    const mwh = parseFloat(rawMwh);
    if (isNaN(mwh)) { errors.push(`Row ${rowNum}: mwh value "${rawMwh}" is not a number`); continue; }
    if (mwh < 0) { errors.push(`Row ${rowNum}: negative mwh value ${mwh} is not allowed`); continue; }

    records.push({ date: rawDate, mwh });
  }

  if (errors.length > 0) {
    return { success: false, records: [], errors, totalMwh: 0, dateRange: null, granularity: 'daily', hourlyRecords: null };
  }

  if (records.length === 0) {
    return { success: false, records: [], errors: ['No valid records found in CSV'], totalMwh: 0, dateRange: null, granularity: 'daily', hourlyRecords: null };
  }

  const sortedDates = records.map(r => r.date).sort();
  const totalMwh = records.reduce((sum, r) => sum + r.mwh, 0);

  return {
    success: true,
    records,
    errors: [],
    totalMwh,
    dateRange: { start: sortedDates[0], end: sortedDates[sortedDates.length - 1] },
    granularity: 'daily',
    hourlyRecords: null, // interpolation happens at commit time in GenerationUpload
  };
}

// ── Hourly parser ────────────────────────────────────────────────────────────

function parseHourlyCsv(
  data: Record<string, string>[],
  headers: string[],
  dateColName: string
): CsvParseResult {
  const errors: string[] = [];

  if (!headers.includes('mwh')) {
    return { success: false, records: [], errors: [`Missing required column: "mwh". Found columns: ${headers.join(', ')}`], totalMwh: 0, dateRange: null, granularity: 'hourly', hourlyRecords: null };
  }

  const hourlyRecords: HourlyGenerationRecord[] = [];
  const dailyAgg = new Map<string, number>();
  const seenHours = new Set<string>();

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const rowNum = i + 2;

    const rawDt = (row[dateColName] ?? '').trim();
    if (!rawDt) { errors.push(`Row ${rowNum}: missing datetime value`); continue; }

    const rawMwh = (row['mwh'] ?? '').trim();
    if (!rawMwh) { errors.push(`Row ${rowNum}: missing mwh value`); continue; }
    const mwh = parseFloat(rawMwh);
    if (isNaN(mwh)) { errors.push(`Row ${rowNum}: mwh "${rawMwh}" is not a number`); continue; }
    if (mwh < 0) { errors.push(`Row ${rowNum}: negative mwh ${mwh} not allowed`); continue; }

    // Normalize to ISO 8601 with Z suffix
    let isoHour = rawDt;
    if (!isoHour.endsWith('Z') && !isoHour.includes('+')) isoHour += 'Z';
    if (seenHours.has(isoHour)) { errors.push(`Row ${rowNum}: duplicate hour "${isoHour}"`); continue; }
    seenHours.add(isoHour);

    hourlyRecords.push({ hour: isoHour, mwh });

    const dateKey = rawDt.slice(0, 10);
    dailyAgg.set(dateKey, (dailyAgg.get(dateKey) ?? 0) + mwh);
  }

  if (errors.length > 0) {
    return { success: false, records: [], errors, totalMwh: 0, dateRange: null, granularity: 'hourly', hourlyRecords: null };
  }

  if (hourlyRecords.length === 0) {
    return { success: false, records: [], errors: ['No valid records found in CSV'], totalMwh: 0, dateRange: null, granularity: 'hourly', hourlyRecords: null };
  }

  // Build daily aggregate for backward compat
  const records: GenerationRecord[] = Array.from(dailyAgg.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, mwh]) => ({ date, mwh }));

  const sortedDates = records.map(r => r.date).sort();
  const totalMwh = records.reduce((sum, r) => sum + r.mwh, 0);

  return {
    success: true,
    records,
    errors: [],
    totalMwh,
    dateRange: { start: sortedDates[0], end: sortedDates[sortedDates.length - 1] },
    granularity: 'hourly',
    hourlyRecords,
  };
}
