import assert from "node:assert/strict";
import test from "node:test";
import {tsImport} from "tsx/esm/api";
import "fake-indexeddb/auto";
import {DOMParser} from "@xmldom/xmldom";

globalThis.DOMParser=DOMParser;
const d=await tsImport("../lib/kairo/domain.ts",import.meta.url);
const c=await tsImport("../lib/kairo/calendar.ts",import.meta.url);
const r=await tsImport("../lib/kairo/records.ts",import.meta.url);
const g=await tsImport("../lib/kairo/goals.ts",import.meta.url);
const v=await tsImport("../lib/kairo/vehicle-status.ts",import.meta.url);
const stats=await tsImport("../lib/kairo/stats.ts",import.meta.url);
const db=await tsImport("../lib/kairo/storage.ts",import.meta.url);
const x=await tsImport("../lib/kairo/excel.ts",import.meta.url);
const now=new Date("2026-08-30T12:00:00Z");
const wheel={id:"wheel-206",name:"Lynx-S",baselineKm:100,baselineDate:"2026-07-31",color:"#f16305",notes:""};
const record={id:"record-206",wheelId:wheel.id,at:now.toISOString(),odometerKm:400,notes:""};
const ride={id:record.id,wheelId:wheel.id,at:record.at,name:"",tripId:null,distanceKm:null,notes:"",localDate:"2026-08-30",timeZone:"UTC"};
const goal={id:"goal-206",wheelId:null,targetKm:400,createdAt:now.toISOString()};
const change=(kind,value)=>({kind,entityId:value.id,value});
function fixture({wheels=[wheel],records=[],rides=[],goals=[]}={}){
  const operations=[d.makeOperation(d.project([]),"device-206",[
    ...wheels.map(value=>change("wheel",value)),...records.map(value=>change("reading",value)),
    ...rides.map(value=>change("ride",value)),...goals.map(value=>change("goal",value)),
  ])];
  return {operations,state:d.project(operations)};
}
const near=(value,expected)=>assert.ok(Math.abs(value-expected)<1e-8,`${value} ≠ ${expected}`);
const ns=()=>`v206-${crypto.randomUUID()}`;
function withStorage(run){
  const previous=Object.getOwnPropertyDescriptor(globalThis,"localStorage"),items=new Map();
  Object.defineProperty(globalThis,"localStorage",{configurable:true,value:{getItem:key=>items.get(key)??null,setItem:(key,value)=>items.set(key,value)}});
  try {return run(items);} finally {if(previous)Object.defineProperty(globalThis,"localStorage",previous);else delete globalThis.localStorage;}
}

