import {roundKm,wheelStats,type Maintenance,type Reading,type Ride,type State,type Trip} from "./domain";
import {formatDateKey,formatMonthKey,readCalendarPreferences,type DateFormat,type WeekStart} from "./calendar";

export type ChartMode="week"|"month";
export type DistanceEvent={date:string;wheelId:string;distance:number};
export type PeriodPoint={date:string;label:string;total:number;[wheelId:string]:string|number};
export type AverageUnit="day"|"week"|"month";
export type RideEntry={
  key:string;ride?:Ride;reading?:Reading;at:string;wheelId:string;name:string;tripId:string|null;
  odometerKm:number|null;distanceKm:number|null;intervalDays:number|null;kmPerDay:number|null;notes:string;warning:string|null;
};
export type RideSortKey="date"|"name"|"wheel"|"odometer"|"distance"|"daily"|"trip"|"notes"|"files";
export type SeriesPoint={date:string;label?:string;total:number;[key:string]:string|number|undefined};

const pad=(n:number)=>String(n).padStart(2,"0");
export const dateKey=(d:Date)=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
export const dateFromKey=(key:string)=>new Date(`${key}T12:00:00`);
const addDays=(d:Date,n:number)=>{const next=new Date(d);next.setDate(next.getDate()+n);return next;};

/** Joins the app's single Ride workflow while preserving separate ride/reading records in storage. */
export function rideEntries(state:State):RideEntry[]{
  const intervalByReading=new Map<string,{reading:Reading;distance:number|null;warning:string|null}>();
  for(const wheel of state.wheel)for(const interval of wheelStats(wheel,state.reading).intervals)intervalByReading.set(interval.reading.id,{reading:interval.reading,distance:interval.distance,warning:interval.warning});
  const available=new Set(state.reading.map(reading=>reading.id)),byMoment=new Map<string,Reading[]>();
  for(const reading of state.reading){const key=`${reading.wheelId}|${reading.at}`,list=byMoment.get(key)??[];list.push(reading);byMoment.set(key,list);}
  const readingById=new Map(state.reading.map(reading=>[reading.id,reading]));
  // Reserve explicit links before trying old timestamp-only associations.
  // A distance-only ride at the same time must not steal another ride's record.
  const exactIds=new Set(state.ride.flatMap(ride=>{
    const reading=readingById.get(ride.id);
    return reading&&reading.wheelId===ride.wheelId&&reading.at===ride.at?[reading.id]:[];
  }));
  const entries:RideEntry[]=[];
  for(const ride of state.ride){
    let reading=available.has(ride.id)&&exactIds.has(ride.id)?readingById.get(ride.id):undefined;
    if(!reading)reading=(byMoment.get(`${ride.wheelId}|${ride.at}`)??[]).find(item=>available.has(item.id)&&!exactIds.has(item.id));
    if(reading)available.delete(reading.id);
    const interval=reading?intervalByReading.get(reading.id):undefined;
    entries.push({key:`ride:${ride.id}`,ride,reading,at:ride.at,wheelId:ride.wheelId,name:ride.name,tripId:ride.tripId,odometerKm:reading?.odometerKm??null,distanceKm:reading?interval?.distance??null:ride.distanceKm,intervalDays:null,kmPerDay:null,notes:ride.notes||reading?.notes||"",warning:interval?.warning??null});
  }
  for(const reading of state.reading)if(available.has(reading.id)){
    const interval=intervalByReading.get(reading.id);
    entries.push({key:`reading:${reading.id}`,reading,at:reading.at,wheelId:reading.wheelId,name:"",tripId:null,odometerKm:reading.odometerKm,distanceKm:interval?.distance??null,intervalDays:null,kmPerDay:null,notes:reading.notes,warning:interval?.warning??null});
  }
  // Use calendar-day gaps, not 24-hour periods: DST must not turn seven days into 6.96.
  // An odometer delta covers the interval from the previous odometer record, even
  // if a distance-only ride was entered in between. Same-day intervals use one day.
  for(const wheel of state.wheel){
    let previousDate=wheel.baselineDate,previousOdometerDate=wheel.baselineDate;
    const ordered=entries.filter(entry=>entry.wheelId===wheel.id).sort((a,b)=>Date.parse(a.at)-Date.parse(b.at)||(a.reading?.sourceOrder??0)-(b.reading?.sourceOrder??0)||a.key.localeCompare(b.key,"en"));
    for(const entry of ordered){
      const day=entry.ride?.localDate??dateKey(new Date(entry.at)),from=entry.reading?previousOdometerDate:previousDate;
      const days=Math.round((Date.parse(`${day}T12:00:00Z`)-Date.parse(`${from}T12:00:00Z`))/86_400_000);
      entry.intervalDays=days>=0?Math.max(1,days):null;
      entry.kmPerDay=entry.distanceKm!==null&&entry.intervalDays!==null?roundKm(entry.distanceKm/entry.intervalDays):null;
      previousDate=day;if(entry.reading)previousOdometerDate=day;
    }
  }
  return entries.sort((a,b)=>Date.parse(b.at)-Date.parse(a.at)||a.key.localeCompare(b.key,"en"));
}

