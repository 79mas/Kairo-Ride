"use client";
import {ExportDialog,type ExportFile} from "./export-dialog";
import {TripDialog,type TripDraft} from "./trip-dialog";
import {prepareTripFiles} from "@/lib/kairo/trip-files";
import {exportName} from "@/lib/kairo/export-name";
import {useDialogViewport} from "@/hooks/use-dialog-viewport";
/* eslint-disable @next/next/no-img-element -- Vite serves the local PWA icon; next/image is not available. */
import {useCallback,useEffect,useRef,useState} from "react";
import {ArrowRight,Backpack,BarChart3,Check,CircleHelp,Clock3,Cloud,CloudOff,FolderOpen,HardDrive,Home,LoaderCircle,Mountain,Paperclip,Pencil,Plus,RefreshCw,Route,Settings,ShieldCheck,TriangleAlert,Trash2,WifiOff,Wrench} from "lucide-react";
import {toast} from "sonner";
import {Toaster} from "@/components/ui/sonner";
import {Button} from "@/components/ui/button";
import {Tabs,TabsList,TabsTrigger} from "@/components/ui/tabs";
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription,DialogFooter} from "@/components/ui/dialog";
import {AlertDialog,AlertDialogContent,AlertDialogHeader,AlertDialogTitle,AlertDialogDescription,AlertDialogFooter,AlertDialogCancel,AlertDialogAction} from "@/components/ui/alert-dialog";
import {Skeleton} from "@/components/ui/skeleton";
import {EntityForm,ltTitles,titles,type EditableKind,type Editor,type FormSubmission} from "./forms";
import {MainViews,RideRow,FileListView,type Detail,type FileTransferView,type View,type ViewActions} from "./views";
import {StoragePanel,type SettingsSection} from "./storage-panel";
import {EarthProgress} from "./goals";
import {preferredRecordVehicle,rememberRecordVehicle,validateRideRecord} from "@/lib/kairo/records";
import {notifyVehicleMaintenance} from "./vehicle-status";
import {garageReminders,vehicleReminder} from "@/lib/kairo/vehicle-status";
import {databaseRestorations} from "@/lib/kairo/archive";
import {activeState,backup,entityKey,formatDate,formatKm,parseBackup,project,today,uuid,validateDelete,validateEdit,type Attachment,type Conflict,type Entity,type Goal,type Kind,type Maintenance,type Reading,type Ride} from "@/lib/kairo/domain";
import {addAttachment,commit,commitChanges,copyLocalToAccount,createRecoverySnapshot,friendlyError,listRecoverySnapshots,loadWorkspace,mergeOperations,metaGet,metaSet,restoreRecoverySnapshot,type Profile,type RecoverySnapshot,type Workspace} from "@/lib/kairo/storage";
import {authorizeGoogle,cachedCloudStatus,prepareGoogle,readDriveConfig,type DriveClient,type DriveConfig,type DriveProgress} from "@/lib/kairo/drive";
import {exportWorkbook,readXlsx,workbookImport,writeXlsx,type ImportPreview} from "@/lib/kairo/excel";
import {appPath,LOCAL_CHANNEL} from "@/lib/kairo/paths";
import {useI18n} from "@/lib/kairo/i18n";
import {dueMaintenance,readingForRide,rideEntries,tripRideStats} from "@/lib/kairo/stats";
import {syncFailureKind,type SyncOutcome} from "@/lib/kairo/auto-sync";
import {useAutoSync} from "@/hooks/use-auto-sync";
import {nextMaintenanceOccurrence} from "@/lib/kairo/maintenance";
import {showLocalNotification} from "@/lib/kairo/notifications";
import {migrateWorkspace} from "@/lib/kairo/migrations";
import {installGlobalDiagnostics,recordDiagnostic,recordError} from "@/lib/kairo/diagnostics";
import {useAppUpdate} from "@/hooks/use-app-update";
import {useUploadWakeLock} from "@/hooks/use-upload-wake-lock";
import {transferView,type LiveTransfer} from "./transfer-center";
import {CriticalRecovery} from "./error-boundary";
import {APP_VERSION} from "@/lib/kairo/version";
import {describeIntegrity} from "@/lib/kairo/integrity";

