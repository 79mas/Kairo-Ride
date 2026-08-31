import assert from "node:assert/strict";
import test from "node:test";
import {readFile} from "node:fs/promises";
import {tsImport} from "tsx/esm/api";
import "fake-indexeddb/auto";
import {DOMParser} from "@xmldom/xmldom";

globalThis.DOMParser=DOMParser;
const d=await tsImport("../lib/kairo/domain.ts",import.meta.url);
const v=await tsImport("../lib/kairo/vehicle-status.ts",import.meta.url);
const db=await tsImport("../lib/kairo/storage.ts",import.meta.url);
const x=await tsImport("../lib/kairo/excel.ts",import.meta.url);
const stats=await tsImport("../lib/kairo/stats.ts",import.meta.url);
const now=new Date("2026-08-30T12:00:00Z");
const wheel={id:"wheel-205",name:"Lynx-S",baselineKm:100,baselineDate:"2026-01-01",color:"#f16305",notes:"Original notes"};
const record={id:"record-205",wheelId:wheel.id,at:"2026-08-29T12:00:00.000Z",odometerKm:180,notes:"Archive note"};
const ride={id:record.id,wheelId:wheel.id,at:record.at,name:"Saved ride",tripId:null,distanceKm:80,notes:"Ride note"};
const maintenance={id:"task-205",title:"Check bearings",category:"bearings",targetKind:"wheel",targetId:wheel.id,dueDate:"2026-08-30",dueOdometerKm:null,remindDaysBefore:0,repeatKm:null,repeatMonths:null,completedAt:null,notes:"Inspect unusual noise"};
const change=(kind,value)=>({kind,value,entityId:value.id});
const history=(w=wheel,tasks=[],archive=true)=>[d.makeOperation(d.project([]),"device-205",[
  change("wheel",w),...(archive?[change("reading",record),change("ride",ride)]:[]),...tasks.map(m=>change("maintenance",m)),
])];
const stateFor=(w=wheel,tasks=[],archive=true)=>d.project(history(w,tasks,archive));
const namespace=()=>`v205-${crypto.randomUUID()}`;

test("2.0.5 keeps legacy wheel operations byte-for-byte equivalent without injecting status defaults",()=>{
  const ops=history(),before=d.canonical(ops),restored=d.parseBackup(d.backup(ops)),state=d.project(restored);
  assert.equal(d.canonical(restored),before);
  assert.equal(Object.hasOwn(state.wheel[0],"status"),false);
  assert.equal(Object.hasOwn(state.wheel[0],"statusNote"),false);
  assert.equal(d.storedWheelStatus(state.wheel[0]),"active");
  assert.equal(d.canRecordWithWheel(state.wheel[0]),true);
  assert.equal(d.SCHEMA_VERSION,1);
  assert.equal(d.wheelStats(state.wheel[0],state.reading).trackedKm,80);
});

test("all six vehicle statuses and reminder notes survive JSON and actual XLSX recovery",async()=>{
  assert.deepEqual(d.WHEEL_STATUSES,["active","attention","critical","in_repair","spare","sold"]);
  for(const status of d.WHEEL_STATUSES){
    const w={...wheel,status,statusNote:"Check the tire before riding"};
    const ops=history(w),book=await x.readXlsx(x.writeXlsx(x.exportWorkbook(ops)));
    const recovered=await x.workbookImport(book,"UTC");
    assert.deepEqual(recovered.operations,ops,status);
    assert.deepEqual(d.parseBackup(d.backup(ops)),ops,status);
    const exported=book.Wheels[1];
    assert.equal(exported[6],d.wheelStatusLabels[status]);
    assert.equal(exported[7],d.wheelStatusLabels[status]);
    assert.equal(exported[8],w.statusNote);
    assert.ok(book.Records);assert.equal(book.Readings,undefined);
  }
  assert.throws(()=>d.wheelSchema.parse({...wheel,status:"broken"}));
});

test("Records replaces the Excel report label but earlier Readings workbooks still recover",async()=>{
  const ops=history(),book=x.exportWorkbook(ops);
  book.Readings=book.Records;delete book.Records;
  assert.deepEqual((await x.workbookImport(book,"UTC")).operations,ops);
  const broken=x.exportWorkbook(ops);broken.History=[broken.History[0]];delete broken.Wheels;delete broken.Rides;
  await assert.rejects(()=>x.workbookImport(broken,"UTC"),/missing recovery history/);
});

