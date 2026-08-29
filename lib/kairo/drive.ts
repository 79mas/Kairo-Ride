import { appPath } from "./paths";
import { attachmentSchema, backup, canonical, parseOperation, type Attachment, type Operation, type State } from "./domain";
import { commit, loadWorkspace, mergeOperations, metaGet, metaSet, patchBlob, patchOperation, type Profile, type StoredBlob, type StoredOperation } from "./storage";

const DRIVE_SCOPE="https://www.googleapis.com/auth/drive.file";
const API="https://www.googleapis.com/drive/v3";
const UPLOAD="https://www.googleapis.com/upload/drive/v3";
const APP="kairo-ride-v1";
const FILE_FIELDS="id,name,mimeType,parents,appProperties,createdTime,trashed";
type DriveFile={id:string;name:string;mimeType?:string;parents?:string[];appProperties?:Record<string,string>;createdTime?:string;trashed?:boolean};
type TokenResponse={access_token?:string;expires_in?:number;error?:string;scope?:string};
type GoogleIdentity={accounts:{oauth2:{initTokenClient(config:{client_id:string;scope:string;callback:(r:TokenResponse)=>void;error_callback:(r:{type:string})=>void;include_granted_scopes:boolean}):{requestAccessToken(config:{prompt:string;hint?:string}):void};revoke(token:string,done:()=>void):void}}};
declare global {interface Window {google?:GoogleIdentity}}
export type DriveConfig={googleClientId:string};
export class DriveError extends Error { constructor(message:string,public status=0){super(message);this.name="DriveError";} }
let configPromise:Promise<DriveConfig>|undefined;
let scriptPromise:Promise<void>|undefined;

export function readDriveConfig():Promise<DriveConfig>{
  if(!configPromise)configPromise=fetch(appPath("kairo-config.json"),{cache:"no-store"}).then(r=>{if(!r.ok)throw new Error("Nepavyko perskaityti programėlės nustatymų.");return r.json();}).then((v:unknown)=>{
    const id=(v as DriveConfig)?.googleClientId;
    if(typeof id!=="string" || (id && !/^[0-9]+-[a-z0-9]+\.apps\.googleusercontent\.com$/.test(id)))throw new Error("Netinkama projekto Google konfigūracija.");
    return {googleClientId:id};
  }).catch(e=>{configPromise=undefined;throw e;});return configPromise;
}
/** Preload on opening the Drive dialog, so requestAccessToken stays in a user click. */
export function prepareGoogle():Promise<void>{
  if(window.google?.accounts.oauth2)return Promise.resolve();
  if(!scriptPromise)scriptPromise=new Promise((resolve,reject)=>{
    const script=document.createElement("script");script.src="https://accounts.google.com/gsi/client";script.async=true;script.defer=true;
    const timer=setTimeout(()=>{script.remove();scriptPromise=undefined;reject(new Error("Google nepasiekiamas. Vietiniai duomenys lieka pasiekiami."));},15000);
    script.onload=()=>{clearTimeout(timer);if(window.google?.accounts.oauth2)resolve();else{scriptPromise=undefined;reject(new Error("Nepavyko paruošti Google prisijungimo."));}};
    script.onerror=()=>{clearTimeout(timer);scriptPromise=undefined;script.remove();reject(new Error("Google prisijungimo nepavyko įkelti. Patikrink ryšį arba turinio blokavimą."));};
    document.head.appendChild(script);
  });return scriptPromise;
}
export function authorizeGoogle(clientId:string, hint?:string):Promise<DriveClient>{
  if(!window.google?.accounts.oauth2)return Promise.reject(new Error("Google prisijungimas dar kraunamas. Bandyk dar kartą."));
  return new Promise((resolve,reject)=>{
    const client=window.google!.accounts.oauth2.initTokenClient({client_id:clientId,scope:DRIVE_SCOPE,include_granted_scopes:false,
      callback:r=>{
        if(r.error||!r.access_token){reject(new Error(r.error==="access_denied"?"Leidimas nesuteiktas. Tavo duomenys nepakeisti.":"Google neprijungtas. Projekto savininkas turi patikrinti OAuth nustatymus."));return;}
        if(!r.scope?.split(" ").includes(DRIVE_SCOPE)){reject(new Error("Reikia leidimo programėlės kuriamiems Drive failams."));return;}
        resolve(new DriveClient(r.access_token,Date.now()+(r.expires_in??3600)*1000));
      },error_callback:r=>reject(new Error(r.type==="popup_closed"?"Prisijungimo langas uždarytas.":"Leisk atidaryti Google prisijungimo langą ir bandyk dar kartą.")),
    });client.requestAccessToken({prompt:hint?"":"select_account",...(hint?{hint}:{})});
  });
}
const quoted=(s:string)=>s.replace(/\\/g,"\\\\").replace(/'/g,"\\'");
const property=(key:string,value:string)=>`appProperties has { key='${quoted(key)}' and value='${quoted(value)}' }`;
const safeName=(s:string)=>s.replace(/[\/\\\u0000-\u001F]/g," ").trim().slice(0,100)||"Įrašas";
export const driveFileUrl=(id:string)=>`https://drive.google.com/file/d/${encodeURIComponent(id)}/view`;
export const driveFolderUrl=(id:string)=>`https://drive.google.com/drive/folders/${encodeURIComponent(id)}`;
const isId=(id:unknown):id is string=>typeof id==="string"&&/^[a-zA-Z0-9_-]{8,200}$/.test(id);
function ensureFile(value:DriveFile):DriveFile{if(!isId(value.id))throw new Error("Google grąžino netinkamą failo identifikatorių.");return value;}
function safeSession(uri:string){const url=new URL(uri);if(url.origin!=="https://www.googleapis.com"||!url.pathname.startsWith("/upload/drive/v3/files"))throw new Error("Netinkamas Google įkėlimo adresas.");return uri;}
async function limitedJson(response:Response,maxBytes:number):Promise<unknown>{
  if(!response.body)throw new Error("Tuščias Drive atsakymas.");
  const reader=response.body.getReader(),chunks:Uint8Array[]=[];let size=0;
  try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>maxBytes)throw new Error("Drive pakeitimų failas viršija dydžio ribą.");chunks.push(value);}}
  catch(e){await reader.cancel().catch(()=>{});throw e;}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  return JSON.parse(new TextDecoder().decode(bytes));
}

