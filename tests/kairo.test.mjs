import assert from "node:assert/strict";
import test from "node:test";
import {tsImport} from "tsx/esm/api";
import "fake-indexeddb/auto";
import {DOMParser} from "@xmldom/xmldom";
globalThis.DOMParser=DOMParser;
const d=await tsImport("../lib/kairo/domain.ts",import.meta.url);
const paths=await tsImport("../lib/kairo/paths.ts",import.meta.url);
const x=await tsImport("../lib/kairo/excel.ts",import.meta.url);
const stats=await tsImport("../lib/kairo/stats.ts",import.meta.url);
const db=await tsImport("../lib/kairo/storage.ts",import.meta.url);
const {DriveClient}=await tsImport("../lib/kairo/drive.ts",import.meta.url);
const wheel={id:"wheel-one",name:"Test wheel",baselineKm:100,baselineDate:"2026-01-01",color:"#127c67",notes:""};
const reading=(id,at,odo)=>({id,wheelId:wheel.id,at:`2026-01-${at}T12:00:00.000Z`,odometerKm:odo,notes:""});
const trip={id:"trip-one",name:"Three days",startDate:"2026-03-28",endDate:"2026-03-30",notes:""};
const gear={id:"gear-one",name:"My Cardo",category:"intercom",status:"active",brand:"Cardo",model:"Packtalk",size:"",purchasedOn:null,notes:"USB-C cable"};
const ride=(id,tripId,distanceKm)=>({id,name:id,wheelId:wheel.id,tripId,distanceKm,at:"2026-03-29T12:00:00.000Z",notes:""});
const change=(kind,value)=>({kind,value,entityId:value.id});
const first=()=>d.makeOperation(d.project([]),"device-a",[change("wheel",wheel)]);

