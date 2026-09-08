import assert from "node:assert/strict";
import test from "node:test";
import {readFile} from "node:fs/promises";
import {tsImport} from "tsx/esm/api";
import "fake-indexeddb/auto";

const d=await tsImport("../lib/kairo/domain.ts",import.meta.url);
const analytics=await tsImport("../lib/kairo/analytics.ts",import.meta.url);
const db=await tsImport("../lib/kairo/storage.ts",import.meta.url);
const diagnostics=await tsImport("../lib/kairo/diagnostics.ts",import.meta.url);
const excel=await tsImport("../lib/kairo/excel.ts",import.meta.url);
const {DriveClient,DriveError}=await tsImport("../lib/kairo/drive.ts",import.meta.url);

const wheel=(id,name,baselineDate="2026-01-01")=>({id,name,baselineKm:0,baselineDate,color:id.endsWith("b")?"#13c6e8":"#f16305",notes:""});
const reading=(id,wheelId,date,odometerKm)=>({id,wheelId,at:`${date}T12:00:00.000Z`,odometerKm,notes:""});
const ride=(id,wheelId,date,distanceKm,durationMinutes)=>({id,wheelId,at:`${date}T12:00:00.000Z`,localDate:date,timeZone:"UTC",name:"",tripId:null,distanceKm,notes:"",...(durationMinutes?{durationMinutes}:{})});
const change=(kind,value)=>({kind,entityId:value.id,value});
const state=(wheels,readings=[],rides=[])=>d.project([d.makeOperation(d.project([]),"analytics-test",[
  ...wheels.map(value=>change("wheel",value)),...readings.map(value=>change("reading",value)),...rides.map(value=>change("ride",value)),
])]);

test("v2091 sparse odometer intervals produce honest 30/90-day trend and weekly growth",()=>{
  const w=wheel("wheel-a","Lynx"),s=state([w],[reading("r30",w.id,"2026-01-31",300),reading("r90",w.id,"2026-04-01",900)]);
  const days=analytics.estimatedDailyDistance(s,[w.id]);
  assert.equal(days.length,90);assert.equal(days[0].date,"2026-01-02");assert.equal(days.at(-1).date,"2026-04-01");
  assert.ok(days.every(day=>day.total===10&&day.estimated));
  const trend=analytics.trendSeries(s,[w.id],new Date("2026-04-01T12:00:00Z"));
  assert.equal(trend.at(-1).average30,10);assert.equal(trend.at(-1).average90,10);
  assert.deepEqual(analytics.growthRates(s,[w.id],new Date("2026-04-01T12:00:00Z")),{asOf:"2026-04-01",kmPerWeek30:70,kmPerWeek90:70});
  const stale=analytics.growthRates(s,[w.id],new Date("2026-04-02T12:00:00Z"));
  assert.equal(stale.asOf,"2026-04-01");assert.equal(stale.kmPerWeek30,null);assert.equal(stale.kmPerWeek90,null);
});

test("v2091 cumulative comparisons never convert a missing day into zero",()=>{
  const w=wheel("wheel-a","Lynx"),s=state([w],[],[ride("day-one",w.id,"2026-01-01",10),ride("day-three",w.id,"2026-01-03",20)]);
  const days=analytics.estimatedDailyDistance(s,[w.id]);
  assert.deepEqual(days.map(day=>day.total),[10,null,20]);
  const month=analytics.periodComparison(s,"month",[w.id],new Date("2026-01-03T12:00:00Z"),1);
  assert.equal(month.points[0].period0,10);assert.equal(month.points[1].period0,null);assert.equal(month.points[2].period0,null);
  assert.equal(Math.round(month.lines[0].coveragePercent),67);
});

test("v2091 insights use comparable month coverage and calculate EUC time without invented durations",()=>{
  const a=wheel("wheel-a","Lynx","2026-05-31"),covered=state([a],[reading("june",a.id,"2026-06-30",300),reading("july",a.id,"2026-07-10",400)]);
  const comparison=analytics.analyticsInsights(covered,new Date("2026-07-10T12:00:00Z"),[a.id]);
  assert.equal(comparison.monthCurrentKm,100);assert.equal(comparison.monthPreviousKm,100);assert.equal(comparison.monthChangePercent,0);

  const b=wheel("wheel-b","V8S","2026-06-30"),timed=state([a,b],[],[
    ride("a-long",a.id,"2026-07-01",100,120),ride("b-day",b.id,"2026-07-01",80,60),ride("a-short",a.id,"2026-07-02",50,60),ride("unknown-time",a.id,"2026-07-03",25),
  ]);
  const result=analytics.analyticsInsights(timed,new Date("2026-07-31T12:00:00Z"),[a.id,b.id]);
  assert.deepEqual(result.longestDay,{date:"2026-07-01",distanceKm:100,vehicleName:"Lynx",estimated:false});
  assert.equal(result.ridingDays,3);assert.equal(result.eucTime.totalMinutes,240);assert.equal(result.eucTime.distanceKm,230);assert.equal(result.eucTime.averageSpeedKmh,57.5);assert.equal(result.eucTime.timedRides,3);
});

