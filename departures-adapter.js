// departures-adapter.js - confirme par tests reels sur Austerlitz ET Pontoise.
// Remplace buildDepartures() (donnees simulees) par de vrais prochains passages PRIM/IDFM.
//
// Champs confirmes par 2 tests reels (Austerlitz + Pontoise) :
// - code mission (facon GOTA/VETO) = MonitoredVehicleJourney.JourneyNote[0].value (ex: "LOLA", "NORA", "ZORU")
//   (VehicleJourneyName est le numero de train SNCF, ex "147576-147577" - PAS le code mission)
// - direction = MonitoredVehicleJourney.DirectionRef.value :
//     "Aller"  => toujours vers le SUD (confirme coherent sur toute la ligne, Austerlitz ET Pontoise)
//     "Retour" => toujours vers le NORD
//   => dans la convention du prototype (southDir()), Aller = 'B' (Sud), Retour = 'A' (Nord)
// - formation = MonitoredVehicleJourney.VehicleFeatureRef ("longTrain" / "shortTrain")
// - destination = MonitoredVehicleJourney.DestinationName[0].value
// - horaire = MonitoredCall.ExpectedDepartureTime (fallback ExpectedArrivalTime pour un terminus)
// - statut = MonitoredCall.DepartureStatus / ArrivalStatus ("onTime", "delayed", "cancelled"...)
// - quai = MonitoredCall.DeparturePlatformName.value ou ArrivalPlatformName.value

const PRIM_BASE_URL = 'https://prim.iledefrance-mobilites.fr/marketplace/stop-monitoring';
const LINE_REF_C = 'STIF:Line::C01727:'; // confirme dans les reponses reelles

/**
 * @param {string} monitoringRef - ex: "STIF:StopArea:SP:43072:" (voir station-mapping.js)
 * @param {string} apiKey
 * @returns {Promise<Array>} tableau au format attendu par renderList/renderSheet du prototype
 */
export async function fetchRealDepartures(monitoringRef, apiKey) {
  const url = `${PRIM_BASE_URL}?MonitoringRef=${encodeURIComponent(monitoringRef)}&LineRef=${encodeURIComponent(LINE_REF_C)}`;

  const response = await fetch(url, {
    headers: { apiKey, Accept: 'application/json' }
  });

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    const msg = errBody?.Siri?.ServiceDelivery?.StopMonitoringDelivery?.[0]?.ErrorCondition?.ErrorInformation?.ErrorText
      ?? errBody?.message
      ?? `${response.status} ${response.statusText}`;
    throw new Error(`PRIM API error: ${msg}`);
  }

  const data = await response.json();
  const delivery = data?.Siri?.ServiceDelivery?.StopMonitoringDelivery?.[0];
  const visits = delivery?.MonitoredStopVisit ?? [];

  return visits.map(visitToTrain).filter(Boolean).sort((a, b) => a.scheduled - b.scheduled);
}

function visitToTrain(visit) {
  const mvj = visit?.MonitoredVehicleJourney;
  if (!mvj) return null;

  const call = mvj.MonitoredCall;

  const code = mvj.JourneyNote?.[0]?.value ?? mvj.VehicleJourneyName?.[0]?.value ?? '????';
  const dest = mvj.DestinationName?.[0]?.value ?? 'Destination inconnue';

  // Aller = Sud ('B'), Retour = Nord ('A') - confirme sur Austerlitz + Pontoise
  const dirRaw = mvj.DirectionRef?.value ?? '';
  const dir = dirRaw === 'Aller' ? 'B' : 'A';

  const expected = call?.ExpectedDepartureTime ?? call?.ExpectedArrivalTime;
  const aimed = call?.AimedDepartureTime ?? call?.AimedArrivalTime;
  const scheduled = new Date(expected ?? aimed ?? Date.now());

  const rawStatus = call?.DepartureStatus ?? call?.ArrivalStatus ?? 'onTime';
  let status = 'ontime';
  let delay = 0;
  if (rawStatus === 'cancelled') {
    status = 'cancelled';
  } else if (expected && aimed) {
    const diffMin = Math.round((new Date(expected) - new Date(aimed)) / 60000);
    if (diffMin > 0) {
      delay = diffMin;
      status = diffMin >= 10 ? 'verylate' : 'late';
    }
  }

  const platform = call?.DeparturePlatformName?.value ?? call?.ArrivalPlatformName?.value ?? null;
  const isLong = (mvj.VehicleFeatureRef ?? []).includes('longTrain');

  return {
    code,
    dest,
    dir,
    scheduled,
    status,
    delay,
    platform,
    length: isLong ? 'long' : 'court',
    position: { unknown: true, text: null } // position detaillee = etape 2 (GTFS-RT / VehicleMonitoring)
  };
}
