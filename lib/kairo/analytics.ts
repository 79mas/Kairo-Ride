import {activeState,roundKm,type State} from "./domain";
import {calendarDayNumber,readCalendarPreferences,shiftDateKey,type WeekStart} from "./calendar";
import {dateKey,rideEntries} from "./stats";

export type EstimatedDay={date:string;total:number|null;byVehicle:Record<string,number>;estimated:boolean};
export type TrendPoint={date:string;average30:number|null;average90:number|null;estimated:boolean};
export type GrowthRates={asOf:string|null;kmPerWeek30:number|null;kmPerWeek90:number|null};
export type ComparisonMode="week"|"month"|"year";
export type ComparisonPoint={index:number;label:string;[series:string]:string|number|null};
export type ComparisonLine={id:string;label:string;coveragePercent:number;estimated:boolean;color:string};
export type PeriodComparison={mode:ComparisonMode;points:ComparisonPoint[];lines:ComparisonLine[]};
export type AnalyticsInsights={
  monthChangePercent:number|null;monthCurrentKm:number|null;monthPreviousKm:number|null;
  longestDay:{date:string;distanceKm:number;vehicleName:string;estimated:boolean}|null;
  ridingDaysPerWeek:number|null;ridingDays:number;
  eucTime:{totalMinutes:number;averageSpeedKmh:number|null;timedRides:number;distanceKm:number};
};

type Cell={distance:number;estimated:boolean};
const palette=["#f16305","#13c6e8","#f0b429","#b28dff"];
const MAX_ANALYTICS_DAYS=50_000;
const mapKey=(wheelId:string,day:string)=>`${wheelId}|${day}`;
const validDate=(value:string)=>{const parsed=new Date(`${value}T12:00:00Z`);return Number.isFinite(+parsed)&&parsed.toISOString().slice(0,10)===value;};

/** Builds a calendar-day estimate without dumping a sparse odometer interval
 * onto its final day. Known distance is spread over (previous record, record].
 * A null day means there is no comparable odometer coverage, never zero. */
export function estimatedDailyDistance(state:State,wheelIds=state.wheel.map(wheel=>wheel.id)):EstimatedDay[]{
  state=activeState(state);const selected=new Set(wheelIds),cells=new Map<string,Cell>();let first=Infinity,last=-Infinity;
  const add=(wheelId:string,day:string,distance:number,estimated:boolean)=>{
    if(!selected.has(wheelId))return;const ordinal=calendarDayNumber(day);if(!Number.isFinite(ordinal))return;
    const key=mapKey(wheelId,day),old=cells.get(key);cells.set(key,{distance:(old?.distance??0)+distance,estimated:estimated||!!old?.estimated});
    first=Math.min(first,ordinal);last=Math.max(last,ordinal);
  };
  for(const entry of rideEntries(state)){
    if(entry.distanceKm===null||entry.distanceKm<0||entry.warning||entry.intervalDays===null)continue;
    const end=entry.ride?.localDate??dateKey(new Date(entry.at));
    if(entry.reading){
      const days=Math.max(1,entry.intervalDays);if(days>MAX_ANALYTICS_DAYS)continue;const share=entry.distanceKm/days,endOrdinal=calendarDayNumber(end);
      for(let offset=days-1;offset>=0;offset--)add(entry.wheelId,shiftDateKey(end,-offset),share,days>1);
      if(!Number.isFinite(endOrdinal))continue;
    }else add(entry.wheelId,end,entry.distanceKm,false);
  }
  if(!Number.isFinite(first)||!Number.isFinite(last)||last-first>MAX_ANALYTICS_DAYS)return [];
  const rows:EstimatedDay[]=[];
  for(let ordinal=first;ordinal<=last;ordinal++){
    const day=new Date(ordinal*86_400_000).toISOString().slice(0,10),byVehicle:Record<string,number>={};let total=0,known=false,estimated=false;
    for(const wheelId of wheelIds){const cell=cells.get(mapKey(wheelId,day));if(!cell)continue;known=true;estimated||=cell.estimated;byVehicle[wheelId]=roundKm(cell.distance);total+=cell.distance;}
    rows.push({date:day,total:known?roundKm(total):null,byVehicle,estimated});
  }
  return rows;
}

