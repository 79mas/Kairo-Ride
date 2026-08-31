import assert from "node:assert/strict";
import test from "node:test";
import {readFile} from "node:fs/promises";
import {tsImport} from "tsx/esm/api";
import "fake-indexeddb/auto";
const numbers=await tsImport("../lib/kairo/numbers.ts",import.meta.url);
const {exportName}=await tsImport("../lib/kairo/export-name.ts",import.meta.url);
const {prepareTripFiles}=await tsImport("../lib/kairo/trip-files.ts",import.meta.url);
const db=await tsImport("../lib/kairo/storage.ts",import.meta.url);
const d=await tsImport("../lib/kairo/domain.ts",import.meta.url);
const wheel={id:"wheel208",name:"Lynx",baselineKm:0,baselineDate:"2026-01-01",color:"#f16305",notes:""};
const trip={id:"trip208",name:"Trip",startDate:"2026-08-31",endDate:"2026-08-31",notes:""};
const namespace=()=>`test208-${crypto.randomUUID()}`;
const changes=()=>[{kind:"wheel",value:wheel,entityId:wheel.id},{kind:"trip",value:trip,entityId:trip.id}];

test("Default numeric display uses spaces and a decimal comma independently of English",()=>{
  assert.equal(numbers.readNumberFormat(),"space-comma");
  assert.equal(numbers.formatNumber(1234567.89),"1\u00a0234\u00a0567,89");
  assert.equal(d.formatKm(1234.56,"en-US"),"1\u00a0234,56");
  assert.equal(numbers.formatNumber(0),"0");
  assert.equal(numbers.formatNumber(-1234.56),"-1\u00a0234,56");
  assert.equal(numbers.formatNumber(NaN),"—");
});
test("All four number formats preserve values, rounding and compact decimal separators",()=>{
  assert.equal(numbers.formatNumber(1234.56,{},"comma-dot"),"1,234.56");
  assert.equal(numbers.formatNumber(1234.56,{},"dot-comma"),"1.234,56");
  assert.equal(numbers.formatNumber(1234.56,{},"space-dot"),"1\u00a0234.56");
  assert.equal(numbers.formatNumber(1250,{notation:"compact"},"space-comma"),"1,25K");
  assert.equal(numbers.formatNumber(.126,{style:"percent",maximumFractionDigits:1},"space-comma"),"12,6%");
});
test("Number preference persists under the app path and invalid preferences recover",()=>{
  const old=Object.getOwnPropertyDescriptor(globalThis,"localStorage"),map=new Map();
  Object.defineProperty(globalThis,"localStorage",{configurable:true,value:{getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v)}});
  try{
    numbers.saveNumberFormat("dot-comma");
    assert.equal(numbers.readNumberFormat(),"dot-comma");assert.equal(numbers.formatNumber(1000.1),"1.000,1");
    map.set(numbers.numberPreferenceKey(),"invalid");assert.equal(numbers.readNumberFormat(),"space-comma");
  }finally{if(old)Object.defineProperty(globalThis,"localStorage",old);else delete globalThis.localStorage;}
});
test("Both export filenames include the current patch version and a sortable timestamp",()=>{
  for(const extension of ["json","xlsx"])assert.equal(exportName(extension,new Date("2026-08-31T12:34:56.123Z")),`Kairo-Ride-2.0.8-2026-08-31T12-34-56-123Z.${extension}`);
});
test("Preparing files is read-only; cancelling leaves no database entries or blobs",async()=>{
  const ns=namespace(),before=await db.loadWorkspace(ns);
  const prepared=await prepareTripFiles(trip.id,[new File(["gpx data"],"route.gpx"),new File(["csv data"],"wheel.csv")]);
  assert.equal(prepared.changes.length,2);assert.equal(prepared.blobs.length,2);
  const after=await db.loadWorkspace(ns);assert.deepEqual(after.operations,before.operations);assert.equal(after.blobs.length,0);
});
test("Ride, odometer, new trip and several original files save as one operation",async()=>{
  const ns=namespace(),at="2026-08-31T12:00:00.000Z";
  const ride={id:"ride208",wheelId:wheel.id,at,name:"",distanceKm:null,tripId:trip.id,notes:""};
  const reading={id:ride.id,wheelId:wheel.id,at,odometerKm:70,notes:""};
  const prepared=await prepareTripFiles(trip.id,[new File(["gpx bytes"],"route.gpx"),new File(["csv bytes"],"wheel.csv")]);
  await db.commitChanges(ns,[...changes(),{kind:"ride",value:ride,entityId:ride.id},{kind:"reading",value:reading,entityId:reading.id},...prepared.changes],prepared.blobs);
  const result=await db.loadWorkspace(ns);
  assert.equal(result.operations.length,1);assert.equal(result.state.ride.length,1);assert.equal(result.state.reading.length,1);
  assert.equal(result.state.attachment.length,2);assert.equal(result.blobs.length,2);
  assert.ok(result.state.attachment.every(a=>a.ownerKind==="trip"&&a.ownerId===trip.id));
  assert.deepEqual((await Promise.all(result.blobs.map(b=>b.blob.text()))).sort(),["csv bytes","gpx bytes"]);
});
test("Archived trip validation aborts the entire file/record transaction",async()=>{
  const ns=namespace();await db.commitChanges(ns,changes());
  await db.commit(ns,"trip",{...trip,archived:true},trip.id);
  const before=await db.loadWorkspace(ns),prepared=await prepareTripFiles(trip.id,[new File(["bytes"],"file.csv")]);
  await assert.rejects(()=>db.commitChanges(ns,prepared.changes,prepared.blobs),/archived|deleted|removed/i);
  const after=await db.loadWorkspace(ns);assert.equal(after.operations.length,before.operations.length);assert.equal(after.blobs.length,0);
});
test("A blob write failure rolls back metadata and all previously written blobs",async()=>{
  const ns=namespace();const prepared=await prepareTripFiles(trip.id,[new File(["first"],"one.csv"),new File(["second"],"two.csv")]);
  const invalid=[prepared.blobs[0],{...prepared.blobs[1],blob:()=>{}}];
  await assert.rejects(()=>db.commitChanges(ns,[...changes(),...prepared.changes],invalid));
  const after=await db.loadWorkspace(ns);assert.equal(after.operations.length,0);assert.equal(after.blobs.length,0);
});
test("Oversized files and insufficient quota are rejected before a write",async()=>{
  await assert.rejects(()=>prepareTripFiles(trip.id,[{size:513*1024*1024}]),/512 MB/);
  const old=Object.getOwnPropertyDescriptor(globalThis,"navigator");
  Object.defineProperty(globalThis,"navigator",{configurable:true,value:{storage:{estimate:async()=>({quota:100,usage:0})}}});
  try{
    await assert.rejects(()=>prepareTripFiles(trip.id,[new File(["a".repeat(95)],"large.csv")]),/enough space/);
    assert.deepEqual(await prepareTripFiles(trip.id,[]),{changes:[],blobs:[]});
  }finally{if(old)Object.defineProperty(globalThis,"navigator",old);else delete globalThis.navigator;}
});
test("Keyboard-safe viewport and scrollable dialogs retain pinch zoom",async()=>{
  const [html,hook,css]=await Promise.all(["../index.html","../hooks/use-dialog-viewport.ts","../app/globals.css"].map(path=>readFile(new URL(path,import.meta.url),"utf8")));
  assert.match(html,/interactive-widget=resizes-content/);assert.doesNotMatch(html,/user-scalable=no|maximum-scale=1/);
  assert.match(hook,/visualViewport/);assert.match(hook,/addEventListener\("resize"/);assert.match(hook,/removeEventListener\("resize"/);
  assert.match(css,/max-height:calc\(var\(--dialog-viewport-height,100dvh\) - 24px\)/);assert.match(css,/\.trip-draft-body\{min-height:0;overflow-y:auto/);
});
test("Date column no longer sticks, Fleet starts left and does not contain an Add action",async()=>{
  const [css,views]=await Promise.all(["../app/globals.css","../components/kairo/views.tsx"].map(path=>readFile(new URL(path,import.meta.url),"utf8")));
  assert.doesNotMatch(css,/td\.ledger-col-date\s*\{[^}]*position:sticky/);
  const fleet=views.slice(views.indexOf("function FleetStrip"),views.indexOf("export function MainViews"));
  assert.match(fleet,/scrollLeft=0/);assert.doesNotMatch(fleet,/openEditor|tr\("Add"/);
});
test("Trip changes stay staged until Save; Close versus Cancel follows dirty state",async()=>{
  const [dialog,forms]=await Promise.all(["../components/kairo/trip-dialog.tsx","../components/kairo/forms.tsx"].map(path=>readFile(new URL(path,import.meta.url),"utf8")));
  assert.match(dialog,/dirty\?tr\("Cancel","Atšaukti"\):tr\("Close","Uždaryti"\)/);
  assert.match(dialog,/disabled=\{busy\|\|!dirty\}/);assert.doesNotMatch(dialog,/addAttachment\(|commit\(|commitChanges\(/);
  assert.match(forms,/files:addAsTrip\?files:\[\]/);assert.match(forms,/<PendingFiles files=\{files\}/);
});
