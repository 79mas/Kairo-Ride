import {appPath} from "./paths";
import {APP_VERSION,readBuildInfo} from "./version";
import {appendDiagnostic,clearDiagnostics,listDiagnostics,storageSelfCheck,type StoredDiagnostic} from "./storage";

export type DiagnosticLevel="info"|"warning"|"error"|"critical";
export type DiagnosticContext={
  action?:string;module?:string;page?:string;message?:string;technical?:unknown;
  before?:unknown;after?:unknown;retryable?:boolean;source?:string;
};
export type DiagnosticEvent=StoredDiagnostic&{
  level:DiagnosticLevel;code:string;incidentId:string;message:string;appVersion:string;buildId:string;
  action?:string;module?:string;page?:string;technical?:unknown;stack?:string;source?:string;
  before?:unknown;after?:unknown;retryable?:boolean;
};
export type HealthReport={
  checkedAt:string;app:{status:"ok"|"warning";version:string;buildId:string};
  database:{status:"ok"|"error";details?:unknown};drive:{status:"ok"|"warning";connected:boolean;account:string};
  synchronization:{status:"ok"|"warning";pendingRecords:number;pendingFiles:number;conflicts:number;lastSync?:string};
  storage:{status:"ok"|"warning";usage?:number;quota?:number;persisted?:boolean};
  serviceWorker:{status:"ok"|"warning";controlled:boolean};
};

