import { USPVDBFacility } from '../types';

const BASE_URL = 'https://energy.usgs.gov/api/uspvdb/v1';

function mapToFacility(raw: Record<string, unknown>): USPVDBFacility {
  return {
    case_id: Number(raw.case_id ?? raw.caseid ?? 0),
    p_name: String(raw.p_name ?? ''),
    p_state: String(raw.p_state ?? ''),
    p_county: String(raw.p_county ?? ''),
    p_cap_ac: Number(raw.p_cap_ac ?? 0),
    p_cap_dc: Number(raw.p_cap_dc ?? 0),
    ylat: Number(raw.ylat ?? 0),
    xlong: Number(raw.xlong ?? 0),
    p_tech_p: String(raw.p_tech_p ?? ''),
    p_axis: String(raw.p_axis ?? ''),
    p_year: Number(raw.p_year ?? 0),
  };
}

/**
 * Searches USPVDB by project name. Optionally filter by state abbreviation.
 * Returns empty array on failure — does NOT throw.
 */
export async function searchFacilities(
  query: string,
  state?: string
): Promise<USPVDBFacility[]> {
  try {
    const params = new URLSearchParams({ p_name: query });
    if (state) params.set('p_state', state);

    const response = await fetch(`${BASE_URL}/?${params.toString()}`);
    if (!response.ok) throw new Error(`USPVDB returned ${response.status}`);

    const json = await response.json();
    const rows = (Array.isArray(json) ? json : json?.data ?? []) as Array<Record<string, unknown>>;
    return rows.map(mapToFacility);
  } catch (err) {
    console.error('[uspvdb] searchFacilities failed:', err);
    return [];
  }
}

/**
 * Fetches a single facility by USPVDB case_id.
 * Returns null on failure — does NOT throw.
 */
export async function getFacilityById(caseId: number): Promise<USPVDBFacility | null> {
  try {
    const params = new URLSearchParams({ case_id: String(caseId) });
    const response = await fetch(`${BASE_URL}/?${params.toString()}`);
    if (!response.ok) throw new Error(`USPVDB returned ${response.status}`);

    const json = await response.json();
    const rows = (Array.isArray(json) ? json : json?.data ?? []) as Array<Record<string, unknown>>;
    return rows.length > 0 ? mapToFacility(rows[0]) : null;
  } catch (err) {
    console.error('[uspvdb] getFacilityById failed:', err);
    return null;
  }
}
