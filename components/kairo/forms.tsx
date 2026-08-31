"use client";
import {useState,type FormEvent} from "react";
import {Check,ChevronDown,LoaderCircle,TriangleAlert} from "lucide-react";
import {toast} from "sonner";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Textarea} from "@/components/ui/textarea";
import {DialogFooter} from "@/components/ui/dialog";
import {Field,Pick} from "./form-fields";
import {MaintenanceForm} from "./maintenance-form";
import {DateInput,DateTimeInput} from "./date-input";
import {preferredRecordVehicle,recordDistancePreview,recordInstant,validateRideRecord} from "@/lib/kairo/records";
import {notifyVehicleMaintenance} from "./vehicle-status";
export {Field,Pick} from "./form-fields";
import {
  GEAR_CATEGORIES,GEAR_STATUSES,gearCategoryLabels,gearStatusLabels,WHEEL_STATUSES,wheelStatusLabels,
  canRecordWithWheel,hasArchivedRecord,storedWheelStatus,validateRecordTarget,formatKm,localDateTime,today,uuid,wheelStats,
  type Entity,type Gear,type Kind,type Reading,type Ride,type State,type Trip,type Wheel,type WheelStatus,
} from "@/lib/kairo/domain";
import {ltWheelStatusLabels,vehicleReminder,vehicleSelectOptions} from "@/lib/kairo/vehicle-status";
import {useI18n,ltGearCategories,ltGearStatuses} from "@/lib/kairo/i18n";
import {friendlyError} from "@/lib/kairo/storage";

export type EditableKind=Exclude<Kind,"attachment"|"goal">;
export type Editor={kind:EditableKind;entity?:Entity;reading?:Reading;parents:string[];readingParents?:string[];tripId?:string;defaultWheelId?:string;namespace:string};
export type FormSubmission={value:Entity;reading?:Reading|null;readingId?:string;newTrip?:Trip};
export const titles:Record<EditableKind,string>={wheel:"Vehicle",reading:"Odometer record",ride:"Ride",trip:"Trip",gear:"Gear",maintenance:"Maintenance"};
export const ltTitles:Record<EditableKind,string>={wheel:"Transporto priemonė",reading:"Odometro įrašas",ride:"Važiavimas",trip:"Kelionė",gear:"Ekipuotė",maintenance:"Priežiūra"};

export type EntityFormProps={editor:Editor;state:State;busy:boolean;onSave:(request:FormSubmission)=>Promise<void>;onCancel:()=>void};
export function EntityForm(props:EntityFormProps){
  return props.editor.kind==="maintenance"?<MaintenanceForm {...props}/>:<GeneralEntityForm {...props}/>;
}