test("GitHub project paths accept root and named repositories but reject URLs and traversal",()=>{
  assert.equal(paths.normalizeBasePath("/"),"");assert.equal(paths.normalizeBasePath("/Kairo-Ride/"),"/Kairo-Ride");
  assert.equal(paths.normalizeBasePath("/group/Project.v2"),"/group/Project.v2");
  for(const invalid of ["https://host.invalid","//host","/../other","/./app","/a?b","/a#b","/a/%2e%2e"]){assert.throws(()=>paths.normalizeBasePath(invalid));}
});
test("equipment saves independently of a wheel, validates categories and survives retirement/deletion history",()=>{
  d.validateEdit(d.project([]),"gear",gear);
  const created=d.makeOperation(d.project([]),"device-a",[change("gear",gear)]),initial=d.project([created]);
  const retired=d.makeOperation(initial,"device-a",[change("gear",{...gear,status:"retired",purchasedOn:"2026-02-28"})]);
  const state=d.project([created,retired]);assert.equal(state.gear[0].status,"retired");assert.equal(state.gear[0].id,gear.id);
  const deleted=d.makeOperation(state,"device-a",[{kind:"gear",entityId:gear.id,value:null}]);
  assert.equal(d.project([created,retired,deleted]).gear.length,0);assert.equal(d.parseBackup(d.backup([created,retired,deleted])).length,3);
  assert.throws(()=>d.gearSchema.parse({...gear,category:"unknown"}));assert.throws(()=>d.gearSchema.parse({...gear,purchasedOn:"2026-02-30"}));
});
test("equipment metadata and concurrent revisions round-trip through actual XLSX bytes",async()=>{
  const a=d.makeOperation(d.project([]),"a",[change("gear",gear)]),state=d.project([a]);
  const b=d.makeOperation(state,"b",[change("gear",{...gear,size:"L",notes:"=SUM(1,2)"})]);
  const c=d.makeOperation(state,"c",[change("gear",{...gear,name:"Cardo travel kit"})]);
  const book=await x.readXlsx(x.writeXlsx(x.exportWorkbook([a,b,c])));
  assert.equal(book.Gear[1][2],"Intercom / Cardo");
  const imported=await x.workbookImport(book);assert.equal(imported.counts.gear,1);
  assert.deepEqual(imported.operations,[a,b,c]);assert.equal(d.project(imported.operations).conflicts[0].kind,"gear");
});
test("gear relationships and maintenance survive sync history and Excel recovery",async()=>{
  const helmet={...gear,id:"gear-helmet",name:"Touring helmet",category:"helmet"};
  const intercom={...gear,usedWithGearIds:[helmet.id]};
  const maintenance={id:"maintenance-one",title:"Insurance renewal",category:"insurance",targetKind:"wheel",targetId:wheel.id,dueDate:"2026-08-20",dueOdometerKm:null,remindDaysBefore:14,repeatKm:null,repeatMonths:12,completedAt:null,notes:"Policy PDF in Drive"};
  const empty=d.project([]),operation=d.makeOperation(empty,"device-a",[change("wheel",wheel),change("gear",helmet),change("gear",intercom),change("maintenance",maintenance)]),state=d.project([operation]);
  d.validateEdit(state,"gear",intercom);d.validateEdit(state,"maintenance",maintenance);
  assert.throws(()=>d.validateEdit(state,"gear",{...intercom,usedWithGearIds:[intercom.id]}),/cannot be used with itself/);
  assert.equal(stats.maintenanceStatus(maintenance,state,new Date("2026-08-10T12:00:00Z")),"due");
  const workbook=await x.readXlsx(x.writeXlsx(x.exportWorkbook([operation]))),imported=await x.workbookImport(workbook,"UTC"),restored=d.project(imported.operations);
  assert.deepEqual(restored.gear.find(item=>item.id===intercom.id).usedWithGearIds,[helmet.id]);
  assert.equal(restored.maintenance[0].category,"insurance");assert.equal(workbook.Maintenance[1][1],"Insurance renewal");
});
test("dashboard distance statistics use authoritative odometer intervals",()=>{
  const base=d.project([]),operation=d.makeOperation(base,"device-a",[change("wheel",wheel),change("reading",reading("day-one","01",110)),change("reading",reading("day-two","02",130))]),state=d.project([operation]);
  assert.equal(stats.metricDistance(state,"all"),30);
  const events=stats.distanceEvents(state);assert.deepEqual(events.map(event=>event.distance),[10,20]);
  assert.equal(stats.periodData(state,"week",0,"en-US",new Date("2026-01-02T12:00:00Z")).total,30);
});
test("the unified Ride workflow pairs odometer data once and keeps legacy records visible",()=>{
  const pairedReading={...reading("paired","02",130),notes:"paired note"},pairedRide={...ride("paired",null,999),at:pairedReading.at,name:"Paired ride"};
  const legacyReading={...reading("legacy-reading","03",150),notes:"legacy note"},rideOnly={...ride("ride-only",null,7),at:"2026-01-04T12:00:00.000Z",localDate:"2026-01-04",timeZone:"UTC"};
  const operation=d.makeOperation(d.project([]),"device-a",[change("wheel",wheel),change("reading",pairedReading),change("ride",pairedRide),change("reading",legacyReading),change("ride",rideOnly)]),state=d.project([operation]);
  const entries=stats.rideEntries(state);assert.equal(entries.length,3);
  assert.equal(entries.find(entry=>entry.ride?.id==="paired").distanceKm,30);
  assert.equal(entries.find(entry=>entry.reading?.id==="legacy-reading").notes,"legacy note");
  assert.deepEqual(stats.distanceEvents(state).map(event=>event.distance),[30,20,7]);
});
test("trip totals use calculated odometer distance from the unified Ride workflow",()=>{
  const pairedReading={...reading("trip-reading","02",135),at:"2026-03-29T12:00:00.000Z"},pairedRide={...ride("trip-reading",trip.id,null),at:pairedReading.at};
  const operation=d.makeOperation(d.project([]),"device-a",[change("wheel",wheel),change("trip",trip),change("reading",pairedReading),change("ride",pairedRide)]),state=d.project([operation]);
  const summary=stats.tripRideStats(trip,state);assert.equal(summary.distanceKm,35);assert.equal(summary.unknownDistances,0);assert.equal(summary.rides.length,1);
});
test("long-term hero averages use every vehicle and the whole history",()=>{
  const operation=d.makeOperation(d.project([]),"device-a",[change("wheel",wheel),change("reading",reading("average","08",170))]),state=d.project([operation]),now=new Date("2026-01-08T12:00:00Z");
  assert.equal(stats.averageDistance(state,"day",now),8.75);
  assert.equal(stats.averageDistance(state,"week",now),61.25);
  assert.equal(stats.averageDistance(state,"month",now),266.323);
});
test("ride, odometer and newly created trip commit as one local history operation",async()=>{
  const ns=`unified-${crypto.randomUUID()}`,newTrip={...trip,id:"atomic-trip"},newRide={...ride("atomic-ride",newTrip.id,23),localDate:"2026-03-29",timeZone:"UTC"},newReading={id:newRide.id,wheelId:wheel.id,at:newRide.at,odometerKm:123,notes:""};
  await db.commitChanges(ns,[{kind:"wheel",value:wheel,entityId:wheel.id},{kind:"trip",value:newTrip,entityId:newTrip.id},{kind:"ride",value:newRide,entityId:newRide.id},{kind:"reading",value:newReading,entityId:newReading.id}]);
  const workspace=await db.loadWorkspace(ns);assert.equal(workspace.operations.length,1);assert.equal(workspace.state.trip.length,1);assert.equal(workspace.state.ride.length,1);assert.equal(workspace.state.reading.length,1);
});
test("empty recovery history cannot silently import an equipment-only report as no data",async()=>{
  const op=d.makeOperation(d.project([]),"a",[change("gear",gear)]),book=x.exportWorkbook([op]);book.History=[book.History[0]];
  await assert.rejects(()=>x.workbookImport(book),/missing recovery history/);
  assert.equal(d.project(d.parseBackup(d.backup([first()]))).gear.length,0);
});

