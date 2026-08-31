import {canRecordWithWheel, compareReadings, localDateTime, validateEdit, wheelStats, type Reading, type Ride, type State, type Wheel} from "./domain";
import {appPath} from "./paths";
import {readingForRide, rideEntries} from "./stats";

const preferenceKey = (namespace: string) => `kairo-last-record-wheel@${appPath()}:${namespace}`;
export function rememberRecordVehicle(namespace: string, wheelId: string): void {
  try { localStorage.setItem(preferenceKey(namespace), wheelId); } catch { /* Saved records remain the fallback. */ }
}
export function preferredRecordVehicle(state: State, namespace: string): Wheel | undefined {
  let remembered: string | null = null;
  try { remembered = localStorage.getItem(preferenceKey(namespace)); } catch { /* No storage in SSR/private contexts. */ }
  const eligible = state.wheel.filter(canRecordWithWheel);
  const preferred = eligible.find(wheel => wheel.id === remembered);
  if (preferred) return preferred;
  const latest = rideEntries(state).find(entry => eligible.some(wheel => wheel.id === entry.wheelId));
  return eligible.find(wheel => wheel.id === latest?.wheelId) ?? eligible[0];
}
export function recordDistancePreview(state: State, wheelId: string, recordId: string, at: string, odometerText: string, sourceOrder?: number) {
  const wheel = state.wheel.find(item => item.id === wheelId);
  const odometer = Number(odometerText.trim().replace(",", "."));
  if (!wheel || !odometerText.trim() || !Number.isFinite(odometer) || odometer < 0 || !Number.isFinite(Date.parse(at))) return null;
  const record: Reading = {id: recordId, wheelId, at: new Date(at).toISOString(), odometerKm: odometer, notes: "", ...(sourceOrder === undefined ? {} : {sourceOrder})};
  const records = [...state.reading.filter(item => item.id !== recordId), record];
  const result = wheelStats(wheel, records);
  const interval = result.intervals.find(item => item.reading.id === recordId)!;
  const ordered = records.filter(item => item.wheelId === wheelId).sort(compareReadings);
  const index = ordered.findIndex(item => item.id === recordId);
  return {distanceKm: interval.distance, previousKm: interval.from, previousAt: ordered[index - 1]?.at ?? wheel.baselineDate,
    warning: interval.warning ?? (result.trackedKm === null ? "This odometer would break the sequence. Check the records before and after this date." : null)};
}
export function recordInstant(input: string, original?: string): string {
  return original && input === localDateTime(original) ? original : new Date(input).toISOString();
}
/** New rides must have an odometer. Old distance-only archives remain editable
 * without making the user invent an odometer that was never recorded. */
export function validateRideRecord(state: State, ride: Ride, record: Reading | null | undefined): void {
  const existing = state.ride.find(item => item.id === ride.id);
  const previous = existing ? readingForRide(state, existing) : state.reading.find(item => item.id === ride.id);
  if (!record && (!existing || previous)) throw new Error("Enter the complete odometer value for this record.");
  if (!record && existing && (existing.wheelId !== ride.wheelId || existing.at !== ride.at || existing.distanceKm !== ride.distanceKm)) {
    throw new Error("Add an odometer to change the vehicle, date or distance of this legacy record.");
  }
  if (record) {
    if (record.wheelId !== ride.wheelId || record.at !== ride.at) throw new Error("The ride and odometer must refer to the same vehicle and time.");
    validateEdit(state, "reading", record);
  }
  validateEdit(state, "ride", ride);
}