export function sortRideEntries(entries:RideEntry[],state:State,key:RideSortKey,direction:"asc"|"desc"){
  const wheelNames=new Map(state.wheel.map(w=>[w.id,w.name])),tripNames=new Map(state.trip.map(t=>[t.id,t.name])),fileCounts=new Map<string,number>();
  for(const file of state.attachment)if(file.ownerKind==="ride")fileCounts.set(file.ownerId,(fileCounts.get(file.ownerId)??0)+1);
  const value=(entry:RideEntry):string|number=>key==="date"?Date.parse(entry.at):key==="name"?entry.name:key==="wheel"?wheelNames.get(entry.wheelId)??"":key==="odometer"?entry.odometerKm??-1:key==="distance"?entry.distanceKm??-1:key==="daily"?entry.kmPerDay??-1:key==="trip"?tripNames.get(entry.tripId??"")??"":key==="notes"?(hasCellValue(entry.notes)?entry.notes.trim().length:-1):entry.ride?fileCounts.get(entry.ride.id)??0:0;
  return [...entries].sort((a,b)=>{const av=value(a),bv=value(b),comparison=typeof av==="number"&&typeof bv==="number"?av-bv:String(av).localeCompare(String(bv),"en",{numeric:true,sensitivity:"base"});return (direction==="asc"?comparison:-comparison)||Date.parse(b.at)-Date.parse(a.at)||a.key.localeCompare(b.key,"en");});
}

/** Blank and placeholder cells do not add mobile columns or visible filler. */
export function hasCellValue(value:string|number|null|undefined){
  if(typeof value==="number")return Number.isFinite(value)&&value!==0;
  return typeof value==="string"&&!!value.trim()&&!/^[\-–—]+$/.test(value.trim());
}

export function readingForRide(state:State,ride:Ride){return rideEntries(state).find(entry=>entry.ride?.id===ride.id)?.reading;}

/** Trip totals use the same effective Ride distance shown in the unified Ride table. */
export function tripRideStats(trip:Trip,state:State){
  const entries=rideEntries(state).filter(entry=>entry.ride?.tripId===trip.id),rides=entries.flatMap(entry=>entry.ride?[entry.ride]:[]);
  const days=Math.round((Date.parse(`${trip.endDate}T12:00:00Z`)-Date.parse(`${trip.startDate}T12:00:00Z`))/86_400_000)+1;
  const known=entries.filter(entry=>entry.distanceKm!==null),ids=new Set(rides.map(ride=>ride.id));
  return {rides,days,distanceKm:roundKm(known.reduce((sum,entry)=>sum+entry.distanceKm!,0)),unknownDistances:entries.length-known.length,
    attachments:state.attachment.filter(file=>file.ownerKind==="trip"?file.ownerId===trip.id:ids.has(file.ownerId))};
}

/** Odometer intervals remain authoritative; ride distance fills only records without a paired reading. */
export function distanceEvents(state:State):DistanceEvent[]{
  return rideEntries(state).flatMap(entry=>{
    const distance=entry.distanceKm;
    if(distance===null||distance<=0)return [];
    const date=entry.ride?.localDate??dateKey(new Date(entry.at));
    return [{date,wheelId:entry.wheelId,distance}];
  }).sort((a,b)=>a.date.localeCompare(b.date)||a.wheelId.localeCompare(b.wheelId,"en"));
}