const blank:Workspace={state:project([]),operations:[],pending:[],blobs:[]};
function download(blob:Blob,name:string){const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60_000);}
export default function KairoApp(){
  const {tr,language,locale}=useI18n();useDialogViewport();
  const [exportFile,setExportFile]=useState<ExportFile|null>(null);
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
  const [settingsSection,setSettingsSection]=useState<SettingsSection>("appearance"),[liveTransfers,setLiveTransfers]=useState<Record<string,LiveTransfer>>({});
  const [recoverySnapshots,setRecoverySnapshots]=useState<RecoverySnapshot[]>([]),[editorDirty,setEditorDirty]=useState(false);
  const [maintenanceDay,setMaintenanceDay]=useState(today),notifying=useRef(new Set<string>());
  const importInput=useRef<HTMLInputElement>(null),attachmentInput=useRef<HTMLInputElement>(null),saving=useRef(false),liveTransfersRef=useRef(liveTransfers);
  useEffect(()=>{liveTransfersRef.current=liveTransfers;},[liveTransfers]);
  const markOfflineReady=useCallback(()=>setOfflineReady(true),[]);
  const beforeActivate=useCallback(async()=>{
    const uploading=Object.values(liveTransfersRef.current).some(item=>item.state==="uploading"||item.state==="retrying");
    if(uploading)throw new Error("Pause the active file upload or wait for it to finish before updating.");
    await createRecoverySnapshot(namespace.current,`Before application update to ${APP_VERSION}`);
  },[]);
  const appUpdate=useAppUpdate({onOfflineReady:markOfflineReady,beforeActivate});
  const activeUpload=Object.values(liveTransfers).some(item=>item.state==="uploading"||item.state==="retrying");
  const uploadWakeLock=useUploadWakeLock(activeUpload);
  const state=activeState(workspace.state);
  const integrityNotice=describeIntegrity(workspace.state.integrity,workspace.state,language);
  const [goalChoice,setGoalChoice]=useState<Record<string,string>>({});
  const goalKey=`kairo-goal@${appPath()}:${profile?.namespace??"local"}`;
  const selectedGoal=goalChoice[goalKey]??(typeof localStorage!=="undefined"?localStorage.getItem(goalKey):null)??"around-the-earth";
  const selectGoal=(id:string)=>{localStorage.setItem(goalKey,id);setGoalChoice(current=>({...current,[goalKey]:id}));};
  useEffect(()=>{if(!editor)toast.dismiss("kairo-vehicle-maintenance-record");},[editor]);
  useEffect(()=>{toast.dismiss("kairo-vehicle-maintenance-garage");toast.dismiss("kairo-vehicle-maintenance-record");},[profile?.namespace]);
  const refresh=useCallback(async()=>{
    const ns=namespace.current,result=await migrateWorkspace(ns),snapshots=await listRecoverySnapshots(ns);
    if(ns===namespace.current){setWorkspace(result.workspace);setRecoverySnapshots(snapshots);}
    if(result.migrated)void recordDiagnostic(ns,"info","DB.MIGRATION_COMPLETE",{module:"storage",action:"migrate",message:"Local data migration completed."}).catch(()=>{});
  },[]);
  useEffect(()=>{
    let mounted=true;const removeDiagnostics=installGlobalDiagnostics(()=>namespace.current);
    void(async()=>{try{const active=await metaGet<Profile>("activeProfile");if(!mounted)return;if(active){namespace.current=active.namespace;setProfile(active);setCloud(await cachedCloudStatus(active.namespace));}await refresh();if(mounted){setReady(true);setPersisted(await navigator.storage?.persisted?.()??false);void recordDiagnostic(namespace.current,"info","APP.STARTED",{module:"app",action:"startup",message:"Application workspace opened."}).catch(()=>{});}}catch(e){void recordError(namespace.current,"DB.OPEN_FAILED",e,{module:"storage",action:"startup"}).catch(()=>{});if(mounted)setFatal(`Could not open this device's storage. ${friendlyError(e)}`);}})();
    const network=()=>setOnline(navigator.onLine);network();window.addEventListener("online",network);window.addEventListener("offline",network);
    const channel=typeof BroadcastChannel!=="undefined"?new BroadcastChannel(LOCAL_CHANNEL):null;if(channel)channel.onmessage=e=>{if(e.data===namespace.current)void refresh().catch(e=>toast.error(friendlyError(e)));};
    const updateDay=()=>{if(document.visibilityState==="visible")setMaintenanceDay(today());};
    window.addEventListener("focus",updateDay);document.addEventListener("visibilitychange",updateDay);
    const timer=setInterval(()=>{setConnection(!!client.current?.connected);updateDay();},15000);
    return()=>{mounted=false;removeDiagnostics();window.removeEventListener("online",network);window.removeEventListener("offline",network);window.removeEventListener("focus",updateDay);document.removeEventListener("visibilitychange",updateDay);channel?.close();clearInterval(timer);client.current?.disconnect();};
  },[refresh]);
  useEffect(()=>{if(!editorDirty)return;const warn=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue="";};window.addEventListener("beforeunload",warn);return()=>window.removeEventListener("beforeunload",warn);},[editorDirty]);
  useEffect(()=>{if(!driveOpen)return;let live=true;void readDriveConfig().then(async cfg=>{if(!live)return;setConfig(cfg);if(cfg.googleClientId){await prepareGoogle();if(live)setGoogleReady(true);}}).catch(e=>toast.error(friendlyError(e)));return()=>{live=false;};},[driveOpen]);
  useEffect(()=>{if(!ready||!online)return;let live=true;void readDriveConfig().then(async cfg=>{if(!live)return;setConfig(cfg);if(cfg.googleClientId){await prepareGoogle();if(live)setGoogleReady(true);}}).catch(()=>{});return()=>{live=false;};},[ready,online]);
  const runSync=useCallback(async(manual:boolean):Promise<SyncOutcome>=>{
    const api=client.current,ns=namespace.current;if(!api||ns==="local")return "inactive";
    if(syncing.current===api)return "success";
    syncing.current=api;setSyncMessage(tr("Checking Drive…","Tikrinamas Drive…"));setSyncIssue(null);
    try{
      const result=await api.sync(ns,event=>{
        if(namespace.current!==ns||client.current!==api)return;
        const progress:DriveProgress=typeof event==="string"?{message:event,phase:"records"}:event;
        setSyncMessage(progress.message);
        if(progress.attachmentId&&progress.state)setLiveTransfers(current=>({...current,[progress.attachmentId!]:{state:progress.state!,confirmedBytes:progress.confirmedBytes??0,totalBytes:progress.totalBytes??0,message:progress.message}}));
      });
      if(namespace.current!==ns||client.current!==api)return "inactive";
      setCloud(result);setConnection(api.connected);await refresh();
      if(result.fileIssues.length){
        const first=result.fileIssues[0],cause=friendlyError(new Error(first.message),language),message=result.fileIssues.length===1
          ?tr(`Records synchronized, but “${first.name}” could not be copied to Drive. ${cause}`,`Įrašai sinchronizuoti, bet failo „${first.name}“ nepavyko nukopijuoti į Drive. ${cause}`)
          :tr(`Records synchronized, but ${result.fileIssues.length} original files could not be copied to Drive. First: “${first.name}”. ${cause}`,`Įrašai sinchronizuoti, bet ${result.fileIssues.length} originalių failų nepavyko nukopijuoti į Drive. Pirmas: „${first.name}“. ${cause}`);
        setSyncIssue({message,retry:false});void recordDiagnostic(ns,"warning","DRIVE.FILE_PARTIAL",{module:"drive",action:"sync",message,technical:result.fileIssues,retryable:true}).catch(()=>{});if(manual)toast.error(message,{duration:10000});return "blocked";
      }
      void recordDiagnostic(ns,"info","DRIVE.SYNC_COMPLETE",{module:"drive",action:"sync",message:"Records and queued files synchronized."}).catch(()=>{});
      return "success";
    }
    catch(e){if(client.current!==api||namespace.current!==ns)return "inactive";if(e instanceof Error&&e.name==="AbortError"){void recordDiagnostic(ns,"info","DRIVE.SYNC_CANCELLED",{module:"drive",action:"sync",message:"Synchronization was stopped safely; local data was not changed."}).catch(()=>{});await refresh().catch(()=>{});return "inactive";}const outcome=syncFailureKind(e),message=friendlyError(e,language);setSyncIssue({message,retry:outcome==="retry"});setConnection(api.connected);void recordError(ns,"DRIVE.SYNC_FAILED",e,{module:"drive",action:"sync",retryable:outcome==="retry"}).catch(()=>{});if(manual)toast.error(message,{duration:8000});await refresh().catch(()=>{});return outcome;}
    finally{if(syncing.current===api)syncing.current=null;if(client.current===api)setSyncMessage("");}
  },[refresh,tr,language]);
  const pendingKey=[...workspace.pending.map(record=>record.operation.id),...workspace.blobs.filter(blob=>blob.queued!==false&&state.attachment.some(a=>a.id===blob.attachmentId&&!a.driveId&&!a.archived)).map(blob=>`file:${blob.attachmentId}`)].sort().join("|");
  const syncNow=useAutoSync({enabled:autoSyncEnabled,connected:connection,online,pendingKey,run:runSync});
  function changeAutoSync(enabled:boolean){localStorage.setItem(`kairo-auto-sync@${appPath()}`,enabled?"on":"off");setAutoSyncEnabled(enabled);}
  function cancelUpload(attachmentId:string){client.current?.cancelAttachmentUpload(attachmentId);setLiveTransfers(current=>{if(!current[attachmentId])return current;const next={...current};delete next[attachmentId];return next;});}
  function openSettings(section:SettingsSection="appearance"){setSettingsSection(section);setDriveOpen(true);}
  function closeEditor(){
    if(busy)return;
    if(editorDirty&&!window.confirm(tr("Discard unsaved changes?","Atmesti neišsaugotus pakeitimus?")))return;
    setEditorDirty(false);setEditor(null);
  }
  function changeView(next:View){
    if(next==="wheels")notifyVehicleMaintenance(garageReminders(state),{tr,locale},"garage");
    else toast.dismiss("kairo-vehicle-maintenance-garage");
    setView(next);
  }
  function prepareNewRecord(){
    toast.dismiss("kairo-vehicle-maintenance-garage");
    const wheel=preferredRecordVehicle(state,namespace.current);
    if(!wheel){toast.error(tr("No vehicle is available for new records. Set a vehicle to Active, Active! or Spare in Garage.","Naujiems įrašams nėra tinkamos priemonės. Garaže pasirink Aktyvus, Aktyvus! arba Atsarginis."),{duration:10000,action:{label:tr("Open Garage","Atverti garažą"),onClick:()=>changeView("wheels")}});return false;}
    const reminder=vehicleReminder(wheel,state);
    notifyVehicleMaintenance(reminder?[reminder]:[],{tr,locale},"record");
    return wheel.id;
  }
  const openEditor=(kind:EditableKind,entity?:Entity,tripId?:string)=>{if(kind==="trip"&&entity){setEditorDirty(false);setEditor(null);setDetail({kind:"trip",id:entity.id,edit:true});return;}const defaultWheelId=kind==="reading"&&!entity?prepareNewRecord():undefined;if(defaultWheelId===false)return;setEditorDirty(false);setDetail(null);setEditor({kind,entity,tripId,defaultWheelId,namespace:namespace.current,parents:entity?(state.heads.get(entityKey(kind,entity.id))??[]).map(r=>r.operationId):[]});};
  const openRide=(ride?:Ride,reading?:Reading,tripId?:string)=>{const defaultWheelId=!ride&&!reading?prepareNewRecord():undefined;if(defaultWheelId===false)return;setEditorDirty(false);setDetail(null);setEditor({kind:"ride",entity:ride,reading,tripId,defaultWheelId,namespace:namespace.current,parents:ride?(state.heads.get(entityKey("ride",ride.id))??[]).map(r=>r.operationId):[],readingParents:reading?(state.heads.get(entityKey("reading",reading.id))??[]).map(r=>r.operationId):[]});};
  const askDelete=(kind:Kind,entity:Entity,linkedReading?:Reading)=>setPendingDelete({kind,entity,linkedReading,namespace:namespace.current,parents:(state.heads.get(entityKey(kind,entity.id))??[]).map(r=>r.operationId),readingParents:linkedReading?(state.heads.get(entityKey("reading",linkedReading.id))??[]).map(r=>r.operationId):undefined});
  async function addGoal(targetKm:number,wheelId:string|null){
    const ns=namespace.current,current=(await loadWorkspace(ns)).state;
    if(ns!==namespace.current)throw new Error("The account changed. Reopen Analytics.");
    const goal:Goal={id:uuid(),targetKm,wheelId,createdAt:new Date().toISOString()};
    validateEdit(current,"goal",goal);await commit(ns,"goal",goal,goal.id);await refresh();
    if(ns===namespace.current)toast.success(tr("Goal saved.","Tikslas išsaugotas."));
  }
  async function saveGoal(goal:Goal,parents:string[]){const ns=namespace.current,current=(await loadWorkspace(ns)).state;validateEdit(current,"goal",goal);await commit(ns,"goal",goal,goal.id,undefined,parents);await refresh();}
  const actions:ViewActions={openEditor,openRide,askDelete,setDetail,addGoal,saveGoal,selectedGoal,selectGoal};
  async function save(request:FormSubmission){if(!editor||saving.current)return;const form=editor,value=request.value;saving.current=true;setBusy(true);try{
    if(form.namespace!==namespace.current)throw new Error("The account changed. Reopen the record.");
    const current=(await loadWorkspace(form.namespace)).state;
    let repeated=false;
    if(form.kind==="ride"){
      if(request.newTrip)validateEdit(current,"trip",request.newTrip);
      const validationState=request.newTrip?{...current,trip:[...current.trip,request.newTrip]}:current;
      validateRideRecord(validationState,value as Ride,request.reading);
      // Revalidated against fresh data; the odometer and ride are committed together.
      const changes=[...(request.newTrip?[{kind:"trip" as const,value:request.newTrip,entityId:request.newTrip.id}]:[]),{kind:"ride" as const,value,entityId:value.id,parents:form.parents},...(request.reading!==undefined&&(request.reading||form.reading)?[{kind:"reading" as const,value:request.reading,entityId:request.readingId!,parents:form.readingParents}]:[])];
      const prepared=await prepareTripFiles((value as Ride).tripId??"",request.files??[]);
      if(prepared.changes.length&&!(value as Ride).tripId)throw new Error("Files must belong to a trip.");
      if(form.namespace!==namespace.current)throw new Error("The account changed. Reopen the record.");
      await commitChanges(form.namespace,[...changes,...prepared.changes],prepared.blobs);
      if(!form.entity&&!form.reading)rememberRecordVehicle(form.namespace,(value as Ride).wheelId);
    }else if(form.kind==="maintenance"){
      const item=value as Maintenance,previous=form.entity as Maintenance|undefined;
      validateEdit(current,"maintenance",item);
      if(item.completedAt&&!previous?.completedAt&&current.maintenance.some(saved=>saved.id===item.id&&saved.completedAt))throw new Error("This task was already completed in another window or device. Reopen it to see the latest state.");
      const next=item.completedAt&&!previous?.completedAt?nextMaintenanceOccurrence(item,current):null;
      if(next)validateEdit(current,"maintenance",next);
      await commitChanges(form.namespace,[{kind:"maintenance",value:item,entityId:item.id,parents:form.parents},...(next?[{kind:"maintenance" as const,value:next,entityId:next.id}]:[])]);
      repeated=!!next;
    }else if(form.kind==="trip"){validateEdit(current,"trip",value);const prepared=await prepareTripFiles(value.id,request.files??[]);if(form.namespace!==namespace.current)throw new Error("The account changed. Reopen the trip.");await commitChanges(form.namespace,[{kind:"trip",value,entityId:value.id,parents:form.parents},...prepared.changes],prepared.blobs);
    }else{validateEdit(current,form.kind,value);await commit(form.namespace,form.kind,value,value.id,undefined,form.parents);}
    await refresh();setEditorDirty(false);setEditor(null);void recordDiagnostic(form.namespace,"info","RECORD.SAVED",{module:"records",action:`save.${form.kind}`,message:`${form.kind} saved locally.`}).catch(()=>{});toast.success(repeated?tr("Saved and scheduled the next occurrence.","Išsaugota ir suplanuotas kitas kartas."):tr("Saved on this device.","Išsaugota šiame įrenginyje."));
  }catch(e){void recordError(form.namespace,"RECORD.SAVE_FAILED",e,{module:"records",action:`save.${form.kind}`}).catch(()=>{});toast.error(friendlyError(e,language));}finally{saving.current=false;setBusy(false);}}
  async function remove(){
    if(!pendingDelete)return;const t=pendingDelete;setBusy(true);
    try{
      if(t.namespace!==namespace.current)throw new Error("The account changed.");
      const current=(await loadWorkspace(t.namespace)).state;
      validateDelete(current,t.kind,t.entity.id);
      const changes=[{kind:t.kind,value:{...t.entity,archived:true},entityId:t.entity.id,parents:t.parents},
        ...(t.linkedReading?[{kind:"reading" as const,value:{...t.linkedReading,archived:true},entityId:t.linkedReading.id,parents:t.readingParents}]:[])];
      await commitChanges(t.namespace,changes);await refresh();setPendingDelete(null);setEditorDirty(false);setEditor(null);
      if(detail?.id===t.entity.id)setDetail(null);
      toast.success(tr("Removed from active use. History is preserved.","Pašalinta iš naudojimo. Istorija išsaugota."));
      void recordDiagnostic(t.namespace,"info","RECORD.ARCHIVED",{module:"records",action:`archive.${t.kind}`,message:`${t.kind} archived; history preserved.`}).catch(()=>{});
    }catch(e){void recordError(t.namespace,"RECORD.ARCHIVE_FAILED",e,{module:"records",action:`archive.${t.kind}`}).catch(()=>{});toast.error(friendlyError(e,language));}finally{setBusy(false);}
  }
  async function activate(next:{client:DriveClient;profile:Profile},copy:boolean){
    setConnecting(true);
    try{
      if(copy)await copyLocalToAccount(next.profile);
      const [{workspace:target},targetCloud,snapshots]=await Promise.all([migrateWorkspace(next.profile.namespace),cachedCloudStatus(next.profile.namespace),listRecoverySnapshots(next.profile.namespace)]);
      await metaSet("activeProfile",next.profile);
      client.current?.disconnect();client.current=next.client;namespace.current=next.profile.namespace;
      setWorkspace(target);setRecoverySnapshots(snapshots);setCloud(targetCloud);setProfile(next.profile);setConnection(next.client.connected);
      setCandidate(null);setDetail(null);setEditorDirty(false);setEditor(null);setImportPreview(null);setConflict(null);setPendingDelete(null);setSyncMessage("");setLiveTransfers({});
      toast.success(`${tr("Connected","Prijungta")} ${next.profile.email}`);void syncNow();
      void recordDiagnostic(next.profile.namespace,"info","ACCOUNT.ACTIVATED",{module:"account",action:"switch",message:"Google account workspace activated."}).catch(()=>{});
    }catch(e){next.client.disconnect();setCandidate(null);void recordError(next.profile.namespace,"ACCOUNT.ACTIVATE_FAILED",e,{module:"account",action:"switch"}).catch(()=>{});toast.error(friendlyError(e,language));}finally{setConnecting(false);}
  }
  function connect(){if(!config?.googleClientId||!googleReady||connecting)return;setConnecting(true);void authorizeGoogle(config.googleClientId,profile?.email).then(async api=>{try{const p=await api.about();if(namespace.current===p.namespace){await activate({client:api,profile:p},false);return;}const local=await loadWorkspace("local");if(namespace.current==="local"&&local.operations.length===0){await activate({client:api,profile:p},false);return;}setCandidate({client:api,profile:p,hasLocal:namespace.current==="local"&&local.operations.length>0});}catch(e){api.disconnect();throw e;}}).catch(e=>toast.error(friendlyError(e,language),{duration:8000})).finally(()=>setConnecting(false));}
  async function disconnect(){
    client.current?.disconnect();client.current=null;setConnection(false);setSyncMessage("");setSyncIssue(null);setWorkspace(blank);
    const [{workspace:local},snapshots]=await Promise.all([migrateWorkspace("local"),listRecoverySnapshots("local")]);await metaSet("activeProfile",null);
    namespace.current="local";setWorkspace(local);setRecoverySnapshots(snapshots);setProfile(null);setCloud({});setDetail(null);setEditorDirty(false);setEditor(null);setImportPreview(null);setConflict(null);setPendingDelete(null);setLiveTransfers({});
    toast.info(tr("Disconnected. This account's local copy remains separate and will return with the same account.","Atsijungta. Paskyros vietinė kopija lieka atskirta ir grįš prisijungus ta pačia paskyra."));
  }
  async function readImport(file:File){const ns=namespace.current;setImportBusy(true);try{if(file.size>25*1024*1024)throw new Error("Import file limit is 25 MB.");let preview:ImportPreview;if(file.name.toLowerCase().endsWith(".json")){const data=JSON.parse(await file.text()),operations=[...parseBackup(data),...databaseRestorations(data)],s=project(operations);preview={operations,warnings:["The JSON backup contains records and attachment links. Original attachment files are not embedded."],counts:{wheel:s.wheel.length,reading:s.reading.length,ride:s.ride.length,trip:s.trip.length,gear:s.gear.length,maintenance:s.maintenance.length,attachment:s.attachment.length,goal:s.goal.length},source:file.name};}else preview=await workbookImport(await readXlsx(new Uint8Array(await file.arrayBuffer())),importZone);setImportPreview({...preview,namespace:ns});void recordDiagnostic(ns,"info","IMPORT.PREVIEW_READY",{module:"import",action:"preview",message:"Import file validated and previewed."}).catch(()=>{});}catch(e){void recordError(ns,"IMPORT.PREVIEW_FAILED",e,{module:"import",action:"preview"}).catch(()=>{});toast.error(friendlyError(e,language),{duration:10000});}finally{setImportBusy(false);}}
  async function applyImport(){if(!importPreview)return;const ns=namespace.current;let checkpoint:RecoverySnapshot|undefined;setImportBusy(true);try{if(importPreview.namespace!==ns)throw new Error("The account changed. Choose the import file again.");const before=await loadWorkspace(ns);checkpoint=await createRecoverySnapshot(ns,"Before data import",before.operations);await mergeOperations(ns,importPreview.operations,false);const after=await loadWorkspace(ns);if(after.state.integrity.length>before.state.integrity.length)throw new Error("Imported data did not pass the integrity check.");await refresh();setImportPreview(null);void recordDiagnostic(ns,"info","IMPORT.COMPLETE",{module:"import",action:"merge",message:"Import completed and passed integrity validation."}).catch(()=>{});toast.success(tr("Import complete. A recovery point was created and the original file was not changed.","Importas baigtas. Sukurtas atkūrimo taškas, originalus failas nepakeistas."));}catch(e){if(checkpoint)await restoreRecoverySnapshot(checkpoint).catch(()=>{});void recordError(ns,"IMPORT.FAILED",e,{module:"import",action:"merge"}).catch(()=>{});toast.error(friendlyError(e,language));}finally{setImportBusy(false);}}
  function exportData(format:"json"|"xlsx"){try{const blob=format==="json"?new Blob([JSON.stringify(backup(workspace.operations),null,2)],{type:"application/json"}):new Blob([writeXlsx(exportWorkbook(workspace.operations)) as BlobPart],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});setExportFile({blob,name:exportName(format),namespace:namespace.current,format});}catch(e){void recordError(namespace.current,"EXPORT.PREPARE_FAILED",e,{module:"export",action:format}).catch(()=>{});toast.error(friendlyError(e,language));}}
  async function saveExport(file:ExportFile){if(file.namespace!==namespace.current)throw new Error("The active account changed. Reopen export.");const api=client.current;if(!api||!online)throw new Error("Connect Google Drive and check your internet connection.");try{await api.saveExport(file.namespace,file.blob,file.name);void recordDiagnostic(file.namespace,"info","EXPORT.DRIVE_COMPLETE",{module:"export",action:file.format,message:`${file.format.toUpperCase()} backup saved to Drive.`}).catch(()=>{});}catch(e){void recordError(file.namespace,"EXPORT.DRIVE_FAILED",e,{module:"export",action:file.format}).catch(()=>{});throw e;}}
  async function restoreSnapshot(snapshot:RecoverySnapshot){const ns=namespace.current;setImportBusy(true);try{if(snapshot.namespace!==ns)throw new Error("The active account changed. Reopen Settings.");await createRecoverySnapshot(ns,"Before restoring a recovery point");await restoreRecoverySnapshot(snapshot);await refresh();void recordDiagnostic(ns,"warning","DB.RECOVERY_RESTORED",{module:"storage",action:"restore",message:"A recovery point was restored by the user."}).catch(()=>{});toast.success(tr("Recovery point restored. Changes are waiting to synchronize.","Atkūrimo taškas atkurtas. Pakeitimai laukia sinchronizavimo."));}catch(e){void recordError(ns,"DB.RECOVERY_FAILED",e,{module:"storage",action:"restore"}).catch(()=>{});toast.error(friendlyError(e,language));}finally{setImportBusy(false);}}
  async function saveTripDraft(draft:TripDraft){
    const ns=draft.namespace;if(ns!==namespace.current)throw new Error("The account changed. Reopen the trip.");
    const current=(await loadWorkspace(ns)).state,trip=current.trip.find(t=>t.id===draft.value.id);
    if(!trip||trip.archived)throw new Error("This trip is no longer active. Reopen the trip list.");
    if(draft.changed)validateEdit(current,"trip",draft.value);
    const prepared=await prepareTripFiles(trip.id,draft.files);
    const removed=draft.removed.map(a=>{const latest=current.attachment.find(item=>item.id===a.id);if(!latest||latest.ownerKind!=="trip"||latest.ownerId!==trip.id)throw new Error("A file link changed. Reopen the trip.");return {kind:"attachment" as const,value:{...latest,archived:true},entityId:latest.id,parents:(current.heads.get(entityKey("attachment",latest.id))??[]).map(r=>r.operationId)};});
    if(ns!==namespace.current)throw new Error("The account changed. Reopen the trip.");
    await commitChanges(ns,[...(draft.changed?[{kind:"trip" as const,value:draft.value,entityId:trip.id,parents:draft.parents}]:[]),...prepared.changes,...removed],prepared.blobs);
    await refresh();void recordDiagnostic(ns,"info","TRIP.SAVED",{module:"trips",action:"save",message:"Trip and selected files saved locally."}).catch(()=>{});toast.success(tr("Trip saved.","Kelionė išsaugota."));
  }

  async function attach(files:FileList|null){if(!files||!detail||detail.kind!=="trip")return;const owner={kind:"trip" as const,id:detail.id},ns=namespace.current;setBusy(true);let count=0;try{for(const file of Array.from(files)){await addAttachment(ns,owner.kind,owner.id,file);count++;}void recordDiagnostic(ns,"info","FILES.SAVED_LOCAL",{module:"transfers",action:"queue",message:`${count} trip file(s) saved locally and queued.`}).catch(()=>{});toast.success(`${tr("Files saved on this device and added to Transfers","Failų išsaugota šiame įrenginyje ir pridėta į perdavimus")}: ${count}.`,{duration:8000,action:{label:tr("View Transfers","Atverti perdavimus"),onClick:()=>openSettings("sync")}});}catch(e){void recordError(ns,"FILES.SAVE_LOCAL_FAILED",e,{module:"transfers",action:"queue"}).catch(()=>{});toast.error(`${count?`${tr("Saved","Išsaugota")} ${count}. `:""}${friendlyError(e,language)}`,{duration:9000});}finally{await refresh();setBusy(false);}}
  function localDownload(a:Attachment){const b=workspace.blobs.find(b=>b.attachmentId===a.id);if(b)download(b.blob,a.name);else toast.info(tr("The original is not on this device. Open it in Drive.","Originalo šiame įrenginyje nėra. Atverk jį Drive."));}
  async function resolveRevision(value:Entity|null){if(!conflict)return;const ns=namespace.current;setBusy(true);try{await commit(ns,conflict.kind,value,conflict.entityId,undefined,conflict.revisions.map(r=>r.operationId));await refresh();const next=(await loadWorkspace(ns)).state.conflicts[0]??null;setConflict(next);void recordDiagnostic(ns,"info","SYNC.CONFLICT_RESOLVED",{module:"sync",action:"resolve",message:"A synchronization conflict was resolved by the user."}).catch(()=>{});toast.success(tr(next?"Selected version saved. Review the next conflict.":"Selected version saved. Both earlier versions remain in history.",next?"Pasirinkta versija išsaugota. Peržiūrėk kitą konfliktą.":"Pasirinkta versija išsaugota. Abi ankstesnės lieka istorijoje."));}catch(e){void recordError(ns,"SYNC.CONFLICT_RESOLVE_FAILED",e,{module:"sync",action:"resolve"}).catch(()=>{});toast.error(friendlyError(e,language));}finally{setBusy(false);}}
  async function persist(){try{const value=await navigator.storage?.persist?.();setPersisted(!!value);toast.info(value?tr("The browser granted more persistent local storage.","Naršyklė suteikė patvaresnę vietinę saugyklą."):tr("The browser did not grant it. Export backups regularly.","Naršyklė leidimo nesuteikė. Reguliariai eksportuok kopiją."));}catch(e){toast.error(friendlyError(e,language));}}
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
          const sent=await showLocalNotification("Kairo Ride",{body:`${item.title} · ${language==="lt"?"laikas patikrai":"needs attention"}${item.dueDate?` · ${formatDate(item.dueDate)}`:""}${item.dueOdometerKm!==null?` · ${item.dueOdometerKm} km`:""}`,icon:appPath("icon-192.png"),tag:`kairo-${item.id}`},()=>live&&document.visibilityState==="visible");
          if(sent)localStorage.setItem(key,"sent");
        }finally{notifying.current.delete(key);}
      }
    };
    const run=()=>{void check().catch(()=>{});};run();
    const timer=setInterval(run,60000);window.addEventListener("focus",run);document.addEventListener("visibilitychange",run);
    return()=>{live=false;clearInterval(timer);window.removeEventListener("focus",run);document.removeEventListener("visibilitychange",run);};
  },[ready,notificationsEnabled,state,maintenanceDay,profile,offlineReady,language]);
  const pendingFiles=workspace.blobs.filter(blob=>blob.queued!==false&&state.attachment.some(a=>a.id===blob.attachmentId&&!a.driveId&&!a.archived)).length;
  const syncLabel=syncMessage?tr("Syncing","Sinchronizuojama"):!online?tr("Offline","Be interneto"):!profile?googleReady?tr("Connect Drive","Prijungti Drive"):tr("On this device","Šiame įrenginyje"):!connection?tr("Refresh access","Atnaujinti prieigą"):workspace.pending.length||pendingFiles?tr("Upload pending","Laukia įkėlimo"):tr("Drive connected","Drive prijungtas");
  const activeTrip=detail?.kind==="trip"?state.trip.find(t=>t.id===detail.id&&!t.archived):undefined;
  const legacyReading=detail?.kind==="reading"?state.reading.find(r=>r.id===detail.id):undefined;
  const activeRide=detail?.kind==="ride"?state.ride.find(r=>r.id===detail.id):legacyReading?{...legacyReading,name:"",tripId:null,distanceKm:null} as Ride:undefined;
  const activeRideEntry=activeRide?rideEntries(state).find(entry=>(entry.ride?.id??entry.reading?.id)===activeRide.id):undefined;
  const tripInfo=activeTrip?tripRideStats(activeTrip,state):undefined;
  const files=detail?state.attachment.filter(a=>a.ownerKind===detail.kind&&a.ownerId===detail.id):[],localIds=new Set(workspace.blobs.map(b=>b.attachmentId));
  const fileTransfers=Object.fromEntries(workspace.blobs.flatMap(blob=>{const attachment=state.attachment.find(item=>item.id===blob.attachmentId);if(!attachment)return [];const item=transferView(attachment,blob,connection,online,liveTransfers[attachment.id]);return [[attachment.id,{state:item.state,percent:item.percent,message:item.message} satisfies FileTransferView]];}));
  const fileList=(items:Attachment[])=><FileListView files={items} localIds={localIds} transfers={fileTransfers} onDownload={localDownload} onDelete={a=>askDelete("attachment",a)}/>;
  if(fatal)return <CriticalRecovery error={new Error(fatal)}/>;
  if(!ready)return <main className="startup"><div className="brand"><span className="brand-mark"><img src={appPath("favicon.svg")} alt=""/></span>Kairo Ride</div><p>{tr("Opening records on this device…","Atveriami šio įrenginio įrašai…")}</p><Skeleton className="h-24 w-80"/><noscript>Kairo Ride requires JavaScript.</noscript></main>;
  return <div className="kairo-app"><Toaster position="top-center" richColors theme="dark"/><a className="skip-link" href="#main-content">{tr("Skip to content","Pereiti prie turinio")}</a>
    <header className="app-header"><button className="brand" onClick={()=>changeView("overview")} aria-label={tr("Kairo Ride home","Kairo Ride apžvalga")}><span className="brand-mark"><img src={appPath("favicon.svg")} alt=""/></span><span>Kairo <b>Ride</b></span></button><div className="header-right"><Button variant="ghost" size="icon" className="settings-button" onClick={()=>openSettings()} aria-label={tr("Settings","Nustatymai")}><Settings/></Button><Button variant="outline" className={`sync-button ${!profile?"local":""}`} disabled={connecting} onClick={()=>googleReady&&online&&!connection?connect():openSettings("sync")}>{syncMessage||connecting?<LoaderCircle className="spin"/>:!online?<WifiOff/>:connection?<Cloud/>:<HardDrive/>}<span>{syncLabel}</span>{workspace.pending.length+pendingFiles>0&&<span className="count-badge">{workspace.pending.length+pendingFiles}</span>}</Button></div></header>
    <Tabs value={view} onValueChange={v=>changeView(v as View)} className="app-tabs"><div className="navigation"><TabsList variant="line" className="main-tabs" aria-label={tr("Main areas","Pagrindinės sritys")}>{nav.map(n=><TabsTrigger value={n.id} key={n.id} aria-label={n.label} title={n.label}><n.icon/><span>{n.label}</span></TabsTrigger>)}</TabsList><span className="nav-caption">{tr("Ride beyond limits.","Riedėk be ribų.")}</span></div><main id="main-content" className="app-main">
      {!profile&&<div className="local-notice"><HardDrive/><p><strong>{tr("Currently stored on this device only.","Kol kas saugoma tik šiame įrenginyje.")}</strong> {tr("Connect Drive to see records on another device. Use export until then.","Prijunk Drive, kad matytum įrašus kitame įrenginyje. Iki tol naudok eksportą.")}</p><Button variant="ghost" size="sm" onClick={()=>openSettings("sync")}>{tr("Settings","Nustatymai")} <ArrowRight/></Button></div>}
      {!online&&<div className="notice"><WifiOff/><span>{tr("You can keep working offline. Changes reach other devices after they upload to Drive.","Gali tęsti be interneto. Pakeitimai kitus įrenginius pasieks po įkėlimo į Drive.")}</span></div>}
      {profile&&online&&!connection&&<div className="notice"><CloudOff/><span>{tr("Your records are available locally. Refresh Google access to resume Drive sync; no data was removed.","Įrašai pasiekiami šiame įrenginyje. Atnaujink Google prieigą sinchronizavimui tęsti; duomenys nepašalinti.")}</span><Button variant="outline" size="sm" disabled={!googleReady||connecting} onClick={connect}>{tr("Refresh access","Atnaujinti prieigą")}</Button></div>}
      {syncIssue&&connection&&online&&!syncMessage&&<div className="notice warning"><TriangleAlert/><span>{syncIssue.message} {syncIssue.retry&&autoSyncEnabled?tr("Automatic sync will retry. Local changes are safe.","Automatinis sinchronizavimas bandys dar kartą. Vietiniai pakeitimai išsaugoti."):tr("Review Settings, then try Sync now. Local changes are safe.","Peržiūrėk nustatymus ir bandyk sinchronizuoti. Vietiniai pakeitimai išsaugoti.")}</span><Button variant="outline" size="sm" onClick={()=>openSettings("sync")}>{tr("Transfers","Perdavimai")}</Button></div>}
      {pendingFiles>0&&<div className="notice"><Cloud/><span>{pendingFiles} {tr("original files are safely stored on this device and shown in Transfers until Drive confirms every byte.","originalūs failai saugiai laikomi šiame įrenginyje ir rodomi Perdavimo lange, kol Drive patvirtins kiekvieną baitą.")}</span><Button variant="outline" size="sm" onClick={()=>openSettings("sync")}>{tr("View Transfers","Atverti perdavimus")}</Button></div>}
      {appUpdate.update&&<div className="notice"><RefreshCw/><span>{tr(`Kairo Ride ${appUpdate.update.version} is downloaded and ready to install.`,`Kairo Ride ${appUpdate.update.version} atsisiųsta ir paruošta diegti.`)}</span><Button variant="outline" size="sm" onClick={()=>openSettings("info")}>{tr("Review update","Peržiūrėti atnaujinimą")}</Button></div>}
      {state.conflicts.length>0&&<div className="notice warning"><TriangleAlert/><span>{state.conflicts.length} {tr("records have conflicting versions. Both are saved.","įrašų versijos nesutampa. Abi išsaugotos.")}</span><Button variant="outline" size="sm" onClick={()=>setConflict(state.conflicts[0])}>{tr("Review","Peržiūrėti")}</Button></div>}
      {integrityNotice&&<div className="notice warning"><TriangleAlert/><span><strong>{integrityNotice.title}.</strong> {integrityNotice.message} {integrityNotice.action}</span><Button variant="outline" size="sm" onClick={()=>openSettings("transfer")}>{tr("Restore backup","Atkurti kopiją")}</Button></div>}
      <MainViews key={profile?.namespace??"local"} state={state} actions={actions} setView={changeView} openStorage={()=>openSettings()}/>
    </main></Tabs><EarthProgress state={state} goalId={selectedGoal}/><footer className="app-footer"><span>Kairo Ride <small>{APP_VERSION}</small></span><span><ShieldCheck/>{tr("No ads or tracking. Your data stays yours.","Be reklamos ir sekimo. Duomenys lieka tavo.")}</span><Button variant="ghost" size="sm" onClick={()=>openSettings()}><CircleHelp/>{tr("Settings","Nustatymai")}</Button></footer>

    <Dialog open={!!editor} onOpenChange={open=>{if(!open)closeEditor();}}><DialogContent className="editor-dialog"><DialogHeader><DialogTitle>{editor?.entity||editor?.reading?tr("Edit","Redaguoti"):tr("New","Naujas įrašas")}: {editor&&(language==="lt"?ltTitles[editor.kind]:titles[editor.kind]).toLowerCase()}</DialogTitle><DialogDescription>{editor?.kind==="ride"?tr("Enter the complete odometer; distance is calculated automatically. A name is optional. You can also create or select a trip.","Įvesk visą odometrą; atstumas skaičiuojamas automatiškai. Pavadinimas neprivalomas. Čia pat galima sukurti arba pasirinkti kelionę."):editor?.kind==="reading"?tr("Enter the complete odometer value, not the ride distance.","Įrašyk visą odometro reikšmę, ne važiavimo atstumą."):editor?.kind==="trip"?tr("A trip combines dates, rides and shared files.","Kelionę sudaro datos, važiavimai ir bendri failai."):editor?.kind==="maintenance"?tr("Set a date, odometer target, or both. Insurance requires an expiry date.","Nurodyk datą, odometro reikšmę arba abu. Draudimui būtina galiojimo data."):tr("Changes are saved only after you press Save.","Pakeitimai išsaugomi tik paspaudus Išsaugoti.")}</DialogDescription></DialogHeader>{editor&&<EntityForm key={`${editor.kind}:${editor.entity?.id??editor.reading?.id??"new"}`} editor={editor} state={state} busy={busy} onDirtyChange={setEditorDirty} onSave={save} onCancel={closeEditor}/ >}{editor&&(editor.entity||editor.reading)&&<Button className="editor-delete" variant="destructive" disabled={busy} onClick={()=>editor.entity?askDelete(editor.kind,editor.entity,editor.reading):editor.reading&&askDelete("reading",editor.reading)}><Trash2/>{tr("Delete","Pašalinti")}</Button>}{editor?.kind==="trip"&&editor.entity&&<section className="detail-section"><h3>{tr("Trip files","Kelionės failai")}</h3><FileListView files={state.attachment.filter(a=>a.ownerKind==="trip"&&a.ownerId===editor.entity?.id)} localIds={localIds} transfers={fileTransfers} onDownload={localDownload} onDelete={a=>askDelete("attachment",a)} editable/></section>}</DialogContent></Dialog>

    {activeTrip&&<TripDialog key={(profile?.namespace??"local")+":"+activeTrip.id+":"+Boolean(detail?.edit)} trip={activeTrip} state={state} namespace={profile?.namespace??"local"} initialEdit={detail?.edit} actions={actions} localIds={localIds} transfers={fileTransfers} onDownload={localDownload} onSave={saveTripDraft} onClose={()=>setDetail(null)}/>}
    <Dialog open={!!detail&&detail.kind!=="trip"} onOpenChange={open=>{if(!open&&!busy)setDetail(null);}}><DialogContent className="detail-dialog"><DialogHeader><div className="eyebrow">{activeTrip?tr("TRIP","KELIONĖ"):tr("RIDE","VAŽIAVIMAS")}</div><DialogTitle className="detail-title">{activeTrip?.name||(activeRide?(activeRide.name||tr("Ride","Važiavimas")):tr("Record unavailable","Įrašas nepasiekiamas"))}</DialogTitle><DialogDescription>{activeTrip?`${formatDate(activeTrip.startDate,false,undefined,locale)} → ${formatDate(activeTrip.endDate,false,undefined,locale)} · ${tripInfo?.days} ${tr("days","d.")}`:activeRide?`${formatDate(activeRide.at,true,activeRide.timeZone,locale)} · ${state.wheel.find(w=>w.id===activeRide.wheelId)?.name??""}`:tr("The record may have been deleted on another device.","Įrašas galėjo būti pašalintas kitame įrenginyje.")}</DialogDescription></DialogHeader>
      {(activeTrip||activeRide)&&<><div className="detail-meta"><span><Route/>{formatKm(tripInfo?tripInfo.distanceKm:activeRideEntry?.distanceKm??null,locale)} km{tripInfo?.unknownDistances?tr(" + unknown distances"," + neįvesti atstumai"):""}</span>{activeRide?.durationMinutes&&<span><Clock3/>{Math.floor(activeRide.durationMinutes/60)} h {activeRide.durationMinutes%60} min{activeRideEntry?.distanceKm!==null&&activeRideEntry?.distanceKm!==undefined?` · ${formatKm(activeRideEntry.distanceKm/(activeRide.durationMinutes/60),locale)} km/h`:""}</span>}{activeTrip&&<span><Paperclip/>{tripInfo?.attachments.length} {tr("files","failų")}</span>}<Button variant="ghost" size="sm" onClick={()=>activeTrip?openEditor("trip",activeTrip):activeRide&&openRide(legacyReading?undefined:activeRide,legacyReading??readingForRide(state,activeRide))}><Pencil/>{tr("Edit","Redaguoti")}</Button></div>{(activeTrip?.notes||activeRide?.notes)&&<p className="detail-notes preserve-lines">{activeTrip?.notes||activeRide?.notes}</p>}
      {activeTrip&&<section className="detail-section"><div className="section-heading"><h3>{tr("Trip rides","Kelionės važiavimai")}</h3><Button variant="outline" size="sm" disabled={!state.wheel.length} onClick={()=>openRide(undefined,undefined,activeTrip.id)}><Plus/>{tr("Add","Pridėti")}</Button></div>{tripInfo?.rides.length?tripInfo.rides.map(r=><RideRow key={r.id} ride={r} state={state} actions={actions}/>):<p className="muted">{tr("No rides linked yet. Edit a ride and select this trip.","Dar nėra priskirtų važiavimų. Redaguok važiavimą ir pasirink šią kelionę.")}</p>}{!state.wheel.length&&<p className="field-hint">{tr("Add a vehicle in Garage before adding a ride.","Prieš važiavimą pridėk priemonę Garaže.")}</p>}</section>}
      {activeRide?.tripId&&<Button variant="outline" onClick={()=>setDetail({kind:"trip",id:activeRide.tripId!})}><Mountain/>{tr("Open trip","Atverti kelionę")}</Button>}
      {activeTrip&&<section className="detail-section"><div className="section-heading"><h3>{activeTrip?tr("Shared trip files","Bendri kelionės failai"):tr("Ride files","Važiavimo failai")}</h3><Button variant="outline" size="sm" disabled={busy} onClick={()=>attachmentInput.current?.click()}>{busy?<LoaderCircle className="spin"/>:<Paperclip/>}{tr("Attach","Prisegti")}</Button></div><p className="field-hint">{tr("GPX, CSV logs, photos, video and other originals. Up to 512 MB per file. Content is neither modified nor analysed.","GPX, CSV logai, nuotraukos, video ir kiti originalai. Iki 512 MB vienam failui. Turinys nekeičiamas ir neanalizuojamas.")}</p>{files.length?fileList(files):<div className="attachment-empty"><FolderOpen/><span>{tr("Attach the first file. It will stay linked to this record.","Prisek pirmą failą. Jis bus susietas su šiuo įrašu.")}</span></div>}{!connection&&<p className="inline-warning"><CloudOff/>{tr("Until Drive is connected, files remain on this device only.","Kol Drive neprijungtas, failai bus tik šiame įrenginyje.")}</p>}</section>}
      {activeTrip&&!!tripInfo?.attachments.filter(a=>a.ownerKind==="ride").length&&<section className="detail-section"><h3>{tr("Ride attachments","Važiavimų priedai")}</h3>{fileList(tripInfo.attachments.filter(a=>a.ownerKind==="ride"))}</section>}</>}
    </DialogContent></Dialog><input ref={attachmentInput} type="file" multiple className="sr-only" tabIndex={-1} aria-label={tr("Attach files","Prisegti failus")} onChange={e=>{void attach(e.target.files);e.target.value="";}}/>

    {exportFile&&<ExportDialog key={exportFile.name} file={exportFile} canSave={connection&&online&&!!profile&&profile.namespace===exportFile.namespace} save={saveExport} download={download} close={()=>setExportFile(null)}/>}
    {driveOpen&&<StoragePanel open setOpen={setDriveOpen} initialSection={settingsSection} namespace={profile?.namespace??"local"} config={config} profile={profile} connection={connection} connecting={connecting} googleReady={googleReady} online={online} autoSyncEnabled={autoSyncEnabled} onAutoSyncChange={changeAutoSync} syncIssue={syncIssue} syncMessage={syncMessage} cloud={cloud} pending={workspace.pending.length} pendingFiles={pendingFiles} conflicts={state.conflicts.length} attachments={state.attachment} blobs={workspace.blobs} liveTransfers={liveTransfers} onTransferChanged={async()=>{await refresh();}} onCancelUpload={cancelUpload} wakeLock={uploadWakeLock.enabled} wakeLockSupported={uploadWakeLock.supported} onWakeLockChange={uploadWakeLock.setEnabled} recoverySnapshots={recoverySnapshots} onRestoreSnapshot={restoreSnapshot} importZone={importZone} setImportZone={setImportZone} importBusy={importBusy} offlineReady={offlineReady} persisted={persisted} notificationsEnabled={notificationsEnabled} update={appUpdate.update} updateChecking={appUpdate.checking} updateActivating={appUpdate.activating} updateError={appUpdate.error} onCheckUpdate={()=>void appUpdate.check()} onApplyUpdate={()=>void appUpdate.activate()} onEnableNotifications={()=>void enableNotifications()} onDisableNotifications={disableNotifications} onConnect={connect} onSync={()=>void syncNow()} onDisconnect={()=>void disconnect().catch(e=>toast.error(friendlyError(e,language)))} onImport={()=>importInput.current?.click()} onExport={exportData} onPersist={()=>void persist()}/>}<input ref={importInput} type="file" accept=".json,.xlsx" className="sr-only" tabIndex={-1} aria-label={tr("Import data","Importuoti duomenis")} onChange={e=>{if(e.target.files?.[0])void readImport(e.target.files[0]);e.target.value="";}}/>

    <AlertDialog open={!!candidate} onOpenChange={open=>{if(!open&&!connecting){candidate?.client.disconnect();setCandidate(null);}}}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{tr("Connect","Prijungti")} {candidate?.profile.email}?</AlertDialogTitle><AlertDialogDescription>{candidate?.hasLocal?tr("This device already has local records and files. Copy them into this account? The original local copy will not be deleted.","Šiame įrenginyje jau yra vietinių įrašų ir failų. Nukopijuoti juos į šią paskyrą? Vietinė kopija nebus ištrinta."):tr("This account's data space will open. Records from another account are not transferred automatically.","Bus atverta šios paskyros duomenų erdvė. Kitos paskyros įrašai automatiškai neperkeliami.")}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={connecting}>{tr("Cancel","Atšaukti")}</AlertDialogCancel>{candidate?.hasLocal&&<Button variant="outline" disabled={connecting} onClick={()=>candidate&&void activate(candidate,false)}>{tr("Without local records","Be vietinių įrašų")}</Button>}<Button disabled={connecting} onClick={()=>candidate&&void activate(candidate,!!candidate.hasLocal)}>{connecting?<LoaderCircle className="spin"/>:<Check/>}{candidate?.hasLocal?tr("Copy and connect","Kopijuoti ir prijungti"):tr("Connect account","Prijungti paskyrą")}</Button></AlertDialogFooter></AlertDialogContent></AlertDialog>
    <AlertDialog open={!!pendingDelete} onOpenChange={open=>{if(!open&&!busy)setPendingDelete(null);}}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{tr("Delete record?","Pašalinti įrašą?")}</AlertDialogTitle><AlertDialogDescription>{pendingDelete?.kind==="attachment"?tr("Only the link will be removed. The original Drive file will not be deleted.","Bus pašalintas tik ryšys. Originalus Drive failas nebus ištrintas."):tr("This item will be hidden from active use. Existing history stays in the database. Restoring or permanently deleting it is possible only by opening the database.","Įrašas bus paslėptas nuo naudojimo. Esama istorija lieka duomenų bazėje. Atkurti arba galutinai ištrinti galima tik atsidarius duomenų bazę.")}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={busy}>{tr("Keep","Palikti")}</AlertDialogCancel><AlertDialogAction variant="destructive" disabled={busy} onClick={e=>{e.preventDefault();void remove();}}>{tr("Delete","Pašalinti")}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    <Dialog open={!!importPreview} onOpenChange={open=>{if(!open&&!importBusy)setImportPreview(null);}}><DialogContent className="import-dialog"><DialogHeader><DialogTitle>{tr("Import preview","Importo peržiūra")}</DialogTitle><DialogDescription>{importPreview?.source}. {tr("Nothing has been written yet.","Dar nieko neįrašyta.")}</DialogDescription></DialogHeader>{importPreview&&<><div className="import-counts"><span><strong>{importPreview.counts.wheel}</strong>{tr("vehicles","priemonių")}</span><span><strong>{importPreview.counts.reading}</strong>{tr("records","įrašų")}</span><span><strong>{importPreview.counts.ride}</strong>{tr("rides","važiavimų")}</span><span><strong>{importPreview.counts.trip}</strong>{tr("trips","kelionių")}</span><span><strong>{importPreview.counts.gear}</strong>{tr("gear","ekipuotės")}</span><span><strong>{importPreview.counts.maintenance}</strong>{tr("maintenance","priežiūros")}</span><span><strong>{importPreview.counts.goal}</strong>{tr("goals","tikslų")}</span></div><ul className="import-warnings">{importPreview.warnings.map((w,i)=><li key={i}>{w}</li>)}</ul><p className="field-hint">{tr("Records merge by stable ID. Re-importing the same file does not duplicate them. Conflicting versions remain visible for review.","Įrašai sujungiami pagal stabilius ID. Pakartotinis importas jų nedaugina. Konfliktuojančios versijos lieka peržiūrai.")}</p></>}<DialogFooter><Button variant="outline" disabled={importBusy} onClick={()=>setImportPreview(null)}>{tr("Cancel","Atšaukti")}</Button><Button disabled={importBusy} onClick={()=>void applyImport()}>{importBusy?<LoaderCircle className="spin"/>:<Check/>}{tr("Confirm import","Patvirtinti importą")}</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={!!conflict} onOpenChange={open=>{if(!open&&!busy)setConflict(null);}}><DialogContent className="conflict-dialog"><DialogHeader><DialogTitle>{tr("Choose which version to keep","Pasirink, kurią versiją palikti")}</DialogTitle><DialogDescription>{tr("Different devices changed the same record. Nothing was silently overwritten.","Skirtingi įrenginiai pakeitė tą patį įrašą. Niekas nebuvo tyliai perrašyta.")}</DialogDescription></DialogHeader>{conflict?.revisions.map((r,i)=><div className="conflict-version" key={r.operationId}><strong>{tr("Version","Versija")} {i+1} · {formatDate(r.createdAt,true,undefined,locale)}</strong><pre>{r.value?JSON.stringify(r.value,null,2):tr("Record deleted","Įrašas pašalintas")}</pre><Button disabled={busy} onClick={()=>void resolveRevision(r.value)}>{tr("Keep this version","Palikti šią versiją")}</Button></div>)}</DialogContent></Dialog>
  </div>;
}
