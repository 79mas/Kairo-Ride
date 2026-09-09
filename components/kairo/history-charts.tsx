"use client";
import {formatNumber} from "@/lib/kairo/numbers";
import {useMemo,useState} from "react";
import {Activity,BarChart3,Clock3,RotateCcw,TrendingUp,Trophy} from "lucide-react";
import {Bar,BarChart,Brush,CartesianGrid,Cell,Line,LineChart,ResponsiveContainer,Tooltip,XAxis,YAxis} from "recharts";
import {Button} from "@/components/ui/button";
import {cumulativeSeries,dailySeries,distanceEvents,fitChartDomain,monthlySeries,type SeriesPoint} from "@/lib/kairo/stats";
import {canRecordWithWheel,type State,type Wheel} from "@/lib/kairo/domain";
import {useI18n} from "@/lib/kairo/i18n";
import {formatDateKey,formatMonthKey,validDateKey} from "@/lib/kairo/calendar";
import {orderedVehicles} from "@/lib/kairo/vehicle-status";
import {VehicleStatusBadge} from "./vehicle-status";
import {GoalForecasts} from "./goals";
import type {ViewActions} from "./views";
import {analyticsInsights,growthRates,periodComparison,trendSeries,type PeriodComparison,type TrendPoint} from "@/lib/kairo/analytics";

const tooltipStyle={background:"#111217",border:"1px solid #2c2e34",borderRadius:10,color:"#f5f3ef"};

function HistoryChart({data,wheels,kind,title,eyebrow,wide=false}:{data:SeriesPoint[];wheels:Wheel[];kind:"line"|"monthly"|"daily";title:string;eyebrow:string;wide?:boolean}){
  const {tr,dateFormat}=useI18n(),[zoom,setZoom]=useState<{startIndex:number;endIndex:number}|null>(null);
  const startIndex=Math.max(0,Math.min(zoom?.startIndex??0,data.length-1)),endIndex=Math.max(startIndex,Math.min(zoom?.endIndex??data.length-1,data.length-1));
  const domain=fitChartDomain(data.slice(startIndex,endIndex+1),wheels.map(w=>w.id),kind==="line"?"line":"grouped");
  const axisKey="date",Chart=kind==="line"?LineChart:BarChart;
  const dateLabel=(value:string)=>kind==="monthly"?formatMonthKey(value,dateFormat):formatDateKey(value,dateFormat);
  const numberFormat={format:(value:number)=>formatNumber(value,{notation:"compact",maximumFractionDigits:1})};
  return <section className={`analytics-card panel${wide?" analytics-wide":""}`}>
    <div className="chart-heading"><div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2></div><Button variant="ghost" size="sm" disabled={!zoom} onClick={()=>setZoom(null)} aria-label={`${tr("Reset zoom","Atkurti mastelį")} · ${title}`}><RotateCcw/>{tr("Fit","Sutalpinti")}</Button></div>
    <ResponsiveContainer width="100%" height={wide?360:340}>
      <Chart data={data} accessibilityLayer margin={{top:12,right:10,left:0,bottom:5}}>
        <CartesianGrid stroke="#292b31" vertical={false}/>
        <XAxis dataKey={axisKey} tickFormatter={dateLabel} tick={{fill:"#8e9098",fontSize:10}} minTickGap={24} padding={kind==="line"?{left:8,right:8}:undefined}/>
        <YAxis domain={domain} allowDataOverflow width={46} tickCount={5} tick={{fill:"#8e9098",fontSize:10}} tickFormatter={value=>numberFormat.format(value)}/>
        <Tooltip formatter={value=>formatNumber(Number(value))} contentStyle={tooltipStyle} labelFormatter={label=>dateLabel(String(label))}
          cursor={kind==="line"?{stroke:"rgba(255,255,255,.12)",strokeDasharray:"3 4"}:{fill:"rgba(255,255,255,.035)"}}/>
        {wheels.map(wheel=>kind==="line"?<Line key={wheel.id} type="monotone" dataKey={wheel.id} name={wheel.name} stroke={wheel.color} strokeWidth={2.5} dot={endIndex===startIndex} activeDot={{r:4,stroke:"#202126",strokeWidth:2}} connectNulls isAnimationActive={false}/>:<Bar key={wheel.id} dataKey={wheel.id} name={wheel.name} fill={wheel.color} radius={[2,2,0,0]} activeBar={{fillOpacity:.9,stroke:"rgba(255,255,255,.14)"}} isAnimationActive={false}/>)}
        {data.length>1&&<Brush dataKey={axisKey} tickFormatter={dateLabel} height={24} stroke="#696b74" fill="#16171c" travellerWidth={12} gap={1} startIndex={startIndex} endIndex={endIndex} onChange={range=>{if(range.startIndex!==undefined&&range.endIndex!==undefined)setZoom({startIndex:range.startIndex,endIndex:range.endIndex});}}/>}
      </Chart>
    </ResponsiveContainer>
  </section>;
}

