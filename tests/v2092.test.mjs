import assert from "node:assert/strict";
import test from "node:test";
import {readFile} from "node:fs/promises";
import {tsImport} from "tsx/esm/api";
import "fake-indexeddb/auto";

const domain=await tsImport("../lib/kairo/domain.ts",import.meta.url);
const analytics=await tsImport("../lib/kairo/analytics.ts",import.meta.url);
const storage=await tsImport("../lib/kairo/storage.ts",import.meta.url);
const diagnostics=await tsImport("../lib/kairo/diagnostics.ts",import.meta.url);
const errors=await tsImport("../lib/kairo/errors.ts",import.meta.url);
const integrity=await tsImport("../lib/kairo/integrity.ts",import.meta.url);
const {transferView}=await tsImport("../components/kairo/transfer-center.tsx",import.meta.url);
const {DriveClient}=await tsImport("../lib/kairo/drive.ts",import.meta.url);

const wheel={id:"wheel-2092",name:"LeaperKim Lynx-S",baselineKm:0,baselineDate:"2026-01-01",color:"#f16305",notes:""};
const attachment={id:"attachment-2092",ownerKind:"trip",ownerId:"trip-2092",name:"route.gpx",mimeType:"application/gpx+xml",size:9*1024*1024,addedAt:"2026-09-09T12:00:00.000Z"};
const trip={id:"trip-2092",name:"Test trip",startDate:"2026-09-09",endDate:"2026-09-09",notes:""};
const change=(kind,value)=>({kind,entityId:value.id,value});

test("v2092 year comparison uses a stable leap-year axis without invalid dates",()=>{
  const state=domain.project([domain.makeOperation(domain.project([]),"year-axis",[change("wheel",wheel)])]);
  const result=analytics.periodComparison(state,"year",[wheel.id],new Date("2026-09-09T12:00:00.000Z"));
  assert.equal(result.points.length,366);
  assert.equal(result.points[59].label,"02-29");
  assert.equal(result.points[59].period0,null);
  for(const point of result.points)assert.ok(Number.isFinite(new Date(`2024-${point.label}T12:00:00.000Z`).getTime()),point.label);
});

test("v2092 Drive confirmation always renders as uploaded and 100 percent",()=>{
  const blob={namespace:"local",attachmentId:attachment.id,blob:new Blob(["local"]),queued:true,transferState:"uploaded",confirmedBytes:0,updatedAt:"2026-09-09T12:00:00.000Z"};
  const live={state:"uploading",confirmedBytes:0,totalBytes:attachment.size,message:"Uploading: 0 %"};
  const shown=transferView({...attachment,driveId:"confirmed-drive-file"},blob,true,true,live);
  assert.equal(shown.state,"uploaded");assert.equal(shown.confirmed,attachment.size);assert.equal(shown.percent,100);
  assert.match(shown.message,/confirmed/i);
});

test("v2092 a user pause wins over a late live upload event",()=>{
  const blob={namespace:"local",attachmentId:attachment.id,blob:new Blob(["local"]),queued:false,transferState:"paused",confirmedBytes:1024,pauseReason:"Upload cancelled.",updatedAt:"2026-09-09T12:00:00.000Z"};
  const shown=transferView(attachment,blob,true,true,{state:"uploading",confirmedBytes:4096,totalBytes:attachment.size,message:"Uploading"});
  assert.equal(shown.state,"paused");assert.equal(shown.confirmed,4096);assert.equal(shown.percent,0);assert.equal(shown.message,"Upload cancelled.");
});

