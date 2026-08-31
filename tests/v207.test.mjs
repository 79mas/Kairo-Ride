import assert from "node:assert/strict";
import test from "node:test";
import {tsImport} from "tsx/esm/api";
import "fake-indexeddb/auto";
const d=await tsImport("../lib/kairo/domain.ts",import.meta.url);
const a=await tsImport("../lib/kairo/archive.ts",import.meta.url);
const db=await tsImport("../lib/kairo/storage.ts",import.meta.url);
const g=await tsImport("../lib/kairo/goals.ts",import.meta.url);
const stats=await tsImport("../lib/kairo/stats.ts",import.meta.url);
const wheel={id:"v207-wheel",name:"Lynx-S",baselineKm:100,baselineDate:"2026-07-01",color:"#f16305",notes:""};
const gear={id:"v207-gear",name:"Helmet",category:"helmet",status:"active",brand:"",model:"",size:"",purchasedOn:null,notes:""};
const record={id:"v207-record",wheelId:wheel.id,at:"2026-08-10T12:00:00Z",odometerKm:200,notes:""};
const ride={id:record.id,wheelId:wheel.id,at:record.at,name:"",distanceKm:null,tripId:null,notes:""};
const goal={id:"v207-goal",name:"Summer",wheelId:null,targetKm:1000,period:"custom",startDate:"2026-08-01",endDate:"2026-08-31",createdAt:record.at};
const change=(kind,value)=>({kind,entityId:value.id,value});
function fixture(extra=[]){const operations=[d.makeOperation(d.project([]),"v207",[change("wheel",wheel),change("gear",gear),change("reading",record),change("ride",ride),...extra])];return {operations,state:d.project(operations)};}
test("v207 old histories remain byte-equivalent through parsing",()=>{
 const {operations}=fixture();assert.deepEqual(d.parseBackup(d.backup(operations)),operations);
 assert.equal(d.project(operations).wheel[0].archived,undefined);
});
test("v207 archiving referenced vehicles keeps all historic mileage and integrity",()=>{
 const f=fixture(),op=d.makeOperation(f.state,"v207",[change("wheel",{...wheel,archived:true})]),state=d.project([...f.operations,op]);
 assert.equal(state.integrity.length,0);assert.equal(stats.metricDistance(state,"all"),100);
 assert.equal(d.canRecordWithWheel(state.wheel[0]),false);assert.equal(state.ride.length,1);
 assert.doesNotThrow(()=>d.validateDelete(f.state,"wheel",wheel.id));
 assert.throws(()=>d.validateEdit(state,"reading",{...record,id:"new"}),/removed|disabled/i);
});
test("v207 gear reference checks and database restoration guard",()=>{
 const f=fixture(),state=d.project([...f.operations,d.makeOperation(f.state,"v207",[change("gear",{...gear,archived:true})])]);
 assert.throws(()=>d.validateEdit(state,"gear",{...gear,id:"cardo",usedWithGearIds:[gear.id]}),/removed/);
 assert.throws(()=>d.validateEdit(state,"gear",gear),/Restore/);
 const task={id:"task",title:"Check",category:"custom",targetKind:"gear",targetId:gear.id,dueDate:null,dueOdometerKm:null,remindDaysBefore:null,repeatKm:null,repeatMonths:null,completedAt:null,notes:""};
 assert.throws(()=>d.validateEdit(state,"maintenance",task),/removed/);
});
test("v207 archived ride plus its odometer disappear from active statistics, not history",()=>{
 const f=fixture(),op=d.makeOperation(f.state,"v207",[change("ride",{...ride,archived:true}),change("reading",{...record,archived:true})]),state=d.project([...f.operations,op]);
 assert.equal(state.ride.length,1);assert.equal(state.reading.length,1);assert.equal(d.activeState(state).ride.length,0);
 assert.equal(stats.rideEntries(state).length,0);assert.equal(stats.metricDistance(state,"all"),0);
});
for(const mode of ["remove","false"])test("v207 deletion marker "+mode+" produces idempotent causal restoration",()=>{
 const f=fixture(),deleted=d.makeOperation(f.state,"v207",[change("wheel",{...wheel,archived:true})]),history=[...f.operations,deleted];
 const snapshot=d.backup(history);if(mode==="remove")snapshot.deletions=[];else snapshot.deletions[0].deleted=false;
 const restored=a.databaseRestorations(snapshot);assert.equal(restored.length,1);
 const state=d.project([...history,...restored,...a.databaseRestorations(snapshot)]);
 assert.equal(state.conflicts.length,0);assert.equal(state.wheel[0].archived,false);assert.equal(stats.metricDistance(state,"all"),100);
 assert.deepEqual(a.databaseRestorations(d.backup([...history,...restored])),[]);
});
test("v207 unedited and legacy snapshots never restore anything",()=>{
 const f=fixture(),op=d.makeOperation(f.state,"v207",[change("wheel",{...wheel,archived:true})]),snapshot=d.backup([...f.operations,op]);
 assert.deepEqual(a.databaseRestorations(snapshot),[]);delete snapshot.deletions;assert.deepEqual(a.databaseRestorations(snapshot),[]);
});
test("v207 malformed deletion controls fail before producing changes",()=>{
 const f=fixture();assert.throws(()=>a.databaseRestorations({...d.backup(f.operations),deletions:[{kind:"wheel",entityId:wheel.id,deleted:"no"}]}),/Invalid/);
});
test("v207 restoration cannot silently replace a concurrent entity edit",()=>{
 const f=fixture(),op=d.makeOperation(f.state,"delete",[change("wheel",{...wheel,archived:true})]),history=[...f.operations,op],snapshot=d.backup(history);snapshot.deletions=[];
 const other=d.makeOperation(d.project(history),"other",[change("wheel",{...wheel,archived:true,notes:"Concurrent note"})]);
 const state=d.project([...history,other,...a.databaseRestorations(snapshot)]);assert.equal(state.conflicts.length,1);
});
test("v207 trip file migration preserves IDs, Drive originals and converges across devices",async()=>{
 const file={id:"file207",ownerKind:"ride",ownerId:ride.id,name:"route.gpx",mimeType:"application/gpx+xml",size:5,addedAt:record.at,driveId:"existing-drive-original"};
 const f=fixture([change("attachment",file)]),one=await a.migrateRideFiles(f.operations,"one"),two=await a.migrateRideFiles(f.operations,"two");
 assert.deepEqual(one,two);const state=d.project([...f.operations,...one,...two]);
 assert.equal(state.conflicts.length,0);assert.equal(state.trip.length,1);assert.equal(state.attachment[0].id,file.id);
 assert.equal(state.attachment[0].driveId,file.driveId);assert.equal(state.attachment[0].ownerKind,"trip");
 assert.equal(state.ride[0].tripId,state.trip[0].id);assert.equal(stats.tripRideStats(state.trip[0],state).distanceKm,100);
 assert.deepEqual(await a.migrateRideFiles([...f.operations,...one],"three"),[]);
});
test("v207 custom goal window counts only matching records and filters vehicle",()=>{
 const next={...record,id:"later",at:"2026-09-01T12:00:00Z",odometerKm:500};
 const f=fixture([change("reading",next)]),now=new Date("2026-09-02T12:00:00Z");
 assert.equal(g.forecastGoal(f.state,goal,now).currentKm,100);
 assert.equal(g.forecastGoal(f.state,{...goal,period:"all"},now).currentKm,400);
 assert.equal(g.goalWindow({...goal,period:"month"},now).start,"2026-09-01");
 assert.equal(g.goalWindow({...goal,period:"year"},now).end,"2026-12-31");
});
test("v207 date windows and goals validate and survive serialization",()=>{
 const f=fixture();assert.doesNotThrow(()=>d.validateEdit(f.state,"goal",goal));
 assert.throws(()=>d.validateEdit(f.state,"goal",{...goal,endDate:"2026-07-01"}),/valid/);
 assert.throws(()=>d.validateEdit(f.state,"goal",{...goal,startDate:undefined}),/valid/);
 const op=d.makeOperation(f.state,"v207",[change("goal",goal)]);
 assert.deepEqual(d.project(d.parseBackup(d.backup([...f.operations,op]))).goal,[goal]);
});
test("v207 atomic storage rejects a stale form linking new gear to archived gear",async()=>{
 const ns="v207-"+crypto.randomUUID(),f=fixture();await db.mergeOperations(ns,f.operations,false);
 await db.commit(ns,"gear",{...gear,archived:true},gear.id);
 await assert.rejects(()=>db.commit(ns,"gear",{...gear,id:"new-cardo",usedWithGearIds:[gear.id]},"new-cardo"),/removed/);
 assert.equal((await db.loadWorkspace(ns)).state.gear.length,1);
});
test("v207 restoring either paired marker restores both ride and odometer",()=>{
 const f=fixture(),deleted=d.makeOperation(f.state,"v207",[change("ride",{...ride,archived:true}),change("reading",{...record,archived:true})]);
 const snapshot=d.backup([...f.operations,deleted]);snapshot.deletions=snapshot.deletions.filter(row=>row.kind!=="ride");
 const restored=a.databaseRestorations(snapshot),state=d.project([...f.operations,deleted,...restored]);
 assert.equal(restored.length,2);assert.equal(state.conflicts.length,0);assert.equal(stats.metricDistance(state,"all"),100);
 assert.equal(state.ride[0].archived,false);assert.equal(state.reading[0].archived,false);
});
test("v207 multiple entities archived in one operation have distinct restoration IDs",()=>{
 const other={...wheel,id:"second"},f=fixture([change("wheel",other)]);
 const deleted=d.makeOperation(f.state,"v207",[change("wheel",{...wheel,archived:true}),change("wheel",{...other,archived:true})]);
 const snapshot=d.backup([...f.operations,deleted]);snapshot.deletions=[];
 const restored=a.databaseRestorations(snapshot);assert.equal(new Set(restored.map(op=>op.id)).size,2);
 assert.equal(d.project([...f.operations,deleted,...restored]).wheel.filter(w=>w.archived).length,0);
});
test("v207 an open vehicle editor cannot restore a vehicle archived in another tab",async()=>{
 const ns="v207-stale-"+crypto.randomUUID(),f=fixture();await db.mergeOperations(ns,f.operations,false);
 await db.commit(ns,"wheel",{...wheel,archived:true},wheel.id);
 await assert.rejects(()=>db.commit(ns,"wheel",{...wheel,notes:"Stale edit"},wheel.id),/Restore/);
 assert.equal((await db.loadWorkspace(ns)).state.wheel[0].archived,true);
});