const valueDomain=(values:(number|null)[],zero=false):[number,number]=>{
  const known=values.filter((value):value is number=>value!==null&&Number.isFinite(value));if(!known.length)return [0,1];
  const low=Math.min(...known),high=Math.max(...known),padding=(high-low||high||1)*.06;
  return zero?[0,Math.max(1,high+padding)]:[Math.max(0,low-padding),Math.max(1,high+padding)];
};
const durationLabel=(minutes:number)=>minutes<60?`${minutes} min`:`${Math.floor(minutes/60)} h ${minutes%60?`${minutes%60} min`:""}`.trim();

function Insights({state,wheelIds}:{state:State;wheelIds:string[]}){
  const {tr,dateFormat}=useI18n(),insights=useMemo(()=>analyticsInsights(state,new Date(),wheelIds),[state,wheelIds]);
  const change=insights.monthChangePercent,changeText=change===null?tr("Month comparison unavailable","Mėnesių palyginimui nepakanka duomenų"):change>=0?tr(`This month: ${formatNumber(change)}% more than the same days last month`,`Šį mėnesį: ${formatNumber(change)}% daugiau nei tomis pačiomis praėjusio mėnesio dienomis`):tr(`This month: ${formatNumber(Math.abs(change))}% less than the same days last month`,`Šį mėnesį: ${formatNumber(Math.abs(change))}% mažiau nei tomis pačiomis praėjusio mėnesio dienomis`);
  const longest=insights.longestDay;
  return <section className="analytics-insights"><div className="analytics-subheading"><p className="eyebrow">INSIGHTS</p><h2>{tr("At a glance","Vienu žvilgsniu")}</h2></div><div className="insight-grid">
    <article className="insight-card"><TrendingUp/><span>{tr("Month pace","Mėnesio tempas")}</span><strong>{changeText}</strong><small>{insights.monthCurrentKm===null?tr("No comparable coverage","Nėra palyginamos aprėpties"):`${formatNumber(insights.monthCurrentKm)} km · ${tr("month to date","nuo mėnesio pradžios")}`}</small></article>
    <article className="insight-card"><Trophy/><span>{tr("Longest day","Ilgiausia diena")}</span><strong>{longest?`${formatNumber(longest.distanceKm)} km · ${longest.vehicleName}`:tr("Not available","Nėra duomenų")}</strong><small>{longest?`${formatDateKey(longest.date,dateFormat)}${longest.estimated?` · ${tr("estimated from an odometer interval","įvertinta iš odometro intervalo")}`:""}`:tr("A known distance day is required","Reikia žinomos dienos ridos")}</small></article>
    <article className="insight-card"><Activity/><span>{tr("Riding frequency","Važiavimo dažnis")}</span><strong>{insights.ridingDaysPerWeek===null?tr("Not available","Nėra duomenų"):`${formatNumber(insights.ridingDaysPerWeek)} ${tr("days / week","dienos / savaitę")}`}</strong><small>{tr("Recorded ride dates in the last 90 days","Įvestos važiavimų datos per paskutines 90 dienų")}</small></article>
    <article className="insight-card"><Clock3/><span>{tr("EUC time","EUC laikas")}</span><strong>{insights.eucTime.timedRides?`${durationLabel(insights.eucTime.totalMinutes)} · ${formatNumber(insights.eucTime.averageSpeedKmh??0)} km/h`:tr("Add time to a ride","Pridėk važiavimo laiką")}</strong><small>{insights.eucTime.timedRides?`${insights.eucTime.timedRides} ${tr("timed rides · weighted average speed","važiavimai su laiku · svertinis vidutinis greitis")}`:tr("Missing time is never estimated","Trūkstamas laikas nėra spėjamas")}</small></article>
  </div></section>;
}