test("Active, Active! and Spare accept new records; inactive statuses reject both record kinds",()=>{
  for(const status of d.WHEEL_STATUSES){
    const state=stateFor({...wheel,status,statusNote:"Inspect tire"}),allowed=["active","attention","spare"].includes(status);
    assert.equal(d.canRecordWithWheel(state.wheel[0]),allowed);
    for(const [kind,value] of [["ride",{...ride,id:"new-ride"}],["reading",{...record,id:"new-record",at:"2026-08-30T12:00:00.000Z",odometerKm:190}]]){
      if(allowed)assert.doesNotThrow(()=>d.validateEdit(state,kind,value),status);
      else assert.throws(()=>d.validateEdit(state,kind,value),/New records are disabled/,status);
    }
  }
  assert.equal(d.canRecordWithWheel(undefined),false);
  assert.throws(()=>d.validateRecordTarget(d.project([]),ride),/Add a vehicle first/);
});

test("inactive vehicles retain archive totals, editable records and legacy record enrichment",()=>{
  for(const status of ["critical","in_repair","sold"]){
    const state=stateFor({...wheel,status});
    assert.equal(state.ride.length,1);assert.equal(state.reading.length,1);
    assert.equal(stats.metricDistance(state,"all"),80);
    assert.equal(stats.rideEntries(state).length,1);
    assert.doesNotThrow(()=>d.validateEdit(state,"ride",{...ride,notes:"Updated archive note"}));
    assert.doesNotThrow(()=>d.validateEdit(state,"reading",{...record,notes:"Corrected note"}));
    assert.doesNotThrow(()=>d.validateEdit({...state,ride:[]},"ride",ride),"Adding ride details to a legacy archive record");
    assert.doesNotThrow(()=>d.validateEdit({...state,reading:[]},"reading",record),"Adding odometer details to a saved ride");
    const other={...wheel,id:"other-wheel",status:"sold"};
    assert.throws(()=>d.validateEdit({...state,wheel:[...state.wheel,other]},"ride",{...ride,wheelId:other.id}),/New records are disabled/);
  }
});

test("blocked new records are rejected atomically by storage, including a newly-created trip",async()=>{
  for(const status of ["critical","in_repair","sold"]){
    const ns=namespace(),w={...wheel,status};
    await db.commit(ns,"wheel",w,w.id);
    const trip={id:"trip-205",name:"New trip",startDate:"2026-08-30",endDate:"2026-08-30",notes:""};
    await assert.rejects(()=>db.commitChanges(ns,[change("trip",trip),change("ride",{...ride,id:"new",tripId:trip.id})]),/New records are disabled/);
    await assert.rejects(()=>db.commit(ns,"reading",{...record,id:"new-record"},"new-record"),/New records are disabled/);
    const saved=await db.loadWorkspace(ns);
    assert.equal(saved.operations.length,1);assert.equal(saved.state.trip.length,0);
    assert.equal(saved.state.ride.length,0);assert.equal(saved.state.reading.length,0);
  }
});

test("a form opened before another tab marks its wheel Critical cannot commit a new record",async()=>{
  const ns=namespace();await db.commit(ns,"wheel",wheel,wheel.id);
  const old=(await db.loadWorkspace(ns)).state;
  const stale=d.makeOperation(old,"stale-tab",[change("ride",ride)]);
  await db.commit(ns,"wheel",{...wheel,status:"critical"},wheel.id);
  await assert.rejects(()=>db.storeOperation(ns,stale),/New records are disabled/);
  assert.equal((await db.loadWorkspace(ns)).state.ride.length,0);
});

test("new vehicle plus record remains atomic and allowed for Active and Spare",async()=>{
  for(const status of ["active","attention","spare"]){
    const ns=namespace(),w={...wheel,status,statusNote:"Inspect before ride"};
    await db.commitChanges(ns,[change("wheel",w),change("ride",ride),change("reading",record)]);
    const saved=await db.loadWorkspace(ns);
    assert.equal(saved.operations.length,1);assert.equal(saved.state.ride.length,1);assert.equal(saved.state.reading.length,1);
  }
});

