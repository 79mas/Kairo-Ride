"use client";
import {formatNumber} from "@/lib/kairo/numbers";
import {useMemo,useState} from "react";
import {BarChart3,RotateCcw} from "lucide-react";
import {Bar,BarChart,Brush,CartesianGrid,Line,LineChart,ResponsiveContainer,Tooltip,XAxis,YAxis} from "recharts";
import {Button} from "@/components/ui/button";
import {cumulativeSeries,dailySeries,distanceEvents,fitChartDomain,monthlySeries,type SeriesPoint} from "@/lib/kairo/stats";
import {canRecordWithWheel,type State,type Wheel} from "@/lib/kairo/domain";
import {useI18n} from "@/lib/kairo/i18n";
import {formatDateKey,formatMonthKey} from "@/lib/kairo/calendar";
import {orderedVehicles} from "@/lib/kairo/vehicle-status";
import {VehicleStatusBadge} from "./vehicle-status";
import {GoalForecasts} from "./goals";
import type {ViewActions} from "./views";

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

export function AnalyticsView({state,actions}:{state:State;actions?:ViewActions}){
  const {tr,locale}=useI18n(),[hidden,setHidden]=useState<Set<string>>(()=>new Set());
  const visible=state.wheel.filter(wheel=>!hidden.has(wheel.id)),ids=visible.map(wheel=>wheel.id);
  const selection=ids.join("|");
  const series=useMemo(()=>{const selected=state.wheel.filter(w=>!hidden.has(w.id)).map(w=>w.id);return {cumulative:cumulativeSeries(state,selected),monthly:monthlySeries(state,locale,selected),daily:dailySeries(state,selected)};},[state,locale,hidden]);
  const toggle=(id:string)=>setHidden(current=>{const next=new Set(current);if(next.has(id))next.delete(id);else next.add(id);return next;});
  // Remount on a changed selection or range so an old brush cannot pin the new axes.
  const chartKey=(data:SeriesPoint[])=>`${selection}:${data.length}:${data[0]?.date}:${data.at(-1)?.date}`;
  const hasHistory=!!distanceEvents(state).length;
  return <>
    {hasHistory&&<div className="analytics-legend panel"><div><strong>{tr("Visible vehicles","Rodomos priemonės")}</strong><span>{tr("Vehicles appear side by side. Both axes fit the selection. Drag the range handles to zoom; the height refits too. Bar charts always start at zero.","Priemonių stulpeliai rodomi greta. Abi ašys pritaikomos pasirinkimui. Tempiant intervalo kraštus persiskaičiuoja ir aukštis. Stulpelių skalė visada prasideda nuo nulio.")}</span></div><div className="interactive-legend" aria-label={tr("Chart vehicles","Grafiko priemonės")}>{orderedVehicles(state.wheel).map(wheel=><button type="button" key={wheel.id} className={hidden.has(wheel.id)?"":"active"} aria-pressed={!hidden.has(wheel.id)} onClick={()=>toggle(wheel.id)}><i style={{background:wheel.color}}/><span>{wheel.name}</span>{!canRecordWithWheel(wheel)&&<VehicleStatusBadge wheel={wheel} state={state}/>}</button>)}</div></div>}
    {!series.daily.length?<div className="panel analytics-empty"><BarChart3/><p>{hasHistory?tr("Select a vehicle with distance records to display its charts.","Pasirink priemonę su atstumo įrašais, kad matytum jos grafikus."):tr("Add a ride with an odometer above the baseline to see your distance charts.","Pridėk važiavimą, kurio odometras didesnis už pradinį, ir matysi ridos grafikus.")}</p></div>:<div className="analytics-grid">
      <HistoryChart key={`cumulative:${chartKey(series.cumulative)}`} data={series.cumulative} wheels={visible} kind="line" eyebrow={tr("CUMULATIVE","KAUPIAMOJI")} title={tr("Distance over time","Rida per laiką")}/>
      <HistoryChart key={`monthly:${chartKey(series.monthly)}`} data={series.monthly} wheels={visible} kind="monthly" eyebrow={tr("MONTHLY","MĖNESIO")} title={tr("Distance by month","Rida pagal mėnesį")}/>
      <HistoryChart key={`daily:${chartKey(series.daily)}`} data={series.daily} wheels={visible} kind="daily" eyebrow={tr("DAILY HISTORY","DIENOS ISTORIJA")} title={tr("Daily distance by vehicle","Dienos rida pagal priemonę")} wide/>
    </div>}
    <GoalForecasts state={state} actions={actions}/>
  </>;
}