export function periodWindow(mode:ChartMode,offset=0,now=new Date(),weekStartsOn:WeekStart=1){
  let start:Date;
  if(mode==="week"){
    const current=new Date(now.getFullYear(),now.getMonth(),now.getDate());
    const mondayOffset=(current.getDay()-weekStartsOn+7)%7;
    start=addDays(current,-mondayOffset+offset*7);
    return {start,end:addDays(start,6)};
  }
  start=new Date(now.getFullYear(),now.getMonth()+offset,1);
  return {start,end:new Date(start.getFullYear(),start.getMonth()+1,0)};
}

export function periodData(state:State,mode:ChartMode,offset=0,locale="en-US",now=new Date(),weekStartsOn:WeekStart=1,dateFormat:DateFormat=readCalendarPreferences().dateFormat){
  const {start,end}=periodWindow(mode,offset,now,weekStartsOn),events=distanceEvents(state);
  const points:PeriodPoint[]=[];
  for(let day=new Date(start);day<=end;day=addDays(day,1)){
    const key=dateKey(day),point:PeriodPoint={date:key,label:mode==="week"?new Intl.DateTimeFormat(locale,{weekday:"short"}).format(day):String(day.getDate()),total:0};
    for(const event of events.filter(e=>e.date===key)){point[event.wheelId]=roundKm(Number(point[event.wheelId]??0)+event.distance);point.total=roundKm(point.total+event.distance);}
    points.push(point);
  }
  const title=mode==="week"
    ?`${formatDateKey(dateKey(start),dateFormat)} – ${formatDateKey(dateKey(end),dateFormat)}`
    :formatMonthKey(dateKey(start).slice(0,7),dateFormat);
  return {points,start,end,title,total:roundKm(points.reduce((sum,p)=>sum+p.total,0))};
}

export type Metric="all"|"year"|"month"|"week";
export function metricDistance(state:State,metric:Metric,wheelId="all",now=new Date(),weekStartsOn:WeekStart=1){
  const events=distanceEvents(state).filter(e=>wheelId==="all"||e.wheelId===wheelId);
  if(metric==="all")return roundKm(events.reduce((sum,e)=>sum+e.distance,0));
  let start:Date;
  if(metric==="year")start=new Date(now.getFullYear(),0,1);
  else if(metric==="month")start=new Date(now.getFullYear(),now.getMonth(),1);
  else start=periodWindow("week",0,now,weekStartsOn).start;
  const from=dateKey(start),to=dateKey(now);
  return roundKm(events.filter(e=>e.date>=from&&e.date<=to).reduce((sum,e)=>sum+e.distance,0));
}

/** Long-term average across every vehicle and every distance record. */
export function averageDistance(state:State,unit:AverageUnit,now=new Date()){
  const total=metricDistance(state,"all","all",now);
  const dates=[...state.wheel.map(wheel=>wheel.baselineDate),...state.reading.map(reading=>dateKey(new Date(reading.at))),...state.ride.map(ride=>ride.localDate??dateKey(new Date(ride.at)))].sort();
  if(!dates.length||total===0)return 0;
  const elapsedDays=Math.max(1,Math.floor((+new Date(`${dateKey(now)}T12:00:00`)-+dateFromKey(dates[0]))/86_400_000)+1);
  const periodDays=unit==="day"?1:unit==="week"?7:365.2425/12;
  return roundKm(total/(elapsedDays/periodDays));
}

export function monthlySeries(state:State,locale="en-US",wheelIds=state.wheel.map(w=>w.id)):SeriesPoint[]{
  const selected=new Set(wheelIds),events=distanceEvents(state).filter(e=>selected.has(e.wheelId)),keys=[...new Set(events.map(e=>e.date.slice(0,7)))].sort();
  return keys.map(key=>{
    const [year,month]=key.split("-").map(Number),point:SeriesPoint={date:key,label:new Intl.DateTimeFormat(locale,{month:"short",year:"2-digit"}).format(new Date(year,month-1,1)),total:0};
    for(const e of events.filter(item=>item.date.startsWith(key))){point[e.wheelId]=roundKm(Number(point[e.wheelId]??0)+e.distance);point.total=roundKm(Number(point.total)+e.distance);}
    return point;
  });
}

