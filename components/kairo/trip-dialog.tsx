import {useId,useState} from "react";
import {Pencil,Plus,Trash2} from "lucide-react";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Textarea} from "@/components/ui/textarea";
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription,DialogFooter} from "@/components/ui/dialog";
import {entityKey,formatDate,formatKm,type Attachment,type State,type Trip} from "@/lib/kairo/domain";
import {tripRideStats} from "@/lib/kairo/stats";
import {useI18n} from "@/lib/kairo/i18n";
import {friendlyError} from "@/lib/kairo/storage";
import {Field} from "./form-fields";
import {DateInput} from "./date-input";
import {PendingFiles} from "./pending-files";
import {FileListView,RideRow,type ViewActions} from "./views";
export type TripDraft={value:Trip;changed:boolean;parents:string[];namespace:string;files:File[];removed:Attachment[]};
export function TripDialog({trip,state,namespace,initialEdit=false,actions,localIds,onDownload,onSave,onClose}:{trip:Trip;state:State;namespace:string;initialEdit?:boolean;actions:ViewActions;localIds:Set<string>;onDownload:(a:Attachment)=>void;onSave:(draft:TripDraft)=>Promise<void>;onClose:()=>void}){
  const {tr,locale}=useI18n(),formId=useId();
  const [initial]=useState(()=>({...trip})),[draft,setDraft]=useState(()=>({...trip})),[parents]=useState(()=>(state.heads.get(entityKey("trip",trip.id))??[]).map(r=>r.operationId));
  const [editing,setEditing]=useState(initialEdit),[files,setFiles]=useState<File[]>([]),[removed,setRemoved]=useState<Attachment[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState("");
  const changed=JSON.stringify(draft)!==JSON.stringify(initial),dirty=changed||files.length>0||removed.length>0,stats=tripRideStats(trip,state);
  const attachments=stats.attachments.filter(a=>!removed.some(r=>r.id===a.id));
  const leave=()=>{if(!busy&&(!dirty||window.confirm(tr("Discard unsaved trip changes?","Atmesti neišsaugotus kelionės pakeitimus?"))))onClose();};
  const navigate=(run:()=>void)=>{if(!dirty||window.confirm(tr("Discard unsaved trip changes?","Atmesti neišsaugotus kelionės pakeitimus?")))run();};
  const guarded:ViewActions={...actions,openEditor:(...args)=>navigate(()=>actions.openEditor(...args)),openRide:(...args)=>navigate(()=>actions.openRide(...args)),setDetail:d=>navigate(()=>actions.setDetail(d))};
  async function save(){if(busy||!dirty)return;setBusy(true);setError("");try{await onSave({value:draft,changed,parents,namespace,files,removed});onClose();}catch(e){setError(friendlyError(e));}finally{setBusy(false);}}
  return <Dialog open onOpenChange={open=>{if(!open)leave();}}><DialogContent className="detail-dialog trip-draft-dialog" showCloseButton={!busy}><DialogHeader><DialogTitle>{trip.name}</DialogTitle><DialogDescription>{formatDate(trip.startDate,false,undefined,locale)} → {formatDate(trip.endDate,false,undefined,locale)} · {formatKm(stats.distanceKm,locale)} km</DialogDescription></DialogHeader>
    <div className="entity-form">
      <div className="trip-draft-body"><form id={formId} className="trip-fields" onSubmit={event=>{event.preventDefault();void save();}}> 
      {!editing?<div className="detail-meta"><p className="preserve-lines">{trip.notes}</p><Button type="button" variant="ghost" size="sm" onClick={()=>setEditing(true)}><Pencil/>{tr("Edit","Redaguoti")}</Button></div>:<>
        <Field label={tr("Name","Pavadinimas")}><Input aria-label={tr("Trip name","Kelionės pavadinimas")} required maxLength={160} value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value})}/></Field>
        <div className="form-grid"><Field label={tr("Start date","Pradžios data")}><DateInput aria-label={tr("Trip start","Kelionės pradžia")} required value={draft.startDate} onValueChange={startDate=>setDraft({...draft,startDate,endDate:draft.endDate<startDate?startDate:draft.endDate})}/></Field><Field label={tr("End date","Pabaigos data")}><DateInput aria-label={tr("Trip end","Kelionės pabaiga")} required min={draft.startDate} value={draft.endDate} onValueChange={endDate=>setDraft({...draft,endDate})}/></Field></div>
        <Field label={tr("Notes","Pastabos")}><Textarea aria-label={tr("Trip notes","Kelionės pastabos")} value={draft.notes} maxLength={20000} onChange={e=>setDraft({...draft,notes:e.target.value})}/></Field>
      </>}
      </form><section className="detail-section"><div className="section-heading"><h3>{tr("Trip rides","Kelionės važiavimai")}</h3><Button type="button" variant="outline" size="sm" disabled={busy||!state.wheel.length} onClick={()=>navigate(()=>actions.openRide(undefined,undefined,trip.id))}><Plus/>{tr("Add ride","Pridėti važiavimą")}</Button></div>{stats.rides.length?stats.rides.map(ride=><RideRow key={ride.id} ride={ride} state={state} actions={guarded}/>):<p className="field-hint">{tr("No rides linked yet.","Važiavimų dar nėra.")}</p>}</section>
      <section className="detail-section"><h3>{tr("Trip files","Kelionės failai")}</h3><FileListView files={attachments} localIds={localIds} onDownload={onDownload} editable={editing&&!busy} onDelete={a=>{if(window.confirm(tr("Remove this file link when you save? The original Drive file is kept.","Pašalinti failo ryšį išsaugant? Originalas Drive liks.")))setRemoved([...removed,a]);}}/><PendingFiles files={files} onChange={setFiles} disabled={busy}/></section>
      {removed.length>0&&<p className="field-hint">{tr("File links marked for removal:","Pašalinti pažymėti failų ryšiai:")} {removed.length}. <Button type="button" variant="ghost" disabled={busy} onClick={()=>setRemoved([])}>{tr("Undo","Atšaukti pašalinimą")}</Button></p>}
      {editing&&<Button type="button" variant="destructive" disabled={busy} onClick={()=>navigate(()=>actions.askDelete("trip",trip))}><Trash2/>{tr("Delete trip","Pašalinti kelionę")}</Button>}
      {error&&<p role="alert" className="inline-warning">{error}</p>}
      </div><DialogFooter><Button type="button" variant="outline" disabled={busy} onClick={onClose}>{dirty?tr("Cancel","Atšaukti"):tr("Close","Uždaryti")}</Button><Button type="submit" form={formId} disabled={busy||!dirty}>{busy?tr("Saving…","Išsaugoma…"):tr("Save","Išsaugoti")}</Button></DialogFooter>
    </div>
  </DialogContent></Dialog>;
}