const DETAIL_KEY=`kairo-detailed-diagnostics@${appPath()}`;
const secretKey=/token|authorization|cookie|secret|password|session|permissionid|driveid|fileid/i;
const fileKey=/filename|file_name/i;
const redactString=(value:string)=>value
  .replace(/Bearer\s+[A-Za-z0-9._~+\/-]+/gi,"Bearer [redacted]")
  .replace(/https:\/\/www\.googleapis\.com\/upload\/drive\/v3\/files\?[^\s"']+/gi,"[redacted upload session]")
  .slice(0,12_000);
function maskedFilename(value:string){const extension=value.includes(".")?`.${value.split(".").at(-1)?.slice(0,12)}`:"";return `[file hidden]${extension}`;}
export function sanitizeDiagnostic(value:unknown,key="",seen=new WeakSet<object>()):unknown{
  if(secretKey.test(key))return "[redacted]";
  if(typeof value==="string")return fileKey.test(key)?maskedFilename(value):redactString(value);
  if(typeof value==="number"||typeof value==="boolean"||value==null)return value;
  if(value instanceof Error)return {name:value.name,message:redactString(value.message),stack:redactString(value.stack??"")};
  if(typeof value!=="object")return String(value);
  if(seen.has(value))return "[circular]";seen.add(value);
  if(Array.isArray(value))return value.slice(0,100).map(item=>sanitizeDiagnostic(item,"",seen));
  return Object.fromEntries(Object.entries(value as Record<string,unknown>).slice(0,100).map(([name,item])=>[name,sanitizeDiagnostic(item,name,seen)]));
}
export function detailedDiagnosticsUntil():number{try{return Number(localStorage.getItem(DETAIL_KEY)??0)||0;}catch{return 0;}}
export function detailedDiagnosticsEnabled(now=Date.now()):boolean{return detailedDiagnosticsUntil()>now;}
export function enableDetailedDiagnostics(minutes=30){const until=Date.now()+Math.max(1,minutes)*60_000;localStorage.setItem(DETAIL_KEY,String(until));return until;}
export function disableDetailedDiagnostics(){try{localStorage.removeItem(DETAIL_KEY);}catch{/* Preference is optional. */}}
const incident=()=>`KR-${new Date().toISOString().replace(/\D/g,"").slice(2,14)}-${crypto.randomUUID().slice(0,6).toUpperCase()}`;
export async function recordDiagnostic(namespace:string,level:DiagnosticLevel,code:string,context:DiagnosticContext={}):Promise<string>{
  const build=await readBuildInfo(),createdAt=new Date().toISOString(),incidentId=incident();
  const technical=context.technical instanceof Error?{name:context.technical.name,message:context.technical.message}:context.technical;
  const stack=context.technical instanceof Error?context.technical.stack:undefined;
  const row:DiagnosticEvent={key:`${namespace}|${createdAt}|${crypto.randomUUID()}`,namespace,createdAt,level,code:code.replace(/[^A-Z0-9_.-]/gi,"_").toUpperCase().slice(0,80),incidentId,
    message:(context.message??(context.technical instanceof Error?context.technical.message:"Application event")).slice(0,1000),appVersion:APP_VERSION,buildId:build.buildId,
    ...(context.action?{action:context.action}:{}),...(context.module?{module:context.module}:{}),...(context.page?{page:context.page}:{}),
    ...(technical!==undefined?{technical:sanitizeDiagnostic(technical)}:{}),...(stack?{stack:redactString(stack)}:{}),...(context.source?{source:redactString(context.source)}:{}),
    ...(context.before!==undefined&&detailedDiagnosticsEnabled()?{before:sanitizeDiagnostic(context.before)}:{}),...(context.after!==undefined&&detailedDiagnosticsEnabled()?{after:sanitizeDiagnostic(context.after)}:{}),
    ...(context.retryable!==undefined?{retryable:context.retryable}:{})};
  await appendDiagnostic(row);return incidentId;
}
export async function recordError(namespace:string,code:string,error:unknown,context:Omit<DiagnosticContext,"technical"|"message">={}):Promise<string>{
  return recordDiagnostic(namespace,"error",code,{...context,technical:error,message:error instanceof Error?error.message:String(error)});
}
export function installGlobalDiagnostics(namespace:()=>string){
  const onError=(event:ErrorEvent)=>{void recordDiagnostic(namespace(),"critical","JS.UNHANDLED",{module:"runtime",action:"window.error",message:event.message,technical:event.error??event.message,source:event.filename?`${event.filename}:${event.lineno}:${event.colno}`:undefined}).catch(()=>{});};
  const onRejection=(event:PromiseRejectionEvent)=>{void recordDiagnostic(namespace(),"critical","JS.REJECTION",{module:"runtime",action:"unhandledrejection",message:event.reason instanceof Error?event.reason.message:"Unhandled promise rejection",technical:event.reason}).catch(()=>{});};
  window.addEventListener("error",onError);window.addEventListener("unhandledrejection",onRejection);
  return()=>{window.removeEventListener("error",onError);window.removeEventListener("unhandledrejection",onRejection);};
}
export async function runHealthCheck(namespace:string,input:{connected:boolean;account?:string;pendingRecords:number;pendingFiles:number;conflicts:number;lastSync?:string}):Promise<HealthReport>{
  const build=await readBuildInfo();let database:HealthReport["database"];
  try{database={status:"ok",details:await storageSelfCheck(namespace)};}catch(error){database={status:"error",details:sanitizeDiagnostic(error)};}
  const estimate=await navigator.storage?.estimate?.().catch(()=>undefined),persisted=await navigator.storage?.persisted?.().catch(()=>false);
  const pressure=!!estimate?.quota&&!!estimate.usage&&estimate.usage/estimate.quota>.85;
  return {checkedAt:new Date().toISOString(),app:{status:build.buildId==="unknown"?"warning":"ok",version:APP_VERSION,buildId:build.buildId},database,
    drive:{status:input.connected?"ok":"warning",connected:input.connected,account:input.account??"Local workspace"},
    synchronization:{status:input.pendingRecords||input.pendingFiles||input.conflicts?"warning":"ok",pendingRecords:input.pendingRecords,pendingFiles:input.pendingFiles,conflicts:input.conflicts,...(input.lastSync?{lastSync:input.lastSync}:{})},
    storage:{status:pressure?"warning":"ok",usage:estimate?.usage,quota:estimate?.quota,persisted},serviceWorker:{status:navigator.serviceWorker?.controller?"ok":"warning",controlled:!!navigator.serviceWorker?.controller}};
}
export async function diagnosticReport(namespace:string,health?:HealthReport){
  const [events,build]=await Promise.all([listDiagnostics(namespace),readBuildInfo()]);
  return sanitizeDiagnostic({format:"kairo-ride-diagnostics",generatedAt:new Date().toISOString(),app:{version:APP_VERSION,buildId:build.buildId,builtAt:build.builtAt},health,environment:{online:navigator.onLine,language:navigator.language,displayMode:matchMedia("(display-mode: standalone)").matches?"standalone":"browser"},events}) as Record<string,unknown>;
}
export function diagnosticText(report:Record<string,unknown>){return `Kairo Ride diagnostics\nDeveloper: kairosbytomas@gmail.com\n\n${JSON.stringify(report,null,2)}`;}
export async function clearDiagnosticLog(namespace:string){await clearDiagnostics(namespace);}
export async function loadDiagnosticLog(namespace:string){return listDiagnostics(namespace) as Promise<DiagnosticEvent[]>;}
export async function shareDiagnosticReport(report:Record<string,unknown>):Promise<"shared"|"downloaded">{
  const text=diagnosticText(report),file=new File([text],`Kairo-Ride-${APP_VERSION}-diagnostics-${new Date().toISOString().replace(/[:.]/g,"-")}.txt`,{type:"text/plain"});
  const data={title:`Kairo Ride ${APP_VERSION} diagnostics`,text:"Please send this diagnostic report to kairosbytomas@gmail.com. Review the attachment before sending.",files:[file]};
  if(navigator.share&&(!navigator.canShare||navigator.canShare(data))){await navigator.share(data);return "shared";}
  const url=URL.createObjectURL(file),link=document.createElement("a");link.href=url;link.download=file.name;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60_000);
  const body=encodeURIComponent(`Kairo Ride ${APP_VERSION} diagnostics\n\nThe full report was downloaded as ${file.name}. Please attach it to this email.`);
  location.href=`mailto:kairosbytomas@gmail.com?subject=${encodeURIComponent(data.title)}&body=${body}`;return "downloaded";
}
export {APP_VERSION};
