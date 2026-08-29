import { LOCAL_DATABASE, LOCAL_CHANNEL } from "./paths";
import { canonical, makeOperation, parseOperation, project, type Attachment, type Entity, type Kind, type Operation, type State } from "./domain";

export type Profile = { namespace: string; email: string; name: string; permissionId: string };
export type StoredOperation = { key: string; namespace: string; operation: Operation; uploaded: boolean; fileId?: string };
export type StoredBlob = { key: string; namespace: string; attachmentId: string; blob: Blob; session?: string; fileId?: string };
export type Workspace = { state: State; operations: Operation[]; pending: StoredOperation[]; blobs: StoredBlob[] };
let opening: Promise<IDBDatabase> | undefined;
function request<T>(r: IDBRequest<T>): Promise<T> { return new Promise((resolve,reject) => { r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); }); }
function complete(tx: IDBTransaction) { return new Promise<void>((resolve,reject) => { tx.oncomplete=()=>resolve(); tx.onabort=()=>reject(tx.error ?? new Error("Storage transaction was cancelled.")); tx.onerror=()=>reject(tx.error); }); }
function database(): Promise<IDBDatabase> {
  if (!opening) opening = new Promise((resolve,reject) => {
    const req = indexedDB.open(LOCAL_DATABASE, 1);
    req.onupgradeneeded = () => {
      for (const name of ["operations", "blobs"]) {
        const store = req.result.createObjectStore(name, {keyPath:"key"});
        store.createIndex("namespace", "namespace", {unique:false});
      }
      req.result.createObjectStore("meta");
    };
    req.onsuccess=()=> { const db = req.result; db.onversionchange=()=> {db.close();opening=undefined;}; resolve(db); };
    req.onerror=()=> {opening=undefined;reject(req.error);};
    req.onblocked=()=>reject(new Error("Close another older Kairo Ride window and try again."));
  });
  return opening;
}
const keyFor = (namespace: string, id: string) => `${namespace}|${id}`;
function announce(namespace: string) {
  if (typeof BroadcastChannel !== "undefined") { const channel = new BroadcastChannel(LOCAL_CHANNEL); channel.postMessage(namespace); channel.close(); }
}
export async function metaGet<T>(key: string): Promise<T | undefined> { const db=await database(); return request(db.transaction("meta").objectStore("meta").get(key)); }
export async function metaSet(key: string, value: unknown) { const db=await database(); const tx=db.transaction("meta","readwrite"); const done=complete(tx); tx.objectStore("meta").put(value,key); await done; }
export async function deviceId() { let value=await metaGet<string>("deviceId"); if (!value) {value=crypto.randomUUID();await metaSet("deviceId",value);} return value; }
export async function loadWorkspace(namespace: string): Promise<Workspace> {
  const db=await database();
  const tx=db.transaction(["operations","blobs"]);
  const [records,blobs]=await Promise.all([
    request<StoredOperation[]>(tx.objectStore("operations").index("namespace").getAll(namespace)),
    request<StoredBlob[]>(tx.objectStore("blobs").index("namespace").getAll(namespace)),
  ]);
  const operations=records.map(r=>parseOperation(r.operation));
  return {operations,state:project(operations),pending:records.filter(r=>!r.uploaded),blobs};
}

/** One transaction for the event and optional file: quota errors cannot leave a phantom attachment. */
export async function storeOperation(namespace: string, operation: Operation, blob?: {attachmentId: string; blob: Blob}) {
  const db=await database();
  const tx=db.transaction(["operations","blobs"],"readwrite"); const done=complete(tx);
  tx.objectStore("operations").add({key:keyFor(namespace,operation.id),namespace,operation,uploaded:false} satisfies StoredOperation);
  if (blob) tx.objectStore("blobs").put({key:keyFor(namespace,blob.attachmentId),namespace,...blob} satisfies StoredBlob);
  await done; announce(namespace);
}
export async function commit(namespace: string, kind: Kind, value: Entity | null, entityId: string, blob?: Blob, parents?: string[]) {
  return commitChanges(namespace,[{kind,value,entityId,parents}],blob?{attachmentId:entityId,blob}:undefined);
}
export async function commitChanges(namespace: string, changes: {kind:Kind;value:Entity|null;entityId:string;parents?:string[]}[], blob?: {attachmentId:string;blob:Blob}) {
  const [workspace,device]=await Promise.all([loadWorkspace(namespace),deviceId()]);
  const op=makeOperation(workspace.state,device,changes.map(({kind,value,entityId})=>({kind,value,entityId})));
  changes.forEach((change,index)=>{if(change.parents)op.changes[index].parents=[...change.parents];});
  await storeOperation(namespace,op,blob);
  return op;
}