function rollingValue(days:EstimatedDay[],index:number,length:number):{value:number|null;estimated:boolean}{
  if(index+1<length)return {value:null,estimated:false};const window=days.slice(index-length+1,index+1);
  if(window.some(day=>day.total===null))return {value:null,estimated:window.some(day=>day.estimated)};
  return {value:roundKm(window.reduce((sum,day)=>sum+(day.total??0),0)/length),estimated:window.some(day=>day.estimated)};
}
export function trendSeries(state:State,wheelIds=state.wheel.map(wheel=>wheel.id),now=new Date()):TrendPoint[]{
  const today=dateKey(now),days=estimatedDailyDistance(state,wheelIds).filter(day=>day.date<=today);
  return days.map((day,index)=>{const short=rollingValue(days,index,30),long=rollingValue(days,index,90);return {date:day.date,average30:short.value,average90:long.value,estimated:short.estimated||long.estimated};});
}
export function growthRates(state:State,wheelIds=state.wheel.map(wheel=>wheel.id),now=new Date()):GrowthRates{
  const today=dateKey(now),source=estimatedDailyDistance(state,wheelIds).filter(day=>day.date<=today);if(!source.length)return {asOf:null,kmPerWeek30:null,kmPerWeek90:null};
  const lookup=new Map(source.map(day=>[day.date,day])),days=Array.from({length:90},(_,index)=>{
    const date=shiftDateKey(today,index-89);return lookup.get(date)??{date,total:null,byVehicle:{},estimated:false};
  });
  const short=rollingValue(days,days.length-1,30).value,long=rollingValue(days,days.length-1,90).value;
  return {asOf:source.at(-1)?.date??null,kmPerWeek30:short===null?null:roundKm(short*7),kmPerWeek90:long===null?null:roundKm(long*7)};
}

function utcMonth(year:number,month:number){const date=new Date(Date.UTC(year,month,1,12));return {year:date.getUTCFullYear(),month:date.getUTCMonth()};}
function periodDefinition(mode:ComparisonMode,offset:number,now:Date,weekStartsOn:WeekStart){
  const today=dateKey(now),current=new Date(`${today}T12:00:00Z`);
  if(mode==="week"){
    const start=shiftDateKey(today,-((current.getUTCDay()-weekStartsOn+7)%7)+offset*7);
    return {start,label:`${start} – ${shiftDateKey(start,6)}`,value:(index:number)=>index<7?shiftDateKey(start,index):null,count:7};
  }
  if(mode==="month"){
    const target=utcMonth(current.getUTCFullYear(),current.getUTCMonth()+offset),prefix=`${target.year}-${String(target.month+1).padStart(2,"0")}`;
    return {start:`${prefix}-01`,label:prefix,value:(index:number)=>{const key=`${prefix}-${String(index+1).padStart(2,"0")}`;return validDate(key)?key:null;},count:31};
  }
  const year=current.getUTCFullYear()+offset,keys:string[]=[];for(let day="2024-01-01";day<="2024-12-31";day=shiftDateKey(day,1))keys.push(day.slice(5));
  return {start:`${year}-01-01`,label:String(year),value:(index:number)=>{const key=`${year}-${keys[index]}`;return validDate(key)?key:null;},count:keys.length};
}

/** Current plus three earlier periods, aligned by weekday, month day or
 * calendar month/day. Missing coverage and future dates remain null. */
export function periodComparison(state:State,mode:ComparisonMode,wheelIds=state.wheel.map(wheel=>wheel.id),now=new Date(),weekStartsOn=readCalendarPreferences().weekStartsOn):PeriodComparison{
  const days=estimatedDailyDistance(state,wheelIds),lookup=new Map(days.map(day=>[day.date,day])),today=dateKey(now),definitions=Array.from({length:4},(_,index)=>periodDefinition(mode,-index,now,weekStartsOn));
  const count=Math.max(...definitions.map(item=>item.count)),points:Array<ComparisonPoint>=Array.from({length:count},(_,index)=>({index,label:mode==="week"?String(index+1):mode==="month"?String(index+1):(definitions[0].value(index)?.slice(5)??"")}));
  const lines:ComparisonLine[]=definitions.map((definition,lineIndex)=>{
    const id=`period${lineIndex}`;let cumulative=0,known=0,eligible=0,estimated=false,complete=true;
    for(let index=0;index<count;index++){
      const day=definition.value(index);if(!day||day>today){points[index][id]=null;continue;}eligible++;
      const source=lookup.get(day);if(source?.total===null||!source){complete=false;points[index][id]=null;continue;}
      known++;estimated||=source.estimated;cumulative+=source.total;points[index][id]=complete?roundKm(cumulative):null;
    }
    return {id,label:definition.label,coveragePercent:eligible?known/eligible*100:0,estimated,color:palette[lineIndex%palette.length]};
  });
  return {mode,points,lines};
}