export class DriveClient {
  private token:string;
  readonly expiresAt:number;
  private controller=new AbortController();
  private folders=new Map<string,DriveFile>();
  constructor(token:string,expiresAt:number,private fetcher:typeof fetch=fetch){this.token=token;this.expiresAt=expiresAt;}
  get connected(){return !!this.token&&!this.controller.signal.aborted&&Date.now()<this.expiresAt-30_000;}
  disconnect(){this.controller.abort();this.token="";this.folders.clear();}
  assertConnected(){if(!this.connected)throw new DriveError("Atnaujink Google prieigą. Vietiniai pakeitimai saugūs šiame įrenginyje.",401);}
  private async fetch(url:string,options:RequestInit={},allow:number[]=[]):Promise<Response>{
    this.assertConnected();
    const parsed=new URL(url);
    if(parsed.origin!=="https://www.googleapis.com"||!/^\/(upload\/)?drive\/v3\//.test(parsed.pathname))throw new Error("Užblokuotas netinkamas Drive API adresas.");
    const response=await this.fetcher(url,{...options,headers:{...Object.fromEntries(new Headers(options.headers).entries()),Authorization:`Bearer ${this.token}`},signal:this.controller.signal,redirect:"error",cache:"no-store"});
    if(!response.ok&&!allow.includes(response.status)){
      if(response.status===401){this.token="";throw new DriveError("Google leidimas pasibaigė. Paspausk „Atnaujinti prieigą“.",401);}
      if(response.status===403){
        const body=await response.json().catch(()=>null);const reason=body?.error?.errors?.[0]?.reason;
        throw new DriveError(reason==="storageQuotaExceeded"?"Google Drive nepakanka vietos. Įrašai ir failai liko šiame įrenginyje.":"Google neleido atlikti veiksmo. Patikrink Drive leidimą; projekto savininkas – ar įjungta Drive API.",403);
      }
      if(response.status===429||response.status>=500)throw new DriveError("Google šiuo metu nepasiekiamas arba riboja užklausas. Bandyk sinchronizuoti vėliau.",response.status);
      throw new DriveError(`Drive veiksmas nepavyko (${response.status}). Vietiniai pakeitimai nepašalinti.`,response.status);
    }
    return response;
  }
  async about():Promise<Profile>{
    const result=await (await this.fetch(`${API}/about?fields=user(permissionId,emailAddress,displayName)`)).json();
    if(!isId(result.user?.permissionId)||typeof result.user?.emailAddress!=="string")throw new Error("Nepavyko patvirtinti Google paskyros.");
    return {namespace:`google:${result.user.permissionId}`,permissionId:result.user.permissionId,email:result.user.emailAddress,name:result.user.displayName??result.user.emailAddress};
  }
  async list(query:string):Promise<DriveFile[]>{
    const files:DriveFile[]=[];let pageToken:string|undefined;
    do{
      const params=new URLSearchParams({q:`trashed = false and ${property("app",APP)} and (${query})`,spaces:"drive",pageSize:"1000",fields:`nextPageToken,files(${FILE_FIELDS})`,orderBy:"createdTime"});
      if(pageToken)params.set("pageToken",pageToken);
      const page=await (await this.fetch(`${API}/files?${params}`)).json();
      if(!Array.isArray(page.files))throw new Error("Nepilnas Drive atsakymas.");
      files.push(...page.files.map(ensureFile));pageToken=page.nextPageToken;
      if(files.length>100_000)throw new Error("Istorija per didelė šiai versijai. Eksportuok kopiją ir kreipkis į projekto savininką.");
    }while(pageToken);return files;
  }
  async newId():Promise<string>{const r=await(await this.fetch(`${API}/files/generateIds?count=1&space=drive&type=files`)).json();if(!isId(r.ids?.[0]))throw new Error("Nepavyko rezervuoti Drive failo.");return r.ids[0];}
  async folder(key:string,name:string,parent?:string):Promise<DriveFile>{
    if(this.folders.has(key))return this.folders.get(key)!;
    const found=await this.list(`${property("kind","folder")} and ${property("key",key)} and mimeType = 'application/vnd.google-apps.folder'`);
    let folder=found[0];
    if(!folder){
      folder=ensureFile(await(await this.fetch(`${API}/files?fields=${FILE_FIELDS}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:safeName(name),mimeType:"application/vnd.google-apps.folder",...(parent?{parents:[parent]}:{}),appProperties:{app:APP,kind:"folder",key}})})).json());
    }else if(key!=="root"&&(folder.name!==safeName(name)||(parent&&!folder.parents?.includes(parent)))){
      const params=new URLSearchParams({fields:FILE_FIELDS});
      if(parent&&!folder.parents?.includes(parent)){params.set("addParents",parent);if(folder.parents?.length)params.set("removeParents",folder.parents.join(","));}
      folder=ensureFile(await(await this.fetch(`${API}/files/${folder.id}?${params}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:safeName(name)})})).json());
    }
    this.folders.set(key,folder);return folder;
  }
  async root(){return this.folder("root","Kairo Ride");}
  async ownerFolder(kind:"trip"|"ride",id:string,state:State):Promise<DriveFile>{
    const root=await this.root();
    if(kind==="trip"){
      const trip=state.trip.find(t=>t.id===id);if(!trip)throw new Error("Nerasta priedo kelionė.");
      const category=await this.folder("trips","Kelionės",root.id);
      return this.folder(`trip-${id}`,`${trip.startDate}_${trip.name}_${id.slice(0,8)}`,category.id);
    }
    const ride=state.ride.find(r=>r.id===id);if(!ride)throw new Error("Nerastas priedo pasivažinėjimas.");
    const parent=ride.tripId?await this.ownerFolder("trip",ride.tripId,state):await this.folder("rides","Pasivažinėjimai",root.id);
    return this.folder(`ride-${id}`,`${ride.localDate??ride.at.slice(0,10)}_${ride.name}_${id.slice(0,8)}`,parent.id);
  }
  async getOperation(file:DriveFile):Promise<Operation>{
    const response=await this.fetch(`${API}/files/${file.id}?alt=media`);
    const op=parseOperation(await limitedJson(response,10*1024*1024));
    if(file.appProperties?.operationId!==op.id)throw new Error("Drive istorijos failas nesutampa su jo metaduomenimis.");return op;
  }
  async pull(namespace:string,onProgress:(s:string)=>void){
    const files=await this.list(property("kind","operation"));
    const known=new Set((await loadWorkspace(namespace)).operations.map(op=>op.id));
    const needed=files.filter(f=>!known.has(f.appProperties?.operationId??""));
    for(let start=0;start<needed.length;start+=4){
      onProgress(`Gaunami pakeitimai: ${Math.min(start+4,needed.length)} / ${needed.length}`);
      const batch=await Promise.all(needed.slice(start,start+4).map(file=>this.getOperation(file)));
      await mergeOperations(namespace,batch,true);
    }
    // A local unacknowledged operation is verified by content before being acknowledged.
    const pending=(await loadWorkspace(namespace)).pending;
    for(const record of pending){
      const file=files.find(f=>f.appProperties?.operationId===record.operation.id);
      if(file){const cloud=await this.getOperation(file);if(canonical(cloud)!==canonical(record.operation))throw new Error("Drive istorijos turinys konfliktuoja. Nieko neperrašėme.");await patchOperation(namespace,record.operation.id,{uploaded:true,fileId:file.id});}
    }
  }
  private async multipart(metadata:Record<string,unknown>,content:string,id?:string):Promise<Response>{
    const boundary=`kairo_${crypto.randomUUID()}`;
    const body=`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${content}\r\n--${boundary}--`;
    return this.fetch(`${UPLOAD}/files${id?`/${id}`:""}?uploadType=multipart&fields=id`,{method:id?"PATCH":"POST",headers:{"Content-Type":`multipart/related; boundary=${boundary}`},body},id?[]:[409]);
  }
  async push(namespace:string,record:StoredOperation,parent:string){
    const id=record.fileId??await this.newId();
    if(!record.fileId)await patchOperation(namespace,record.operation.id,{fileId:id});
    const metadata={id,name:`${record.operation.createdAt.replace(/[:.]/g,"-")}_${record.operation.id}.json`,parents:[parent],appProperties:{app:APP,kind:"operation",operationId:record.operation.id}};
    const response=await this.multipart(metadata,JSON.stringify(record.operation));
    if(response.status===409){const cloud=await this.getOperation({id,name:"",appProperties:{operationId:record.operation.id}});if(canonical(cloud)!==canonical(record.operation))throw new Error("Rezervuotas Drive failas turi kitą turinį.");}
    else{const created=ensureFile(await response.json());if(created.id!==id)throw new Error("Google sukūrė kitą failą nei rezervuotas.");}
    this.assertConnected();await patchOperation(namespace,record.operation.id,{uploaded:true,fileId:id});
  }
  async uploadAttachment(namespace:string,attachment:Attachment,stored:StoredBlob,parent:string,onProgress:(s:string)=>void):Promise<string>{
    const fileId=stored.fileId??await this.newId();if(!stored.fileId)await patchBlob(namespace,attachment.id,{fileId});
    let session=stored.session;let offset=0;
    if(session){
      const status=await this.fetch(safeSession(session),{method:"PUT",headers:{"Content-Range":`bytes */${stored.blob.size}`},body:new Blob([])},[308,404,410]);
      if(status.ok){const done=ensureFile(await status.json());if(done.id!==fileId)throw new Error("Nesutampa įkelto failo ID.");return done.id;}
      if(status.status===308)offset=Number(status.headers.get("Range")?.match(/-(\d+)$/)?.[1]??-1)+1;
      else session=undefined;
    }
    if(session&&(!Number.isFinite(offset)||offset<0||offset>stored.blob.size))throw new Error("Google grąžino netinkamą įkėlimo poziciją.");
    if(session&&offset===stored.blob.size&&stored.blob.size>0)throw new Error("Visi baitai perduoti, bet Google dar nepatvirtino failo. Bandyk sinchronizuoti dar kartą.");
    if(!session){
      const response=await this.fetch(`${UPLOAD}/files?uploadType=resumable&fields=id`,{method:"POST",headers:{"Content-Type":"application/json","X-Upload-Content-Type":attachment.mimeType,"X-Upload-Content-Length":String(stored.blob.size)},body:JSON.stringify({id:fileId,name:attachment.name,parents:[parent],appProperties:{app:APP,kind:"attachment",attachmentId:attachment.id}})},[409]);
      if(response.status===409){
        const existing=await(await this.fetch(`${API}/files/${fileId}?fields=id,size,appProperties`)).json();
        if(existing.appProperties?.attachmentId!==attachment.id||Number(existing.size)!==attachment.size)throw new Error("Drive priedo patikra nepavyko.");return ensureFile(existing).id;
      }
      session=response.headers.get("Location")??undefined;if(!session)throw new Error("Google negrąžino įkėlimo sesijos.");safeSession(session);await patchBlob(namespace,attachment.id,{session,fileId});
    }
    const chunk=8*1024*1024;
    do{
      const end=Math.min(offset+chunk,stored.blob.size);onProgress(`Keliamas ${attachment.name}: ${Math.round(offset/Math.max(1,stored.blob.size)*100)} %`);
      const response=await this.fetch(safeSession(session),{method:"PUT",headers:{"Content-Type":attachment.mimeType,"Content-Range":stored.blob.size?`bytes ${offset}-${end-1}/${stored.blob.size}`:"bytes */0"},body:stored.blob.slice(offset,end)},[308]);
      if(response.ok){const result=ensureFile(await response.json());if(result.id!==fileId)throw new Error("Nesutampa įkelto failo ID.");return result.id;}
      const next=Number(response.headers.get("Range")?.match(/-(\d+)$/)?.[1]??-1)+1;
      if(next<=offset||next>end)throw new Error("Įkėlimas sustojo. Kitą kartą bus tęsiamas nuo Google patvirtintos vietos.");offset=next;
    }while(offset<stored.blob.size);
    throw new Error("Google dar nepatvirtino viso failo. Bandyk sinchronizuoti dar kartą.");
  }
  async writeSnapshot(operations:Operation[],root:string){
    const found=await this.list(property("kind","snapshot"));
    const metadata={name:"database.json",appProperties:{app:APP,kind:"snapshot"},...(found[0]?{}:{parents:[root]})};
    const response=await this.multipart(metadata,JSON.stringify({...backup(operations),note:"Materializuota kopija. history failai yra nekintamas pirminis pakeitimų žurnalas."}),found[0]?.id);
    if(!response.ok)throw new DriveError("Nepavyko atnaujinti database.json kopijos. Pakeitimų žurnalas išsaugotas.",response.status);
  }
  async sync(namespace:string,onProgress:(s:string)=>void):Promise<{rootId:string;pending:number;lastSync:string}>{
    const perform=async()=>{
      this.assertConnected();this.folders.clear();
      onProgress("Tikrinama Google paskyra…");const profile=await this.about();
      if(profile.namespace!==namespace)throw new Error("Paskyra pasikeitė. Pakeitimai į kitą paskyrą nebus siunčiami.");
      const root=await this.root();await metaSet(`${namespace}:rootId`,root.id);
      await this.pull(namespace,onProgress);
      let workspace=await loadWorkspace(namespace);
      if(workspace.state.integrity.length)throw new Error("Trūksta dalies duomenų istorijos. Sinchronizavimas sustabdytas, kad nebūtų klaidingų pakeitimų.");
      // Upload raw originals before publishing metadata that claims a Drive ID.
      for(const attachment of workspace.state.attachment){
        const conflicted=workspace.state.conflicts.some(c=>c.entityId===attachment.id||c.entityId===attachment.ownerId);
        if(conflicted)continue;
        const folder=await this.ownerFolder(attachment.ownerKind,attachment.ownerId,workspace.state);
        if(attachment.driveId)continue;
        const stored=workspace.blobs.find(b=>b.attachmentId===attachment.id);
        if(!stored)continue; // The originating offline device still owns the queued original.
        const driveId=await this.uploadAttachment(namespace,attachment,stored,folder.id,onProgress);
        this.assertConnected();
        const latest=(await loadWorkspace(namespace)).state.attachment.find(a=>a.id===attachment.id);
        if(latest)await commit(namespace,"attachment",attachmentSchema.parse({...latest,driveId}),attachment.id);
      }
      const history=await this.folder("history","history",root.id);
      // Capture a finite batch. Later local writes remain pending for the next pass.
      workspace=await loadWorkspace(namespace);const pending=workspace.pending;
      for(let i=0;i<pending.length;i++){onProgress(`Saugomi pakeitimai: ${i+1} / ${pending.length}`);await this.push(namespace,pending[i],history.id);}
      await this.pull(namespace,onProgress);
      workspace=await loadWorkspace(namespace);
      const notYetUploaded=new Set(workspace.pending.map(r=>r.operation.id));
      onProgress("Atnaujinama duomenų kopija…");await this.writeSnapshot(workspace.operations.filter(op=>!notYetUploaded.has(op.id)),root.id);
      const lastSync=new Date().toISOString();await metaSet(`${namespace}:lastSync`,lastSync);
      return {rootId:root.id,pending:workspace.pending.length,lastSync};
    };
    if(typeof navigator!=="undefined"&&navigator.locks)return navigator.locks.request(`kairo-sync:${namespace}`,perform);
    return perform();
  }
}
export async function cachedCloudStatus(namespace:string){const [rootId,lastSync]=await Promise.all([metaGet<string>(`${namespace}:rootId`),metaGet<string>(`${namespace}:lastSync`)]);return {rootId,lastSync};}