test("unnamed rides are valid without changing old operation representations",()=>{
  const old={...ride,name:"Original ride"};
  const {operations}=fixture({records:[record],rides:[old]});
  assert.deepEqual(d.parseBackup(d.backup(operations)),operations);
  assert.equal(d.rideSchema.parse(ride).name,"");
  assert.equal(d.rideSchema.parse({...ride,name:"  "}).name,"");
  assert.throws(()=>d.wheelSchema.parse({...wheel,name:""}));
  assert.throws(()=>d.tripSchema.parse({id:"trip",name:"",startDate:"2026-08-30",endDate:"2026-08-30",notes:""}));
  const oldState=d.project(operations);assert.deepEqual(oldState.goal,[]);
  assert.equal(d.SCHEMA_VERSION,1);
});
test("new rides require a complete odometer and matching vehicle/time, including valid zero",()=>{
  const {state}=fixture();
  for(const missing of [null,undefined])assert.throws(()=>r.validateRideRecord(state,ride,missing),/complete odometer/);
  assert.doesNotThrow(()=>r.validateRideRecord(state,ride,record));
  assert.throws(()=>r.validateRideRecord(state,ride,{...record,wheelId:"other"}),/same vehicle and time/);
  assert.throws(()=>r.validateRideRecord(state,ride,{...record,at:"2026-08-29T12:00:00.000Z"}),/same vehicle and time/);
  const zero=fixture({wheels:[{...wheel,baselineKm:0}]}).state;
  assert.doesNotThrow(()=>r.validateRideRecord(zero,ride,{...record,odometerKm:0}));
});
test("legacy distance-only archives keep metadata editable without guessed odometers",()=>{
  const old={...ride,name:"Archive",distanceKm:300},state=fixture({rides:[old]}).state;
  assert.doesNotThrow(()=>r.validateRideRecord(state,{...old,name:"",notes:"Edited"},null));
  assert.throws(()=>r.validateRideRecord(state,{...old,distanceKm:400},null),/Add an odometer/);
  assert.throws(()=>r.validateRideRecord(state,{...old,at:"2026-08-31T12:00:00.000Z"},null),/Add an odometer/);
  const paired=fixture({rides:[old],records:[record]}).state;
  assert.throws(()=>r.validateRideRecord(paired,old,null),/complete odometer/);
  const critical=fixture({wheels:[{...wheel,status:"critical"}],rides:[old]}).state;
  assert.doesNotThrow(()=>r.validateRideRecord(critical,{...old,notes:"Archived"},null));
});
test("live distance uses this vehicle and the previous chronological odometer, not the fleet latest",()=>{
  const other={...wheel,id:"other",name:"Other"};
  const before={...record,id:"before",at:"2026-08-10T12:00:00.000Z",odometerKm:170};
  const after={...record,id:"after",at:"2026-08-25T12:00:00.000Z",odometerKm:250};
  const state=fixture({wheels:[wheel,other],records:[before,after,{...record,id:"other-record",wheelId:other.id,odometerKm:9000}]}).state;
  const preview=r.recordDistancePreview(state,wheel.id,"new","2026-08-17T12:00:00.000Z","240");
  assert.equal(preview.previousKm,170);assert.equal(preview.distanceKm,70);assert.equal(preview.warning,null);
  const edit=r.recordDistancePreview(state,wheel.id,before.id,before.at,"190");
  assert.equal(edit.previousKm,100);assert.equal(edit.distanceKm,90);
  assert.ok(r.recordDistancePreview(state,wheel.id,"new","2026-08-17T12:00:00Z","260").warning,"Must not exceed the next record");
  assert.ok(r.recordDistancePreview(state,wheel.id,"new","2026-08-17T12:00:00Z","160").warning);
  assert.equal(r.recordDistancePreview(state,wheel.id,"new",record.at,""),null);
  assert.equal(r.recordDistancePreview(state,wheel.id,"new","invalid","240"),null);
  assert.equal(r.recordDistancePreview(state,wheel.id,"new",record.at,"not a number"),null);
});
test("unchanged record date/time retains original seconds and timezone offset",()=>{
  const original="2026-08-30T17:23:41.123+03:00";
  assert.equal(r.recordInstant(d.localDateTime(original),original),original);
  assert.notEqual(r.recordInstant("2026-08-31T18:40",original),original);
});
test("last vehicle preference is account-scoped and skips deleted or inactive vehicles",()=>withStorage(()=>{
  const second={...wheel,id:"second",name:"Second",status:"spare"};
  const state=fixture({wheels:[wheel,second],records:[record]}).state;
  r.rememberRecordVehicle("account-A",second.id);
  assert.equal(r.preferredRecordVehicle(state,"account-A").id,second.id);
  assert.equal(r.preferredRecordVehicle(state,"account-B").id,wheel.id);
  const inactive={...state,wheel:[wheel,{...second,status:"in_repair"}]};
  assert.equal(r.preferredRecordVehicle(inactive,"account-A").id,wheel.id);
  assert.equal(r.preferredRecordVehicle({...state,wheel:[wheel]},"account-A").id,wheel.id);
  assert.equal(r.preferredRecordVehicle({...state,wheel:state.wheel.map(w=>({...w,status:"sold"}))},"account-A"),undefined);
}));
test("latest archived ride supplies an eligible vehicle fallback without local preference",()=>{
  const second={...wheel,id:"second",name:"Second"};
  const state=fixture({wheels:[wheel,second],records:[{...record,wheelId:second.id}]}).state;
  withStorage(()=>assert.equal(r.preferredRecordVehicle(state,"new-device").id,second.id));
});
test("Fleet ordering is stable, does not mutate history, and labels inactive selectors",()=>{
  const wheels=["sold","active","in_repair","spare","critical","attention"].map(status=>({...wheel,id:status,name:status,status,statusNote:"Check it"}));
  const state=fixture({wheels}).state,before=d.canonical(state.wheel);
  const ordered=v.orderedVehicles(state.wheel);
  const eligible=state.wheel.filter(d.canRecordWithWheel),inactive=state.wheel.filter(w=>!d.canRecordWithWheel(w));
  assert.deepEqual(ordered.map(w=>w.id),[...eligible,...inactive].map(w=>w.id));
  assert.equal(d.canonical(state.wheel),before);
  const options=v.vehicleSelectOptions(state);
  assert.match(options.find(o=>o.value==="critical").label,/Critical/);
  assert.equal(options.find(o=>o.value==="sold").className,"vehicle-option-inactive");
  assert.ok(v.vehicleSelectOptions(state,"lt").find(o=>o.value==="sold").label.includes("Parduotas"));
});

