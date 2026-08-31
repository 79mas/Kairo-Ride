import {useRef,useState} from "react";
import {Button} from "@/components/ui/button";
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription,DialogFooter} from "@/components/ui/dialog";
import {useI18n} from "@/lib/kairo/i18n";
export type ExportFile={blob:Blob;name:string;namespace:string};
export function ExportDialog({file,canSave,save,download,close}:{file:ExportFile;canSave:boolean;save:(file:ExportFile)=>Promise<void>;download:(blob:Blob,name:string)=>void;close:()=>void}){
  const {tr}=useI18n();
  const [local,setLocal]=useState(true),[drive,setDrive]=useState(false),[downloaded,setDownloaded]=useState(false),[saved,setSaved]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState("");
  const running=useRef(false);
  async function run(){
    if(running.current||(!local&&!drive))return;
    running.current=true;setBusy(true);setError("");
    try{
      if(drive&&!canSave)throw new Error(tr("Connect or refresh Google Drive access in Settings first.","Pirmiausia nustatymuose prijunk arba atnaujink Google Drive prieigą."));
      if(local&&!downloaded){download(file.blob,file.name);setDownloaded(true);}
      if(drive&&!saved){await save(file);setSaved(true);}
    }catch(e){setError(e instanceof Error?e.message:String(e));}
    finally{running.current=false;setBusy(false);}
  }
  const complete=(local||drive)&&(!local||downloaded)&&(!drive||saved);
  return <Dialog open onOpenChange={open=>{if(!open&&!busy)close();}}><DialogContent showCloseButton={!busy}><DialogHeader><DialogTitle>{tr("Export","Eksportas")}</DialogTitle><DialogDescription>{file.name}</DialogDescription></DialogHeader>
    <label className="auto-sync-setting"><input type="checkbox" checked={local} disabled={busy} onChange={e=>setLocal(e.target.checked)}/>{tr("Download file","Atsisiųsti failą")}</label>
    <label className="auto-sync-setting"><input type="checkbox" checked={drive} disabled={busy} onChange={e=>setDrive(e.target.checked)}/>{tr("Save to Google Drive","Išsaugoti į Google Drive")}</label>
    {drive&&!canSave&&<p className="field-hint">{tr("Connect Google Drive in Settings, then reopen export.","Prijunk Google Drive nustatymuose ir vėl atverk eksportą.")}</p>}
    {downloaded&&<p role="status">{tr("Download started.","Atsisiuntimas pradėtas.")}</p>}{saved&&<p role="status">{tr("Saved to Kairo Ride / Exports in Google Drive.","Išsaugota Google Drive aplanke Kairo Ride / Exports.")}</p>}
    {error&&<p role="alert" className="inline-warning">{error}</p>}
    <DialogFooter><Button variant="outline" disabled={busy} onClick={close}>{tr("Close","Uždaryti")}</Button><Button disabled={busy||complete||(!local&&!drive)||(drive&&!canSave)} onClick={()=>void run()}>{busy?tr("Exporting…","Eksportuojama…"):tr("Export","Eksportuoti")}</Button></DialogFooter>
  </DialogContent></Dialog>;
}