function knownSum(lookup:Map<string,EstimatedDay>,start:string,end:string){let total=0,known=0;for(let day=start;day<=end;day=shiftDateKey(day,1)){const row=lookup.get(day);if(row?.total!==null&&row){total+=row.total;known++;}}return {total:known?roundKm(total):null,known};}
export function analyticsInsights(state:State,now=new Date(),wheelIds=state.wheel.map(wheel=>wheel.id)):AnalyticsInsights{
  const days=estimatedDailyDistance(state,wheelIds).filter(day=>day.date<=dateKey(now)),lookup=new Map(days.map(day=>[day.date,day])),today=dateKey(now),current=new Date(`${today}T12:00:00Z`);
  const currentStart=`${current.getUTCFullYear()}-${String(current.getUTCMonth()+1).padStart(2,"0")}-01`,previous=utcMonth(current.getUTCFullYear(),current.getUTCMonth()-1),previousStart=`${previous.year}-${String(previous.month+1).padStart(2,"0")}-01`;
  const elapsed=current.getUTCDate(),previousLast=new Date(Date.UTC(previous.year,previous.month+1,0,12)).getUTCDate(),comparableDays=Math.min(elapsed,previousLast),dayPart=String(comparableDays).padStart(2,"0");
  const currentEnd=`${current.getUTCFullYear()}-${String(current.getUTCMonth()+1).padStart(2,"0")}-${dayPart}`,previousEnd=`${previous.year}-${String(previous.month+1).padStart(2,"0")}-${dayPart}`;
  const month=knownSum(lookup,currentStart,currentEnd),prior=knownSum(lookup,previousStart,previousEnd);
  const monthChangePercent=month.known===comparableDays&&prior.known===comparableDays&&month.total!==null&&prior.total!==null&&prior.total>0?roundKm((month.total-prior.total)/prior.total*100):null;
  let longest:AnalyticsInsights["longestDay"]=null;
  for(const day of days)for(const [wheelId,distanceKm] of Object.entries(day.byVehicle))if(!longest||distanceKm>longest.distanceKm)
    longest={date:day.date,distanceKm,vehicleName:state.wheel.find(wheel=>wheel.id===wheelId)?.name??"Unknown vehicle",estimated:day.estimated};
  const selected=new Set(wheelIds),from90=shiftDateKey(today,-89),entries=rideEntries(activeState(state)).filter(entry=>selected.has(entry.wheelId)&&entry.ride&&entry.distanceKm!==null&&entry.distanceKm>0&&(entry.ride.localDate??dateKey(new Date(entry.at)))<=today);
  const rideDates=entries.map(entry=>entry.ride?.localDate??dateKey(new Date(entry.at))).filter(day=>day>=from90),ridingDays=new Set(rideDates).size;
  const firstRide=rideDates.sort()[0],spanDays=firstRide?Math.min(90,calendarDayNumber(today)-calendarDayNumber(firstRide)+1):0;
  const ridingDaysPerWeek=spanDays>0?roundKm(Math.min(7,ridingDays/Math.max(1,spanDays/7))):null;
  let totalMinutes=0,distanceKm=0,timedRides=0;
  for(const entry of entries){const duration=entry.ride?.durationMinutes;if(duration===undefined||duration<=0)continue;totalMinutes+=duration;distanceKm+=entry.distanceKm??0;timedRides++;}
  return {monthChangePercent,monthCurrentKm:month.total,monthPreviousKm:prior.total,longestDay:longest,ridingDaysPerWeek,ridingDays,
    eucTime:{totalMinutes:Math.round(totalMinutes),averageSpeedKmh:totalMinutes>0?roundKm(distanceKm/(totalMinutes/60)):null,timedRides,distanceKm:roundKm(distanceKm)}};
}