test("v2092 cancelling an active request aborts it and preserves the local original",async()=>{
  const namespace=`cancel-${crypto.randomUUID()}`,file=new Blob([new Uint8Array(attachment.size)]);
  await storage.commitChanges(namespace,[change("trip",trip),change("attachment",attachment)],[{attachmentId:attachment.id,blob:file}]);
  let releaseStart;const started=new Promise(resolve=>{releaseStart=resolve;});
  const fetcher=async(url,options={})=>{
    if(url.includes("generateIds"))return Response.json({ids:["drive-file-2092"]});
    if(url.includes("uploadType=resumable"))return new Response(null,{status:200,headers:{Location:"https://www.googleapis.com/upload/drive/v3/files?upload_id=cancel-test"}});
    if(url.includes("upload_id=cancel-test"))return new Promise((resolve,reject)=>{
      releaseStart();
      const abort=()=>reject(options.signal?.reason??new DOMException("Cancelled","AbortError"));
      if(options.signal?.aborted)abort();else options.signal?.addEventListener("abort",abort,{once:true});
    });
    throw new Error(`Unexpected request: ${url}`);
  };
  const client=new DriveClient("token",Date.now()+60_000,fetcher),stored=(await storage.loadWorkspace(namespace)).blobs[0];
  const upload=client.uploadAttachment(namespace,attachment,stored,"parent-folder",()=>{});
  await started;await storage.pauseTransfer(namespace,attachment.id);
  assert.equal(client.cancelAttachmentUpload(attachment.id),true);
  await assert.rejects(upload,error=>error instanceof Error&&error.name==="AbortError");
  const after=(await storage.loadWorkspace(namespace)).blobs[0];
  assert.equal(after.queued,false);assert.equal(after.transferState,"paused");assert.equal(after.blob.size,file.size);assert.equal(after.confirmedBytes,0);
});

test("v2092 technical errors have a plain-language meaning and next action",()=>{
  const network=errors.explainError(new TypeError("Failed to fetch"),"en");
  assert.equal(network.title,"Google Drive could not be reached");assert.match(network.message,/Local data is safe/);assert.match(network.action,/Refresh access/);
  const validation=errors.explainError('[{"code":"unrecognized_keys","keys":["templateId","repeatDays"],"path":[],"message":"Unrecognized"}]',"en");
  assert.match(validation.title,/compatibility/i);assert.match(validation.message,/templateId, repeatDays/);assert.doesNotMatch(validation.message,/unrecognized_keys/);
});

test("v2092 integrity warning names the affected item without exposing its UUID",()=>{
  const state=domain.project([domain.makeOperation(domain.project([]),"integrity-label",[change("wheel",wheel)])]);
  const notice=integrity.describeIntegrity([`Record history is incomplete: wheel:${wheel.id}.`],state,"en");
  assert.match(notice.message,/LeaperKim Lynx-S/);assert.doesNotMatch(notice.message,new RegExp(wheel.id));assert.match(notice.action,/JSON backup/);
});

test("v2092 diagnostic reports omit stable account identifiers and add explanations",()=>{
  const event={key:"google:11612443173075750762|event",namespace:"google:11612443173075750762",createdAt:"2026-09-09T12:00:00.000Z",level:"critical",code:"UI.CRASH",incidentId:"KR-TEST",message:"Invalid time value",appVersion:"2.0.9.2",buildId:"build"};
  const health={checkedAt:event.createdAt,app:{status:"ok",version:"2.0.9.2",buildId:"build"},database:{status:"ok"},drive:{status:"ok",connected:true,account:"private@example.com"},synchronization:{status:"ok",pendingRecords:0,pendingFiles:0,conflicts:0},storage:{status:"ok"},serviceWorker:{status:"ok",controlled:true}};
  const safe=diagnostics.privacySafeReportData([event],health),text=JSON.stringify(safe);
  assert.doesNotMatch(text,/11612443173075750762|private@example\.com|namespace|\"key\"/);
  assert.equal(safe.health.drive.account,"[account hidden]");assert.match(safe.events[0].explanation.action,/Analytics/);
});

test("v2092 source contracts keep technical detail secondary and wire per-file cancellation",async()=>{
  const [panel,app,charts]=await Promise.all(["../components/kairo/diagnostics-panel.tsx","../components/kairo/app.tsx","../components/kairo/history-charts.tsx"].map(path=>readFile(new URL(path,import.meta.url),"utf8")));
  assert.match(panel,/What to do/);assert.match(panel,/Technical details/);assert.match(app,/cancelAttachmentUpload/);
  assert.match(charts,/validDateKey/);assert.equal(analytics.YEAR_DAY_LABELS.length,366);
});
