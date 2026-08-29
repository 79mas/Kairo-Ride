import {roundKm,wheelStats,type Maintenance,type State} from "./domain";

export type ChartMode="week"|"month";
export type DistanceEvent={date:string;wheelId:string;distance:number};
export type PeriodPoint={date:string;label:string;total:number;[wheelId:string]:string|number};

const pad=(n:number)=>String(n).padStart(2,"0");
export const dateKey=(d:Date)=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
export const dateFromKey=(key:string)=>new Date(`${key}T12:00:00`);
const addDays=(d:Date,n:number)=>{const next=new Date(d);next.setDate(next.getDate()+n);return next;};

/** Odometer intervals are the authoritative distance source. Each interval belongs to its later reading's local day. */
export function distanceEvents(state:State):DistanceEvent[]{
  return state.wheel.flatMap(wheel=>wheelStats(wheel,state.reading).intervals
    .filter(interval=>interval.distance!==null&&interval.distance!>0)
    .map(interval=>({date:dateKey(new Date(interval.reading.at)),wheelId:wheel.id,distance:interval.distance!})))
    .sort((a,b)=>a.date.localeCompare(b.date)||a.wheelId.localeCompare(b.wheelId,"en"));
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
