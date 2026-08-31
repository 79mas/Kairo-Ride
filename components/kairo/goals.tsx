"use client";
import {useState,type FormEvent} from "react";
import {Globe2,Pencil,Plus,Target,Trash2} from "lucide-react";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Progress} from "@/components/ui/progress";
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription,DialogFooter} from "@/components/ui/dialog";
import {toast} from "sonner";
import {Field,Pick} from "./form-fields";
import {VehicleStatusBadge} from "./vehicle-status";
import {DateInput} from "./date-input";
import {defaultEarthGoal,forecastGoal,goalWindow} from "@/lib/kairo/goals";
import {entityKey,formatDate,formatKm,uuid,type Goal,type State} from "@/lib/kairo/domain";
import {vehicleSelectOptions} from "@/lib/kairo/vehicle-status";
import {useI18n} from "@/lib/kairo/i18n";
import type {ViewActions} from "./views";

function goalLabel(goal:Goal,state:State,tr:(en:string,lt:string)=>string){
  const scope=goal.wheelId?state.wheel.find(w=>w.id===goal.wheelId)?.name??tr("Unavailable vehicle","Nepasiekiama priemonė"):tr("all vehicles","visos priemonės");
  const period=goal.period==="week"?tr("this week","ši savaitė"):goal.period==="month"?tr("this month","šis mėnuo"):goal.period==="year"?tr("this year","šie metai"):goal.period==="custom"?formatDate(goal.startDate??"")+" – "+formatDate(goal.endDate??""):tr("all time","visas laikas");
  return (goal.name?.trim()||tr("Distance goal","Ridos tikslas"))+" ("+scope+", "+period+")";
}
export function visibleGoals(state:State){return state.goal.some(g=>g.id===defaultEarthGoal.id)?state.goal:[defaultEarthGoal,...state.goal];}
export function GoalForecasts({state,actions}:{state:State;actions?:ViewActions}){
  const {tr,locale,language}=useI18n();
  const [editing,setEditing]=useState<Goal|null>(null),[parents,setParents]=useState<string[]>([]),[busy,setBusy]=useState(false);
  const goals=visibleGoals(state),selected=goals.some(g=>g.id===actions?.selectedGoal)?actions!.selectedGoal!:defaultEarthGoal.id;
  const open=(goal?:Goal)=>{const next:Goal=goal??{id:uuid(),name:"",targetKm:10000,wheelId:null,period:"all",createdAt:new Date().toISOString()};setEditing({...next});setParents((state.heads.get(entityKey("goal",next.id))??[]).map(r=>r.operationId));};
  async function save(event:FormEvent){event.preventDefault();if(!editing||!actions?.saveGoal)return;setBusy(true);try{await actions.saveGoal(editing,parents);setEditing(null);}catch(error){toast.error(error instanceof Error?error.message:"Could not save goal.");}finally{setBusy(false);}}
  return <section className="goal-section panel"><div className="chart-heading"><div><p className="eyebrow">{tr("NEXT MILESTONES","KITI TIKSLAI")}</p><h2><Target/>{tr("Distance goals","Ridos tikslai")}</h2></div><Button disabled={!actions} onClick={()=>open()}><Plus/>{tr("Add goal","Pridėti tikslą")}</Button></div>
    <Field label={tr("Show in the global progress bar","Rodyti bendroje progreso juostoje")}><Pick label={tr("Global progress goal","Bendros juostos tikslas")} value={selected} onChange={value=>actions?.selectGoal?.(value)} options={goals.map(g=>({value:g.id,label:goalLabel(g,state,tr)}))}/></Field>
    <div className="goal-grid">{goals.map(goal=>{const f=forecastGoal(state,goal),label=goalLabel(goal,state,tr),window=goalWindow(goal);return <article className="goal-card" key={goal.id}><div className="section-heading"><strong>{label}</strong><Button variant="ghost" size="icon" disabled={!actions} onClick={()=>open(goal)} aria-label={tr("Edit goal","Redaguoti tikslą")+": "+label}><Pencil/></Button></div>
      {goal.wheelId&&state.wheel.find(w=>w.id===goal.wheelId)&&<VehicleStatusBadge wheel={state.wheel.find(w=>w.id===goal.wheelId)!} state={state}/>}<div className="goal-distance"><strong>{formatKm(goal.targetKm,locale)}</strong><span>km</span></div>
      <Progress value={Math.min(100,f.progressPercent)} getValueLabel={()=>new Intl.NumberFormat(locale,{maximumFractionDigits:2}).format(f.progressPercent)+"%"} aria-label={label} aria-valuetext={new Intl.NumberFormat(locale,{maximumFractionDigits:2}).format(f.progressPercent)+"%"}/><p>{formatKm(f.currentKm,locale)} / {formatKm(goal.targetKm,locale)} km · {formatKm(f.progressPercent,locale)}%</p>
      <p className="goal-eta">{f.status==="achieved"?tr("Goal reached","Tikslas pasiektas"):f.estimatedDate?tr("Estimated date","Numatoma data")+": "+formatDate(f.estimatedDate,false,undefined,locale):f.status==="inactive"?tr("Forecast paused · vehicle inactive","Prognozė sustabdyta · priemonė neaktyvi"):f.status==="invalid_history"?tr("Check incomplete records","Patikrink nepilnus įrašus"):tr("Not enough recent activity for a forecast","Prognozei nepakanka naujausios veiklos")}</p>
      {f.estimatedDate&&f.estimatedDate>window.end&&<p className="inline-warning">{tr("At this pace, the goal would be reached after this period ends.","Tokiu tempu tikslas būtų pasiektas pasibaigus pasirinktam laikotarpiui.")}</p>}
      <p className="field-hint">{formatKm(f.averageKmPerDay,locale)} km/d · {tr("30-day rolling average","30 dienų slenkantis vidurkis")}</p>
    </article>;})}</div>
    <details className="forecast-explanation"><summary>{tr("How the forecast works","Kaip skaičiuojama prognozė")}</summary><p>{tr("Progress counts records within the selected period. Forecasts use the last 30 calendar days, including zero-distance days. Sparse odometer intervals are spread evenly for this estimate. Week, month and year follow the current calendar period.","Progresas skaičiuojamas pagal pasirinkto laikotarpio įrašus. Prognozei naudojamos paskutinės 30 kalendorinių dienų, įskaitant dienas be ridos. Reti odometro intervalai įverčiui paskirstomi tolygiai. Savaitė, mėnuo ir metai reiškia einamąjį kalendorinį laikotarpį.")}</p></details>
    <Dialog open={!!editing} onOpenChange={open=>{if(!open&&!busy)setEditing(null);}}><DialogContent className="editor-dialog"><DialogHeader><DialogTitle>{tr("Edit distance goal","Redaguoti ridos tikslą")}</DialogTitle><DialogDescription>{tr("Choose a name, scope and period. Save applies your changes.","Pasirink pavadinimą, priemones ir laikotarpį. Pakeitimus pritaikys Išsaugoti.")}</DialogDescription></DialogHeader>{editing&&<form onSubmit={event=>void save(event)} className="entity-form">
      <Field label={tr("Name (optional)","Pavadinimas (neprivalomas)")}><Input maxLength={160} value={editing.name??""} onChange={e=>setEditing({...editing,name:e.target.value})}/></Field>
      <Field label={tr("Goal scope","Tikslo apimtis")}><Pick label={tr("Goal scope","Tikslo apimtis")} value={editing.wheelId??"all"} onChange={value=>setEditing({...editing,wheelId:value==="all"?null:value})} options={[{value:"all",label:tr("All vehicles","Visos priemonės")},...vehicleSelectOptions(state,language).filter(o=>!state.wheel.find(w=>w.id===o.value)?.archived||o.value===editing.wheelId)]}/></Field>
      <Field label={tr("Target distance, km","Tikslinė rida, km")}><Input required type="number" min="0.001" step="any" value={editing.targetKm||""} onChange={e=>setEditing({...editing,targetKm:Number(e.target.value)})}/></Field>
      <Field label={tr("Period","Laikotarpis")}><Pick label={tr("Period","Laikotarpis")} value={editing.period??"all"} onChange={value=>setEditing({...editing,period:value as Goal["period"]})} options={[{value:"week",label:tr("This week","Ši savaitė")},{value:"month",label:tr("This month","Šis mėnuo")},{value:"year",label:tr("This year","Šie metai")},{value:"all",label:tr("All time","Visas laikas")},{value:"custom",label:tr("Specify","Pasirinkti")}]} /></Field>
      {editing.period==="custom"&&<div className="form-grid"><Field label={tr("Start date","Pradžios data")}><DateInput aria-label={tr("Start date","Pradžios data")} required value={editing.startDate??""} onValueChange={value=>setEditing({...editing,startDate:value})}/></Field><Field label={tr("End date","Pabaigos data")}><DateInput aria-label={tr("End date","Pabaigos data")} required min={editing.startDate} value={editing.endDate??""} onValueChange={value=>setEditing({...editing,endDate:value})}/></Field></div>}
      <DialogFooter>{state.goal.some(g=>g.id===editing.id)&&editing.id!==defaultEarthGoal.id&&<Button type="button" variant="destructive" disabled={busy} onClick={()=>{actions?.askDelete("goal",editing);setEditing(null);}}><Trash2/>{tr("Delete","Pašalinti")}</Button>}<Button type="button" variant="outline" disabled={busy} onClick={()=>setEditing(null)}>{tr("Cancel","Atšaukti")}</Button><Button type="submit" disabled={busy}>{tr("Save","Išsaugoti")}</Button></DialogFooter>
    </form>}</DialogContent></Dialog>
  </section>;
}
export function EarthProgress({state,goalId}:{state:State;goalId?:string}){
  const {tr,locale}=useI18n(),goal=visibleGoals(state).find(g=>g.id===(goalId??defaultEarthGoal.id))??defaultEarthGoal,f=forecastGoal(state,goal),label=goalLabel(goal,state,tr);
  return <section className="earth-progress" aria-label={label}><div><span><Globe2/>{label} — {formatKm(goal.targetKm,locale)} km</span><span>{formatKm(f.currentKm,locale)} / {formatKm(goal.targetKm,locale)} km <strong>{new Intl.NumberFormat(locale,{maximumFractionDigits:2}).format(f.progressPercent)}%</strong></span></div><Progress value={Math.min(100,f.progressPercent)} getValueLabel={()=>new Intl.NumberFormat(locale,{maximumFractionDigits:2}).format(f.progressPercent)+"%"} aria-label={label}/></section>;
}