function TrendChart({data}:{data:TrendPoint[]}){
  const {tr,dateFormat}=useI18n(),values=data.flatMap(point=>[point.average30,point.average90]),domain=valueDomain(values);
  return <section className="analytics-card panel analytics-wide"><div className="chart-heading"><div><p className="eyebrow">TREND</p><h2>{tr("Short- and long-term intensity","Trumpalaikis ir ilgalaikis intensyvumas")}</h2></div></div>
    <p className="chart-note">{tr("Rolling kilometres per calendar day. Sparse odometer intervals are distributed evenly; unknown coverage stays blank.","Slenkantys kilometrai per kalendorinę dieną. Reti odometro intervalai paskirstomi tolygiai, nežinoma aprėptis lieka tuščia.")}</p><div className="trend-legend"><span><i style={{background:"#f16305"}}/>{tr("30-day average","30 dienų vidurkis")}</span><span><i style={{background:"#13c6e8"}}/>{tr("90-day average","90 dienų vidurkis")}</span></div>
    <ResponsiveContainer width="100%" height={340}><LineChart data={data} accessibilityLayer margin={{top:12,right:12,left:0,bottom:5}}><CartesianGrid stroke="#292b31" vertical={false}/><XAxis dataKey="date" tickFormatter={value=>formatDateKey(value,dateFormat)} tick={{fill:"#8e9098",fontSize:10}} minTickGap={34}/><YAxis domain={domain} allowDataOverflow width={46} tick={{fill:"#8e9098",fontSize:10}} tickFormatter={value=>formatNumber(value,{notation:"compact",maximumFractionDigits:1})}/><Tooltip contentStyle={tooltipStyle} labelFormatter={value=>formatDateKey(String(value),dateFormat)} formatter={(value,name)=>[`${formatNumber(Number(value))} km/d`,name==="average30"?tr("30-day average","30 dienų vidurkis"):tr("90-day average","90 dienų vidurkis")]} cursor={{stroke:"rgba(255,255,255,.12)",strokeDasharray:"3 4"}}/><Line type="monotone" dataKey="average30" name={tr("30-day average","30 dienų vidurkis")} stroke="#f16305" strokeWidth={2.8} dot={false} activeDot={{r:4,stroke:"#202126",strokeWidth:2}} connectNulls={false} isAnimationActive={false}/><Line type="monotone" dataKey="average90" name={tr("90-day average","90 dienų vidurkis")} stroke="#13c6e8" strokeWidth={2.4} dot={false} activeDot={{r:4,stroke:"#202126",strokeWidth:2}} connectNulls={false} isAnimationActive={false}/>{data.length>90&&<Brush dataKey="date" tickFormatter={value=>formatDateKey(value,dateFormat)} height={24} stroke="#696b74" fill="#16171c" travellerWidth={12}/>}</LineChart></ResponsiveContainer>
  </section>;
}

function GrowthChart({state,wheelIds}:{state:State;wheelIds:string[]}){
  const {tr,dateFormat}=useI18n(),rates=useMemo(()=>growthRates(state,wheelIds),[state,wheelIds]),data=[{label:tr("Last 30 days","Paskutinės 30 dienų"),value:rates.kmPerWeek30,color:"#f16305"},{label:tr("Last 90 days","Paskutinės 90 dienų"),value:rates.kmPerWeek90,color:"#13c6e8"}];
  return <section className="analytics-card panel"><div className="chart-heading"><div><p className="eyebrow">GROWTH RATE</p><h2>{tr("Average kilometres added per week","Vidutiniškai pridedama kilometrų per savaitę")}</h2></div></div><p className="chart-note">{rates.asOf?`${tr("Known data through","Žinomi duomenys iki")} ${formatDateKey(rates.asOf,dateFormat)}`:tr("No comparable coverage","Nėra palyginamos aprėpties")}</p><ResponsiveContainer width="100%" height={280}><BarChart data={data} accessibilityLayer margin={{top:18,right:12,left:0,bottom:8}}><CartesianGrid stroke="#292b31" vertical={false}/><XAxis dataKey="label" tick={{fill:"#8e9098",fontSize:10}}/><YAxis domain={[0,"auto"]} width={46} tick={{fill:"#8e9098",fontSize:10}} tickFormatter={value=>formatNumber(value,{notation:"compact",maximumFractionDigits:1})}/><Tooltip contentStyle={tooltipStyle} formatter={value=>value===null?tr("Unknown","Nežinoma"):`${formatNumber(Number(value))} km/week`} cursor={{fill:"rgba(255,255,255,.035)"}}/><Bar dataKey="value" name={tr("Average km/week","Vidutiniškai km/sav.")} radius={[4,4,0,0]} isAnimationActive={false}>{data.map(item=><Cell key={item.label} fill={item.color}/>)}</Bar></BarChart></ResponsiveContainer></section>;
}

