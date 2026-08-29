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
import {
  GEAR_CATEGORIES,GEAR_STATUSES,MAINTENANCE_CATEGORIES,gearCategoryLabels,gearStatusLabels,
  maintenanceCategoryLabels,formatKm,localDateTime,today,uuid,wheelStats,
  type Entity,type Gear,type Kind,type Maintenance,type State,
} from "@/lib/kairo/domain";
import {useI18n,ltGearCategories,ltGearStatuses,ltMaintenanceCategories} from "@/lib/kairo/i18n";
import {friendlyError} from "@/lib/kairo/storage";

export type EditableKind=Exclude<Kind,"attachment">;
export type Editor={kind:EditableKind;entity?:Entity;parents:string[];tripId?:string;namespace:string};
export const titles:Record<EditableKind,string>={wheel:"Vehicle",reading:"Odometer reading",ride:"Ride",trip:"Trip",gear:"Gear",maintenance:"Maintenance"};
export const ltTitles:Record<EditableKind,string>={wheel:"Transporto priemonė",reading:"Odometro rodmuo",ride:"Važiavimas",trip:"Kelionė",gear:"Ekipuotė",maintenance:"Priežiūra"};

export function Field({label,children,hint}:{label:string;children:ReactNode;hint?:string}){
  return <div className="field"><Label>{label}</Label>{children}{hint&&<p className="field-hint">{hint}</p>}</div>;
}

