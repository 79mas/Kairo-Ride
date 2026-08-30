"use client";
/* eslint-disable @next/next/no-img-element -- Vite serves the local PWA icon; next/image is not available. */
import {useCallback,useEffect,useRef,useState} from "react";
import {ArrowRight,Backpack,BarChart3,Check,CircleHelp,Cloud,CloudOff,FolderOpen,HardDrive,Home,LoaderCircle,Mountain,Paperclip,Pencil,Plus,Route,Settings,ShieldCheck,TriangleAlert,WifiOff,Wrench} from "lucide-react";
import {toast} from "sonner";
import {Toaster} from "@/components/ui/sonner";
import {Button} from "@/components/ui/button";
import {Tabs,TabsList,TabsTrigger} from "@/components/ui/tabs";
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription,DialogFooter} from "@/components/ui/dialog";
import {AlertDialog,AlertDialogContent,AlertDialogHeader,AlertDialogTitle,AlertDialogDescription,AlertDialogFooter,AlertDialogCancel,AlertDialogAction} from "@/components/ui/alert-dialog";
import {Skeleton} from "@/components/ui/skeleton";
import {EntityForm,ltTitles,titles,type EditableKind,type Editor,type FormSubmission} from "./forms";
import {MainViews,RideRow,FileListView,type Detail,type View,type ViewActions} from "./views";
import {StoragePanel} from "./storage-panel";
import {notifyVehicleMaintenance} from "./vehicle-status";
import {garageReminders,vehicleReminder} from "@/lib/kairo/vehicle-status";
import {backup,canRecordWithWheel,entityKey,formatDate,formatKm,parseBackup,project,today,validateDelete,validateEdit,type Attachment,type Conflict,type Entity,type Kind,type Maintenance,type Reading,type Ride} from "@/lib/kairo/domain";
import {addAttachment,commit,commitChanges,copyLocalToAccount,friendlyError,loadWorkspace,mergeOperations,metaGet,metaSet,type Profile,type Workspace} from "@/lib/kairo/storage";
import {authorizeGoogle,cachedCloudStatus,prepareGoogle,readDriveConfig,type DriveClient,type DriveConfig} from "@/lib/kairo/drive";
import {exportWorkbook,readXlsx,workbookImport,writeXlsx,type ImportPreview} from "@/lib/kairo/excel";
import {appPath,LOCAL_CHANNEL} from "@/lib/kairo/paths";
import {useI18n} from "@/lib/kairo/i18n";
import {dueMaintenance,readingForRide,rideEntries,tripRideStats} from "@/lib/kairo/stats";
import {syncFailureKind,type SyncOutcome} from "@/lib/kairo/auto-sync";
import {useAutoSync} from "@/hooks/use-auto-sync";
import {nextMaintenanceOccurrence} from "@/lib/kairo/maintenance";
import {showLocalNotification} from "@/lib/kairo/notifications";

