import {KINDS, canonical, entityKey, makeOperation, parseBackup, project, type Entity, type Kind, type Operation} from "./domain";

/** Editable deletion markers are compared with their own snapshot, never a
 * newer local view. Compensating causal events survive multi-device merges. */
function restorationId(key:string){
  // Stable non-security identifier; canonical operation collision checks still apply.
  let hash=BigInt("0x6c62272e07bb014262b821756295c58d");
  for(const byte of new TextEncoder().encode(key))hash=BigInt.asUintN(128,(hash^BigInt(byte))*BigInt("0x1000000000000000000013b"));
  return "restore-"+hash.toString(16).padStart(32,"0");
}
export function databaseRestorations(input: unknown): Operation[] {
  const data = input as {deletions?: {kind:Kind;entityId:string;deleted:boolean}[]};
  if (!Array.isArray(data?.deletions)) return [];
  const operations = parseBackup(input), state = project(operations);
  if (data.deletions.some(row=>!row || !KINDS.includes(row.kind) || typeof row.entityId!=="string" || typeof row.deleted!=="boolean"))
    throw new Error("Invalid database deletion markers.");
  const markers = new Map(data.deletions.map(row=>[entityKey(row.kind,row.entityId),row.deleted]));
  if(markers.size!==data.deletions.length) throw new Error("Duplicate database deletion markers.");
  const pairedRestores=new Set<string>();
  for(const kind of ["ride","reading"] as const)for(const entity of state[kind])if(entity.archived&&markers.get(entityKey(kind,entity.id))!==true)for(const head of state.heads.get(entityKey(kind,entity.id))??[])pairedRestores.add(head.operationId);
  const result:Operation[]=[];
  for (const kind of KINDS) for (const entity of state[kind]) {
    if (!entity.archived) continue;
    const paired=(kind==="ride"||kind==="reading")&&(state.heads.get(entityKey(kind,entity.id))??[]).some(head=>pairedRestores.has(head.operationId));
    if(markers.get(entityKey(kind,entity.id))===true&&!paired)continue;
    const heads=state.heads.get(entityKey(kind,entity.id))!;
    if (heads.length!==1) throw new Error("Resolve conflicting versions before restoring this record.");
    const head=heads[0];
    result.push({version:1,id:restorationId(canonical([kind,entity.id,head.operationId])),
      deviceId:"database-editor",createdAt:head.createdAt,changes:[{
        kind,entityId:entity.id,parents:[head.operationId],value:{...entity,archived:false} as Entity,
      }]});
  }
  return result;
}

export async function migrateRideFiles(operations:Operation[], device:string):Promise<Operation[]> {
  const state=project(operations), result:Operation[]=[];
  for(const ride of state.ride) {
    if(ride.archived) continue;
    const files=state.attachment.filter(a=>!a.archived&&a.ownerKind==="ride"&&a.ownerId===ride.id);
    if(!files.length) continue;
    const hash=new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(ride.id)));
    const id="files-trip-"+[...hash].map(b=>b.toString(16).padStart(2,"0")).join("");
    const linked=state.trip.find(t=>t.id===ride.tripId&&!t.archived);
    const trip=linked??state.trip.find(t=>t.id===id)??{id,name:ride.name||"Imported ride files",startDate:ride.localDate??ride.at.slice(0,10),endDate:ride.localDate??ride.at.slice(0,10),notes:""};
    const changes:{kind:Kind;entityId:string;value:Entity}[]=[];
    if(!state.trip.some(t=>t.id===trip.id))changes.push({kind:"trip",entityId:trip.id,value:trip});
    if(ride.tripId!==trip.id)changes.push({kind:"ride",entityId:ride.id,value:{...ride,tripId:trip.id}});
    for(const file of files)changes.push({kind:"attachment",entityId:file.id,value:{...file,ownerKind:"trip",ownerId:trip.id}});
    const operation=makeOperation(state,device,changes);
    // Equivalent migrations on two devices intentionally converge by content.
    operation.id="migrate-files-"+[...new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(canonical(changes))))].map(b=>b.toString(16).padStart(2,"0")).join("");
    operation.createdAt=ride.at;operation.deviceId="migration-v207";
    result.push(operation);
  }
  return result;
}
