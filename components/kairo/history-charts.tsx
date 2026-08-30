"use client";
import {useMemo,useState} from "react";
import {BarChart3,RotateCcw} from "lucide-react";
import {Bar,BarChart,Brush,CartesianGrid,Line,LineChart,ResponsiveContainer,Tooltip,XAxis,YAxis} from "recharts";
import {Button} from "@/components/ui/button";
import {cumulativeSeries,dailySeries,distanceEvents,fitChartDomain,monthlySeries,type SeriesPoint} from "@/lib/kairo/stats";
import type {State,Wheel} from "@/lib/kairo/domain";
import {useI18n} from "@/lib/kairo/i18n";

const tooltipStyle={background:"#111217",border:"1px solid #2c2e34",borderRadius:10,color:"#f5f3ef"};

function HistoryChart({data,wheels,kind,title,eyebrow,wide=false}:{data:SeriesPoint[];wheels:Wheel[];kind:"line"|"monthly"|"daily";title:string;eyebrow:string;wide?:boolean}){
  const {tr,locale}=useI18n(),[zoom,setZoom]=useState<{startIndex:number;endIndex:number}|null>(null);
  const startIndex=Math.max(0,Math.min(zoom?.startIndex??0,data.length-1)),endIndex=Math.max(startIndex,Math.min(zoom?.endIndex??data.length-1,data.length-1));
  const domain=fitChartDomain(data.slice(startIndex,endIndex+1),wheels.map(w=>w.id),kind==="line"?"line":"stacked");
  const axisKey=kind==="monthly"?"label":"date",Chart=kind==="line"?LineChart:BarChart;
  const numberFormat=new Intl.NumberFormat(locale,{notation:"compact",maximumFractionDigits:1});
  return <section className={`analytics-card panel${wide?" analytics-wide":""}`}>
    <div className="chart-heading"><div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2></div><Button variant="ghost" size="sm" disabled={!zoom} onClick={()=>setZoom(null)} aria-label={`${tr("Reset zoom","Atkurti mastelį")} · ${title}`}><RotateCcw/>{tr("Fit","Sutalpinti")}</Button></div>
    <ResponsiveContainer width="100%" height={wide?360:340}>
      <Chart data={data} accessibilityLayer margin={{top:12,right:10,left:0,bottom:5}}>
        <CartesianGrid stroke="#292b31" vertical={false}/>
        <XAxis dataKey={axisKey} tick={{fill:"#8e9098",fontSize:10}} minTickGap={24} padding={kind==="line"?{left:8,right:8}:undefined}/>
        <YAxis domain={domain} allowDataOverflow width={46} tickCount={5} tick={{fill:"#8e9098",fontSize:10}} tickFormatter={value=>numberFormat.format(value)}/>
        <Tooltip contentStyle={tooltipStyle}/>
        {wheels.map(wheel=>kind==="line"?<Line key={wheel.id} type="monotone" dataKey={wheel.id} name={wheel.name} stroke={wheel.color} strokeWidth={2.5} dot={endIndex===startIndex} connectNulls isAnimationActive={false}/>:<Bar key={wheel.id} dataKey={wheel.id} name={wheel.name} stackId="distance" fill={wheel.color} radius={[2,2,0,0]} isAnimationActive={false}/>)}
        {data.length>1&&<Brush dataKey={axisKey} height={24} stroke="#f16305" fill="#16171c" travellerWidth={12} gap={1} startIndex={startIndex} endIndex={endIndex} onChange={range=>{if(range.startIndex!==undefined&&range.endIndex!==undefined)setZoom({startIndex:range.startIndex,endIndex:range.endIndex});}}/>}
      </Chart>
    </ResponsiveContainer>
  </section>;
}

export function AnalyticsView({state}:{state:State}){
  const {tr,locale}=useI18n(),[hidden,setHidden]=useState<Set<string>>(()=>new Set());
  const visible=state.wheel.filter(wheel=>!hidden.has(wheel.id)),ids=visible.map(wheel=>wheel.id);
  const selection=ids.join("|");
  const series=useMemo(()=>{const selected=state.wheel.filter(w=>!hidden.has(w.id)).map(w=>w.id);return {cumulative:cumulativeSeries(state,selected),monthly:monthlySeries(state,locale,selected),daily:dailySeries(state,selected)};},[state,locale,hidden]);
  const toggle=(id:string)=>setHidden(current=>{const next=new Set(current);if(next.has(id))next.delete(id);else next.add(id);return next;});
  // Remount on a changed selection or range so an old brush cannot pin the new axes.
  const chartKey=(data:SeriesPoint[])=>`${selection}:${data.length}:${data[0]?.date}:${data.at(-1)?.date}`;
  if(!distanceEvents(state).length)return <div className="panel analytics-empty"><BarChart3/><h2>{tr("Your distance history starts with a ride","Atstumo istorija prasideda važiavimu")}</h2><p>{tr("Add a ride distance or a final odometer value above the baseline to see your charts.","Pridėk važiavimo atstumą arba galutinį odometrą, didesnį už pradinį, ir matysi grafikus.")}</p></div>;
  return <>
    <div className="analytics-legend panel"><div><strong>{tr("Visible vehicles","Rodomos priemonės")}</strong><span>{tr("Both axes fit the selected vehicles. Drag the range handles to zoom; the height refits too. Bar charts always start at zero.","Abi ašys pritaikomos pasirinktoms priemonėms. Tempiant intervalo kraštus persiskaičiuoja ir aukštis. Stulpelių skalė visada prasideda nuo nulio.")}</span></div><div className="interactive-legend" aria-label={tr("Chart vehicles","Grafiko priemonės")}>{state.wheel.map(wheel=><button type="button" key={wheel.id} className={hidden.has(wheel.id)?"":"active"} aria-pressed={!hidden.has(wheel.id)} onClick={()=>toggle(wheel.id)}><i style={{background:wheel.color}}/><span>{wheel.name}</span></button>)}</div></div>
    {!series.daily.length?<div className="panel analytics-empty"><BarChart3/><p>{tr("Select a vehicle with distance records to display its charts.","Pasirink priemonę su atstumo įrašais, kad matytum jos grafikus.")}</p></div>:<div className="analytics-grid">
      <HistoryChart key={`cumulative:${chartKey(series.cumulative)}`} data={series.cumulative} wheels={visible} kind="line" eyebrow={tr("CUMULATIVE","KAUPIAMOJI")} title={tr("Distance over time","Rida per laiką")}/>
      <HistoryChart key={`monthly:${chartKey(series.monthly)}`} data={series.monthly} wheels={visible} kind="monthly" eyebrow={tr("MONTHLY","MĖNESIO")} title={tr("Distance by month","Rida pagal mėnesį")}/>
      <HistoryChart key={`daily:${chartKey(series.daily)}`} data={series.daily} wheels={visible} kind="daily" eyebrow={tr("DAILY HISTORY","DIENOS ISTORIJA")} title={tr("Daily distance by vehicle","Dienos rida pagal priemonę")} wide/>
    </div>}
  </>;
}