function ComparisonChart({comparison,wide=false}:{comparison:PeriodComparison;wide?:boolean}){
  const {tr,locale,dateFormat,weekStartsOn}=useI18n(),available=comparison.lines.filter(line=>line.coveragePercent>0),values=comparison.points.flatMap(point=>available.map(line=>typeof point[line.id]==="number"?point[line.id] as number:null)),domain=valueDomain(values,true);
  const title=comparison.mode==="week"?tr("This and previous weeks","Ši ir ankstesnės savaitės"):comparison.mode==="month"?tr("This and previous months","Šis ir ankstesni mėnesiai"):tr("This and previous years","Šie ir ankstesni metai");
  const tick=(value:string|number)=>{if(comparison.mode==="week")return new Intl.DateTimeFormat(locale,{weekday:"short",timeZone:"UTC"}).format(new Date(Date.UTC(2024,0,7+((weekStartsOn+Number(value)-1)%7))));if(comparison.mode==="year"){const key=`2024-${String(value)}`;if(!validDateKey(key))return "—";return new Intl.DateTimeFormat(locale,{month:"short",day:"numeric",timeZone:"UTC"}).format(new Date(`${key}T12:00:00Z`));}return String(value);};
  const label=(raw:string)=>comparison.mode==="week"?raw.split(" – ").map(value=>formatDateKey(value,dateFormat)).join(" – "):comparison.mode==="month"?formatMonthKey(raw,dateFormat):raw;
  return <section className={`analytics-card panel${wide?" analytics-wide":""}`}><div className="chart-heading"><div><p className="eyebrow">PERIOD PACE</p><h2>{title}</h2></div></div><div className="comparison-legend">{comparison.lines.map(line=><span className={line.coveragePercent?"":"unavailable"} key={line.id}><i style={{background:line.color}}/>{label(line.label)} <small>{formatNumber(line.coveragePercent,{maximumFractionDigits:0})}% {tr("coverage","aprėptis")}</small></span>)}</div><ResponsiveContainer width="100%" height={wide?350:300}><LineChart data={comparison.points} accessibilityLayer margin={{top:12,right:12,left:0,bottom:5}}><CartesianGrid stroke="#292b31" vertical={false}/><XAxis dataKey="label" tickFormatter={tick} tick={{fill:"#8e9098",fontSize:10}} minTickGap={comparison.mode==="year"?34:10}/><YAxis domain={domain} allowDataOverflow width={46} tick={{fill:"#8e9098",fontSize:10}} tickFormatter={value=>formatNumber(value,{notation:"compact",maximumFractionDigits:1})}/><Tooltip contentStyle={tooltipStyle} formatter={(value,name)=>[`${formatNumber(Number(value))} km`,label(String(name))]} labelFormatter={value=>tick(String(value??""))} cursor={{stroke:"rgba(255,255,255,.12)",strokeDasharray:"3 4"}}/>{available.map((line,index)=><Line key={line.id} type="monotone" dataKey={line.id} name={line.label} stroke={line.color} strokeWidth={index?2:3} strokeDasharray={index?`${8-index} 4`:undefined} dot={false} activeDot={{r:4,stroke:"#202126",strokeWidth:2}} connectNulls={false} isAnimationActive={false}/>)}</LineChart></ResponsiveContainer><p className="chart-note">{tr("Each line accumulates distance from that period's start. Missing coverage and future dates are not converted to zero.","Kiekviena linija kaupia ridą nuo laikotarpio pradžios. Trūkstama aprėptis ir būsimos datos nepaverčiamos nuliais.")}</p></section>;
}