test("all five date formats parse and render real calendar dates without locale guessing",()=>{
  const expected=["2028/02/29","29/02/2028","29.02.2028","02/29/2028","2028-02-29"];
  c.DATE_FORMATS.forEach((format,index)=>{
    assert.equal(c.formatDateKey("2028-02-29",format),expected[index]);
    assert.equal(c.parseDateText(expected[index],format),"2028-02-29");
  });
  assert.equal(c.parseDateText("2026/02/29","yyyy/mm/dd"),null);
  assert.equal(c.parseDateText("2026/13/01","yyyy/mm/dd"),null);
  assert.equal(c.parseDateText("2026/8/3","yyyy/mm/dd"),null);
  assert.equal(c.parseDateText("30/08/2026","yyyy/mm/dd"),null);
  assert.equal(c.parseDateText("2026/04/31","yyyy/mm/dd"),null);
  assert.equal(c.formatDateKey("invalid"),"");
  assert.equal(c.formatMonthKey("2026-08","yyyy/mm/dd"),"2026/08");
  assert.equal(c.formatMonthKey("2026-08","dd.mm.yyyy"),"08.2026");
});
test("calendar-only dates never shift zones; instants do, with explicit 24-hour time",()=>{
  assert.equal(c.displayDate("2026-08-30",false,"America/Los_Angeles","en-US","yyyy/mm/dd"),"2026/08/30");
  assert.equal(c.displayDate("2026-08-30T22:30:00Z",true,"Europe/Vilnius","en-US","yyyy/mm/dd"),"2026/08/31 01:30");
  assert.equal(c.displayDate("2026-08-30T22:30:00Z",true,"UTC","lt-LT","dd/mm/yyyy"),"30/08/2026 22:30");
  assert.equal(c.displayDate("not-date"),"—");
});
test("calendar preferences default to yyyy/mm/dd and Monday and validate stored values",()=>withStorage(items=>{
  assert.deepEqual(c.readCalendarPreferences(),c.DEFAULT_CALENDAR);
  c.saveCalendarPreferences({dateFormat:"dd.mm.yyyy",weekStartsOn:0});
  assert.deepEqual(c.readCalendarPreferences(),{dateFormat:"dd.mm.yyyy",weekStartsOn:0});
  items.set(c.calendarPreferenceKey(),JSON.stringify({dateFormat:"random",weekStartsOn:9}));
  assert.deepEqual(c.readCalendarPreferences(),c.DEFAULT_CALENDAR);
  c.saveCalendarPreferences(c.DEFAULT_CALENDAR);
}));
test("week start affects periods, totals and calendars without changing stored dates",()=>{
  const state=fixture({records:[record]}).state;
  assert.equal(stats.dateKey(stats.periodWindow("week",0,now,1).start),"2026-08-24");
  assert.equal(stats.dateKey(stats.periodWindow("week",0,now,0).start),"2026-08-30");
  const saturday={...record,at:"2026-08-29T12:00:00Z"};
  const archive=fixture({records:[saturday]}).state;
  assert.equal(stats.metricDistance(archive,"week","all",now,1),300);
  assert.equal(stats.metricDistance(archive,"week","all",now,0),0);
  for(let first=0;first<7;first++){
    const window=stats.periodWindow("week",0,now,first);
    assert.equal(window.start.getDay(),first);
    const points=stats.periodData(state,"week",0,"en-US",now,first,"yyyy/mm/dd").points;
    assert.equal(points.length,7);
    assert.equal(c.calendarMonthDays("2026-08",first).findIndex(Boolean),(6-first+7)%7);
  }
  assert.match(stats.periodData(state,"week",0,"en-US",now,1).title,/2026\/08\/24/);
  assert.equal(c.shiftDateKey("2026-03-28",2),"2026-03-30");
  assert.equal(c.shiftDateKey("2028-02-28",1),"2028-02-29");
});
test("grouped bar scaling uses the maximum individual visible value, not a stack total",()=>{
  const points=[{date:"2026-08-01",total:1000,a:100,b:900},{date:"2026-08-02",total:550,a:150,b:400}];
  assert.deepEqual(stats.fitChartDomain(points,["a","b"],"grouped"),[0,945]);
  assert.deepEqual(stats.fitChartDomain(points,["a"],"grouped"),[0,157.5]);
  assert.deepEqual(stats.fitChartDomain(points.slice(1),["a","b"],"grouped"),[0,420]);
  assert.deepEqual(stats.fitChartDomain(points,[],"grouped"),[0,1]);
  assert.deepEqual(stats.fitChartDomain([{date:"2026-08-01",total:0,a:0}],["a"],"grouped"),[0,1]);
});

