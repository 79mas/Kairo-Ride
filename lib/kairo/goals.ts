import {canRecordWithWheel, roundKm, type Goal, type State} from "./domain";
import {calendarDayNumber, shiftDateKey, readCalendarPreferences} from "./calendar";
import {dateKey, metricDistance, rideEntries} from "./stats";

export const EARTH_EQUATOR_KM = 40_075;
export type ForecastStatus = "forecast" | "achieved" | "no_activity" | "inactive" | "invalid_history" | "out_of_range";
export type GoalForecast = {
  currentKm: number; remainingKm: number; progressPercent: number; averageKmPerDay: number;
  distanceLast30Km: number; estimatedDate: string | null; status: ForecastStatus; fromDate: string; toDate: string;
};

/** Thirty calendar days INCLUDING today and days with no records.
 * An odometer interval is apportioned evenly over (previous date, record date].
 * A same-day interval counts once on that day. This estimates sparse journals;
 * it never extrapolates unrecorded riding after the last record. */
export function forecastGoal(state: State, goal: Pick<Goal, "targetKm" | "wheelId"> & Partial<Goal>, now = new Date()): GoalForecast {
  const toDate = dateKey(now), fromDate = shiftDateKey(toDate, -29);
  const lastDay = calendarDayNumber(toDate), firstDay = calendarDayNumber(fromDate);
  const window = goalWindow(goal,now);
  const entries = rideEntries(state).filter(entry => goal.wheelId === null || entry.wheelId === goal.wheelId);
  let current = 0, recent = 0, invalid = false;
  for (const entry of entries) {
    const day = entry.ride?.localDate ?? dateKey(new Date(entry.at));
    if (day > toDate) continue; // A future-dated record is not already-achieved mileage.
    if (entry.distanceKm === null || entry.warning || entry.intervalDays === null) {invalid = true; continue;}
    const distance = Math.max(0, entry.distanceKm);
    if(day>=window.start&&day<=window.end)current += distance;
    const end = calendarDayNumber(day);
    if (entry.reading) {
      const days = entry.intervalDays;
      const overlap = Math.max(0, Math.min(end, lastDay) - Math.max(end - days + 1, firstDay) + 1);
      recent += distance * overlap / days;
    } else if (day >= fromDate) recent += distance;
  }
  const currentKm = roundKm(current), remainingKm = roundKm(Math.max(0, goal.targetKm - currentKm));
  const averageKmPerDay = recent / 30;
  const result: GoalForecast = {
    currentKm, remainingKm, progressPercent: goal.targetKm > 0 ? currentKm / goal.targetKm * 100 : 0,
    averageKmPerDay, distanceLast30Km: roundKm(recent), estimatedDate: null,
    status: "no_activity", fromDate, toDate,
  };
  const wheel = goal.wheelId === null ? undefined : state.wheel.find(item => item.id === goal.wheelId);
  if (!Number.isFinite(goal.targetKm) || goal.targetKm <= 0 || invalid || goal.wheelId !== null && !wheel) result.status = "invalid_history";
  else if (!remainingKm) result.status = "achieved";
  else if (wheel && !canRecordWithWheel(wheel)) result.status = "inactive";
  else if (averageKmPerDay > 0) {
    const days = Math.ceil(remainingKm / averageKmPerDay);
    // A tiny historical average must not overflow JS dates or produce a nonsense UI.
    if (Number.isFinite(days) && days <= calendarDayNumber("9999-12-31") - lastDay) {
      result.estimatedDate = shiftDateKey(toDate, days); result.status = "forecast";
    } else result.status = "out_of_range";
  }
  return result;
}

export function earthProgress(state: State) {
  const totalKm = metricDistance(state, "all");
  const percent = totalKm / EARTH_EQUATOR_KM * 100;
  return {totalKm, percent, barPercent: Math.min(100, Math.max(0, percent))};
}

export const defaultEarthGoal:Goal={id:"around-the-earth",name:"Around the Earth",wheelId:null,targetKm:EARTH_EQUATOR_KM,period:"all",createdAt:"2026-01-01T00:00:00Z"};
export function goalWindow(goal:Partial<Goal>,now=new Date()){
  const day=dateKey(now),year=now.getFullYear(),month=now.getMonth();
  if(goal.period==="custom")return {start:goal.startDate??day,end:goal.endDate??day};
  if(goal.period==="week"){
    const start=shiftDateKey(day,-((now.getDay()-readCalendarPreferences().weekStartsOn+7)%7));
    return {start,end:shiftDateKey(start,6)};
  }
  if(goal.period==="month")return {start:dateKey(new Date(year,month,1,12)),end:dateKey(new Date(year,month+1,0,12))};
  if(goal.period==="year")return {start:`${year}-01-01`,end:`${year}-12-31`};
  return {start:"0000-01-01",end:"9999-12-31"};
}
