"use client";
import {useState,type FormEvent} from "react";
import {CalendarClock,Check,Gauge,LoaderCircle,RotateCcw,TriangleAlert} from "lucide-react";
import {toast} from "sonner";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Textarea} from "@/components/ui/textarea";
import {DialogFooter} from "@/components/ui/dialog";
import {Select,SelectContent,SelectGroup,SelectItem,SelectLabel,SelectTrigger,SelectValue} from "@/components/ui/select";
import {formatDate,formatKm,today,uuid,wheelStats,type Maintenance} from "@/lib/kairo/domain";
import {useI18n} from "@/lib/kairo/i18n";
import {friendlyError} from "@/lib/kairo/storage";
import {
  MAINTENANCE_TEMPLATES,VOLTRIDE_MAINTENANCE_URL,createMaintenanceDraft,maintenanceFromDraft,maintenanceOdometer,
  maintenanceTemplate,retargetMaintenanceDraft,selectMaintenanceTemplate,toggleMaintenanceReminder,type MaintenanceDraft,
} from "@/lib/kairo/maintenance";
import {Field,Pick} from "./form-fields";
import type {EntityFormProps} from "./forms";

export function MaintenanceForm({editor,state,busy,onSave,onCancel}:EntityFormProps){
  const {tr,language,locale}=useI18n(),original=editor.entity as Maintenance|undefined;
  const [id]=useState(()=>original?.id??uuid());
  const [entryDay]=useState(today);
  const [draft,setDraft]=useState(()=>createMaintenanceDraft(state,{item:original,day:entryDay,language}));
  const template=maintenanceTemplate(draft.templateId);
  const currentOdometer=maintenanceOdometer(state,draft.targetKind,draft.targetId);
  const selectedWheel=draft.targetKind==="wheel"?state.wheel.find(wheel=>wheel.id===draft.targetId):undefined;
  const lastReading=selectedWheel?wheelStats(selectedWheel,state.reading).lastAt:undefined;
  const targetOptions=(draft.targetKind==="wheel"?state.wheel:state.gear).map(item=>({value:item.id,label:item.name}));
  const groups=[{id:"inspection",label:tr("Inspections and checks","Apžiūros ir patikros")},{id:"condition",label:tr("Condition / component-based work","Darbai pagal būklę ar komponentą")},{id:"other",label:tr("Insurance and custom tasks","Draudimas ir kitos užduotys")}];
  const update=<K extends keyof MaintenanceDraft>(key:K,value:MaintenanceDraft[K])=>setDraft(current=>({...current,[key]:value}));
  function selectTemplate(value:string){setDraft(current=>selectMaintenanceTemplate(current,value,state,entryDay,language));}
  function changeTargetKind(value:string){
    const kind=value as Maintenance["targetKind"],target=(kind==="wheel"?state.wheel[0]?.id:state.gear[0]?.id)??"";
    setDraft(current=>retargetMaintenanceDraft(current,state,kind,target));
  }
  function resetSuggestions(){
    setDraft(current=>({...selectMaintenanceTemplate(current,current.templateId,state,entryDay,language),title:current.title}));
  }
  function submit(event:FormEvent){
    event.preventDefault();
    try{void onSave({value:maintenanceFromDraft(draft,id,original)});}catch(error){toast.error(friendlyError(error));}
  }
  const hasReminder=draft.dateEnabled||draft.mileageEnabled;
  return <form onSubmit={submit} className="entity-form maintenance-form">
    <Field label={tr("Task type","Užduoties tipas")}>
      <Select value={draft.templateId} onValueChange={selectTemplate}>
        <SelectTrigger aria-label={tr("Maintenance task type","Priežiūros tipas")} className="form-select maintenance-template-select"><SelectValue/></SelectTrigger>
        <SelectContent position="popper" className="maintenance-template-menu">
          {!MAINTENANCE_TEMPLATES.some(item=>item.id===draft.templateId)&&<SelectItem value={draft.templateId}>{tr("Saved custom template","Išsaugotas individualus šablonas")}</SelectItem>}
          {groups.map(group=><SelectGroup key={group.id}><SelectLabel>{group.label}</SelectLabel>{MAINTENANCE_TEMPLATES.filter(item=>item.group===group.id).map(item=><SelectItem key={item.id} value={item.id}>{item.title[language]}</SelectItem>)}</SelectGroup>)}
        </SelectContent>
      </Select>
    </Field>
    <div className="maintenance-template-note">
      <strong>{template.cadence[language]}</strong>
      <p>{template.guidance[language]}</p>
      {template.id==="professional_inspection"&&<a href={VOLTRIDE_MAINTENANCE_URL} target="_blank" rel="noopener noreferrer">{tr("Voltride's general recommendation","Bendros Voltride rekomendacijos")}</a>}
    </div>
    {template.gear&&<Field label={tr("Applies to","Kam taikoma")}><Pick label={tr("Target type","Objekto tipas")} value={draft.targetKind} onChange={changeTargetKind} options={[{value:"wheel",label:tr("Vehicle","Transporto priemonė")},{value:"gear",label:tr("Gear","Ekipuotė")}]}/></Field>}
    <Field label={draft.targetKind==="wheel"?tr("Vehicle","Transporto priemonė"):tr("Gear","Ekipuotė")}>
      <Pick label={tr("Maintenance target","Priežiūros objektas")} value={draft.targetId} onChange={value=>setDraft(current=>retargetMaintenanceDraft(current,state,current.targetKind,value))} options={targetOptions}/>
      {!targetOptions.length&&<p className="inline-warning">{tr("Add a vehicle or choose a task that applies to your gear.","Pridėk transporto priemonę arba pasirink ekipuotei taikomą užduotį.")}</p>}
    </Field>
    <Field label={tr("Task name","Užduoties pavadinimas")}><Input aria-label={tr("Task name","Užduoties pavadinimas")} required maxLength={160} value={draft.title} onChange={event=>update("title",event.target.value)} placeholder={tr("Describe the work","Aprašyk darbą")}/></Field>
    <div className="maintenance-anchor">
      <span><CalendarClock/>{tr("Entry date","Įvedimo data")}: {formatDate(entryDay,false,undefined,locale)}</span>
      {currentOdometer!==null&&<span><Gauge/>{tr("Latest odometer","Paskutinis odometras")}: <strong>{formatKm(currentOdometer,locale)} km</strong>{lastReading?` · ${formatDate(lastReading,false,undefined,locale)}`:` · ${tr("baseline","pradinis rodmuo")}`}</span>}
      <p>{tr("Suggestions start from this date and the latest recorded odometer, not live telemetry. Update Rides if the record is out of date. Saved targets stay fixed until you edit them or complete the task.","Siūlymai skaičiuojami nuo šios datos ir paskutinio įrašyto odometro, ne gyvos telemetrijos. Jei rodmuo pasenęs, atnaujink Važiavimus. Išsaugoti tikslai nekinta, kol jų neredaguoji arba neatlieki darbo.")}</p>
      <Button type="button" size="sm" variant="outline" onClick={resetSuggestions} disabled={busy}><RotateCcw/>{tr("Use suggested intervals","Naudoti siūlomus intervalus")}</Button>
    </div>
    <fieldset className="maintenance-reminders">
      <legend>{tr("Reminders — whichever comes first","Priminimai – kas sueina pirmiau")}</legend>
      <div className="maintenance-reminder-grid">
        <section className={`maintenance-reminder ${draft.dateEnabled?"enabled":""}`}>
          <label className="maintenance-toggle"><input type="checkbox" aria-label={tr("Date reminder","Priminimas pagal datą")} checked={draft.dateEnabled} onChange={event=>setDraft(current=>toggleMaintenanceReminder(current,"date",event.target.checked,state,entryDay))}/><CalendarClock/><strong>{tr("Date","Data")}</strong></label>
          <Field label={template.id==="insurance"?tr("Insurance valid until","Draudimas galioja iki"):tr("Due date","Atlikimo data")}><Input type="date" aria-label={tr("Due date","Atlikimo data")} required={draft.dateEnabled} disabled={!draft.dateEnabled} value={draft.dueDate} onChange={event=>update("dueDate",event.target.value)}/></Field>
          <Field label={tr("Remind days before","Priminti prieš dienų")}><Input type="number" inputMode="numeric" min={0} max={3650} step={1} aria-label={tr("Reminder days","Priminimo dienos")} disabled={!draft.dateEnabled} value={draft.remindDays} onChange={event=>update("remindDays",event.target.value)}/></Field>
        </section>
        <section className={`maintenance-reminder ${draft.mileageEnabled?"enabled":""}`}>
          <label className="maintenance-toggle"><input type="checkbox" aria-label={tr("Mileage reminder","Priminimas pagal ridą")} checked={draft.mileageEnabled} disabled={draft.targetKind!=="wheel"||currentOdometer===null} onChange={event=>setDraft(current=>toggleMaintenanceReminder(current,"mileage",event.target.checked,state,entryDay))}/><Gauge/><strong>{tr("Mileage","Rida")}</strong></label>
          <Field label={tr("Due at odometer, km","Atlikti ties odometru, km")}><Input aria-label={tr("Due odometer","Atlikimo odometras")} inputMode="decimal" disabled={!draft.mileageEnabled} required={draft.mileageEnabled} value={draft.dueOdometer} onChange={event=>update("dueOdometer",event.target.value)} placeholder={tr("Enter target","Įvesk tikslą")}/></Field>
          {draft.targetKind==="wheel"?<p className="field-hint">{tr("An absolute odometer record, not the distance remaining. The reminder reacts to saved ride records.","Absoliutus odometro rodmuo, ne likęs atstumas. Priminimas remiasi išsaugotais važiavimų rodmenimis.")}</p>:<p className="field-hint">{tr("Mileage reminders apply only to vehicles.","Ridos priminimai taikomi tik transporto priemonėms.")}</p>}
        </section>
      </div>
      {template.id==="insurance"&&!draft.dateEnabled&&<p className="inline-warning">{tr("Insurance needs an expiry date. Enable Date before saving.","Draudimui būtina galiojimo data. Prieš išsaugodamas įjunk Datą.")}</p>}
      {!hasReminder&&template.id!=="insurance"&&<p className="field-hint">{tr("Saved as an unscheduled checklist. No date or mileage alert will be generated. Event-based checks are not detected automatically.","Bus išsaugota kaip patikra be termino. Datos ar ridos pranešimo nebus. Įvykio patikros automatiškai neaptinkamos.")}</p>}
    </fieldset>
    <div className="maintenance-repeat">
      <label className="maintenance-toggle"><input type="checkbox" checked={draft.repeatEnabled&&hasReminder} disabled={!hasReminder} onChange={event=>update("repeatEnabled",event.target.checked)}/><span>{tr("Schedule the next check when completed","Atlikus suplanuoti kitą patikrą")}</span></label>
      {draft.repeatEnabled&&hasReminder&&<>
        <div className="form-grid">
          {draft.dateEnabled&&<Field label={tr("Repeat after completion","Kartoti po atlikimo")}><div className="maintenance-repeat-time"><Input aria-label={tr("Repeat time interval","Kartojimo laiko intervalas")} inputMode="numeric" type="number" min={1} max={draft.repeatUnit==="days"?36500:1200} step={1} value={draft.repeatTime} onChange={event=>update("repeatTime",event.target.value)} placeholder={tr("Optional","Neprivaloma")}/><Pick label={tr("Repeat time unit","Kartojimo laiko vienetas")} value={draft.repeatUnit} onChange={value=>update("repeatUnit",value as "days"|"months")} options={[{value:"days",label:tr("days","dienų")},{value:"months",label:tr("months","mėnesių")}]}/></div></Field>}
          {draft.mileageEnabled&&<Field label={tr("Repeat every, km","Kartoti kas, km")}><Input aria-label={tr("Repeat kilometres","Kartojimo kilometrai")} inputMode="decimal" value={draft.repeatKm} onChange={event=>update("repeatKm",event.target.value)} placeholder={tr("Optional","Neprivaloma")}/></Field>}
        </div>
        <p className="field-hint">{tr("The completed record stays in history. The next task starts from the completion date and the latest odometer then recorded. Update the odometer first if needed. Leave an interval blank to stop repeating that reminder.","Atliktas įrašas lieka istorijoje. Kita užduotis skaičiuojama nuo atlikimo datos ir tuo metu įrašyto odometro. Prireikus pirma atnaujink odometrą. Palik intervalą tuščią, jei to priminimo kartoti nereikia.")}</p>
        {template.id==="insurance"&&<p className="field-hint">{tr("Exception: insurance repeats from the entered expiry date. Always verify the renewed policy's actual expiry; the app cannot know its terms.","Išimtis: draudimas kartojamas nuo įvestos galiojimo pabaigos. Visada patikrink atnaujinto poliso tikrąją galiojimo datą; programėlė jo sąlygų nežino.")}</p>}
      </>}
    </div>
    <label className="check-card completed-check"><input type="checkbox" checked={draft.completed} onChange={event=>update("completed",event.target.checked)}/><span>{tr("Mark as completed","Pažymėti atlikta")}</span></label>
    <Field label={tr("Notes / actual condition","Pastabos / faktinė būklė")}><Textarea aria-label={tr("Maintenance notes","Priežiūros pastabos")} rows={3} maxLength={20000} value={draft.notes} onChange={event=>update("notes",event.target.value)} placeholder={tr("Symptoms, wear, pressure record, parts fitted, service notes…","Požymiai, nusidėvėjimas, slėgio rodmuo, pakeistos dalys, serviso pastabos…")}/></Field>
    <p className="maintenance-disclaimer"><TriangleAlert/>{tr("Suggested reminders, not an official Lynx-S or other manufacturer's service schedule. Vehicle and component instructions take priority. Damage, water, dust or unusual symptoms can require an earlier check. Notifications are checked while the app is active, not guaranteed when closed.","Siūlomi priminimai, ne oficialus Lynx-S ar kito gamintojo aptarnavimo grafikas. Priemonės ir komponento instrukcija turi pirmenybę. Pažeidimai, vanduo, dulkės ar neįprasti požymiai gali reikalauti ankstesnės patikros. Pranešimai tikrinami aktyvioje programoje; uždarius jie negarantuojami.")}</p>
    <DialogFooter><Button type="button" variant="outline" disabled={busy} onClick={onCancel}>{tr("Cancel","Atšaukti")}</Button><Button type="submit" disabled={busy||!targetOptions.some(item=>item.value===draft.targetId)||(template.id==="insurance"&&!draft.dateEnabled)}>{busy?<LoaderCircle className="spin"/>:<Check/>}{tr("Save","Išsaugoti")}</Button></DialogFooter>
  </form>;
}
