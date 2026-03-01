import Papa from 'papaparse';
import { GenerationRecord } from '../types';

export interface CsvParseResult {
  success: boolean;
  records: GenerationRecord[];
  errors: string[];
  totalMwh: number;
  dateRange: { start: string; end: string } | null;
}

const REQUIRED_COLUMNS = ['date', 'mwh'];

export function parseCsv(csvContent: string): CsvParseResult {
  const errors: string[] = [];

  const parsed = Papa.parse<Record<string, string>>(csvContent.trim(), {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase(),
  });

  if (parsed.errors.length > 0) {
    const parseErrors = parsed.errors.map(e => `Row ${e.row ?? '?'}: ${e.message}`);
    return { success: false, records: [], errors: parseErrors, totalMwh: 0, dateRange: null };
  }

  const data = parsed.data;

  if (data.length === 0) {
    return { success: false, records: [], errors: ['CSV file is empty'], totalMwh: 0, dateRange: null };
  }

  // Column validation
  const headers = Object.keys(data[0]);
  for (const col of REQUIRED_COLUMNS) {
    if (!headers.includes(col)) {
      errors.push(`Missing required column: "${col}". Found columns: ${headers.join(', ')}`);
    }
  }
  if (errors.length > 0) {
    return { success: false, records: [], errors, totalMwh: 0, dateRange: null };
  }

  const today = new Date();
  today.setHours(23, 59, 59, 999);

  const records: GenerationRecord[] = [];
  const seenDates = new Set<string>();

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const rowNum = i + 2; // 1-indexed + header row

    // Date validation
    const rawDate = (row['date'] ?? '').trim();
    if (!rawDate) {
      errors.push(`Row ${rowNum}: missing date value`);
      continue;
    }

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(rawDate)) {
      errors.push(`Row ${rowNum}: date "${rawDate}" is not in YYYY-MM-DD format`);
      continue;
    }

    const parsedDate = new Date(rawDate + 'T00:00:00Z');
    if (isNaN(parsedDate.getTime())) {
      errors.push(`Row ${rowNum}: date "${rawDate}" is not a valid calendar date`);
      continue;
    }

    if (parsedDate > today) {
      errors.push(`Row ${rowNum}: date "${rawDate}" is in the future`);
      continue;
    }

    // Duplicate date check
    if (seenDates.has(rawDate)) {
      errors.push(`Row ${rowNum}: duplicate date "${rawDate}"`);
      continue;
    }
    seenDates.add(rawDate);

    // MWh validation
    const rawMwh = (row['mwh'] ?? '').trim();
    if (!rawMwh) {
      errors.push(`Row ${rowNum}: missing mwh value`);
      continue;
    }

    const mwh = parseFloat(rawMwh);
    if (isNaN(mwh)) {
      errors.push(`Row ${rowNum}: mwh value "${rawMwh}" is not a number`);
      continue;
    }

    if (mwh < 0) {
      errors.push(`Row ${rowNum}: negative mwh value ${mwh} is not allowed`);
      continue;
    }

    records.push({ date: rawDate, mwh });
  }

  if (errors.length > 0) {
    return { success: false, records: [], errors, totalMwh: 0, dateRange: null };
  }

  if (records.length === 0) {
    return { success: false, records: [], errors: ['No valid records found in CSV'], totalMwh: 0, dateRange: null };
  }

  const sortedDates = records.map(r => r.date).sort();
  const totalMwh = records.reduce((sum, r) => sum + r.mwh, 0);

  return {
    success: true,
    records,
    errors: [],
    totalMwh,
    dateRange: { start: sortedDates[0], end: sortedDates[sortedDates.length - 1] },
  };
}