export function cumulativeSeries(state:State,wheelIds=state.wheel.map(w=>w.id)):SeriesPoint[]{
  const selected=new Set(wheelIds),events=distanceEvents(state).filter(e=>selected.has(e.wheelId)),byDay=new Map<string,Map<string,number>>();
  for(const e of events){const row=byDay.get(e.date)??new Map<string,number>();row.set(e.wheelId,roundKm((row.get(e.wheelId)??0)+e.distance));byDay.set(e.date,row);}
  const cumulative=new Map<string,number>();
  return [...byDay].sort(([a],[b])=>a.localeCompare(b)).map(([date,row])=>{
    const point:SeriesPoint={date,total:0};
    for(const id of wheelIds){cumulative.set(id,roundKm((cumulative.get(id)??0)+(row.get(id)??0)));point[id]=cumulative.get(id)!;point.total=roundKm(point.total+Number(point[id]));}
    return point;
  });
}

export function dailySeries(state:State,wheelIds=state.wheel.map(w=>w.id)):SeriesPoint[]{
  const selected=new Set(wheelIds),byDay=new Map<string,SeriesPoint>();
  for(const event of distanceEvents(state))if(selected.has(event.wheelId)){
    const point=byDay.get(event.date)??{date:event.date,total:0};
    point[event.wheelId]=roundKm(Number(point[event.wheelId]??0)+event.distance);point.total=roundKm(point.total+event.distance);byDay.set(event.date,point);
  }
  return [...byDay.values()];
}

/** Fit only the visible series in the current zoom window, never hidden totals.
 * Bars retain a truthful zero baseline; lines may zoom their vertical range. */
export function fitChartDomain(points:SeriesPoint[],wheelIds:string[],kind:"line"|"stacked"|"grouped"):[number,number]{
  if(!points.length||!wheelIds.length)return [0,1];
  const values=kind==="stacked"?points.map(point=>wheelIds.reduce((sum,id)=>sum+(Number(point[id])||0),0)):points.flatMap(point=>wheelIds.map(id=>Number(point[id]??0))).filter(Number.isFinite);
  let low=Infinity,high=-Infinity;for(const value of values){low=Math.min(low,value);high=Math.max(high,value);}
  if(!Number.isFinite(high)||high<=0)return [0,1];
  if(kind!=="line")return [0,high*1.05];
  const padding=(high-low||high)*.05;
  return [Math.max(0,low-padding),high+padding];
}

export type MaintenanceStatus="completed"|"overdue"|"due"|"upcoming"|"planned";
export function maintenanceStatus(item:Maintenance,state:State,now=new Date()):MaintenanceStatus{
  if(item.completedAt)return "completed";
  const todayKey=dateKey(now),wheel=item.targetKind==="wheel"?state.wheel.find(w=>w.id===item.targetId):undefined;
  const odometer=wheel?wheelStats(wheel,state.reading).odometerKm:null;
  if(item.dueDate&&item.dueDate<todayKey)return "overdue";
  if(item.dueOdometerKm!==null&&odometer!==null&&odometer>item.dueOdometerKm)return "overdue";
  if(item.dueOdometerKm!==null&&odometer!==null&&odometer>=item.dueOdometerKm)return "due";
  if(item.dueDate){const reminder=addDays(dateFromKey(item.dueDate),-(item.remindDaysBefore??0));if(dateKey(reminder)<=todayKey)return "due";return "upcoming";}
  if(item.dueOdometerKm!==null&&odometer!==null&&item.dueOdometerKm-odometer<=Math.max(25,(item.repeatKm??0)*.1))return "upcoming";
  return "planned";
}

export function dueMaintenance(state:State,now=new Date()){
  return state.maintenance.filter(item=>["overdue","due"].includes(maintenanceStatus(item,state,now)));
}