const blank:Workspace={state:project([]),operations:[],pending:[],blobs:[]};
function download(blob:Blob,name:string){const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60_000);}
export default function KairoApp(){
  const {tr,language,locale}=useI18n();
  const nav=[{id:"overview",label:tr("Home","Apžvalga"),icon:Home},{id:"rides",label:tr("Rides","Važiavimai"),icon:Route},{id:"trips",label:tr("Trips","Kelionės"),icon:Mountain},{id:"wheels",label:tr("Garage","Garažas"),icon:Wrench},{id:"gear",label:tr("Gear","Ekipuotė"),icon:Backpack},{id:"analytics",label:tr("Analytics","Analitika"),icon:BarChart3}] as const;
  const [ready,setReady]=useState(false),[fatal,setFatal]=useState("");
  const [workspace,setWorkspace]=useState<Workspace>(blank),[profile,setProfile]=useState<Profile|null>(null);
  const namespace=useRef("local"),client=useRef<DriveClient|null>(null),syncing=useRef<DriveClient|null>(null);
  const [online,setOnline]=useState(true),[connection,setConnection]=useState(false),[syncMessage,setSyncMessage]=useState("");
  const [autoSyncEnabled,setAutoSyncEnabled]=useState(()=>typeof localStorage==="undefined"||localStorage.getItem(`kairo-auto-sync@${appPath()}`)!=="off");
  const [syncIssue,setSyncIssue]=useState<{message:string;retry:boolean}|null>(null);
  const [cloud,setCloud]=useState<{rootId?:string;lastSync?:string}>({});
  const [view,setView]=useState<View>("overview"),[editor,setEditor]=useState<Editor|null>(null),[detail,setDetail]=useState<Detail|null>(null);
  const [driveOpen,setDriveOpen]=useState(false),[config,setConfig]=useState<DriveConfig|null>(null),[googleReady,setGoogleReady]=useState(false),[connecting,setConnecting]=useState(false);
  const [candidate,setCandidate]=useState<{client:DriveClient;profile:Profile;hasLocal:boolean}|null>(null);
  const [pendingDelete,setPendingDelete]=useState<{kind:Kind;entity:Entity;linkedReading?:Reading;parents:string[];readingParents?:string[];namespace:string}|null>(null);
  const [importPreview,setImportPreview]=useState<(ImportPreview&{namespace:string})|null>(null),[importBusy,setImportBusy]=useState(false),[importZone,setImportZone]=useState("Europe/Vilnius");
  const [conflict,setConflict]=useState<Conflict|null>(null),[persisted,setPersisted]=useState(false),[busy,setBusy]=useState(false),[offlineReady,setOfflineReady]=useState(false);
  const [notificationsEnabled,setNotificationsEnabled]=useState(()=>typeof localStorage!=="undefined"&&localStorage.getItem("kairo-notifications")==="on");
  const [maintenanceDay,setMaintenanceDay]=useState(today),notifying=useRef(new Set<string>());
  const importInput=useRef<HTMLInputElement>(null),attachmentInput=useRef<HTMLInputElement>(null);
  const state=workspace.state;
  useEffect(()=>{if(!editor)toast.dismiss("kairo-vehicle-maintenance-record");},[editor]);
  useEffect(()=>{toast.dismiss("kairo-vehicle-maintenance-garage");toast.dismiss("kairo-vehicle-maintenance-record");},[profile?.namespace]);
  const refresh=useCallback(async()=>{const ns=namespace.current,next=await loadWorkspace(ns);if(ns===namespace.current)setWorkspace(next);},[]);
  useEffect(()=>{
    let mounted=true;
    void(async()=>{try{const active=await metaGet<Profile>("activeProfile");if(!mounted)return;if(active){namespace.current=active.namespace;setProfile(active);setCloud(await cachedCloudStatus(active.namespace));}await refresh();if(mounted){setReady(true);setPersisted(await navigator.storage?.persisted?.()??false);}}catch(e){if(mounted)setFatal(`Could not open this device's storage. ${friendlyError(e)}`);}})();
    const network=()=>setOnline(navigator.onLine);network();window.addEventListener("online",network);window.addEventListener("offline",network);
    const channel=typeof BroadcastChannel!=="undefined"?new BroadcastChannel(LOCAL_CHANNEL):null;if(channel)channel.onmessage=e=>{if(e.data===namespace.current)void refresh().catch(e=>toast.error(friendlyError(e)));};
    const updateDay=()=>{if(document.visibilityState==="visible")setMaintenanceDay(today());};
    window.addEventListener("focus",updateDay);document.addEventListener("visibilitychange",updateDay);
    const timer=setInterval(()=>{setConnection(!!client.current?.connected);updateDay();},15000);
    const swMessage=(e:MessageEvent)=>{if(e.data?.type==="KAIRO_OFFLINE_READY")setOfflineReady(true);};
    if("serviceWorker"in navigator){navigator.serviceWorker.addEventListener("message",swMessage);void navigator.serviceWorker.register(appPath("sw.js"),{scope:appPath(),updateViaCache:"none"}).then(()=>navigator.serviceWorker.ready).then(reg=>reg.active?.postMessage({type:"CHECK_OFFLINE"})).catch(()=>{});}
    return()=>{mounted=false;window.removeEventListener("online",network);window.removeEventListener("offline",network);window.removeEventListener("focus",updateDay);document.removeEventListener("visibilitychange",updateDay);channel?.close();clearInterval(timer);navigator.serviceWorker?.removeEventListener("message",swMessage);client.current?.disconnect();};
  },[refresh]);
  useEffect(()=>{if(!driveOpen)return;let live=true;void readDriveConfig().then(async cfg=>{if(!live)return;setConfig(cfg);if(cfg.googleClientId){await prepareGoogle();if(live)setGoogleReady(true);}}).catch(e=>toast.error(friendlyError(e)));return()=>{live=false;};},[driveOpen]);
  useEffect(()=>{if(!ready||!online)return;let live=true;void readDriveConfig().then(async cfg=>{if(!live)return;setConfig(cfg);if(cfg.googleClientId){await prepareGoogle();if(live)setGoogleReady(true);}}).catch(()=>{});return()=>{live=false;};},[ready,online]);
  const runSync=useCallback(async(manual:boolean):Promise<SyncOutcome>=>{
    const api=client.current,ns=namespace.current;if(!api||ns==="local")return "inactive";
    if(syncing.current===api)return "success";
    syncing.current=api;setSyncMessage(tr("Checking Drive…","Tikrinamas Drive…"));setSyncIssue(null);
    try{const result=await api.sync(ns,s=>{if(namespace.current===ns&&client.current===api)setSyncMessage(s);});if(namespace.current===ns&&client.current===api){setCloud(result);setConnection(api.connected);await refresh();return "success";}return "inactive";}
    catch(e){if(client.current!==api||namespace.current!==ns)return "inactive";const outcome=syncFailureKind(e),message=friendlyError(e);setSyncIssue({message,retry:outcome==="retry"});setConnection(api.connected);if(manual)toast.error(message,{duration:8000});await refresh().catch(()=>{});return outcome;}
    finally{if(syncing.current===api)syncing.current=null;if(client.current===api)setSyncMessage("");}
  },[refresh,tr]);
  const pendingKey=[...workspace.pending.map(record=>record.operation.id),...workspace.blobs.filter(blob=>state.attachment.some(a=>a.id===blob.attachmentId&&!a.driveId)).map(blob=>`file:${blob.attachmentId}`)].sort().join("|");
  const syncNow=useAutoSync({enabled:autoSyncEnabled,connected:connection,online,pendingKey,run:runSync});
  function changeAutoSync(enabled:boolean){localStorage.setItem(`kairo-auto-sync@${appPath()}`,enabled?"on":"off");setAutoSyncEnabled(enabled);}
  function changeView(next:View){
    if(next==="wheels")notifyVehicleMaintenance(garageReminders(state),{tr,locale},"garage");
    else toast.dismiss("kairo-vehicle-maintenance-garage");
    setView(next);
  }
  function prepareNewRecord(){
    toast.dismiss("kairo-vehicle-maintenance-garage");
    const wheel=state.wheel.find(canRecordWithWheel);
    if(!wheel){toast.error(tr("No vehicle is available for new records. Set a vehicle to Active, Active! or Spare in Garage.","Naujiems įrašams nėra tinkamos priemonės. Garaže pasirink Aktyvus, Aktyvus! arba Atsarginis."),{duration:10000,action:{label:tr("Open Garage","Atverti garažą"),onClick:()=>changeView("wheels")}});return false;}
    const reminder=vehicleReminder(wheel,state);
    notifyVehicleMaintenance(reminder?[reminder]:[],{tr,locale},"record");
    return true;
  }
  const openEditor=(kind:EditableKind,entity?:Entity,tripId?:string)=>{if(kind==="reading"&&!entity&&!prepareNewRecord())return;setDetail(null);setEditor({kind,entity,tripId,namespace:namespace.current,parents:entity?(state.heads.get(entityKey(kind,entity.id))??[]).map(r=>r.operationId):[]});};
  const openRide=(ride?:Ride,reading?:Reading,tripId?:string)=>{if(!ride&&!reading&&!prepareNewRecord())return;setDetail(null);setEditor({kind:"ride",entity:ride,reading,tripId,namespace:namespace.current,parents:ride?(state.heads.get(entityKey("ride",ride.id))??[]).map(r=>r.operationId):[],readingParents:reading?(state.heads.get(entityKey("reading",reading.id))??[]).map(r=>r.operationId):[]});};
  const askDelete=(kind:Kind,entity:Entity,linkedReading?:Reading)=>setPendingDelete({kind,entity,linkedReading,namespace:namespace.current,parents:(state.heads.get(entityKey(kind,entity.id))??[]).map(r=>r.operationId),readingParents:linkedReading?(state.heads.get(entityKey("reading",linkedReading.id))??[]).map(r=>r.operationId):undefined});
  const actions:ViewActions={openEditor,openRide,askDelete,setDetail};
  async function save(request:FormSubmission){if(!editor)return;const form=editor,value=request.value;setBusy(true);try{
    if(form.namespace!==namespace.current)throw new Error("The account changed. Reopen the record.");
    const current=(await loadWorkspace(form.namespace)).state;
    let repeated=false;
    if(form.kind==="ride"){
      if(request.newTrip)validateEdit(current,"trip",request.newTrip);
      const validationState=request.newTrip?{...current,trip:[...current.trip,request.newTrip]}:current;
      validateEdit(validationState,"ride",value);
      if(request.reading)validateEdit(current,"reading",request.reading);
      const changes=[...(request.newTrip?[{kind:"trip" as const,value:request.newTrip,entityId:request.newTrip.id}]:[]),{kind:"ride" as const,value,entityId:value.id,parents:form.parents},...(request.reading!==undefined&&(request.reading||form.reading)?[{kind:"reading" as const,value:request.reading,entityId:request.readingId!,parents:form.readingParents}]:[])];
      await commitChanges(form.namespace,changes);
    }else if(form.kind==="maintenance"){
      const item=value as Maintenance,previous=form.entity as Maintenance|undefined;
      validateEdit(current,"maintenance",item);
      if(item.completedAt&&!previous?.completedAt&&current.maintenance.some(saved=>saved.id===item.id&&saved.completedAt))throw new Error("This task was already completed in another window or device. Reopen it to see the latest state.");
      const next=item.completedAt&&!previous?.completedAt?nextMaintenanceOccurrence(item,current):null;
      if(next)validateEdit(current,"maintenance",next);
      await commitChanges(form.namespace,[{kind:"maintenance",value:item,entityId:item.id,parents:form.parents},...(next?[{kind:"maintenance" as const,value:next,entityId:next.id}]:[])]);
      repeated=!!next;
    }else{validateEdit(current,form.kind,value);await commit(form.namespace,form.kind,value,value.id,undefined,form.parents);}
    await refresh();setEditor(null);toast.success(repeated?tr("Saved and scheduled the next occurrence.","Išsaugota ir suplanuotas kitas kartas."):tr("Saved on this device.","Išsaugota šiame įrenginyje."));
  }catch(e){toast.error(friendlyError(e));}finally{setBusy(false);}}
  async function remove(){if(!pendingDelete)return;const t=pendingDelete;setBusy(true);try{if(t.namespace!==namespace.current)throw new Error("The account changed.");const current=(await loadWorkspace(t.namespace)).state;validateDelete(current,t.kind,t.entity.id);if(t.linkedReading)validateDelete(current,"reading",t.linkedReading.id);const changes=[{kind:t.kind,value:null,entityId:t.entity.id,parents:t.parents},...(t.linkedReading?[{kind:"reading" as const,value:null,entityId:t.linkedReading.id,parents:t.readingParents}]:[])];const deletion=await commitChanges(t.namespace,changes);await refresh();setPendingDelete(null);if(detail?.id===t.entity.id)setDetail(null);toast.success(t.kind==="attachment"?tr("Link removed. The Drive original remains.","Nuoroda pašalinta. Drive originalas liko."):tr("Record deleted.","Įrašas pašalintas."),{action:{label:tr("Undo","Atšaukti"),onClick:()=>{const restore=[{kind:t.kind,value:t.entity,entityId:t.entity.id,parents:[deletion.id]},...(t.linkedReading?[{kind:"reading" as const,value:t.linkedReading,entityId:t.linkedReading.id,parents:[deletion.id]}]:[])];void commitChanges(t.namespace,restore).then(refresh).catch(e=>toast.error(friendlyError(e)));}},duration:12000});}catch(e){toast.error(friendlyError(e));}finally{setBusy(false);}}
  async function activate(next:{client:DriveClient;profile:Profile},copy:boolean){
    setConnecting(true);
    try{
      if(copy)await copyLocalToAccount(next.profile);
      const [target,targetCloud]=await Promise.all([loadWorkspace(next.profile.namespace),cachedCloudStatus(next.profile.namespace)]);
      await metaSet("activeProfile",next.profile);
      client.current?.disconnect();client.current=next.client;namespace.current=next.profile.namespace;
      setWorkspace(target);setCloud(targetCloud);setProfile(next.profile);setConnection(next.client.connected);
      setCandidate(null);setDetail(null);setEditor(null);setImportPreview(null);setConflict(null);setPendingDelete(null);setSyncMessage("");
      toast.success(`${tr("Connected","Prijungta")} ${next.profile.email}`);void syncNow();
    }catch(e){next.client.disconnect();setCandidate(null);toast.error(friendlyError(e));}finally{setConnecting(false);}
  }
  function connect(){if(!config?.googleClientId||!googleReady||connecting)return;setConnecting(true);void authorizeGoogle(config.googleClientId,profile?.email).then(async api=>{try{const p=await api.about();if(namespace.current===p.namespace){await activate({client:api,profile:p},false);return;}const local=await loadWorkspace("local");if(namespace.current==="local"&&local.operations.length===0){await activate({client:api,profile:p},false);return;}setCandidate({client:api,profile:p,hasLocal:namespace.current==="local"&&local.operations.length>0});}catch(e){api.disconnect();throw e;}}).catch(e=>toast.error(friendlyError(e),{duration:8000})).finally(()=>setConnecting(false));}
  async function disconnect(){
    client.current?.disconnect();client.current=null;setConnection(false);setSyncMessage("");setSyncIssue(null);setWorkspace(blank);
    const local=await loadWorkspace("local");await metaSet("activeProfile",null);
    namespace.current="local";setWorkspace(local);setProfile(null);setCloud({});setDetail(null);setEditor(null);setImportPreview(null);setConflict(null);setPendingDelete(null);
    toast.info(tr("Disconnected. This account's local copy remains separate and will return with the same account.","Atsijungta. Paskyros vietinė kopija lieka atskirta ir grįš prisijungus ta pačia paskyra."));
  }
  async function readImport(file:File){const ns=namespace.current;setImportBusy(true);try{if(file.size>25*1024*1024)throw new Error("Import file limit is 25 MB.");let preview:ImportPreview;if(file.name.toLowerCase().endsWith(".json")){const operations=parseBackup(JSON.parse(await file.text())),s=project(operations);preview={operations,warnings:["The JSON backup contains records and attachment links. Original attachment files are not embedded."],counts:{wheel:s.wheel.length,reading:s.reading.length,ride:s.ride.length,trip:s.trip.length,gear:s.gear.length,maintenance:s.maintenance.length,attachment:s.attachment.length},source:file.name};}else preview=await workbookImport(await readXlsx(new Uint8Array(await file.arrayBuffer())),importZone);setImportPreview({...preview,namespace:ns});}catch(e){toast.error(friendlyError(e),{duration:10000});}finally{setImportBusy(false);}}
  async function applyImport(){if(!importPreview)return;setImportBusy(true);try{if(importPreview.namespace!==namespace.current)throw new Error("The account changed. Choose the import file again.");await mergeOperations(namespace.current,importPreview.operations,false);await refresh();setImportPreview(null);toast.success(tr("Import complete. The original file was not changed.","Importas baigtas. Originalus failas nepakeistas."));}catch(e){toast.error(friendlyError(e));}finally{setImportBusy(false);}}
  function exportData(format:"json"|"xlsx"){try{if(format==="json")download(new Blob([JSON.stringify(backup(workspace.operations),null,2)],{type:"application/json"}),`Kairo-Ride-${today()}.json`);else download(new Blob([writeXlsx(exportWorkbook(workspace.operations)) as BlobPart],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}),`Kairo-Ride-${today()}.xlsx`);toast.success(tr("Export ready. Original attachments are not embedded.","Eksportas paruoštas. Priedų originalai neįtraukti."));}catch(e){toast.error(friendlyError(e));}}
  async function attach(files:FileList|null){if(!files||!detail)return;const owner={...detail},ns=namespace.current;setBusy(true);let count=0;try{for(const file of Array.from(files)){await addAttachment(ns,owner.kind,owner.id,file);count++;}toast.success(`${tr("Files saved on this device","Failų išsaugota šiame įrenginyje")}: ${count}.`);}catch(e){toast.error(`${count?`${tr("Saved","Išsaugota")} ${count}. `:""}${friendlyError(e)}`,{duration:9000});}finally{await refresh();setBusy(false);}}
  function localDownload(a:Attachment){const b=workspace.blobs.find(b=>b.attachmentId===a.id);if(b)download(b.blob,a.name);else toast.info(tr("The original is not on this device. Open it in Drive.","Originalo šiame įrenginyje nėra. Atverk jį Drive."));}
  async function resolveRevision(value:Entity|null){if(!conflict)return;setBusy(true);try{await commit(namespace.current,conflict.kind,value,conflict.entityId,undefined,conflict.revisions.map(r=>r.operationId));await refresh();setConflict(null);toast.success(tr("Selected version saved. Both earlier versions remain in history.","Pasirinkta versija išsaugota. Abi ankstesnės lieka istorijoje."));}catch(e){toast.error(friendlyError(e));}finally{setBusy(false);}}
  async function persist(){try{const value=await navigator.storage?.persist?.();setPersisted(!!value);toast.info(value?tr("The browser granted more persistent local storage.","Naršyklė suteikė patvaresnę vietinę saugyklą."):tr("The browser did not grant it. Export backups regularly.","Naršyklė leidimo nesuteikė. Reguliariai eksportuok kopiją."));}catch(e){toast.error(friendlyError(e));}}
  async function enableNotifications(){
    if(!("Notification" in window)){toast.info(tr("This browser does not support notifications.","Ši naršyklė nepalaiko pranešimų."));return;}
    try{
      const permission=await Notification.requestPermission();const enabled=permission==="granted";
      localStorage.setItem("kairo-notifications",enabled?"on":"off");setNotificationsEnabled(enabled);
      toast.info(enabled?tr("Local reminders enabled.","Vietiniai priminimai įjungti."):tr("Notification permission was not granted.","Leidimas pranešimams nesuteiktas."));
    }catch{toast.info(tr("Could not enable system notifications. Maintenance status is still shown inside the app.","Nepavyko įjungti sistemos pranešimų. Priežiūros būsena vis tiek rodoma programėlėje."));}
  }
  function disableNotifications(){localStorage.setItem("kairo-notifications","off");setNotificationsEnabled(false);}
  useEffect(()=>{
    if(!ready||!notificationsEnabled||typeof Notification==="undefined"||Notification.permission!=="granted")return;
    let live=true;
    const check=async()=>{
      if(!live||document.visibilityState!=="visible")return;
      for(const item of dueMaintenance(state)){
        const key=`kairo-reminder:${appPath()}:${profile?.namespace??"local"}:${item.id}:${maintenanceDay}`;
        if(localStorage.getItem(key)||notifying.current.has(key))continue;
        notifying.current.add(key);
        try{
          const sent=await showLocalNotification("Kairo Ride",{body:`${item.title} · ${language==="lt"?"laikas patikrai":"needs attention"}${item.dueDate?` · ${item.dueDate}`:""}${item.dueOdometerKm!==null?` · ${item.dueOdometerKm} km`:""}`,icon:appPath("icon-192.png"),tag:`kairo-${item.id}`},()=>live&&document.visibilityState==="visible");
          if(sent)localStorage.setItem(key,"sent");
        }finally{notifying.current.delete(key);}
      }
    };
    const run=()=>{void check().catch(()=>{});};run();
    const timer=setInterval(run,60000);window.addEventListener("focus",run);document.addEventListener("visibilitychange",run);
    return()=>{live=false;clearInterval(timer);window.removeEventListener("focus",run);document.removeEventListener("visibilitychange",run);};
  },[ready,notificationsEnabled,state,maintenanceDay,profile,offlineReady,language]);
  const pendingFiles=state.attachment.filter(a=>!a.driveId).length;
  const syncLabel=syncMessage?tr("Syncing","Sinchronizuojama"):!online?tr("Offline","Be interneto"):!profile?googleReady?tr("Connect Drive","Prijungti Drive"):tr("On this device","Šiame įrenginyje"):!connection?tr("Refresh access","Atnaujinti prieigą"):workspace.pending.length||pendingFiles?tr("Upload pending","Laukia įkėlimo"):tr("Drive connected","Drive prijungtas");
  const activeTrip=detail?.kind==="trip"?state.trip.find(t=>t.id===detail.id):undefined,activeRide=detail?.kind==="ride"?state.ride.find(r=>r.id===detail.id):undefined;
  const activeRideEntry=activeRide?rideEntries(state).find(entry=>entry.ride?.id===activeRide.id):undefined;
  const tripInfo=activeTrip?tripRideStats(activeTrip,state):undefined;
  const files=detail?state.attachment.filter(a=>a.ownerKind===detail.kind&&a.ownerId===detail.id):[],localIds=new Set(workspace.blobs.map(b=>b.attachmentId));
  const fileList=(items:Attachment[])=><FileListView files={items} localIds={localIds} onDownload={localDownload} onDelete={a=>askDelete("attachment",a)}/>;
  if(fatal)return <main className="startup"><TriangleAlert/><h1>Kairo Ride</h1><p role="alert">{fatal}</p><Button onClick={()=>location.reload()}>{tr("Try again","Bandyti dar kartą")}</Button><p>{tr("Storage can be limited in a private browsing session. Nothing was deleted.","Privačioje naršymo sesijoje saugykla gali būti ribojama. Nieko neištrinta.")}</p></main>;
  if(!ready)return <main className="startup"><div className="brand"><span className="brand-mark"><img src={appPath("favicon.svg")} alt=""/></span>Kairo Ride</div><p>{tr("Opening records on this device…","Atveriami šio įrenginio įrašai…")}</p><Skeleton className="h-24 w-80"/><noscript>Kairo Ride requires JavaScript.</noscript></main>;
  return <div className="kairo-app"><Toaster position="top-center" richColors theme="dark"/><a className="skip-link" href="#main-content">{tr("Skip to content","Pereiti prie turinio")}</a>
    <header className="app-header"><button className="brand" onClick={()=>changeView("overview")} aria-label={tr("Kairo Ride home","Kairo Ride apžvalga")}><span className="brand-mark"><img src={appPath("favicon.svg")} alt=""/></span><span>Kairo <b>Ride</b></span></button><div className="header-right"><Button variant="ghost" size="icon" className="settings-button" onClick={()=>setDriveOpen(true)} aria-label={tr("Settings","Nustatymai")}><Settings/></Button><Button variant="outline" className={`sync-button ${!profile?"local":""}`} disabled={connecting} onClick={()=>googleReady&&online&&!connection?connect():setDriveOpen(true)}>{syncMessage||connecting?<LoaderCircle className="spin"/>:!online?<WifiOff/>:connection?<Cloud/>:<HardDrive/>}<span>{syncLabel}</span>{workspace.pending.length>0&&<span className="count-badge">{workspace.pending.length}</span>}</Button></div></header>
    <Tabs value={view} onValueChange={v=>changeView(v as View)} className="app-tabs"><div className="navigation"><TabsList variant="line" className="main-tabs" aria-label={tr("Main areas","Pagrindinės sritys")}>{nav.map(n=><TabsTrigger value={n.id} key={n.id} aria-label={n.label} title={n.label}><n.icon/><span>{n.label}</span></TabsTrigger>)}</TabsList><span className="nav-caption">{tr("Ride beyond limits.","Riedėk be ribų.")}</span></div><main id="main-content" className="app-main">
      {!profile&&<div className="local-notice"><HardDrive/><p><strong>{tr("Currently stored on this device only.","Kol kas saugoma tik šiame įrenginyje.")}</strong> {tr("Connect Drive to see records on another device. Use export until then.","Prijunk Drive, kad matytum įrašus kitame įrenginyje. Iki tol naudok eksportą.")}</p><Button variant="ghost" size="sm" onClick={()=>setDriveOpen(true)}>{tr("Settings","Nustatymai")} <ArrowRight/></Button></div>}
      {!online&&<div className="notice"><WifiOff/><span>{tr("You can keep working offline. Changes reach other devices after they upload to Drive.","Gali tęsti be interneto. Pakeitimai kitus įrenginius pasieks po įkėlimo į Drive.")}</span></div>}
      {profile&&online&&!connection&&<div className="notice"><CloudOff/><span>{tr("Your records are available locally. Refresh Google access to resume Drive sync; no data was removed.","Įrašai pasiekiami šiame įrenginyje. Atnaujink Google prieigą sinchronizavimui tęsti; duomenys nepašalinti.")}</span><Button variant="outline" size="sm" disabled={!googleReady||connecting} onClick={connect}>{tr("Refresh access","Atnaujinti prieigą")}</Button></div>}
      {syncIssue&&connection&&online&&!syncMessage&&<div className="notice warning"><TriangleAlert/><span>{syncIssue.message} {syncIssue.retry&&autoSyncEnabled?tr("Automatic sync will retry. Local changes are safe.","Automatinis sinchronizavimas bandys dar kartą. Vietiniai pakeitimai išsaugoti."):tr("Review Settings, then try Sync now. Local changes are safe.","Peržiūrėk nustatymus ir bandyk sinchronizuoti. Vietiniai pakeitimai išsaugoti.")}</span><Button variant="outline" size="sm" onClick={()=>setDriveOpen(true)}>{tr("Settings","Nustatymai")}</Button></div>}
      {state.conflicts.length>0&&<div className="notice warning"><TriangleAlert/><span>{state.conflicts.length} {tr("records have conflicting versions. Both are saved.","įrašų versijos nesutampa. Abi išsaugotos.")}</span><Button variant="outline" size="sm" onClick={()=>setConflict(state.conflicts[0])}>{tr("Review","Peržiūrėti")}</Button></div>}
      {state.integrity.length>0&&<div className="notice warning"><TriangleAlert/><span>{state.integrity.join(" ")} {tr("Restore missing history from a JSON backup.","Atkurk trūkstamą istoriją iš JSON kopijos.")}</span></div>}
      <MainViews state={state} actions={actions} setView={changeView} openStorage={()=>setDriveOpen(true)}/>
    </main></Tabs><footer className="app-footer"><span>Kairo Ride <small>2.0.5</small></span><span><ShieldCheck/>{tr("No ads or tracking. Your data stays yours.","Be reklamos ir sekimo. Duomenys lieka tavo.")}</span><Button variant="ghost" size="sm" onClick={()=>setDriveOpen(true)}><CircleHelp/>{tr("Settings","Nustatymai")}</Button></footer>

    <Dialog open={!!editor} onOpenChange={open=>{if(!open&&!busy)setEditor(null);}}><DialogContent className="editor-dialog"><DialogHeader><DialogTitle>{editor?.entity||editor?.reading?tr("Edit","Redaguoti"):tr("New","Naujas įrašas")}: {editor&&(language==="lt"?ltTitles[editor.kind]:titles[editor.kind]).toLowerCase()}</DialogTitle><DialogDescription>{editor?.kind==="ride"?tr("One form saves the ride and its optional odometer value. It can also create or select a trip.","Viena forma išsaugo važiavimą ir neprivalomą odometro reikšmę. Čia pat galima sukurti arba pasirinkti kelionę."):editor?.kind==="reading"?tr("Enter the complete odometer value, not the ride distance.","Įrašyk visą odometro reikšmę, ne važiavimo atstumą."):editor?.kind==="trip"?tr("A trip combines dates, rides and shared files.","Kelionę sudaro datos, važiavimai ir bendri failai."):editor?.kind==="maintenance"?tr("Set a date, odometer target, or both. Insurance requires an expiry date.","Nurodyk datą, odometro reikšmę arba abu. Draudimui būtina galiojimo data."):tr("Changes are saved only after you press Save.","Pakeitimai išsaugomi tik paspaudus Išsaugoti.")}</DialogDescription></DialogHeader>{editor&&<EntityForm key={`${editor.kind}:${editor.entity?.id??editor.reading?.id??"new"}`} editor={editor} state={state} busy={busy} onSave={save} onCancel={()=>setEditor(null)}/>}</DialogContent></Dialog>

    <Dialog open={!!detail} onOpenChange={open=>{if(!open&&!busy)setDetail(null);}}><DialogContent className="detail-dialog"><DialogHeader><div className="eyebrow">{activeTrip?tr("TRIP","KELIONĖ"):tr("RIDE","VAŽIAVIMAS")}</div><DialogTitle className="detail-title">{activeTrip?.name??activeRide?.name??tr("Record unavailable","Įrašas nepasiekiamas")}</DialogTitle><DialogDescription>{activeTrip?`${formatDate(activeTrip.startDate,false,undefined,locale)} → ${formatDate(activeTrip.endDate,false,undefined,locale)} · ${tripInfo?.days} ${tr("days","d.")}`:activeRide?`${formatDate(activeRide.at,true,activeRide.timeZone,locale)} · ${state.wheel.find(w=>w.id===activeRide.wheelId)?.name??""}`:tr("The record may have been deleted on another device.","Įrašas galėjo būti pašalintas kitame įrenginyje.")}</DialogDescription></DialogHeader>
      {(activeTrip||activeRide)&&<><div className="detail-meta"><span><Route/>{formatKm(tripInfo?tripInfo.distanceKm:activeRideEntry?.distanceKm??null,locale)} km{tripInfo?.unknownDistances?tr(" + unknown distances"," + neįvesti atstumai"):""}</span><span><Paperclip/>{tripInfo?tripInfo.attachments.length:files.length} {tr("files","failų")}</span><Button variant="ghost" size="sm" onClick={()=>activeTrip?openEditor("trip",activeTrip):activeRide&&openRide(activeRide,readingForRide(state,activeRide))}><Pencil/>{tr("Edit","Redaguoti")}</Button></div>{(activeTrip?.notes||activeRide?.notes)&&<p className="detail-notes preserve-lines">{activeTrip?.notes||activeRide?.notes}</p>}
      {activeTrip&&<section className="detail-section"><div className="section-heading"><h3>{tr("Trip rides","Kelionės važiavimai")}</h3><Button variant="outline" size="sm" disabled={!state.wheel.length} onClick={()=>openRide(undefined,undefined,activeTrip.id)}><Plus/>{tr("Add","Pridėti")}</Button></div>{tripInfo?.rides.length?tripInfo.rides.map(r=><RideRow key={r.id} ride={r} state={state} actions={actions}/>):<p className="muted">{tr("No rides linked yet. Edit a ride and select this trip.","Dar nėra priskirtų važiavimų. Redaguok važiavimą ir pasirink šią kelionę.")}</p>}{!state.wheel.length&&<p className="field-hint">{tr("Add a vehicle in Garage before adding a ride.","Prieš važiavimą pridėk priemonę Garaže.")}</p>}</section>}
      {activeRide?.tripId&&<Button variant="outline" onClick={()=>setDetail({kind:"trip",id:activeRide.tripId!})}><Mountain/>{tr("Open trip","Atverti kelionę")}</Button>}
      <section className="detail-section"><div className="section-heading"><h3>{activeTrip?tr("Shared trip files","Bendri kelionės failai"):tr("Ride files","Važiavimo failai")}</h3><Button variant="outline" size="sm" disabled={busy} onClick={()=>attachmentInput.current?.click()}>{busy?<LoaderCircle className="spin"/>:<Paperclip/>}{tr("Attach","Prisegti")}</Button></div><p className="field-hint">{tr("GPX, CSV logs, photos, video and other originals. Up to 512 MB per file. Content is neither modified nor analysed.","GPX, CSV logai, nuotraukos, video ir kiti originalai. Iki 512 MB vienam failui. Turinys nekeičiamas ir neanalizuojamas.")}</p>{files.length?fileList(files):<div className="attachment-empty"><FolderOpen/><span>{tr("Attach the first file. It will stay linked to this record.","Prisek pirmą failą. Jis bus susietas su šiuo įrašu.")}</span></div>}{!connection&&<p className="inline-warning"><CloudOff/>{tr("Until Drive is connected, files remain on this device only.","Kol Drive neprijungtas, failai bus tik šiame įrenginyje.")}</p>}</section>
      {activeTrip&&!!tripInfo?.attachments.filter(a=>a.ownerKind==="ride").length&&<section className="detail-section"><h3>{tr("Ride attachments","Važiavimų priedai")}</h3>{fileList(tripInfo.attachments.filter(a=>a.ownerKind==="ride"))}</section>}</>}
    </DialogContent></Dialog><input ref={attachmentInput} type="file" multiple className="sr-only" tabIndex={-1} aria-label={tr("Attach files","Prisegti failus")} onChange={e=>{void attach(e.target.files);e.target.value="";}}/>

    <StoragePanel open={driveOpen} setOpen={setDriveOpen} config={config} profile={profile} connection={connection} connecting={connecting} googleReady={googleReady} online={online} autoSyncEnabled={autoSyncEnabled} onAutoSyncChange={changeAutoSync} syncIssue={syncIssue} syncMessage={syncMessage} cloud={cloud} pending={workspace.pending.length} pendingFiles={pendingFiles} importZone={importZone} setImportZone={setImportZone} importBusy={importBusy} offlineReady={offlineReady} persisted={persisted} notificationsEnabled={notificationsEnabled} onEnableNotifications={()=>void enableNotifications()} onDisableNotifications={disableNotifications} onConnect={connect} onSync={()=>void syncNow()} onDisconnect={()=>void disconnect().catch(e=>toast.error(friendlyError(e)))} onImport={()=>importInput.current?.click()} onExport={exportData} onPersist={()=>void persist()}/><input ref={importInput} type="file" accept=".json,.xlsx" className="sr-only" tabIndex={-1} aria-label={tr("Import data","Importuoti duomenis")} onChange={e=>{if(e.target.files?.[0])void readImport(e.target.files[0]);e.target.value="";}}/>

    <AlertDialog open={!!candidate} onOpenChange={open=>{if(!open&&!connecting){candidate?.client.disconnect();setCandidate(null);}}}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{tr("Connect","Prijungti")} {candidate?.profile.email}?</AlertDialogTitle><AlertDialogDescription>{candidate?.hasLocal?tr("This device already has local records and files. Copy them into this account? The original local copy will not be deleted.","Šiame įrenginyje jau yra vietinių įrašų ir failų. Nukopijuoti juos į šią paskyrą? Vietinė kopija nebus ištrinta."):tr("This account's data space will open. Records from another account are not transferred automatically.","Bus atverta šios paskyros duomenų erdvė. Kitos paskyros įrašai automatiškai neperkeliami.")}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={connecting}>{tr("Cancel","Atšaukti")}</AlertDialogCancel>{candidate?.hasLocal&&<Button variant="outline" disabled={connecting} onClick={()=>candidate&&void activate(candidate,false)}>{tr("Without local records","Be vietinių įrašų")}</Button>}<Button disabled={connecting} onClick={()=>candidate&&void activate(candidate,!!candidate.hasLocal)}>{connecting?<LoaderCircle className="spin"/>:<Check/>}{candidate?.hasLocal?tr("Copy and connect","Kopijuoti ir prijungti"):tr("Connect account","Prijungti paskyrą")}</Button></AlertDialogFooter></AlertDialogContent></AlertDialog>
    <AlertDialog open={!!pendingDelete} onOpenChange={open=>{if(!open&&!busy)setPendingDelete(null);}}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{tr("Delete record?","Pašalinti įrašą?")}</AlertDialogTitle><AlertDialogDescription>{pendingDelete?.kind==="attachment"?tr("Only the link will be removed. The original Drive file will not be deleted.","Bus pašalintas tik ryšys. Originalus Drive failas nebus ištrintas."):tr("Deletion is added to history and can be undone immediately after the action.","Pašalinimas įtraukiamas į istoriją ir iškart po veiksmo gali būti atšauktas.")}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={busy}>{tr("Keep","Palikti")}</AlertDialogCancel><AlertDialogAction variant="destructive" disabled={busy} onClick={e=>{e.preventDefault();void remove();}}>{tr("Delete","Pašalinti")}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    <Dialog open={!!importPreview} onOpenChange={open=>{if(!open&&!importBusy)setImportPreview(null);}}><DialogContent className="import-dialog"><DialogHeader><DialogTitle>{tr("Import preview","Importo peržiūra")}</DialogTitle><DialogDescription>{importPreview?.source}. {tr("Nothing has been written yet.","Dar nieko neįrašyta.")}</DialogDescription></DialogHeader>{importPreview&&<><div className="import-counts"><span><strong>{importPreview.counts.wheel}</strong>{tr("vehicles","priemonių")}</span><span><strong>{importPreview.counts.reading}</strong>{tr("records","įrašų")}</span><span><strong>{importPreview.counts.ride}</strong>{tr("rides","važiavimų")}</span><span><strong>{importPreview.counts.trip}</strong>{tr("trips","kelionių")}</span><span><strong>{importPreview.counts.gear}</strong>{tr("gear","ekipuotės")}</span><span><strong>{importPreview.counts.maintenance}</strong>{tr("maintenance","priežiūros")}</span></div><ul className="import-warnings">{importPreview.warnings.map((w,i)=><li key={i}>{w}</li>)}</ul><p className="field-hint">{tr("Records merge by stable ID. Re-importing the same file does not duplicate them. Conflicting versions remain visible for review.","Įrašai sujungiami pagal stabilius ID. Pakartotinis importas jų nedaugina. Konfliktuojančios versijos lieka peržiūrai.")}</p></>}<DialogFooter><Button variant="outline" disabled={importBusy} onClick={()=>setImportPreview(null)}>{tr("Cancel","Atšaukti")}</Button><Button disabled={importBusy} onClick={()=>void applyImport()}>{importBusy?<LoaderCircle className="spin"/>:<Check/>}{tr("Confirm import","Patvirtinti importą")}</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={!!conflict} onOpenChange={open=>{if(!open&&!busy)setConflict(null);}}><DialogContent className="conflict-dialog"><DialogHeader><DialogTitle>{tr("Choose which version to keep","Pasirink, kurią versiją palikti")}</DialogTitle><DialogDescription>{tr("Different devices changed the same record. Nothing was silently overwritten.","Skirtingi įrenginiai pakeitė tą patį įrašą. Niekas nebuvo tyliai perrašyta.")}</DialogDescription></DialogHeader>{conflict?.revisions.map((r,i)=><div className="conflict-version" key={r.operationId}><strong>{tr("Version","Versija")} {i+1} · {formatDate(r.createdAt,true,undefined,locale)}</strong><pre>{r.value?JSON.stringify(r.value,null,2):tr("Record deleted","Įrašas pašalintas")}</pre><Button disabled={busy} onClick={()=>void resolveRevision(r.value)}>{tr("Keep this version","Palikti šią versiją")}</Button></div>)}</DialogContent></Dialog>
  </div>;
}
