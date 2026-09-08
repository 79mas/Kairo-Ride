import {migrateRideFiles} from "./archive";
import {DATA_SCHEMA_VERSION} from "./version";
import {createRecoverySnapshot,loadWorkspace,mergeOperations,metaGet,metaSet,restoreRecoverySnapshot,type Workspace} from "./storage";

const migrationKey=(namespace:string)=>`${namespace}:dataSchemaVersion`;

/** Migrations are additive immutable operations. A checkpoint is still created
 * first so an interrupted or invalid migration has a deterministic escape path. */
export async function migrateWorkspace(namespace:string):Promise<{workspace:Workspace;migrated:boolean}> {
  const previous=await metaGet<number>(migrationKey(namespace))??1;
  if(previous>DATA_SCHEMA_VERSION)throw new Error("This local database was written by a newer Kairo Ride version. Update the app before opening it.");
  if(previous===DATA_SCHEMA_VERSION)return {workspace:await loadWorkspace(namespace),migrated:false};
  const before=await loadWorkspace(namespace);
  const checkpoint=await createRecoverySnapshot(namespace,`Before data migration ${previous} → ${DATA_SCHEMA_VERSION}`,before.operations);
  try{
    const rideFiles=await migrateRideFiles(before.operations,"migration-v207");
    if(rideFiles.length)await mergeOperations(namespace,rideFiles,false);
    const workspace=await loadWorkspace(namespace);
    if(workspace.state.integrity.length)throw new Error("Migration produced incomplete record history.");
    await metaSet(migrationKey(namespace),DATA_SCHEMA_VERSION);
    return {workspace,migrated:true};
  }catch(error){
    await restoreRecoverySnapshot(checkpoint).catch(()=>{});
    throw error;
  }
}