test("historical insert recomputes every interval without inflated totals",()=>{
  const list=[reading("r3","03",160),reading("r1","01",110),reading("r2","02",130)];
  const stats=d.wheelStats(wheel,list);
  assert.deepEqual(stats.intervals.map(i=>i.distance),[10,20,30]);assert.equal(stats.trackedKm,60);
});
test("moving an odometer date recomputes old and new successors",()=>{
  const a=reading("a","01",110),b=reading("b","02",130),c=reading("c","03",160);
  const moved={...b,at:"2026-01-04T12:00:00.000Z",odometerKm:170};
  assert.deepEqual(d.wheelStats(wheel,[a,moved,c]).intervals.map(i=>i.distance),[10,50,10]);
});
test("zero values are valid and odometer decreases are never silently summed",()=>{
  const zero={...wheel,baselineKm:0};d.wheelSchema.parse(zero);
  d.readingSchema.parse({...reading("r","01",0)});
  const stats=d.wheelStats(wheel,[reading("r","02",0)]);assert.equal(stats.trackedKm,null);assert.equal(stats.intervals[0].distance,null);
});
test("duplicate instants are marked for review without inventing a ride",()=>{
  const stats=d.wheelStats(wheel,[{...reading("a","01",110),sourceOrder:2},{...reading("b","01",130),sourceOrder:3}]);
  assert.equal(stats.warnings,2);assert.equal(stats.trackedKm,30);
});
test("renaming a wheel preserves its stable links and color",()=>{
  const a=first(),s=d.project([a]);const b=d.makeOperation(s,"device-a",[change("wheel",{...wheel,name:"New name"}),change("reading",reading("r","02",130))]);
  const merged=d.project([a,b]);assert.equal(merged.reading[0].wheelId,merged.wheel[0].id);assert.equal(merged.wheel[0].color,"#127c67");
});
test("concurrent edits stay as two heads and merge independently of download order",()=>{
  const a=first(),state=d.project([a]);
  const b=d.makeOperation(state,"device-b",[change("wheel",{...wheel,name:"B"})]);
  const c=d.makeOperation(state,"device-c",[change("wheel",{...wheel,name:"C"})]);
  const left=d.project([a,b,c]),right=d.project([c,a,b]);
  assert.equal(left.conflicts.length,1);assert.equal(left.conflicts[0].revisions.length,2);assert.deepEqual(left.wheel,right.wheel);
  const resolution=d.makeOperation(left,"device-a",[change("wheel",{...wheel,name:"Chosen"})]);
  const resolved=d.project([c,a,resolution,b]);assert.equal(resolved.conflicts.length,0);assert.equal(resolved.wheel[0].name,"Chosen");
});
test("a concurrent deletion and edit are both preserved",()=>{
  const a=first(),s=d.project([a]);const b=d.makeOperation(s,"device-b",[{kind:"wheel",entityId:wheel.id,value:null}]);const c=d.makeOperation(s,"device-c",[change("wheel",{...wheel,notes:"retained"})]);
  const state=d.project([a,b,c]);assert.equal(state.conflicts.length,1);assert.ok(state.conflicts[0].revisions.some(r=>r.value===null));
});
test("colliding operation identifiers stop a merge",()=>{
  const a=first(),b=structuredClone(a);b.changes[0].value.name="Different";
  assert.throws(()=>d.project([a,b]),/same ID/);
});
test("missing parents are not silently treated as complete history",()=>{
  const a=first(),b=d.makeOperation(d.project([a]),"device-b",[change("wheel",{...wheel,name:"B"})]);
  assert.equal(d.project([b]).integrity.length,1);
});
test("a disconnected cycle cannot hide next to an apparently valid revision",()=>{
  const a=first(),b=structuredClone(a),c=first();b.id=crypto.randomUUID();a.changes[0].parents=[b.id];b.changes[0].parents=[a.id];
  assert.throws(()=>d.project([a,b,c]),/cycle/);
});
test("identical concurrent values do not require a pointless conflict decision",()=>{
  const a=first(),s=d.project([a]);const b=d.makeOperation(s,"b",[change("wheel",{...wheel,name:"same"})]);const c=d.makeOperation(s,"c",[change("wheel",{...wheel,name:"same"})]);
  const result=d.project([a,b,c]);assert.equal(result.conflicts.length,0);assert.equal(result.heads.get(d.entityKey("wheel",wheel.id)).length,2);
});
test("a valid local-midnight reading is not rejected by a UTC calendar comparison",()=>{
  const state=d.project([first()]);d.validateEdit(state,"reading",{...reading("midnight","01",105),at:"2025-12-31T22:15:00.000Z"});
});
test("journeys count calendar days across DST and do not count unknown distances as facts",()=>{
  const rides=[ride("a",trip.id,12),ride("b",trip.id,null),ride("outside",null,25)];
  const files=[{id:"f",ownerKind:"ride",ownerId:"a"},{id:"g",ownerKind:"trip",ownerId:trip.id},{id:"h",ownerKind:"ride",ownerId:"outside"}];
  const s=d.tripStats(trip,rides,files);assert.equal(s.days,3);assert.equal(s.distanceKm,12);assert.equal(s.unknownDistances,1);assert.equal(s.attachments.length,2);
});
test("local validation rejects an impossible odometer and protects referenced wheels",()=>{
  const s=d.project([d.makeOperation(d.project([]),"a",[change("wheel",wheel),change("reading",reading("r","02",150))])]);
  assert.throws(()=>d.validateEdit(s,"reading",reading("new","01",200)),/odometer sequence/);
  assert.throws(()=>d.validateDelete(s,"wheel",wheel.id),/linked records/);
});
test("unsupported schemas and invalid dates reject before import",()=>{
  assert.throws(()=>d.parseBackup({format:"kairo-ride",schemaVersion:2,operations:[]}));
  assert.throws(()=>d.tripSchema.parse({...trip,endDate:"2026-02-30"}));
  assert.throws(()=>d.tripSchema.parse({...trip,endDate:"2026-03-01"}));
});
test("text beginning with Excel formula characters is exported as inert text",async()=>{
  const book={Test:[["Name","Value"],["=HYPERLINK(\"https://example.invalid\")",0],["<script>&'\"",2.3]]};
  const file=x.writeXlsx(book),round=await x.readXlsx(file);
  assert.deepEqual(round.Test,book.Test);
  const xml=await x.unzipXml(file);assert.ok(!xml["xl/worksheets/sheet1.xml"].includes("<f>"));assert.ok(xml["xl/worksheets/sheet1.xml"].includes("inlineStr"));
});
test("Excel dates use selected time zone, including DST",()=>{
  assert.equal(x.zonedInstant("2026-08-28T12:30:00","Europe/Vilnius"),"2026-08-28T09:30:00.000Z");
  assert.equal(x.zonedInstant("2026-01-28T12:30:00","Europe/Vilnius"),"2026-01-28T10:30:00.000Z");
  assert.throws(()=>x.zonedInstant("2026-03-29T03:30:00","Europe/Vilnius"),/does not exist/);
});
test("legacy workbook imports baseline and inputs, ignores broken calculated columns, and is idempotent",async()=>{
  const book={Models:[["Model","Start km","Date Added",""],["Wheel A",100,"2026-01-01","#112233"]],Rides:[["ID","Date","Model","Input ODM","Km","Total km","Remarks"],[11,"2026-01-02 12:00","Wheel A",120,999,999,"note"],[12,"2026-01-03 12:00","Wheel A",130,999,999,""]]};
  const a=await x.workbookImport(book,"Europe/Vilnius"),b=await x.workbookImport(book,"Europe/Vilnius");
  assert.equal(a.operations[0].id,b.operations[0].id);
  const s=d.project([...a.operations,...b.operations]);assert.equal(s.reading.length,2);assert.equal(s.ride.length,0);assert.equal(s.wheel[0].color,"#112233");assert.equal(d.wheelStats(s.wheel[0],s.reading).trackedKm,30);
});
test("ambiguous old mixed-wheel sheet is explicitly rejected, not guessed",async()=>{await assert.rejects(()=>x.workbookImport({"EUC Data":[["Date","ODM"]]},"Europe/Vilnius"),/reviewed separately/);});
test("Excel history roundtrip supports operations larger than an Excel cell",async()=>{
  const op=d.makeOperation(d.project([]),"device-a",[change("wheel",wheel),...Array.from({length:300},(_,i)=>change("reading",{...reading(`r${i}`,"02",101+i),notes:"x".repeat(100)}))]);
  const book=x.exportWorkbook([op]);assert.ok(book.History.length>2);assert.ok(book.History.slice(1).every(row=>row[2].length<=30000));
  const parsed=await x.workbookImport(await x.readXlsx(x.writeXlsx(book)),"UTC");assert.deepEqual(parsed.operations,[op]);
});
test("Excel history chunking never splits an emoji surrogate pair",async()=>{
  const op=d.makeOperation(d.project([]),"device-a",[change("wheel",{...wheel,notes:"😀".repeat(9900)}),change("trip",{...trip,notes:"🚴".repeat(9900)})]);
  const result=await x.workbookImport(await x.readXlsx(x.writeXlsx(x.exportWorkbook([op]))),"UTC");assert.deepEqual(result.operations,[op]);
});
test("invalid ZIP contents fail closed",async()=>{await assert.rejects(()=>x.unzipXml(new Uint8Array([1,2,3])));const zip=x.writeXlsx({a:[["x"]]});zip[40]^=1;await assert.rejects(()=>x.readXlsx(zip));});
test("Excel reader accepts namespace-prefixed OOXML from standards-compliant writers",async()=>{
  const file=x.zipStore({
    "xl/workbook.xml":`<?xml version="1.0"?><x:workbook xmlns:x="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><x:sheets><x:sheet name="Rides" sheetId="1" r:id="rId1"/></x:sheets></x:workbook>`,
    "xl/_rels/workbook.xml.rels":`<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="/xl/worksheets/sheet1.xml"/></Relationships>`,
    "xl/worksheets/sheet1.xml":`<?xml version="1.0"?><x:worksheet xmlns:x="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><x:sheetData><x:row r="1"><x:c r="A1" t="inlineStr"><x:is><x:t>ID</x:t></x:is></x:c></x:row></x:sheetData></x:worksheet>`,
  });
  assert.deepEqual((await x.readXlsx(file)).Rides,[["ID"]]);
});