/** Imported and downloaded histories merge; an acknowledged queue never clears newer writes. */
export async function mergeOperations(namespace: string, operations: Operation[], uploaded: boolean) {
  const validated=operations.map(parseOperation);
  const db=await database();
  const tx=db.transaction("operations","readwrite"); const done=complete(tx);
  const store=tx.objectStore("operations");
  const current=await request<StoredOperation[]>(store.index("namespace").getAll(namespace));
  const map=new Map(current.map(r=>[r.operation.id,r]));
  try {
    project([...current.map(r=>r.operation),...validated]);
    for (const operation of validated) {
      const existing=map.get(operation.id);
      if (existing && canonical(existing.operation)!==canonical(operation)) throw new Error("Change ID conflict.");
      const record: StoredOperation={key:keyFor(namespace,operation.id),namespace,operation,uploaded: uploaded || existing?.uploaded || false,...(existing?.fileId?{fileId:existing.fileId}:{})};
      store.put(record); map.set(operation.id,record);
    }
  } catch (e) {tx.abort();await done.catch(()=>{});throw e;}
  await done; announce(namespace);
}
export async function patchOperation(namespace: string, operationId: string, patch: {uploaded?: boolean; fileId?: string}) {
  const db=await database();const tx=db.transaction("operations","readwrite");const done=complete(tx);const store=tx.objectStore("operations");
  const current=await request<StoredOperation|undefined>(store.get(keyFor(namespace,operationId)));
  if(current) store.put({...current,...patch});
  await done;
}
export async function patchBlob(namespace: string, attachmentId: string, patch: {session?: string; fileId?: string}) {
  const db=await database();const tx=db.transaction("blobs","readwrite");const done=complete(tx);const store=tx.objectStore("blobs");
  const current=await request<StoredBlob|undefined>(store.get(keyFor(namespace,attachmentId)));
  if(current) store.put({...current,...patch});
  await done;
}
export async function copyLocalToAccount(profile: Profile) {
  const local=await loadWorkspace("local");
  const db=await database();const tx=db.transaction(["operations","blobs"],"readwrite");const done=complete(tx);
  try{
    const [current,blobs]=await Promise.all([
      request<StoredOperation[]>(tx.objectStore("operations").index("namespace").getAll(profile.namespace)),
      request<StoredBlob[]>(tx.objectStore("blobs").index("namespace").getAll(profile.namespace)),
    ]);
    project([...current.map(r=>r.operation),...local.operations]);
    const known=new Set(current.map(r=>r.operation.id)),knownBlobs=new Set(blobs.map(b=>b.attachmentId));
    for(const operation of local.operations)if(!known.has(operation.id))tx.objectStore("operations").add({key:keyFor(profile.namespace,operation.id),namespace:profile.namespace,operation,uploaded:false} satisfies StoredOperation);
    for(const b of local.blobs)if(!knownBlobs.has(b.attachmentId))tx.objectStore("blobs").put({key:keyFor(profile.namespace,b.attachmentId),namespace:profile.namespace,attachmentId:b.attachmentId,blob:b.blob} satisfies StoredBlob);
  }catch(e){tx.abort();await done.catch(()=>{});throw e;}
  await done;
  announce(profile.namespace);
}
export async function addAttachment(namespace: string, ownerKind: "trip"|"ride", ownerId: string, file: File) {
  if(file.size>512*1024*1024) throw new Error("The per-file limit is 512 MB. Keep a larger video separately in Drive.");
  const estimate=await navigator.storage?.estimate?.();
  if(estimate?.quota && estimate?.usage && file.size > (estimate.quota-estimate.usage)*0.9) throw new Error("This device does not have enough space for a copy of this file. The original was not changed.");
  const a: Attachment={id:crypto.randomUUID(),ownerKind,ownerId,name:file.name.slice(0,160),mimeType:file.type||"application/octet-stream",size:file.size,addedAt:new Date().toISOString()};
  await commit(namespace,"attachment",a,a.id,file);
  return a;
}
export function friendlyError(error: unknown) {
  if(error instanceof DOMException && error.name === "QuotaExceededError") return "Device storage is full. This change was not saved. Export a backup and free some space.";
  if(error instanceof Error) return error.message;
  return "The action failed. Your earlier records were not changed.";
}