function GeneralEntityForm({editor,state,busy,onSave,onCancel}:EntityFormProps){
  const {tr,language,locale}=useI18n(),entity=editor.entity;
  const rideEntity=editor.kind==="ride"?entity as Ride|undefined:undefined;
  const linkedReading=editor.kind==="ride"?editor.reading:editor.kind==="reading"?entity as Reading|undefined:undefined;
  const legacyDistanceOnly=!!rideEntity&&!linkedReading;
  const [id]=useState(()=>entity?.id??linkedReading?.id??uuid());
  const [name,setName]=useState(entity&&"name"in entity?entity.name??"":entity&&"title"in entity?entity.title:"");
  const [notes,setNotes]=useState(entity&&"notes"in entity&&entity.notes?entity.notes:linkedReading?.notes??"");
  const [wheelId,setWheelId]=useState(entity&&"wheelId"in entity&&entity.wheelId?entity.wheelId:linkedReading?.wheelId??(state.wheel.some(w=>w.id===editor.defaultWheelId&&canRecordWithWheel(w))?editor.defaultWheelId:preferredRecordVehicle(state,editor.namespace)?.id)??"");
  const [at,setAt]=useState(localDateTime(entity&&"at"in entity?entity.at:linkedReading?.at));
  const previewAt=Number.isFinite(Date.parse(at))?recordInstant(at,rideEntity?.at??linkedReading?.at):"";
  const [odometer,setOdometer]=useState(linkedReading?String(linkedReading.odometerKm):"");
  const distancePreview=recordDistancePreview(state,wheelId??"",linkedReading?.id??id,previewAt,odometer,linkedReading?.sourceOrder);
  const initialTripId=rideEntity?.tripId??editor.tripId??null;
  const [addAsTrip,setAddAsTrip]=useState(!!initialTripId);
  const [tripId,setTripId]=useState(initialTripId??"new");
  const [newTripId]=useState(uuid);
  const [newTripName,setNewTripName]=useState("");
  const [startDate,setStartDate]=useState(entity&&"startDate"in entity?entity.startDate??today():today());
  const [endDate,setEndDate]=useState(entity&&"endDate"in entity?entity.endDate??today():today());
  const [baseline,setBaseline]=useState(entity&&"baselineKm"in entity?String(entity.baselineKm):"0");
  const [baselineDate,setBaselineDate]=useState(entity&&"baselineDate"in entity?entity.baselineDate:today());
  const [color,setColor]=useState(entity&&"color"in entity?entity.color:"#f16305");
  const wheelEntity=editor.kind==="wheel"?entity as Wheel|undefined:undefined;
  const [vehicleStatus,setVehicleStatus]=useState<WheelStatus>(wheelEntity?storedWheelStatus(wheelEntity):"active");
  const [statusNote,setStatusNote]=useState(wheelEntity?.statusNote??"");
  const hasOpenMaintenance=state.maintenance.some(item=>item.targetKind==="wheel"&&item.targetId===id&&!item.completedAt);
  const recordForm=editor.kind==="ride"||editor.kind==="reading";
  const selectedVehicle=state.wheel.find(wheel=>wheel.id===wheelId);
  const archivedSelection=!!selectedVehicle&&hasArchivedRecord(state,selectedVehicle.id,id);
  const blockedSelection=recordForm&&(!selectedVehicle||(!canRecordWithWheel(selectedVehicle)&&!archivedSelection));
  const vehicleLabel=(status:WheelStatus)=>language==="lt"?ltWheelStatusLabels[status]:wheelStatusLabels[status];
  function selectVehicle(next:string){
    setWheelId(next);
    if(!entity&&!linkedReading){
      const wheel=state.wheel.find(item=>item.id===next),reminder=wheel?vehicleReminder(wheel,state):null;
      notifyVehicleMaintenance(reminder?[reminder]:[],{tr,locale},"record");
    }
  }

  const gear=editor.kind==="gear"?entity as Gear|undefined:undefined;
  const [category,setCategory]=useState<Gear["category"]>(gear?.category??"helmet");
  const [gearStatus,setGearStatus]=useState<Gear["status"]>(gear?.status??"active");
  const [brand,setBrand]=useState(gear?.brand??"");
  const [model,setModel]=useState(gear?.model??"");
  const [size,setSize]=useState(gear?.size??"");
  const [purchasedOn,setPurchasedOn]=useState(gear?.purchasedOn??"");
  const [usedWith,setUsedWith]=useState<string[]>(gear?.usedWithGearIds??[]);

  const trip=addAsTrip&&tripId!=="new"?state.trip.find(t=>t.id===tripId):undefined;
  const outside=trip&&(at.slice(0,10)<trip.startDate||at.slice(0,10)>trip.endDate);
  const number=(v:string)=>{if(!v.trim())throw new Error(tr("Enter a number.","Įvesk skaičių."));const n=Number(v.replace(",","."));if(!Number.isFinite(n)||n<0)throw new Error(tr("Enter a positive number or zero.","Įvesk teigiamą skaičių arba nulį."));return n;};
  const categoryLabel=(value:Gear["category"])=>language==="lt"?ltGearCategories[value]:gearCategoryLabels[value];
  const statusLabel=(value:Gear["status"])=>language==="lt"?ltGearStatuses[value]:gearStatusLabels[value];
  function toggleUsedWith(gearId:string){setUsedWith(current=>current.includes(gearId)?current.filter(id=>id!==gearId):[...current,gearId]);}

  function submit(e:FormEvent){e.preventDefault();try{
    let value:Entity,request:FormSubmission;
    const originalAt=entity&&"at"in entity?entity.at:linkedReading?.at;
    const unchangedAt=!!originalAt&&at===localDateTime(originalAt);
    const recordAt=recordInstant(at,originalAt);
    if(editor.kind==="wheel")value={id,name,baselineKm:number(baseline),baselineDate,color,notes,status:vehicleStatus,statusNote:statusNote.trim()};
    else if(editor.kind==="trip")value={id,name,startDate,endDate,notes};
    else if(editor.kind==="gear")value={id,name,category,status:gearStatus,brand,model,size,purchasedOn:purchasedOn||null,usedWithGearIds:usedWith,notes};
    else if(editor.kind==="reading")value={id,wheelId,at:recordAt,odometerKm:number(odometer),notes,...(entity&&"sourceOrder"in entity?{sourceOrder:entity.sourceOrder}:{})};
    else {
      if(addAsTrip&&tripId==="new"&&!newTripName.trim())throw new Error(tr("Enter the new trip name.","Įvesk naujos kelionės pavadinimą."));
      const selectedTripId=addAsTrip?(tripId==="new"?newTripId:tripId):null;
      value={id,name:name.trim(),wheelId,at:recordAt,distanceKm:odometer.trim()?null:rideEntity?.distanceKm??null,tripId:selectedTripId,notes,localDate:unchangedAt&&rideEntity?.localDate?rideEntity.localDate:at.slice(0,10),timeZone:unchangedAt&&rideEntity?.timeZone?rideEntity.timeZone:Intl.DateTimeFormat().resolvedOptions().timeZone};
      const readingId=linkedReading?.id??id;
      const reading=odometer.trim()?{id:readingId,wheelId,at:recordAt,odometerKm:number(odometer),notes,...(linkedReading?.sourceOrder!==undefined?{sourceOrder:linkedReading.sourceOrder}:{})}:null;
      const newTrip=addAsTrip&&tripId==="new"?{id:newTripId,name:newTripName.trim(),startDate:at.slice(0,10),endDate:at.slice(0,10),notes:""}:undefined;
      request={value,reading,readingId,newTrip};
      validateRideRecord(newTrip?{...state,trip:[...state.trip,newTrip]}:state,value as Ride,reading);
      void onSave(request);return;
    }
    if(editor.kind==="reading")validateRecordTarget(state,value as Reading);
    request={value};void onSave(request);
  }catch(error){toast.error(friendlyError(error));}}

  return <form onSubmit={submit} className="entity-form">
    {editor.kind!=="reading"&&<Field label={editor.kind==="wheel"?tr("Vehicle name","Transporto priemonės pavadinimas"):editor.kind==="maintenance"?tr("Task name","Užduoties pavadinimas"):editor.kind==="ride"?tr("Name (optional)","Pavadinimas (neprivalomas)"):tr("Name","Pavadinimas")}><Input aria-label={tr("Name","Pavadinimas")} autoFocus required={editor.kind!=="ride"} maxLength={160} value={name} onChange={e=>setName(e.target.value)} placeholder={editor.kind==="trip"?tr("e.g. Baltic coast weekend","Pvz., savaitgalis pajūryje"):editor.kind==="wheel"?"e.g. LeaperKim Lynx":editor.kind==="gear"?tr("e.g. touring helmet or Cardo","Pvz., kelioninis šalmas arba Cardo"):editor.kind==="maintenance"?tr("e.g. Inspect front bearing","Pvz., patikrinti guolį"):tr("e.g. Evening loop","Pvz., vakarinis ratas")}/></Field>}

    {(editor.kind==="reading"||editor.kind==="ride")&&<><Field label={tr("Vehicle","Transporto priemonė")}><Pick label={tr("Vehicle","Transporto priemonė")} value={wheelId} onChange={selectVehicle} options={vehicleSelectOptions(state,language).filter(option=>!state.wheel.find(w=>w.id===option.value)?.archived||option.value===linkedReading?.wheelId||option.value===rideEntity?.wheelId).map(option=>({...option,disabled:!canRecordWithWheel(state.wheel.find(w=>w.id===option.value))&&!hasArchivedRecord(state,option.value,id)}))}/></Field><Field label={tr("Date and time","Data ir laikas")} hint={`${tr("Device time zone","Įrenginio laiko juosta")}: ${Intl.DateTimeFormat().resolvedOptions().timeZone}.`}><DateTimeInput aria-label={tr("Date and time","Data ir laikas")} required value={at} onValueChange={setAt}/></Field></>}
    {blockedSelection&&<p role="alert" className="inline-warning record-status-warning"><TriangleAlert/>{tr("No vehicle is available for this new record. Choose Active, Active! or Spare in Garage first.","Šiam naujam įrašui nėra tinkamos priemonės. Pirmiausia Garaže pasirink Aktyvus, Aktyvus! arba Atsarginis.")}</p>}
    {recordForm&&archivedSelection&&!canRecordWithWheel(selectedVehicle)&&<p className="field-hint">{tr("You are editing an archived record. New records for this vehicle remain disabled.","Redaguoji archyvinį įrašą. Nauji šios priemonės įrašai lieka išjungti.")}</p>}
    {editor.kind==="reading"&&<Field label={tr("Odometer, km","Odometras, km")} hint={state.wheel.find(w=>w.id===wheelId)?`${tr("Latest known","Paskutinis žinomas")}: ${formatKm(wheelStats(state.wheel.find(w=>w.id===wheelId)!,state.reading).odometerKm,locale)} km. ${tr("Earlier records can be inserted too.","Galima įterpti ir ankstesnį rodmenį.")}`:undefined}><Input aria-label={tr("Odometer in kilometres","Odometras kilometrais")} autoFocus inputMode="decimal" required value={odometer} onChange={e=>setOdometer(e.target.value)} placeholder="0.0"/></Field>}
    {editor.kind==="ride"&&<><div className="form-grid"><Field label={tr("Odometer after ride, km","Odometras po važiavimo, km")} hint={state.wheel.find(w=>w.id===wheelId)?`${tr("Latest known","Paskutinis žinomas")}: ${formatKm(wheelStats(state.wheel.find(w=>w.id===wheelId)!,state.reading).odometerKm,locale)} km`:undefined}><Input aria-label={tr("Odometer after ride","Odometras po važiavimo")} inputMode="decimal" required={!legacyDistanceOnly} value={odometer} onChange={e=>setOdometer(e.target.value)} placeholder="0.0"/></Field><Field label={tr("Ride distance, km","Važiavimo atstumas, km")} hint={tr("Calculated from the previous odometer for this vehicle and date.","Apskaičiuojama pagal ankstesnį šios priemonės odometrą ir datą.")}><output className="calculated-distance" aria-label={tr("Ride distance","Važiavimo atstumas")} aria-live="polite">{distancePreview&&!distancePreview.warning&&distancePreview.distanceKm!==null?`${formatKm(distancePreview.distanceKm,locale)} km`:legacyDistanceOnly&&!odometer.trim()&&rideEntity?.distanceKm!==null?`${formatKm(rideEntity!.distanceKm!,locale)} km`:"—"}</output></Field></div>{distancePreview?.warning&&<p role="alert" className="inline-warning">{tr("Check the odometer: it must fit between the previous and next records.","Patikrink odometrą: jis turi derėti su ankstesniu ir vėlesniu įrašu.")}</p>}{legacyDistanceOnly&&<p className="field-hint">{tr("Legacy distance-only record. Add an odometer to change its date, vehicle or distance; its name and notes can still be edited.","Senas įrašas be odometro. Norint pakeisti datą, priemonę ar atstumą, reikia odometro; pavadinimą ir pastabas galima redaguoti.")}</p>}<label className="check-card trip-toggle"><input type="checkbox" checked={addAsTrip} onChange={e=>{const checked=e.target.checked;setAddAsTrip(checked);if(checked&&tripId!=="new"&&!state.trip.some(item=>item.id===tripId))setTripId(state.trip[0]?.id??"new");}}/><span>{tr("Add as trip","Pridėti kaip kelionę")}</span></label>{addAsTrip&&<div className="trip-link-fields"><Field label={tr("Trip","Kelionė")}><Pick value={tripId} onChange={setTripId} label={tr("Trip","Kelionė")} options={[{value:"new",label:tr("Create a new trip","Sukurti naują kelionę")},...state.trip.filter(t=>!t.archived||t.id===initialTripId).map(t=>({value:t.id,label:t.name}))]}/></Field>{tripId==="new"&&<Field label={tr("New trip name","Naujos kelionės pavadinimas")}><Input aria-label={tr("New trip name","Naujos kelionės pavadinimas")} required maxLength={160} value={newTripName} onChange={e=>setNewTripName(e.target.value)} placeholder={tr("e.g. Baltic coast weekend","Pvz., savaitgalis pajūryje")}/></Field>}</div>}{outside&&<p className="inline-warning"><TriangleAlert/>{tr("The ride date is outside the trip dates.","Važiavimo data nepatenka į kelionės intervalą.")}</p>}</>}
    {editor.kind==="trip"&&<div className="form-grid"><Field label={tr("Start date","Pradžios data")}><DateInput aria-label={tr("Trip start","Kelionės pradžia")} required value={startDate} onValueChange={value=>{setStartDate(value);if(endDate<value)setEndDate(value);}}/></Field><Field label={tr("End date","Pabaigos data")}><DateInput aria-label={tr("Trip end","Kelionės pabaiga")} required min={startDate} value={endDate} onValueChange={setEndDate}/></Field></div>}
    {editor.kind==="wheel"&&<><Field label={tr("Vehicle status","Transporto priemonės būsena")} hint={tr("Active, Active! and Spare allow new records. Critical, In repair and Sold keep the archive but block new records.","Aktyvus, Aktyvus! ir Atsarginis leidžia naujus įrašus. Sugedęs, Remontuojamas ir Parduotas išsaugo archyvą, bet neleidžia naujų įrašų.")}><Pick label={tr("Vehicle status","Transporto priemonės būsena")} value={vehicleStatus} onChange={value=>setVehicleStatus(value as WheelStatus)} options={WHEEL_STATUSES.map(value=>({value,label:vehicleLabel(value)}))}/></Field>{vehicleStatus==="attention"&&<Field label={tr("Maintenance reminder note","Priežiūros priminimo tekstas")} hint={hasOpenMaintenance?tr("Open maintenance tasks will also appear in the reminder.","Priminime taip pat bus parodytos neatliktos priežiūros užduotys."):tr("Describe what needs attention, or add a task in Garage → Maintenance.","Aprašyk, ką reikia atlikti, arba pridėk užduotį: Garažas → Priežiūra.")}><Textarea aria-label={tr("Maintenance reminder note","Priežiūros priminimo tekstas")} required={!hasOpenMaintenance} maxLength={1000} rows={2} value={statusNote} onChange={event=>setStatusNote(event.target.value)}/></Field>}<p className="field-hint">{tr("Due maintenance automatically displays Active! for Active or Spare vehicles. A manually selected Active! stays until you change it here.","Suėjus priežiūros terminui Aktyvus ir Atsarginis automatiškai rodomi kaip Aktyvus!. Ranka pasirinktas Aktyvus! lieka, kol jį pakeiti čia.")}</p><div className="form-grid"><Field label={tr("Baseline odometer, km","Pradinis odometras, km")}><Input aria-label={tr("Baseline odometer","Pradinis odometras")} inputMode="decimal" required value={baseline} onChange={e=>setBaseline(e.target.value)}/></Field><Field label={tr("Baseline date","Pradinio rodmens data")}><DateInput aria-label={tr("Baseline date","Pradinio rodmens data")} required value={baselineDate} onValueChange={setBaselineDate}/></Field></div><Field label={tr("Vehicle chart colour","Transporto priemonės spalva")}><Input aria-label={tr("Vehicle colour","Transporto priemonės spalva")} type="color" value={color} onChange={e=>setColor(e.target.value)} className="color-input"/></Field></>}

    {editor.kind==="gear"&&<><div className="form-grid"><Field label={tr("Category","Kategorija")}><Pick label={tr("Gear category","Ekipuotės kategorija")} value={category} onChange={v=>setCategory(v as Gear["category"])} options={GEAR_CATEGORIES.map(value=>({value,label:categoryLabel(value)}))}/></Field><Field label={tr("Status","Būsena")}><Pick label={tr("Gear status","Ekipuotės būsena")} value={gearStatus} onChange={v=>setGearStatus(v as Gear["status"])} options={GEAR_STATUSES.map(value=>({value,label:statusLabel(value)}))}/></Field><Field label={tr("Brand","Gamintojas")}><Input aria-label={tr("Brand","Gamintojas")} maxLength={160} value={brand} onChange={e=>setBrand(e.target.value)} placeholder={tr("Optional","Neprivaloma")}/></Field><Field label={tr("Model","Modelis")}><Input aria-label={tr("Model","Modelis")} maxLength={160} value={model} onChange={e=>setModel(e.target.value)} placeholder={tr("Optional","Neprivaloma")}/></Field><Field label={tr("Size","Dydis")}><Input aria-label={tr("Size","Dydis")} maxLength={60} value={size} onChange={e=>setSize(e.target.value)} placeholder={tr("e.g. L or 43","Pvz., L arba 43")}/></Field><Field label={tr("Purchase date","Įsigijimo data")}><DateInput aria-label={tr("Purchase date","Įsigijimo data")} value={purchasedOn} onValueChange={setPurchasedOn}/></Field></div><Field label={tr("Used with","Kur naudojama")} hint={tr("Link this item to gear you have already added.","Susiek šį daiktą su jau įvesta ekipuote.")}>{state.gear.some(item=>item.id!==id)?<details className="multi-select"><summary><span>{usedWith.length?`${usedWith.length} ${tr("selected","pasirinkta")}`:tr("Select gear…","Pasirink ekipuotę…")}</span><ChevronDown/></summary><div className="multi-select-menu">{state.gear.filter(item=>item.id!==id&&(!item.archived||usedWith.includes(item.id))).map(item=><label className="multi-select-option" key={item.id}><input type="checkbox" checked={usedWith.includes(item.id)} onChange={()=>toggleUsedWith(item.id)}/><span>{item.name}</span></label>)}</div></details>:<p className="field-hint">{tr("Add another gear item first.","Pirmiausia pridėk kitą ekipuotės elementą.")}</p>}</Field></>}


    <Field label={tr("Notes","Pastabos")}><Textarea aria-label={tr("Notes","Pastabos")} rows={3} maxLength={20000} value={notes} onChange={e=>setNotes(e.target.value)} placeholder={tr("Anything worth remembering…","Kas svarbu prisiminti…")}/></Field>
    <DialogFooter><Button type="button" variant="outline" disabled={busy} onClick={onCancel}>{tr("Cancel","Atšaukti")}</Button><Button type="submit" disabled={busy||blockedSelection}>{busy?<LoaderCircle className="spin"/>:<Check/>}{tr("Save","Išsaugoti")}</Button></DialogFooter>
  </form>;
}