test("sync and recovery merge inactive vehicle archives without loss or false duplicate IDs",async()=>{
  const ns=namespace(),base=history(),before=d.project(base);
  const inactive=d.makeOperation(before,"device-b",[change("wheel",{...wheel,status:"sold"})]);
  await db.mergeOperations(ns,[...base,inactive],true);
  await db.mergeOperations(ns,d.parseBackup(d.backup([...base,inactive])),true);
  let saved=await db.loadWorkspace(ns);
  assert.equal(saved.operations.length,2);assert.equal(saved.state.wheel[0].status,"sold");
  assert.equal(saved.state.ride.length,1);assert.equal(saved.pending.length,0);
  await db.commit(ns,"ride",{...ride,notes:"Edited while archived"},ride.id);
  saved=await db.loadWorkspace(ns);
  assert.equal(saved.state.ride[0].notes,"Edited while archived");
  assert.equal(saved.state.reading.length,1);
});

test("undo restores a deleted historical record for an inactive wheel without enabling new ones",async()=>{
  const ns=namespace();await db.mergeOperations(ns,history({...wheel,status:"critical"}),true);
  await db.commitChanges(ns,[{kind:"ride",entityId:ride.id,value:null},{kind:"reading",entityId:record.id,value:null}]);
  assert.equal((await db.loadWorkspace(ns)).state.ride.length,0);
  await db.commitChanges(ns,[change("ride",ride),change("reading",record)]);
  assert.equal((await db.loadWorkspace(ns)).state.ride.length,1);
  await assert.rejects(()=>db.commit(ns,"ride",{...ride,id:"not-historical"},"not-historical"),/New records are disabled/);
});

test("reactivating an inactive vehicle restores entry without rewriting its archive",async()=>{
  const ns=namespace(),ops=history({...wheel,status:"in_repair"});
  await db.mergeOperations(ns,ops,true);
  await db.commit(ns,"wheel",{...wheel,status:"active"},wheel.id);
  await db.commit(ns,"ride",{...ride,id:"after-repair"},"after-repair");
  const saved=await db.loadWorkspace(ns);
  assert.equal(saved.state.ride.length,2);
  assert.equal(d.canonical(saved.operations.find(op=>op.id===ops[0].id)),d.canonical(ops[0]));
});

test("Active! requires either a meaningful manual note or an unfinished maintenance task",()=>{
  const flagged={...wheel,status:"attention",statusNote:"   "};
  assert.throws(()=>d.validateEdit(stateFor(), "wheel",flagged),/reminder note/);
  assert.doesNotThrow(()=>d.validateEdit(stateFor(),"wheel",{...flagged,statusNote:"Inspect tire damage"}));
  assert.doesNotThrow(()=>d.validateEdit(stateFor(wheel,[maintenance]),"wheel",flagged));
  assert.throws(()=>d.validateEdit(stateFor(wheel,[{...maintenance,completedAt:now.toISOString()}]),"wheel",flagged),/reminder note/);
});

test("status changes still work if imported odometer history already needs correction",()=>{
  const state={...stateFor(),reading:[{...record,odometerKm:90}]};
  assert.equal(d.wheelStats(wheel,state.reading).trackedKm,null);
  assert.doesNotThrow(()=>d.validateEdit(state,"wheel",{...wheel,status:"critical"}));
  assert.throws(()=>d.validateEdit(state,"wheel",{...wheel,status:"critical",baselineKm:110}),/odometer sequence/);
  assert.throws(()=>d.validateEdit(state,"reading",{...record,odometerKm:90}),/odometer sequence/);
});

test("due date, reminder lead time and reached odometer automatically flag active vehicles",()=>{
  const dueTasks=[
    maintenance,
    {...maintenance,dueDate:"2026-09-06",remindDaysBefore:7},
    {...maintenance,dueDate:null,remindDaysBefore:null,dueOdometerKm:180},
    {...maintenance,dueDate:"2026-09-30",dueOdometerKm:170},
  ];
  for(const status of ["active","spare"]){
    for(const task of dueTasks){
      const w={...wheel,status},state=stateFor(w,[task]);
      assert.equal(v.effectiveWheelStatus(w,state,now),"attention");
      assert.equal(v.vehicleReminder(w,state,now).tasks[0].id,task.id);
      assert.equal(d.canRecordWithWheel(w),true);
    }
  }
});

