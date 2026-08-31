import {Paperclip,X} from "lucide-react";
import {Button} from "@/components/ui/button";
import {useI18n} from "@/lib/kairo/i18n";
import {formatNumber} from "@/lib/kairo/numbers";
import {toast} from "sonner";

export function PendingFiles({files,onChange,disabled=false}:{files:File[];onChange:(files:File[])=>void;disabled?:boolean}){
  const {tr}=useI18n();
  return <section className="pending-files"><label className="file-picker"><Paperclip/><span>{tr("Add trip files","Pridėti kelionės failus")}</span><input aria-label={tr("Add trip files","Pridėti kelionės failus")} type="file" multiple disabled={disabled} onChange={event=>{
    const selected=Array.from(event.currentTarget.files??[]);event.currentTarget.value="";
    if(selected.some(file=>file.size>512*1024*1024)){toast.error(tr("The per-file limit is 512 MB.","Vieno failo riba – 512 MB."));return;}
    onChange([...files,...selected.filter(file=>!files.some(old=>old.name===file.name&&old.size===file.size&&old.lastModified===file.lastModified))]);
  }}/></label><p className="field-hint">{tr("GPX, CSV, photos, video and other originals. Added only when you press Save.","GPX, CSV, nuotraukos, video ir kiti originalai. Pridedami tik paspaudus Išsaugoti.")}</p>
  {files.map((file,index)=><div className="pending-file" key={index}><span>{file.name}<small>{formatNumber(file.size/1024/1024)} MB</small></span><Button type="button" variant="ghost" size="icon" disabled={disabled} aria-label={tr("Remove selected file","Atšaukti failo pasirinkimą")+": "+file.name} onClick={()=>onChange(files.filter((_,i)=>i!==index))}><X/></Button></div>)}
  </section>;
}
