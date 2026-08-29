import {roundKm,wheelStats,type Maintenance,type Reading,type Ride,type State,type Trip} from "./domain";

export type ChartMode="week"|"month";
export type DistanceEvent={date:string;wheelId:string;distance:number};
export type PeriodPoint={date:string;label:string;total:number;[wheelId:string]:string|number};
export type AverageUnit="day"|"week"|"month";
export type RideEntry={
  key:string;ride?:Ride;reading?:Reading;at:string;wheelId:string;name:string;tripId:string|null;
  odometerKm:number|null;distanceKm:number|null;notes:string;warning:string|null;
};

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
  const entries:RideEntry[]=[];
  for(const ride of state.ride){
    let reading=available.has(ride.id)?state.reading.find(item=>item.id===ride.id):undefined;
    if(!reading)reading=(byMoment.get(`${ride.wheelId}|${ride.at}`)??[]).find(item=>available.has(item.id));
    if(reading)available.delete(reading.id);
    const interval=reading?intervalByReading.get(reading.id):undefined;
    entries.push({key:`ride:${ride.id}`,ride,reading,at:ride.at,wheelId:ride.wheelId,name:ride.name,tripId:ride.tripId,odometerKm:reading?.odometerKm??null,distanceKm:reading?interval?.distance??null:ride.distanceKm,notes:ride.notes||reading?.notes||"",warning:interval?.warning??null});
  }
  for(const reading of state.reading)if(available.has(reading.id)){
    const interval=intervalByReading.get(reading.id);
    entries.push({key:`reading:${reading.id}`,reading,at:reading.at,wheelId:reading.wheelId,name:"",tripId:null,odometerKm:reading.odometerKm,distanceKm:interval?.distance??null,notes:reading.notes,warning:interval?.warning??null});
  }
  return entries.sort((a,b)=>Date.parse(b.at)-Date.parse(a.at)||a.key.localeCompare(b.key,"en"));
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

export function periodWindow(mode:ChartMode,offset=0,now=new Date()){
  let start:Date;
  if(mode==="week"){
    const current=new Date(now.getFullYear(),now.getMonth(),now.getDate());
    const mondayOffset=(current.getDay()+6)%7;
    start=addDays(current,-mondayOffset+offset*7);
    return {start,end:addDays(start,6)};
  }
  start=new Date(now.getFullYear(),now.getMonth()+offset,1);
  return {start,end:new Date(start.getFullYear(),start.getMonth()+1,0)};
}

export function periodData(state:State,mode:ChartMode,offset=0,locale="en-US",now=new Date()){
  const {start,end}=periodWindow(mode,offset,now),events=distanceEvents(state);
  const points:PeriodPoint[]=[];
  for(let day=new Date(start);day<=end;day=addDays(day,1)){
    const key=dateKey(day),point:PeriodPoint={date:key,label:mode==="week"?new Intl.DateTimeFormat(locale,{weekday:"short"}).format(day):String(day.getDate()),total:0};
    for(const event of events.filter(e=>e.date===key)){point[event.wheelId]=roundKm(Number(point[event.wheelId]??0)+event.distance);point.total=roundKm(point.total+event.distance);}
    points.push(point);
  }
  const title=mode==="week"
    ?`${new Intl.DateTimeFormat(locale,{month:"short",day:"numeric"}).format(start)} – ${new Intl.DateTimeFormat(locale,{month:"short",day:"numeric",year:"numeric"}).format(end)}`
    :new Intl.DateTimeFormat(locale,{month:"long",year:"numeric"}).format(start);
  return {points,start,end,title,total:roundKm(points.reduce((sum,p)=>sum+p.total,0))};
}

export type Metric="all"|"year"|"month"|"week";
export function metricDistance(state:State,metric:Metric,wheelId="all",now=new Date()){
  const events=distanceEvents(state).filter(e=>wheelId==="all"||e.wheelId===wheelId);
  if(metric==="all")return roundKm(events.reduce((sum,e)=>sum+e.distance,0));
  let start:Date;
  if(metric==="year")start=new Date(now.getFullYear(),0,1);
  else if(metric==="month")start=new Date(now.getFullYear(),now.getMonth(),1);
  else start=periodWindow("week",0,now).start;
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

export function monthlySeries(state:State,locale="en-US"){
  const events=distanceEvents(state),keys=[...new Set(events.map(e=>e.date.slice(0,7)))].sort();
  return keys.map(key=>{
    const [year,month]=key.split("-").map(Number),point:Record<string,string|number>={date:key,label:new Intl.DateTimeFormat(locale,{month:"short",year:"2-digit"}).format(new Date(year,month-1,1)),total:0};
    for(const e of events.filter(item=>item.date.startsWith(key))){point[e.wheelId]=roundKm(Number(point[e.wheelId]??0)+e.distance);point.total=roundKm(Number(point.total)+e.distance);}
    return point;
  });
}

export function cumulativeSeries(state:State){
  const events=distanceEvents(state),byDay=new Map<string,Map<string,number>>();
  for(const e of events){const row=byDay.get(e.date)??new Map<string,number>();row.set(e.wheelId,roundKm((row.get(e.wheelId)??0)+e.distance));byDay.set(e.date,row);}
  const cumulative=new Map<string,number>();
  return [...byDay].sort(([a],[b])=>a.localeCompare(b)).map(([date,row])=>{
    const point:Record<string,string|number>={date,total:0};
    for(const wheel of state.wheel){cumulative.set(wheel.id,roundKm((cumulative.get(wheel.id)??0)+(row.get(wheel.id)??0)));point[wheel.id]=cumulative.get(wheel.id)!;point.total=roundKm(Number(point.total)+Number(point[wheel.id]));}
    return point;
  });
}

export type MaintenanceStatus="completed"|"overdue"|"due"|"upcoming"|"planned";
export function maintenanceStatus(item:Maintenance,state:State,now=new Date()):MaintenanceStatus{
  if(item.completedAt)return "completed";
  const todayKey=dateKey(now),wheel=item.targetKind==="wheel"?state.wheel.find(w=>w.id===item.targetId):undefined;
  const odometer=wheel?wheelStats(wheel,state.reading).odometerKm:null;
  if(item.dueDate&&item.dueDate<todayKey)return "overdue";
  if(item.dueOdometerKm!==null&&odometer!==null&&odometer>=item.dueOdometerKm)return "due";
  if(item.dueDate){const reminder=addDays(dateFromKey(item.dueDate),-(item.remindDaysBefore??0));if(dateKey(reminder)<=todayKey)return "due";return "upcoming";}
  if(item.dueOdometerKm!==null&&odometer!==null&&item.dueOdometerKm-odometer<=Math.max(25,(item.repeatKm??0)*.1))return "upcoming";
  return "planned";
}

export function dueMaintenance(state:State,now=new Date()){
  return state.maintenance.filter(item=>["overdue","due"].includes(maintenanceStatus(item,state,now)));
}