test("account namespaces never share events or pending queues",async()=>{
  const nsA=`test-a-${crypto.randomUUID()}`,nsB=`test-b-${crypto.randomUUID()}`;await db.storeOperation(nsA,first());
  assert.equal((await db.loadWorkspace(nsA)).pending.length,1);assert.equal((await db.loadWorkspace(nsB)).operations.length,0);
});
test("acknowledging a captured event leaves a newly saved event pending",async()=>{
  const ns=`queue-${crypto.randomUUID()}`,a=first();await db.storeOperation(ns,a);const captured=(await db.loadWorkspace(ns)).pending;
  const b=d.makeOperation(d.project([a]),"device-a",[change("wheel",{...wheel,notes:"new edit during sync"})]);await db.storeOperation(ns,b);
  await db.patchOperation(ns,captured[0].operation.id,{uploaded:true});const current=await db.loadWorkspace(ns);assert.deepEqual(current.pending.map(r=>r.operation.id),[b.id]);
});
test("uncommitted form edits do not mutate saved state",async()=>{
  const ns=`cancel-${crypto.randomUUID()}`;await db.storeOperation(ns,first());const draft=structuredClone((await db.loadWorkspace(ns)).state.wheel[0]);draft.name="unsaved";
  assert.equal((await db.loadWorkspace(ns)).state.wheel[0].name,wheel.name);
});
test("stale form parents create a conflict instead of overwriting a newer edit",async()=>{
  const ns=`stale-${crypto.randomUUID()}`,a=first();await db.storeOperation(ns,a);
  await db.commit(ns,"wheel",{...wheel,name:"remote edit"},wheel.id,undefined,[a.id]);
  await db.commit(ns,"wheel",{...wheel,name:"stale form"},wheel.id,undefined,[a.id]);
  assert.equal((await db.loadWorkspace(ns)).state.conflicts.length,1);
});
test("a duplicate operation aborts its attached blob transaction",async()=>{
  const ns=`atomic-${crypto.randomUUID()}`,a=first();await db.storeOperation(ns,a);
  await assert.rejects(()=>db.storeOperation(ns,a,{attachmentId:"file1",blob:new Blob(["original"])}));
  assert.equal((await db.loadWorkspace(ns)).blobs.length,0);
});
test("import merges without clearing existing records or queue",async()=>{
  const ns=`import-${crypto.randomUUID()}`,a=first();await db.storeOperation(ns,a);const b=d.makeOperation(d.project([a]),"device-b",[change("trip",trip)]);
  await db.mergeOperations(ns,[a,b],false);await db.mergeOperations(ns,[a,b],false);const result=await db.loadWorkspace(ns);assert.equal(result.operations.length,2);assert.equal(result.pending.length,2);
});
test("a merge collision rolls back the whole import",async()=>{
  const ns=`rollback-${crypto.randomUUID()}`,a=first();await db.storeOperation(ns,a);const b=structuredClone(a);b.changes[0].value.name="collision";
  const c=d.makeOperation(d.project([a]),"b",[change("trip",trip)]);
  await assert.rejects(()=>db.mergeOperations(ns,[c,b],false));assert.equal((await db.loadWorkspace(ns)).state.trip.length,0);
});
test("expired access tokens cannot issue requests",async()=>{let called=false;const client=new DriveClient("test-token",Date.now()-1000,async()=>{called=true;return Response.json({});});await assert.rejects(()=>client.about(),/Refresh Google access/);assert.equal(called,false);});
test("default Drive fetch keeps the browser global receiver",async()=>{
  const original=globalThis.fetch;let receiver;
  globalThis.fetch=function(){assert.equal(this,globalThis);receiver=true;return Promise.resolve(Response.json({user:{permissionId:"123456789012",emailAddress:"test@example.invalid"}}));};
  try{const client=new DriveClient("test-token",Date.now()+3600000);assert.equal((await client.about()).email,"test@example.invalid");assert.equal(receiver,true);}
  finally{globalThis.fetch=original;}
});
test("disconnect aborts in-flight requests and prevents future uploads",async()=>{
  let signal;const client=new DriveClient("test-token",Date.now()+3600000,async(_url,options)=>{signal=options.signal;return new Promise((_,reject)=>signal.addEventListener("abort",()=>reject(new DOMException("Aborted","AbortError"))));});
  const pending=client.about();client.disconnect();await assert.rejects(()=>pending);assert.equal(signal.aborted,true);await assert.rejects(()=>client.about());
});
test("Drive pagination visits every page and carries only an in-memory bearer token",async()=>{
  let count=0;const client=new DriveClient("test-token",Date.now()+3600000,async(url,options)=>{count++;assert.equal(options.headers.Authorization,"Bearer test-token");const u=new URL(url);return Response.json({files:[{id:`file00000${count}`,name:"part"}],...(u.searchParams.has("pageToken")?{}:{nextPageToken:"page-2"})});});
  assert.equal((await client.list("mimeType = 'application/json'")).length,2);assert.equal(count,2);
});
test("wrong Google account stops sync before a Drive folder or event is written",async()=>{
  let calls=0;const client=new DriveClient("test-token",Date.now()+3600000,async()=>{calls++;return Response.json({user:{permissionId:"123456789012",emailAddress:"test@example.invalid"}});});
  await assert.rejects(()=>client.sync("google:different",()=>{}),/account changed/);assert.equal(calls,1);
});
test("unsafe resumable session URLs never receive a bearer token",async()=>{
  const ns=`upload-${crypto.randomUUID()}`,attachment={id:"attachment-1",ownerKind:"trip",ownerId:trip.id,name:"log.csv",mimeType:"text/csv",size:3,addedAt:new Date().toISOString()};let calls=0;
  const client=new DriveClient("test-token",Date.now()+3600000,async()=>{calls++;throw new Error("must not fetch");});
  await assert.rejects(()=>client.uploadAttachment(ns,attachment,{key:"k",namespace:ns,attachmentId:attachment.id,blob:new Blob(["abc"]),fileId:"file0000001",session:"https://attacker.invalid/upload"},"parent0001",()=>{}),/Invalid Google upload/);assert.equal(calls,0);
});
test("resumable upload continues at the server-confirmed offset",async()=>{
  const ns=`resume-${crypto.randomUUID()}`,size=8*1024*1024+7,blob=new Blob([new Uint8Array(size)]),a={id:"attached-resume",ownerKind:"trip",ownerId:trip.id,name:"video.mp4",mimeType:"video/mp4",size,addedAt:new Date().toISOString()};
  await db.storeOperation(ns,d.makeOperation(d.project([]),"device-a",[change("attachment",a)]),{attachmentId:a.id,blob});
  const ranges=[];let requests=0;
  const client=new DriveClient("test-token",Date.now()+3600000,async(_url,options)=>{
    requests++;ranges.push(new Headers(options.headers).get("Content-Range"));
    return requests===1?new Response(null,{status:308,headers:{Range:`bytes=0-${8*1024*1024-1}`}}):Response.json({id:"file-resume-001"});
  });
  const id=await client.uploadAttachment(ns,a,{key:"k",namespace:ns,attachmentId:a.id,blob,fileId:"file-resume-001",session:"https://www.googleapis.com/upload/drive/v3/files?upload_id=test"},"parent00001",()=>{});
  assert.equal(id,"file-resume-001");assert.deepEqual(ranges,[`bytes */${size}`,`bytes ${8*1024*1024}-${size-1}/${size}`]);
});
test("a lost event-upload acknowledgement retries with the reserved file ID",async()=>{
  const ns=`retry-${crypto.randomUUID()}`,op=first();await db.storeOperation(ns,op);let created=false;let attempts=0;
  const client=new DriveClient("test-token",Date.now()+3600000,async(url,options)=>{
    if(url.includes("generateIds"))return Response.json({ids:["reserved-file-001"]});
    if(options.method==="POST"){attempts++;assert.match(options.body,/reserved-file-001/);if(!created){created=true;throw new TypeError("network lost after create");}return new Response(null,{status:409});}
    return Response.json(op);
  });
  const initial=(await db.loadWorkspace(ns)).pending[0];
  await assert.rejects(()=>client.push(ns,initial,"history0001"));
  const retained=(await db.loadWorkspace(ns)).pending[0];assert.equal(retained.fileId,"reserved-file-001");
  await client.push(ns,retained,"history0001");
  assert.equal(attempts,2);assert.equal((await db.loadWorkspace(ns)).pending.length,0);
});