test("future, completed and unrelated maintenance do not flag a normal wheel",()=>{
  const tasks=[
    {...maintenance,id:"future",dueDate:"2026-10-01"},
    {...maintenance,id:"done",completedAt:now.toISOString()},
    {...maintenance,id:"other",targetId:"another-wheel"},
    {...maintenance,id:"gear",targetKind:"gear"},
    {...maintenance,id:"unscheduled",dueDate:null,remindDaysBefore:null,dueOdometerKm:null},
    {...maintenance,id:"nearby",dueDate:null,remindDaysBefore:null,dueOdometerKm:200},
  ];
  const state=stateFor(wheel,tasks);
  assert.equal(v.effectiveWheelStatus(wheel,state,now),"active");
  assert.equal(v.vehicleReminder(wheel,state,now),null);
  assert.deepEqual(v.garageReminders(state,now),[]);
});

test("completing the due task clears automatic Active! back to its stored Active or Spare state",()=>{
  for(const status of ["active","spare"]){
    const w={...wheel,status},state=stateFor(w,[maintenance]);
    assert.equal(v.effectiveWheelStatus(w,state,now),"attention");
    const done={...state,maintenance:[{...maintenance,completedAt:now.toISOString()}]};
    assert.equal(v.effectiveWheelStatus(w,done,now),status);
    assert.equal(w.status,status);
  }
});

test("maintenance never reactivates a Critical, In repair or Sold vehicle",()=>{
  for(const status of ["critical","in_repair","sold"]){
    const w={...wheel,status},state=stateFor(w,[maintenance]);
    assert.equal(v.effectiveWheelStatus(w,state,now),status);
    assert.equal(v.vehicleReminder(w,state,now),null);
    assert.equal(d.canRecordWithWheel(w),false);
  }
});

test("manual Active! shows its note and all open tasks in urgency order",()=>{
  const w={...wheel,status:"attention",statusNote:" Inspect before use "};
  const tasks=[
    {...maintenance,id:"future",dueDate:"2026-10-01"},
    {...maintenance,id:"done",completedAt:now.toISOString()},
    {...maintenance,id:"overdue",dueDate:"2026-08-29"},
    {...maintenance,id:"today"},
  ];
  const state=stateFor(w,tasks),reminder=v.vehicleReminder(w,state,now);
  assert.equal(reminder.note,"Inspect before use");
  assert.deepEqual(reminder.tasks.map(m=>m.id),["overdue","today","future"]);
  assert.equal(v.garageReminders(state,now).length,1);
  const done={...state,maintenance:[]};
  assert.equal(v.effectiveWheelStatus(w,done,now),"attention","Manual flag stays until explicitly changed");
});

test("exported current status explains automatic attention without rewriting the saved status",()=>{
  const ops=history({...wheel,status:"spare"},[{...maintenance,dueDate:"2000-01-01"}]);
  const before=d.canonical(ops),book=x.exportWorkbook(ops);
  assert.equal(book.Wheels[1][6],"Active!");assert.equal(book.Wheels[1][7],"Spare");
  assert.equal(d.canonical(ops),before);
});

test("record labels and the current patch version are consistent across package, lockfile and UI",async()=>{
  const pkg=JSON.parse(await readFile(new URL("../package.json",import.meta.url),"utf8"));
  const lock=JSON.parse(await readFile(new URL("../package-lock.json",import.meta.url),"utf8"));
  const app=await readFile(new URL("../components/kairo/app.tsx",import.meta.url),"utf8");
  assert.equal(pkg.version,"2.0.8");assert.equal(lock.version,"2.0.8");assert.equal(lock.packages[""].version,"2.0.8");
  assert.match(app,/<small>2\.0\.8<\/small>/);
  const state=stateFor();const bad=d.wheelStats(wheel,[{...record,odometerKm:90}]);
  assert.match(bad.intervals[0].warning,/record/);assert.doesNotMatch(bad.intervals[0].warning,/reading/i);
  assert.throws(()=>d.validateEdit(state,"reading",{...record,odometerKm:90}),/record breaks/);
});
