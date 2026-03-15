import { HourlyGridMix } from '../types';

const DELAY_MS = 200;

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** Splits a date range into monthly chunks. */
function splitIntoMonths(startDate: string, endDate: string): Array<{ start: string; end: string }> {
  const chunks: Array<{ start: string; end: string }> = [];
  const start = new Date(startDate + 'T00:00:00Z');
  const end = new Date(endDate + 'T23:00:00Z');

  let cursor = new Date(start);
  while (cursor <= end) {
    const chunkStart = cursor.toISOString().slice(0, 10);
    // End of month
    const lastDay = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 0));
    const chunkEnd = (lastDay > end ? end : lastDay).toISOString().slice(0, 10);
    chunks.push({ start: chunkStart, end: chunkEnd });
    // Advance to first day of next month
    cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1));
  }
  return chunks;
}

/** Formats an ISO date string to EIA period format "YYYY-MM-DDTHH". */
function toEiaPeriod(date: string, hour: number): string {
  return `${date}T${String(hour).padStart(2, '0')}`;
}

interface EiaPageResult {
  data: HourlyGridMix[];
  total: number;
}

async function fetchEiaPage(
  balancingAuthority: string,
  start: string,
  end: string,
  offset: number
): Promise<EiaPageResult> {
  const params = new URLSearchParams({
    frequency: 'hourly',
    'data[0]': 'value',
    'facets[respondent][]': balancingAuthority,
    start: toEiaPeriod(start, 0),
    end: toEiaPeriod(end, 23),
    'sort[0][column]': 'period',
    'sort[0][direction]': 'asc',
    length: '5000',
    offset: String(offset),
  });

  const response = await fetch(
    `/api/eia/electricity/rto/fuel-type-data/data/?${params.toString()}`
  );

  if (!response.ok) {
    throw new Error(`EIA API returned ${response.status}`);
  }

  const json = await response.json();
  const rows = (json?.response?.data ?? []) as Array<Record<string, unknown>>;
  const total = (json?.response?.total as number) ?? 0;

  const data: HourlyGridMix[] = rows.map(row => ({
    period: String(row.period ?? ''),
    respondent: String(row.respondent ?? ''),
    fueltype: String(row.fueltype ?? ''),
    value: Number(row.value ?? 0),
  }));

  return { data, total };
}

/**
 * Fetches hourly grid mix data for a balancing authority over a date range.
 * Handles pagination internally (one month per request, up to 5000 rows/page).
 * Returns empty array on any API failure — does NOT throw.
 */
export async function fetchHourlyGridMix(
  balancingAuthority: string,
  startDate: string,
  endDate: string
): Promise<HourlyGridMix[]> {
  try {
    const months = splitIntoMonths(startDate, endDate);
    const allData: HourlyGridMix[] = [];
    const seen = new Set<string>();

    for (const { start, end } of months) {
      let offset = 0;
      let fetched = 0;
      let total = Infinity;

      while (fetched < total) {
        const result = await fetchEiaPage(balancingAuthority, start, end, offset);
        total = result.total;

        for (const row of result.data) {
          const key = `${row.period}|${row.fueltype}`;
          if (!seen.has(key)) {
            seen.add(key);
            allData.push(row);
          }
        }

        fetched += result.data.length;
        offset += result.data.length;

        if (result.data.length === 0) break;
        if (fetched < total) await delay(DELAY_MS);
      }

      await delay(DELAY_MS);
    }

    return allData;
  } catch (err) {
    console.error('[eia] fetchHourlyGridMix failed:', err);
    return [];
  }
}
