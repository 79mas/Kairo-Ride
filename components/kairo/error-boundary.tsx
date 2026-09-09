"use client";
import {Component,useState,type ErrorInfo,type ReactNode} from "react";
import {Download,Mail,RotateCcw,Stethoscope,TriangleAlert} from "lucide-react";
import {Button} from "@/components/ui/button";
import {backup} from "@/lib/kairo/domain";
import {diagnosticReport,recordDiagnostic,shareDiagnosticReport} from "@/lib/kairo/diagnostics";
import {loadWorkspace,metaGet,type Profile} from "@/lib/kairo/storage";
import {APP_VERSION} from "@/lib/kairo/version";
import {useI18n} from "@/lib/kairo/i18n";
import {explainError,friendlyError} from "@/lib/kairo/errors";

type State={error:Error|null;incidentId:string};
export class AppErrorBoundary extends Component<{children:ReactNode},State>{
  state:State={error:null,incidentId:""};
  static getDerivedStateFromError(error:Error){return {error,incidentId:""};}
  componentDidCatch(error:Error,info:ErrorInfo){
    void metaGet<Profile>("activeProfile").then(profile=>recordDiagnostic(profile?.namespace??"local","critical","UI.CRASH",{module:"react",action:"render",message:error.message,technical:error,source:info.componentStack??undefined})).then(incidentId=>this.setState({incidentId})).catch(()=>{});
  }
  render(){return this.state.error?<CriticalRecovery error={this.state.error} incidentId={this.state.incidentId}/>:this.props.children;}
}
function triggerDownload(blob:Blob,name:string){const url=URL.createObjectURL(blob),link=document.createElement("a");link.href=url;link.download=name;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60_000);}
export function CriticalRecovery({error,incidentId}:{error:Error;incidentId?:string}){
  const {tr,language}=useI18n(),[details,setDetails]=useState(false),[message,setMessage]=useState(""),explanation=explainError(error,language);
  async function namespace(){return (await metaGet<Profile>("activeProfile"))?.namespace??"local";}
  async function exportData(){try{const ns=await namespace(),workspace=await loadWorkspace(ns);triggerDownload(new Blob([JSON.stringify(backup(workspace.operations),null,2)],{type:"application/json"}),`Kairo-Ride-${APP_VERSION}-critical-recovery-${new Date().toISOString().replace(/[:.]/g,"-")}.json`);setMessage(tr("Recovery backup downloaded.","Atkūrimo kopija atsisiųsta."));}catch(reason){setMessage(friendlyError(reason,language));}}
  async function send(){try{const report=await diagnosticReport(await namespace());const result=await shareDiagnosticReport(report);setMessage(result==="shared"?tr("Share action completed; confirm and send it to the developer.","Bendrinimo veiksmas baigtas; patvirtink ir išsiųsk kūrėjui."):tr("Report downloaded; attach it to the opened email draft.","Ataskaita atsisiųsta; pridėk ją prie atverto laiško."));}catch(reason){setMessage(friendlyError(reason,language));}}
  return <main className="startup critical-recovery"><TriangleAlert/><h1>{tr("Kairo Ride encountered a critical error","Kairo Ride įvyko kritinė klaida")}</h1><p><strong>{explanation.title}.</strong> {explanation.message} {explanation.action}</p><p>{tr("Your saved records were not intentionally cleared. Export a local recovery copy before clearing browser data or reinstalling the PWA.","Išsaugoti įrašai nebuvo tyčia išvalyti. Prieš valant naršyklės duomenis ar perinstaliuojant PWA eksportuok vietinę atkūrimo kopiją.")}</p>{incidentId&&<small>{tr("Support reference","Pagalbos nuoroda")}: <code>{incidentId}</code></small>}<div className="button-row"><Button onClick={()=>location.reload()}><RotateCcw/>{tr("Reload app","Perkrauti programą")}</Button><Button variant="outline" onClick={()=>setDetails(!details)}><Stethoscope/>{tr("Technical details","Techninė informacija")}</Button><Button variant="outline" onClick={()=>void exportData()}><Download/>{tr("Export local data","Eksportuoti vietinius duomenis")}</Button><Button variant="outline" onClick={()=>void send()}><Mail/>{tr("Send report","Siųsti ataskaitą")}</Button></div>{details&&<pre>{error.stack??error.message}</pre>}{message&&<p role="status">{message}</p>}<p className="field-hint">{tr("Do not uninstall the PWA or clear site data until a recovery backup exists.","Neišdiek PWA iš naujo ir nevalyk svetainės duomenų, kol neturi atkūrimo kopijos.")}</p></main>;
}