test("goal ETA is based on thirty calendar days and tracked mileage, not initial odometer",()=>{
  const state=fixture({records:[record],rides:[ride]}).state,forecast=g.forecastGoal(state,goal,now);
  assert.equal(forecast.currentKm,300);assert.equal(forecast.remainingKm,100);
  assert.equal(forecast.averageKmPerDay,10);assert.equal(forecast.estimatedDate,"2026-09-09");
  assert.equal(forecast.fromDate,"2026-08-01");assert.equal(forecast.toDate,"2026-08-30");
  assert.equal(forecast.progressPercent,75);
});
test("sparse odometer intervals are weighted by overlap, rather than dumped into their last day",()=>{
  const state=fixture({wheels:[{...wheel,baselineDate:"2026-07-01"}],records:[{...record,odometerKm:700}]}).state;
  const forecast=g.forecastGoal(state,{...goal,targetKm:700},now);
  assert.equal(forecast.currentKm,600);assert.equal(forecast.distanceLast30Km,300);
  assert.equal(forecast.averageKmPerDay,10);assert.equal(forecast.estimatedDate,"2026-09-09");
});
test("forecast includes zero days and never invents riding after the last record",()=>{
  const state=fixture({records:[{...record,at:"2026-08-07T12:00:00Z",odometerKm:170}]}).state;
  const forecast=g.forecastGoal(state,{...goal,targetKm:170},now);
  near(forecast.averageKmPerDay,70/30);
  assert.equal(forecast.estimatedDate,"2026-10-12");
  assert.equal(g.forecastGoal(state,goal,new Date("2026-09-30T12:00:00Z")).status,"no_activity");
});
test("total goals sum selected vehicle contributions; a single-vehicle goal stays independent",()=>{
  const other={...wheel,id:"other",name:"Other"},state=fixture({wheels:[wheel,other],records:[record,{...record,id:"other-record",wheelId:other.id,odometerKm:700}]}).state;
  const all=g.forecastGoal(state,{...goal,targetKm:1200},now),single=g.forecastGoal(state,{...goal,wheelId:wheel.id},now);
  assert.equal(all.currentKm,900);assert.equal(all.averageKmPerDay,30);assert.equal(all.estimatedDate,"2026-09-09");
  assert.equal(single.currentKm,300);assert.equal(single.averageKmPerDay,10);
});
test("a same-day interval and a distance-only legacy ride each contribute once",()=>{
  const same={...record,id:"same",at:"2026-08-30T16:00:00Z",odometerKm:430};
  const legacy={...ride,id:"legacy",distanceKm:60};
  const state=fixture({records:[record,same],rides:[ride,legacy]}).state;
  const forecast=g.forecastGoal(state,goal,now);
  assert.equal(forecast.currentKm,390);assert.equal(forecast.averageKmPerDay,13);
});
test("goals handle reached, empty, inactive, inconsistent and future history honestly",()=>{
  const state=fixture({records:[record]}).state;
  assert.equal(g.forecastGoal(state,{...goal,targetKm:300},now).status,"achieved");
  assert.equal(g.forecastGoal(fixture().state,goal,now).estimatedDate,null);
  const inactive={...state,wheel:[{...wheel,status:"sold"}]};
  assert.equal(g.forecastGoal(inactive,{...goal,wheelId:wheel.id},now).status,"inactive");
  assert.equal(g.forecastGoal(inactive,{...goal,wheelId:wheel.id},now).currentKm,300);
  const bad=fixture({records:[{...record,odometerKm:90}]}).state;
  assert.equal(g.forecastGoal(bad,goal,now).status,"invalid_history");
  assert.equal(g.forecastGoal(state,{...goal,wheelId:"missing"},now).status,"invalid_history");
  const future=fixture({records:[record,{...record,id:"future",at:"2026-08-31T12:00:00Z",odometerKm:10000}]}).state;
  assert.equal(g.forecastGoal(future,goal,now).currentKm,300);assert.equal(g.forecastGoal(future,goal,now).averageKmPerDay,10);
});
test("forecast window and ETA arithmetic remain calendar-based across DST",()=>{
  const state=fixture({wheels:[{...wheel,baselineDate:"2026-02-28"}],records:[{...record,at:"2026-03-30T12:00:00Z",odometerKm:400}]}).state;
  const forecast=g.forecastGoal(state,goal,new Date("2026-03-30T12:00:00Z"));
  assert.equal(forecast.averageKmPerDay,10);assert.equal(forecast.estimatedDate,"2026-04-09");
});
test("goals validate scope and positive targets, and protect referenced vehicles",()=>{
  const state=fixture({goals:[goal]}).state;
  for(const targetKm of [0,-1,Infinity,NaN])assert.throws(()=>d.goalSchema.parse({...goal,targetKm}));
  assert.throws(()=>d.validateEdit(state,"goal",{...goal,id:"duplicate"}),/already/);
  assert.throws(()=>d.validateEdit(state,"goal",{...goal,id:"missing",wheelId:"missing"}),/vehicle/i);
  assert.doesNotThrow(()=>d.validateEdit(state,"goal",{...goal,id:"vehicle-goal",wheelId:wheel.id}));
  assert.doesNotThrow(()=>d.validateDelete(fixture({goals:[{...goal,wheelId:wheel.id}]}).state,"wheel",wheel.id));
});
test("goals and unnamed rides survive exact JSON, XLSX and independent-device history recovery",async()=>{
  const {operations}=fixture({records:[record],rides:[ride],goals:[goal,{...goal,id:"single-goal",wheelId:wheel.id}]});
  const before=d.canonical(operations);
  assert.deepEqual(d.parseBackup(d.backup(operations)),operations);
  const book=await x.readXlsx(x.writeXlsx(x.exportWorkbook(operations)));
  assert.equal(book.Goals.length,3);assert.equal(book.Goals[1][2],"All vehicles");
  const recovered=await x.workbookImport(book,"Europe/Vilnius");
  assert.deepEqual(recovered.operations,operations);assert.equal(recovered.counts.goal,2);
  const first=ns(),replica=ns();
  await db.mergeOperations(first,operations,false);await db.mergeOperations(replica,operations,true);
  assert.deepEqual((await db.loadWorkspace(replica)).state.goal,(await db.loadWorkspace(first)).state.goal);
  assert.equal((await db.loadWorkspace(replica)).state.ride[0].name,"");
  assert.equal(d.canonical(operations),before);
  const broken=x.exportWorkbook(operations);broken.History=[broken.History[0]];for(const key of ["Wheels","Records","Rides"])delete broken[key];
  await assert.rejects(()=>x.workbookImport(broken,"UTC"),/missing recovery history/);
});
test("new goals queue for sync and deleting / undoing a goal does not touch rides",async()=>{
  const {operations}=fixture({records:[record],rides:[ride]}),space=ns();
  await db.mergeOperations(space,operations,true);
  await db.commit(space,"goal",goal,goal.id);
  const saved=await db.loadWorkspace(space);
  assert.equal(saved.pending.length,1);assert.equal(saved.state.goal[0].targetKm,400);
  const deletion=await db.commit(space,"goal",null,goal.id);
  assert.equal((await db.loadWorkspace(space)).state.goal.length,0);
  await db.commit(space,"goal",goal,goal.id,undefined,[deletion.id]);
  const restored=await db.loadWorkspace(space);
  assert.equal(restored.state.goal.length,1);assert.equal(restored.state.ride.length,1);assert.equal(restored.state.reading.length,1);
});
test("concurrent goal edits retain both versions instead of silently overwriting",()=>{
  const {operations,state}=fixture({goals:[goal]});
  const a=d.makeOperation(state,"phone",[change("goal",{...goal,targetKm:500})]);
  const b=d.makeOperation(state,"desktop",[change("goal",{...goal,targetKm:600})]);
  assert.equal(d.project([...operations,a,b]).conflicts[0].kind,"goal");
  assert.deepEqual(d.project([...operations,a,b]).goal,d.project([...operations,b,a]).goal);
});
test("equator progress uses all-time tracked km and bounds only the visual bar",()=>{
  const state=fixture({records:[{...record,odometerKm:wheel.baselineKm+40075}]}).state;
  assert.deepEqual(g.earthProgress(state),{totalKm:40075,percent:100,barPercent:100});
  const twice=fixture({records:[{...record,odometerKm:wheel.baselineKm+80150}]}).state;
  assert.deepEqual(g.earthProgress(twice),{totalKm:80150,percent:200,barPercent:100});
  assert.deepEqual(g.earthProgress(fixture().state),{totalKm:0,percent:0,barPercent:0});
});