export function Pick({value,onChange,options,label}:{value:string;onChange:(v:string)=>void;options:{value:string;label:string}[];label:string}){
  const {tr}=useI18n();
  return <Select value={value||undefined} onValueChange={onChange}><SelectTrigger aria-label={label} className="form-select"><SelectValue placeholder={tr("Select…","Pasirink…")}/></SelectTrigger><SelectContent>{options.map(o=><SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent></Select>;
}

export function EntityForm({editor,state,busy,onSave,onCancel}:{editor:Editor;state:State;busy:boolean;onSave:(value:Entity)=>Promise<void>;onCancel:()=>void}){
  const {tr,language,locale}=useI18n(),entity=editor.entity;
  const [id]=useState(()=>entity?.id??uuid());
  const [name,setName]=useState(entity&&"name"in entity?entity.name:entity&&"title"in entity?entity.title:"");
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
  const [color,setColor]=useState(entity&&"color"in entity?entity.color:"#f16305");

  const gear=editor.kind==="gear"?entity as Gear|undefined:undefined;
  const [category,setCategory]=useState<Gear["category"]>(gear?.category??"helmet");
  const [gearStatus,setGearStatus]=useState<Gear["status"]>(gear?.status??"active");
  const [brand,setBrand]=useState(gear?.brand??"");
  const [model,setModel]=useState(gear?.model??"");
  const [size,setSize]=useState(gear?.size??"");
  const [purchasedOn,setPurchasedOn]=useState(gear?.purchasedOn??"");
  const [usedWith,setUsedWith]=useState<string[]>(gear?.usedWithGearIds??[]);

  const maintenance=editor.kind==="maintenance"?entity as Maintenance|undefined:undefined;
  const [maintenanceCategory,setMaintenanceCategory]=useState<Maintenance["category"]>(maintenance?.category??"tire_tread");
  const [targetKind,setTargetKind]=useState<Maintenance["targetKind"]>(maintenance?.targetKind??(state.wheel.length?"wheel":"gear"));
  const [targetId,setTargetId]=useState(maintenance?.targetId??state.wheel[0]?.id??state.gear[0]?.id??"");
  const [dueDate,setDueDate]=useState(maintenance?.dueDate??"");
  const [dueOdometer,setDueOdometer]=useState(maintenance?.dueOdometerKm===null||maintenance?.dueOdometerKm===undefined?"":String(maintenance.dueOdometerKm));
  const [remindDays,setRemindDays]=useState(maintenance?.remindDaysBefore===null||maintenance?.remindDaysBefore===undefined?"14":String(maintenance.remindDaysBefore));
  const [repeatKm,setRepeatKm]=useState(maintenance?.repeatKm===null||maintenance?.repeatKm===undefined?"":String(maintenance.repeatKm));
  const [repeatMonths,setRepeatMonths]=useState(maintenance?.repeatMonths===null||maintenance?.repeatMonths===undefined?"":String(maintenance.repeatMonths));
  const [completed,setCompleted]=useState(!!maintenance?.completedAt);

  const trip=state.trip.find(t=>t.id===tripId);
  const outside=trip&&(at.slice(0,10)<trip.startDate||at.slice(0,10)>trip.endDate);
  const number=(v:string)=>{if(!v.trim())throw new Error(tr("Enter a number.","Įvesk skaičių."));const n=Number(v.replace(",","."));if(!Number.isFinite(n)||n<0)throw new Error(tr("Enter a positive number or zero.","Įvesk teigiamą skaičių arba nulį."));return n;};
  const optionalNumber=(v:string)=>v.trim()?number(v):null;
  const categoryLabel=(value:Gear["category"])=>language==="lt"?ltGearCategories[value]:gearCategoryLabels[value];
  const statusLabel=(value:Gear["status"])=>language==="lt"?ltGearStatuses[value]:gearStatusLabels[value];
  const maintenanceLabel=(value:Maintenance["category"])=>language==="lt"?ltMaintenanceCategories[value]:maintenanceCategoryLabels[value];
  const targetOptions=(targetKind==="wheel"?state.wheel:state.gear).map(item=>({value:item.id,label:item.name}));

  function changeTargetKind(value:string){const next=value as Maintenance["targetKind"];setTargetKind(next);setTargetId((next==="wheel"?state.wheel[0]?.id:state.gear[0]?.id)??"");}
  function toggleUsedWith(gearId:string){setUsedWith(current=>current.includes(gearId)?current.filter(id=>id!==gearId):[...current,gearId]);}
  function changeMaintenanceCategory(value:string){const next=value as Maintenance["category"];setMaintenanceCategory(next);if(!name.trim()||MAINTENANCE_CATEGORIES.some(category=>maintenanceCategoryLabels[category]===name))setName(maintenanceLabel(next));}

  function submit(e:FormEvent){e.preventDefault();try{
    let value:Entity;
    const unchangedAt=!!entity&&"at"in entity&&at===localDateTime(entity.at);
    const recordAt=unchangedAt&&entity&&"at"in entity?entity.at:new Date(at).toISOString();
    if(editor.kind==="wheel")value={id,name,baselineKm:number(baseline),baselineDate,color,notes};
    else if(editor.kind==="trip")value={id,name,startDate,endDate,notes};
    else if(editor.kind==="gear")value={id,name,category,status:gearStatus,brand,model,size,purchasedOn:purchasedOn||null,usedWithGearIds:usedWith,notes};
    else if(editor.kind==="maintenance")value={id,title:name,category:maintenanceCategory,targetKind,targetId,dueDate:dueDate||null,dueOdometerKm:targetKind==="wheel"?optionalNumber(dueOdometer):null,remindDaysBefore:dueDate?optionalNumber(remindDays):null,repeatKm:targetKind==="wheel"?optionalNumber(repeatKm):null,repeatMonths:optionalNumber(repeatMonths),completedAt:completed?(maintenance?.completedAt??new Date().toISOString()):null,notes};
    else if(editor.kind==="reading")value={id,wheelId,at:recordAt,odometerKm:number(odometer),notes,...(entity&&"sourceOrder"in entity?{sourceOrder:entity.sourceOrder}:{})};
    else value={id,name,wheelId,at:recordAt,distanceKm:distance.trim()?number(distance):null,tripId:tripId==="none"?null:tripId,notes,localDate:unchangedAt&&entity&&"localDate"in entity&&entity.localDate?entity.localDate:at.slice(0,10),timeZone:unchangedAt&&entity&&"timeZone"in entity&&entity.timeZone?entity.timeZone:Intl.DateTimeFormat().resolvedOptions().timeZone};
    void onSave(value);
  }catch(error){toast.error(friendlyError(error));}}

  return <form onSubmit={submit} className="entity-form">
    {editor.kind!=="reading"&&<Field label={editor.kind==="wheel"?tr("Vehicle name","Transporto priemonės pavadinimas"):editor.kind==="maintenance"?tr("Task name","Užduoties pavadinimas"):tr("Name","Pavadinimas")}><Input aria-label={tr("Name","Pavadinimas")} autoFocus required maxLength={160} value={name} onChange={e=>setName(e.target.value)} placeholder={editor.kind==="trip"?tr("e.g. Baltic coast weekend","Pvz., savaitgalis pajūryje"):editor.kind==="wheel"?"e.g. LeaperKim Lynx":editor.kind==="gear"?tr("e.g. touring helmet or Cardo","Pvz., kelioninis šalmas arba Cardo"):editor.kind==="maintenance"?tr("e.g. Inspect front bearing","Pvz., patikrinti guolį"):tr("e.g. Evening loop","Pvz., vakarinis ratas")}/></Field>}

    {(editor.kind==="reading"||editor.kind==="ride")&&<><Field label={tr("Vehicle","Transporto priemonė")}><Pick label={tr("Vehicle","Transporto priemonė")} value={wheelId} onChange={setWheelId} options={state.wheel.map(w=>({value:w.id,label:w.name}))}/></Field><Field label={tr("Date and time","Data ir laikas")} hint={`${tr("Device time zone","Įrenginio laiko juosta")}: ${Intl.DateTimeFormat().resolvedOptions().timeZone}.`}><Input aria-label={tr("Date and time","Data ir laikas")} type="datetime-local" required value={at} onChange={e=>setAt(e.target.value)}/></Field></>}
    {editor.kind==="reading"&&<Field label={tr("Odometer, km","Odometras, km")} hint={state.wheel.find(w=>w.id===wheelId)?`${tr("Latest known","Paskutinis žinomas")}: ${formatKm(wheelStats(state.wheel.find(w=>w.id===wheelId)!,state.reading).odometerKm,locale)} km. ${tr("Earlier readings can be inserted too.","Galima įterpti ir ankstesnį rodmenį.")}`:undefined}><Input aria-label={tr("Odometer in kilometres","Odometras kilometrais")} autoFocus inputMode="decimal" required value={odometer} onChange={e=>setOdometer(e.target.value)} placeholder="0.0"/></Field>}
    {editor.kind==="ride"&&<><Field label={tr("Ride distance, km","Važiavimo atstumas, km")} hint={tr("Optional. This value is not added to odometer distance a second time.","Neprivaloma. Šis atstumas antrą kartą nepridedamas prie odometro ridos.")}><Input aria-label={tr("Ride distance","Važiavimo atstumas")} inputMode="decimal" value={distance} onChange={e=>setDistance(e.target.value)} placeholder={tr("Optional","Neprivaloma")}/></Field><Field label={tr("Trip","Kelionė")}><Pick value={tripId} onChange={setTripId} label={tr("Trip","Kelionė")} options={[{value:"none",label:tr("Standalone ride","Atskiras važiavimas")},...state.trip.map(t=>({value:t.id,label:t.name}))]}/></Field>{outside&&<p className="inline-warning"><TriangleAlert/>{tr("The ride date is outside the trip dates.","Važiavimo data nepatenka į kelionės intervalą.")}</p>}</>}
    {editor.kind==="trip"&&<div className="form-grid"><Field label={tr("Start date","Pradžios data")}><Input aria-label={tr("Trip start","Kelionės pradžia")} type="date" required value={startDate} onChange={e=>{setStartDate(e.target.value);if(endDate<e.target.value)setEndDate(e.target.value);}}/></Field><Field label={tr("End date","Pabaigos data")}><Input aria-label={tr("Trip end","Kelionės pabaiga")} type="date" required min={startDate} value={endDate} onChange={e=>setEndDate(e.target.value)}/></Field></div>}
    {editor.kind==="wheel"&&<><div className="form-grid"><Field label={tr("Baseline odometer, km","Pradinis odometras, km")}><Input aria-label={tr("Baseline odometer","Pradinis odometras")} inputMode="decimal" required value={baseline} onChange={e=>setBaseline(e.target.value)}/></Field><Field label={tr("Baseline date","Pradinio rodmens data")}><Input aria-label={tr("Baseline date","Pradinio rodmens data")} type="date" required value={baselineDate} onChange={e=>setBaselineDate(e.target.value)}/></Field></div><Field label={tr("Vehicle chart colour","Transporto priemonės spalva")}><Input aria-label={tr("Vehicle colour","Transporto priemonės spalva")} type="color" value={color} onChange={e=>setColor(e.target.value)} className="color-input"/></Field></>}

    {editor.kind==="gear"&&<><div className="form-grid"><Field label={tr("Category","Kategorija")}><Pick label={tr("Gear category","Ekipuotės kategorija")} value={category} onChange={v=>setCategory(v as Gear["category"])} options={GEAR_CATEGORIES.map(value=>({value,label:categoryLabel(value)}))}/></Field><Field label={tr("Status","Būsena")}><Pick label={tr("Gear status","Ekipuotės būsena")} value={gearStatus} onChange={v=>setGearStatus(v as Gear["status"])} options={GEAR_STATUSES.map(value=>({value,label:statusLabel(value)}))}/></Field><Field label={tr("Brand","Gamintojas")}><Input aria-label={tr("Brand","Gamintojas")} maxLength={160} value={brand} onChange={e=>setBrand(e.target.value)} placeholder={tr("Optional","Neprivaloma")}/></Field><Field label={tr("Model","Modelis")}><Input aria-label={tr("Model","Modelis")} maxLength={160} value={model} onChange={e=>setModel(e.target.value)} placeholder={tr("Optional","Neprivaloma")}/></Field><Field label={tr("Size","Dydis")}><Input aria-label={tr("Size","Dydis")} maxLength={60} value={size} onChange={e=>setSize(e.target.value)} placeholder={tr("e.g. L or 43","Pvz., L arba 43")}/></Field><Field label={tr("Purchase date","Įsigijimo data")}><Input aria-label={tr("Purchase date","Įsigijimo data")} type="date" value={purchasedOn} onChange={e=>setPurchasedOn(e.target.value)}/></Field></div><Field label={tr("Used with","Kur naudojama")} hint={tr("Link this item to gear you have already added.","Susiek šį daiktą su jau įvesta ekipuote.")}><div className="check-grid">{state.gear.filter(item=>item.id!==id).map(item=><label className="check-card" key={item.id}><input type="checkbox" checked={usedWith.includes(item.id)} onChange={()=>toggleUsedWith(item.id)}/><span>{item.name}</span></label>)}{state.gear.filter(item=>item.id!==id).length===0&&<p className="field-hint">{tr("Add another gear item first.","Pirmiausia pridėk kitą ekipuotės elementą.")}</p>}</div></Field></>}

    {editor.kind==="maintenance"&&<><div className="form-grid"><Field label={tr("Task type","Užduoties tipas")}><Pick label={tr("Maintenance task type","Priežiūros tipas")} value={maintenanceCategory} onChange={changeMaintenanceCategory} options={MAINTENANCE_CATEGORIES.map(value=>({value,label:maintenanceLabel(value)}))}/></Field><Field label={tr("Applies to","Kam taikoma")}><Pick label={tr("Target type","Objekto tipas")} value={targetKind} onChange={changeTargetKind} options={[{value:"wheel",label:tr("Vehicle","Transporto priemonė")},{value:"gear",label:tr("Gear","Ekipuotė")}]}/></Field></div><Field label={tr("Vehicle or gear","Transporto priemonė arba ekipuotė")}><Pick label={tr("Maintenance target","Priežiūros objektas")} value={targetId} onChange={setTargetId} options={targetOptions}/></Field><div className="form-grid"><Field label={maintenanceCategory==="insurance"?tr("Insurance valid until","Draudimas galioja iki"):tr("Due date","Atlikimo data")}><Input aria-label={tr("Due date","Atlikimo data")} type="date" required={maintenanceCategory==="insurance"} value={dueDate} onChange={e=>setDueDate(e.target.value)}/></Field><Field label={tr("Remind days before","Priminti prieš dienų")}><Input aria-label={tr("Reminder days","Priminimo dienos")} inputMode="numeric" disabled={!dueDate} value={dueDate?remindDays:""} onChange={e=>setRemindDays(e.target.value)}/></Field>{targetKind==="wheel"&&<><Field label={tr("Due at odometer, km","Atlikti ties odometru, km")}><Input aria-label={tr("Due odometer","Atlikimo odometras")} inputMode="decimal" value={dueOdometer} onChange={e=>setDueOdometer(e.target.value)} placeholder={tr("Optional","Neprivaloma")}/></Field><Field label={tr("Repeat every, km","Kartoti kas, km")}><Input aria-label={tr("Repeat kilometres","Kartojimo kilometrai")} inputMode="decimal" value={repeatKm} onChange={e=>setRepeatKm(e.target.value)} placeholder={tr("Optional","Neprivaloma")}/></Field></>}<Field label={tr("Repeat every, months","Kartoti kas, mėn.")}><Input aria-label={tr("Repeat months","Kartojimo mėnesiai")} inputMode="numeric" value={repeatMonths} onChange={e=>setRepeatMonths(e.target.value)} placeholder={tr("Optional","Neprivaloma")}/></Field></div><label className="check-card completed-check"><input type="checkbox" checked={completed} onChange={e=>setCompleted(e.target.checked)}/><span>{tr("Mark as completed","Pažymėti atlikta")}</span></label></>}

    <Field label={tr("Notes","Pastabos")}><Textarea aria-label={tr("Notes","Pastabos")} rows={3} maxLength={20000} value={notes} onChange={e=>setNotes(e.target.value)} placeholder={tr("Anything worth remembering…","Kas svarbu prisiminti…")}/></Field>
    <DialogFooter><Button type="button" variant="outline" disabled={busy} onClick={onCancel}>{tr("Cancel","Atšaukti")}</Button><Button type="submit" disabled={busy}>{busy?<LoaderCircle className="spin"/>:<Check/>}{tr("Save","Išsaugoti")}</Button></DialogFooter>
  </form>;
}