export function AnalyticsView({state,actions}:{state:State;actions?:ViewActions}){
  const {tr,locale,weekStartsOn}=useI18n(),[hidden,setHidden]=useState<Set<string>>(()=>new Set());
  const visible=state.wheel.filter(wheel=>!hidden.has(wheel.id)),ids=visible.map(wheel=>wheel.id);
  const selection=ids.join("|");
  const series=useMemo(()=>{const selected=state.wheel.filter(w=>!hidden.has(w.id)).map(w=>w.id);return {cumulative:cumulativeSeries(state,selected),monthly:monthlySeries(state,locale,selected),daily:dailySeries(state,selected)};},[state,locale,hidden]);
  const advanced=useMemo(()=>{const selected=selection?selection.split("|"):[];return {trend:trendSeries(state,selected),week:periodComparison(state,"week",selected,new Date(),weekStartsOn),month:periodComparison(state,"month",selected,new Date(),weekStartsOn),year:periodComparison(state,"year",selected,new Date(),weekStartsOn)};},[state,selection,weekStartsOn]);
  const toggle=(id:string)=>setHidden(current=>{const next=new Set(current);if(next.has(id))next.delete(id);else next.add(id);return next;});
  // Remount on a changed selection or range so an old brush cannot pin the new axes.
  const chartKey=(data:SeriesPoint[])=>`${selection}:${data.length}:${data[0]?.date}:${data.at(-1)?.date}`;
  const hasHistory=!!distanceEvents(state).length;
  return <>
    <Insights state={state} wheelIds={ids}/>
    {hasHistory&&<div className="analytics-legend panel"><div><strong>{tr("Visible vehicles","Rodomos priemonės")}</strong><span>{tr("Vehicles appear side by side. Both axes fit the selection. Drag the range handles to zoom; the height refits too. Bar charts always start at zero.","Priemonių stulpeliai rodomi greta. Abi ašys pritaikomos pasirinkimui. Tempiant intervalo kraštus persiskaičiuoja ir aukštis. Stulpelių skalė visada prasideda nuo nulio.")}</span></div><div className="interactive-legend" aria-label={tr("Chart vehicles","Grafiko priemonės")}>{orderedVehicles(state.wheel).map(wheel=><button type="button" key={wheel.id} className={hidden.has(wheel.id)?"":"active"} aria-pressed={!hidden.has(wheel.id)} onClick={()=>toggle(wheel.id)}><i style={{background:wheel.color}}/><span>{wheel.name}</span>{!canRecordWithWheel(wheel)&&<VehicleStatusBadge wheel={wheel} state={state}/>}</button>)}</div></div>}
    {!series.daily.length?<div className="panel analytics-empty"><BarChart3/><p>{hasHistory?tr("Select a vehicle with distance records to display its charts.","Pasirink priemonę su atstumo įrašais, kad matytum jos grafikus."):tr("Add a ride with an odometer above the baseline to see your distance charts.","Pridėk važiavimą, kurio odometras didesnis už pradinį, ir matysi ridos grafikus.")}</p></div>:<div className="analytics-grid">
      <HistoryChart key={`cumulative:${chartKey(series.cumulative)}`} data={series.cumulative} wheels={visible} kind="line" eyebrow={tr("CUMULATIVE","KAUPIAMOJI")} title={tr("Distance over time","Rida per laiką")}/>
      <HistoryChart key={`monthly:${chartKey(series.monthly)}`} data={series.monthly} wheels={visible} kind="monthly" eyebrow={tr("MONTHLY","MĖNESIO")} title={tr("Distance by month","Rida pagal mėnesį")}/>
      <HistoryChart key={`daily:${chartKey(series.daily)}`} data={series.daily} wheels={visible} kind="daily" eyebrow={tr("DAILY HISTORY","DIENOS ISTORIJA")} title={tr("Daily distance by vehicle","Dienos rida pagal priemonę")} wide/>
      <TrendChart data={advanced.trend}/>
      <GrowthChart state={state} wheelIds={ids}/>
      <ComparisonChart comparison={advanced.week}/>
      <ComparisonChart comparison={advanced.month}/>
      <ComparisonChart comparison={advanced.year} wide/>
    </div>}
    <GoalForecasts state={state} actions={actions}/>
  </>;
}