function memoryDrive(permissionId){
  const files=new Map(),sessions=new Map();let counter=0;
  const next=()=>`drive-file-${String(++counter).padStart(9,"0")}`;
  const create=(meta,content)=>{const id=meta.id??next();const value={...meta,id,content,createdTime:new Date(counter).toISOString()};files.set(id,value);return value;};
  const fetcher=async(raw,options={})=>{
    const url=new URL(raw),method=options.method??"GET",headers=new Headers(options.headers);
    assert.equal(headers.get("Authorization"),"Bearer test-token");
    if(url.pathname.endsWith("/about"))return Response.json({user:{permissionId,emailAddress:"test@example.invalid",displayName:"Test"}});
    if(url.pathname.endsWith("/generateIds"))return Response.json({ids:[next()]});
    if(url.searchParams.has("upload_id")){
      const session=sessions.get(url.searchParams.get("upload_id"));assert.ok(session);
      const range=headers.get("Content-Range");
      if(range.startsWith("bytes */"))return session.done?Response.json({id:session.meta.id}):new Response(null,{status:308,...(session.offset?{headers:{Range:`bytes=0-${session.offset-1}`}}:{})});
      const [,start,end,total]=range.match(/^bytes (\d+)-(\d+)\/(\d+)$/);assert.equal(Number(start),session.offset);
      session.parts.push(new Uint8Array(await options.body.arrayBuffer()));session.offset=Number(end)+1;
      if(session.offset===Number(total)){session.done=true;const bytes=new Uint8Array(session.offset);let p=0;for(const part of session.parts){bytes.set(part,p);p+=part.length;}create({...session.meta,size:session.offset},bytes);return Response.json({id:session.meta.id});}
      return new Response(null,{status:308,headers:{Range:`bytes=0-${session.offset-1}`}});
    }
    if(url.searchParams.get("uploadType")==="resumable"){
      const meta=JSON.parse(options.body),sessionId=next();sessions.set(sessionId,{meta,offset:0,done:false,parts:[]});
      return new Response(null,{status:200,headers:{Location:`https://www.googleapis.com/upload/drive/v3/files?upload_id=${sessionId}`}});
    }
    if(url.searchParams.get("uploadType")==="multipart"){
      const boundary=headers.get("Content-Type").split("boundary=")[1],parts=options.body.split(`--${boundary}`);
      const meta=JSON.parse(parts[1].split("\r\n\r\n")[1].trim()),content=JSON.parse(parts[2].split("\r\n\r\n")[1].trim());
      const target=method==="PATCH"?url.pathname.split("/").at(-1):meta.id;
      if(method==="POST"&&files.has(target))return new Response(null,{status:409});
      const value=create({...files.get(target),...meta,...(target?{id:target}:{})},content);return Response.json({id:value.id});
    }
    if(url.pathname.endsWith("/files")){
      if(method==="POST"){const value=create(JSON.parse(options.body));return Response.json(value);}
      const q=url.searchParams.get("q"),props=[...q.matchAll(/key='([^']+)' and value='([^']+)'/g)];
      const result=[...files.values()].filter(f=>props.every(([,key,value])=>f.appProperties?.[key]===value)).filter(f=>!q.includes("mimeType = 'application/vnd.google-apps.folder'")||f.mimeType==="application/vnd.google-apps.folder");
      return Response.json({files:result.map(f=>Object.fromEntries(Object.entries(f).filter(([key])=>key!=="content")))});
    }
    const file=files.get(url.pathname.split("/").at(-1));if(!file)return new Response(null,{status:404});
    if(method==="PATCH"){Object.assign(file,JSON.parse(options.body));if(url.searchParams.has("addParents"))file.parents=[url.searchParams.get("addParents")];return Response.json(file);}
    if(url.searchParams.get("alt")==="media")return Response.json(file.content);
    return Response.json(file);
  };
  return {files,fetcher};
}

