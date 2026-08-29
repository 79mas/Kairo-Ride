"use client";
import {useState,type FormEvent,type ReactNode} from "react";
import {Check,LoaderCircle,TriangleAlert} from "lucide-react";
import {toast} from "sonner";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Textarea} from "@/components/ui/textarea";
import {Label} from "@/components/ui/label";
import {DialogFooter} from "@/components/ui/dialog";
import {Select,SelectTrigger,SelectValue,SelectContent,SelectItem} from "@/components/ui/select";
import {GEAR_CATEGORIES,GEAR_STATUSES,gearCategoryLabels,gearStatusLabels,formatKm,localDateTime,today,uuid,wheelStats,type Entity,type Gear,type Kind,type State} from "@/lib/kairo/domain";
import {friendlyError} from "@/lib/kairo/storage";
export type EditableKind=Exclude<Kind,"attachment">;
export type Editor={kind:EditableKind;entity?:Entity;parents:string[];tripId?:string;namespace:string};
export const titles:Record<EditableKind,string>={wheel:"Vienaratis",reading:"Odometro rodmuo",ride:"Pasivažinėjimas",trip:"Kelionė",gear:"Ekipuotė"};
export function Field({label,children,hint}:{label:string;children:ReactNode;hint?:string}){return <div className="field"><Label>{label}</Label>{children}{hint&&<p className="field-hint">{hint}</p>}</div>;}
export function Pick({value,onChange,options,label}:{value:string;onChange:(v:string)=>void;options:{value:string;label:string}[];label:string}){return <Select value={value||undefined} onValueChange={onChange}><SelectTrigger aria-label={label} className="form-select"><SelectValue placeholder="Pasirink…"/></SelectTrigger><SelectContent>{options.map(o=><SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent></Select>;}
export function EntityForm({editor,state,busy,onSave,onCancel}:{editor:Editor;state:State;busy:boolean;onSave:(value:Entity)=>Promise<void>;onCancel:()=>void}){
  const entity=editor.entity;
  const [id]=useState(()=>entity?.id??uuid());
  const [name,setName]=useState(entity&&"name"in entity?entity.name:"");
  const [notes,setNotes]=useState(entity&&"notes"in entity?entity.notes:"");
  const [wheelId,setWheelId]=useState(entity&&"wheelId"in entity?entity.wheelId:state.wheel[0]?.id??"");
  const [at,setAt]=useState(localDateTime(entity&&"at"in entity?entity.at:undefined));
  const [distance,setDistance]=useState(entity&&"distanceKm"in entity?entity.distanceKm===null?"":String(entity.distanceKm):"");
  const [odometer,setOdometer]=useState(entity&&"odometerKm"in entity?String(entity.odometerKm):"");
  const [tripId,setTripId]=useState(entity&&"tripId"in entity?entity.tripId??"none":editor.tripId??"none");
  const [startDate,setStartDate]=useState(entity&&"startDate"in entity?entity.startDate:today());
  const [endDate,setEndDate]=useState(entity&&"endDate"in entity?entity.endDate:today());
  const [baseline,setBaseline]=useState(entity&&"baselineKm"in entity?String(entity.baselineKm):"0");
  const [baselineDate,setBaselineDate]=useState(entity&&"baselineDate"in entity?entity.baselineDate:today());
  const [color,setColor]=useState(entity&&"color"in entity?entity.color:"#127c67");
  const gear=editor.kind==="gear"?entity as Gear|undefined:undefined;
  const [category,setCategory]=useState<Gear["category"]>(gear?.category??"helmet");
  const [gearStatus,setGearStatus]=useState<Gear["status"]>(gear?.status??"active");
  const [brand,setBrand]=useState(gear?.brand??"");
  const [model,setModel]=useState(gear?.model??"");
  const [size,setSize]=useState(gear?.size??"");
  const [purchasedOn,setPurchasedOn]=useState(gear?.purchasedOn??"");
  const trip=state.trip.find(t=>t.id===tripId);
  const outside=trip&&(at.slice(0,10)<trip.startDate||at.slice(0,10)>trip.endDate);
  const number=(v:string)=>{if(!v.trim())throw new Error("Įvesk skaičių.");const n=Number(v.replace(",","."));if(!Number.isFinite(n)||n<0)throw new Error("Įvesk teigiamą skaičių arba nulį.");return n;};
  function submit(e:FormEvent){e.preventDefault();try{
    let value:Entity;
    const unchangedAt=!!entity&&"at"in entity&&at===localDateTime(entity.at);
    const recordAt=unchangedAt&&entity&&"at"in entity?entity.at:new Date(at).toISOString();
    if(editor.kind==="wheel")value={id,name,baselineKm:number(baseline),baselineDate,color,notes};
    else if(editor.kind==="trip")value={id,name,startDate,endDate,notes};
    else if(editor.kind==="gear")value={id,name,category,status:gearStatus,brand,model,size,purchasedOn:purchasedOn||null,notes};
    else if(editor.kind==="reading")value={id,wheelId,at:recordAt,odometerKm:number(odometer),notes,...(entity&&"sourceOrder"in entity?{sourceOrder:entity.sourceOrder}:{})};
    else value={id,name,wheelId,at:recordAt,distanceKm:distance.trim()?number(distance):null,tripId:tripId==="none"?null:tripId,notes,localDate:unchangedAt&&entity&&"localDate"in entity&&entity.localDate?entity.localDate:at.slice(0,10),timeZone:unchangedAt&&entity&&"timeZone"in entity&&entity.timeZone?entity.timeZone:Intl.DateTimeFormat().resolvedOptions().timeZone};
    void onSave(value);
  }catch(e){toast.error(friendlyError(e));}}
  return <form onSubmit={submit} className="entity-form">
    {editor.kind!=="reading"&&<Field label={editor.kind==="wheel"?"Vienaračio pavadinimas":"Pavadinimas"}><Input aria-label="Pavadinimas" autoFocus required maxLength={160} value={name} onChange={e=>setName(e.target.value)} placeholder={editor.kind==="trip"?"Pvz., savaitgalis pajūryje":editor.kind==="wheel"?"Pvz., LeaperKim Lynx":editor.kind==="gear"?"Pvz., kelioninis šalmas arba Cardo":"Pvz., vakarinis ratas"}/></Field>}
    {(editor.kind==="reading"||editor.kind==="ride")&&<><Field label="Vienaratis"><Pick label="Vienaratis" value={wheelId} onChange={setWheelId} options={state.wheel.map(w=>({value:w.id,label:w.name}))}/></Field><Field label="Data ir laikas" hint={`Šio įrenginio laiko juosta: ${Intl.DateTimeFormat().resolvedOptions().timeZone}.`}><Input aria-label="Data ir laikas" type="datetime-local" required value={at} onChange={e=>setAt(e.target.value)}/></Field></>}
    {editor.kind==="reading"&&<Field label="Odometras, km" hint={state.wheel.find(w=>w.id===wheelId)?`Paskutinis žinomas: ${formatKm(wheelStats(state.wheel.find(w=>w.id===wheelId)!,state.reading).odometerKm)} km. Galima įterpti ir ankstesnį rodmenį.`:undefined}><Input aria-label="Odometras kilometrais" autoFocus inputMode="decimal" required value={odometer} onChange={e=>setOdometer(e.target.value)} placeholder="0,0"/></Field>}
    {editor.kind==="ride"&&<><Field label="Pasivažinėjimo atstumas, km" hint="Neprivaloma. Šis atstumas antrą kartą nepridedamas prie odometro ridos."><Input aria-label="Pasivažinėjimo atstumas" inputMode="decimal" value={distance} onChange={e=>setDistance(e.target.value)} placeholder="Gali palikti tuščią"/></Field><Field label="Kelionė"><Pick value={tripId} onChange={setTripId} label="Kelionė" options={[{value:"none",label:"Atskiras pasivažinėjimas"},...state.trip.map(t=>({value:t.id,label:t.name}))]}/></Field>{outside&&<p className="inline-warning"><TriangleAlert/>Data nepatenka į kelionės intervalą. Patikslink kelionės datas.</p>}</>}
    {editor.kind==="trip"&&<div className="form-grid"><Field label="Pradžios data"><Input aria-label="Kelionės pradžia" type="date" required value={startDate} onChange={e=>{setStartDate(e.target.value);if(endDate<e.target.value)setEndDate(e.target.value);}}/></Field><Field label="Pabaigos data"><Input aria-label="Kelionės pabaiga" type="date" required min={startDate} value={endDate} onChange={e=>setEndDate(e.target.value)}/></Field></div>}
    {editor.kind==="wheel"&&<><div className="form-grid"><Field label="Pradinis odometras, km"><Input aria-label="Pradinis odometras" inputMode="decimal" required value={baseline} onChange={e=>setBaseline(e.target.value)}/></Field><Field label="Pradinio rodmens data"><Input aria-label="Pradinio rodmens data" type="date" required value={baselineDate} onChange={e=>setBaselineDate(e.target.value)}/></Field></div><Field label="Vienaračio spalva"><Input aria-label="Vienaračio spalva" type="color" value={color} onChange={e=>setColor(e.target.value)} className="color-input"/></Field></>}
    {editor.kind==="gear"&&<><div className="form-grid"><Field label="Kategorija"><Pick label="Ekipuotės kategorija" value={category} onChange={v=>setCategory(v as Gear["category"])} options={GEAR_CATEGORIES.map(value=>({value,label:gearCategoryLabels[value]}))}/></Field><Field label="Būsena"><Pick label="Ekipuotės būsena" value={gearStatus} onChange={v=>setGearStatus(v as Gear["status"])} options={GEAR_STATUSES.map(value=>({value,label:gearStatusLabels[value]}))}/></Field><Field label="Gamintojas"><Input aria-label="Gamintojas" maxLength={160} value={brand} onChange={e=>setBrand(e.target.value)} placeholder="Neprivaloma"/></Field><Field label="Modelis"><Input aria-label="Modelis" maxLength={160} value={model} onChange={e=>setModel(e.target.value)} placeholder="Neprivaloma"/></Field><Field label="Dydis"><Input aria-label="Dydis" maxLength={60} value={size} onChange={e=>setSize(e.target.value)} placeholder="Pvz., L arba 43"/></Field><Field label="Įsigijimo data"><Input aria-label="Įsigijimo data" type="date" value={purchasedOn} onChange={e=>setPurchasedOn(e.target.value)}/></Field></div><p className="field-hint">Privalomi tik pavadinimas, kategorija ir būsena. Seną ekipuotę gali pažymėti kaip nebenaudojamą, išsaugodamas jos istoriją.</p></>}
    <Field label="Pastabos"><Textarea aria-label="Pastabos" rows={3} maxLength={20000} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Kas svarbu prisiminti…"/></Field>
    <DialogFooter><Button type="button" variant="outline" disabled={busy} onClick={onCancel}>Atšaukti</Button><Button type="submit" disabled={busy}>{busy?<LoaderCircle className="spin"/>:<Check/>}Išsaugoti</Button></DialogFooter>
  </form>;
}
