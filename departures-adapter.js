const PRIM_BASE_URL = 'https://prim.iledefrance-mobilites.fr/marketplace/stop-monitoring';
const LINE_REF_C = 'STIF:Line::C01727:';

export async function fetchRealDepartures(monitoringRef, apiKey) {
  const url = `${PRIM_BASE_URL}?MonitoringRef=${encodeURIComponent(monitoringRef)}&LineRef=${encodeURIComponent(LINE_REF_C)}`;
  const response = await fetch(url, { headers: { apiKey, Accept: 'application/json' } });
  if (!response.ok) { throw new Error(`PRIM API error: ${response.status}`); }
  const data = await response.json();
  return data;
}