test("complete Drive protocol stores a trip original and reconstructs an independent replica from immutable history",async()=>{
  const permissionId="990000000001",ns=`google:${permissionId}`,remote=memoryDrive(permissionId),client=new DriveClient("test-token",Date.now()+3600000,remote.fetcher);
  const original="<gpx>original bytes</gpx>",file=new Blob([original]);
  const attachment={id:"full-file-1",ownerKind:"trip",ownerId:trip.id,name:"route.gpx",mimeType:"application/gpx+xml",size:file.size,addedAt:new Date().toISOString()};
  const op=d.makeOperation(d.project([]),"device-a",[change("wheel",wheel),change("reading",reading("r","02",123.4)),change("trip",trip),change("ride",ride("ride1",trip.id,23.4)),change("gear",gear),change("attachment",attachment)]);
  await db.storeOperation(ns,op,{attachmentId:attachment.id,blob:file});
  const result=await client.sync(ns,()=>{});assert.equal(result.pending,0);
  const saved=(await db.loadWorkspace(ns)).state.attachment[0];assert.ok(saved.driveId);
  assert.equal(new TextDecoder().decode(remote.files.get(saved.driveId).content),original);
  const snapshot=[...remote.files.values()].find(f=>f.name==="database.json");assert.equal(snapshot.content.operations.length,2);
  const replica=`replica-${crypto.randomUUID()}`;await client.pull(replica,()=>{});const copy=await db.loadWorkspace(replica);
  assert.equal(copy.state.trip.length,1);assert.equal(copy.state.ride[0].tripId,trip.id);assert.equal(copy.state.attachment[0].driveId,saved.driveId);assert.equal(copy.blobs.length,0);assert.equal(d.wheelStats(copy.state.wheel[0],copy.state.reading).trackedKm,23.4);
  assert.deepEqual(copy.state.gear,[gear]);
  const originalCount=remote.files.size;await client.sync(ns,()=>{});assert.equal(remote.files.size,originalCount);
});