test("v2091 optional time-on-wheel validates and exports with calculated average speed",()=>{
  const w=wheel("wheel-a","Lynx"),r=ride("timed",w.id,"2026-01-02",30,90),operation=d.makeOperation(d.project([]),"timed-test",[change("wheel",w),change("ride",r)]);
  assert.equal(d.rideSchema.parse(r).durationMinutes,90);assert.throws(()=>d.rideSchema.parse({...r,durationMinutes:0}));
  const book=excel.exportWorkbook([operation]),header=book.Rides[0],row=book.Rides[1];
  assert.equal(row[header.indexOf("Time on wheel (min)")],90);assert.equal(row[header.indexOf("Average speed km/h")],20);
});

test("v2091 restoring a recovery point creates a newer compensating revision",async()=>{
  const namespace=`restore-${crypto.randomUUID()}`,original=wheel("wheel-a","Original");
  const first=await db.commit(namespace,"wheel",original,original.id),snapshot=await db.createRecoverySnapshot(namespace,"Before edit");
  const second=await db.commit(namespace,"wheel",{...original,name:"Changed"},original.id);
  await db.restoreRecoverySnapshot(snapshot);
  const restored=await db.loadWorkspace(namespace),last=restored.operations.find(operation=>operation.id!==first.id&&operation.id!==second.id);
  assert.equal(restored.state.wheel[0].name,"Original");assert.equal(restored.state.conflicts.length,0);assert.equal(restored.operations.length,3);
  assert.deepEqual(last.changes[0].parents,[second.id]);
  await db.mergeOperations(namespace,[first,second],true);
  assert.equal((await db.loadWorkspace(namespace)).state.wheel[0].name,"Original");
});

test("v2091 a Pause click during an in-flight chunk preserves pause and confirmed bytes",async()=>{
  const namespace=`pause-${crypto.randomUUID()}`,attachment={id:"attachment-one",ownerKind:"trip",ownerId:"trip-one",name:"route.gpx",mimeType:"application/gpx+xml",size:9*1024*1024,addedAt:"2026-09-08T12:00:00.000Z"};
  const blob=new Blob([new Uint8Array(attachment.size)]),trip={id:"trip-one",name:"Trip",startDate:"2026-09-08",endDate:"2026-09-08",notes:""};
  await db.commitChanges(namespace,[change("attachment",attachment),change("trip",trip)],[{attachmentId:attachment.id,blob}]);
  let chunks=0;const fetcher=async url=>{
    if(url.includes("generateIds"))return Response.json({ids:["drive-file-id"]});
    if(url.includes("uploadType=resumable"))return new Response(null,{status:200,headers:{Location:"https://www.googleapis.com/upload/drive/v3/files?upload_id=safe"}});
    if(url.includes("upload_id=safe")){chunks++;await db.pauseTransfer(namespace,attachment.id);return new Response(null,{status:308,headers:{Range:"bytes=0-8388607"}});}
    throw new Error(`Unexpected request: ${url}`);
  };
  const client=new DriveClient("token",Date.now()+60_000,fetcher);
  const stored=(await db.loadWorkspace(namespace)).blobs[0];
  await assert.rejects(()=>client.uploadAttachment(namespace,attachment,stored,"parent-folder",()=>{}),error=>error instanceof DriveError&&error.status===409);
  const paused=(await db.loadWorkspace(namespace)).blobs[0];
  assert.equal(chunks,1);assert.equal(paused.queued,false);assert.equal(paused.transferState,"paused");assert.equal(paused.confirmedBytes,8*1024*1024);
});

test("v2091 diagnostics sanitize secrets, upload sessions and filenames",()=>{
  const clean=diagnostics.sanitizeDiagnostic({token:"access-token",authorization:"Bearer abc.def",uploadSession:"https://www.googleapis.com/upload/drive/v3/files?upload_id=secret",fileName:"private-trip.gpx",nested:{password:"nope"}});
  assert.equal(clean.token,"[redacted]");assert.equal(clean.authorization,"[redacted]");assert.equal(clean.uploadSession,"[redacted]");assert.equal(clean.fileName,"[file hidden].gpx");assert.equal(clean.nested.password,"[redacted]");
  assert.doesNotMatch(JSON.stringify(clean),/access-token|abc\.def|private-trip|upload_id=secret|nope/);
});

test("v2091 source contracts include transfers, diagnostics, migrations and the requested analytics",async()=>{
  const [charts,settings,worker,form]=await Promise.all(["../components/kairo/history-charts.tsx","../components/kairo/storage-panel.tsx","../build/pwa-worker.js","../components/kairo/forms.tsx"].map(path=>readFile(new URL(path,import.meta.url),"utf8")));
  for(const copy of ["Short- and long-term intensity","This and previous weeks","This and previous months","This and previous years","Average kilometres added per week","EUC time"])assert.match(charts,new RegExp(copy));
  assert.match(charts,/average30/);assert.match(charts,/average90/);assert.match(charts,/connectNulls=\{false\}/);assert.match(charts,/Insights/);
  assert.match(settings,/TransferCenter/);assert.match(settings,/DiagnosticsPanel/);assert.match(settings,/Recovery points/);assert.match(settings,/Application update/);
  assert.match(form,/Time on wheel/);assert.match(worker,/ACTIVATE_UPDATE/);
  const installStart=worker.indexOf('self.addEventListener("install"');
  const activateStart=worker.indexOf('self.addEventListener("activate"');
  const installWorker=worker.slice(installStart,activateStart);
  assert.doesNotMatch(installWorker,/skipWaiting/);
});
