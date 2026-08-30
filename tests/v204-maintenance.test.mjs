import assert from "node:assert/strict";
import test from "node:test";
import {tsImport} from "tsx/esm/api";
import "fake-indexeddb/auto";
import {DOMParser} from "@xmldom/xmldom";
globalThis.DOMParser=DOMParser;
const d=await tsImport("../lib/kairo/domain.ts",import.meta.url);
const m=await tsImport("../lib/kairo/maintenance.ts",import.meta.url);
const stats=await tsImport("../lib/kairo/stats.ts",import.meta.url);
const x=await tsImport("../lib/kairo/excel.ts",import.meta.url);
const db=await tsImport("../lib/kairo/storage.ts",import.meta.url);
const {showLocalNotification}=await tsImport("../lib/kairo/notifications.ts",import.meta.url);
const wheel={id:"wheel-one",name:"Lynx-S",baselineKm:50,baselineDate:"2026-01-01",color:"#f16305",notes:""};
const other={...wheel,id:"wheel-other",name:"V8S",baselineKm:7000};
const gear={id:"gear-helmet",name:"Helmet",category:"helmet",status:"active",brand:"",model:"",size:"",purchasedOn:null,notes:""};
const reading=(id,at,odometerKm,wheelId=wheel.id)=>({id,wheelId,at:`${at}T12:00:00.000Z`,odometerKm,notes:""});
const change=(kind,value)=>({kind,value,entityId:value.id});
const starting=[change("wheel",wheel),change("wheel",other),change("gear",gear),change("reading",reading("old","2026-08-20",1286.6)),change("reading",reading("latest","2026-08-29",1346)),change("reading",reading("other-latest","2026-08-30",7936,other.id))];
const baseOp=d.makeOperation(d.project([]),"test-device",starting),state=d.project([baseOp]);
const options={targetKind:"wheel",targetId:wheel.id,day:"2026-08-30"};
const draft=(templateId="tire_pressure",extra={})=>m.createMaintenanceDraft(state,{...options,templateId,...extra});
const item=(templateId="tire_pressure",extra={})=>m.maintenanceFromDraft({...draft(templateId),...extra},"task-one");

test("maintenance catalog covers inspections, condition-based work, insurance and custom tasks in both languages",()=>{
  const templates=m.MAINTENANCE_TEMPLATES;
  assert.equal(templates.length,20);assert.equal(new Set(templates.map(t=>t.id)).size,20);
  for(const template of templates){assert.ok(template.title.en);assert.ok(template.title.lt);assert.ok(template.guidance.en);assert.ok(template.guidance.lt);assert.ok(d.MAINTENANCE_CATEGORIES.includes(template.category));}
  assert.equal(templates.filter(t=>t.group==="condition").length,5);
  assert.equal(m.maintenanceTemplate("not-known").id,"custom");
});
test("pressure defaults use the latest reading of the selected vehicle, plus 100 km and seven days",()=>{
  const value=draft();assert.equal(value.dueOdometer,"1446");assert.equal(value.dueDate,"2026-09-06");
  assert.equal(value.dateEnabled,true);assert.equal(value.mileageEnabled,true);assert.equal(value.repeatTime,"7");assert.equal(value.repeatUnit,"days");assert.equal(value.remindDays,"0");
  assert.equal(m.maintenanceOdometer(state,"wheel",other.id),7936);
});
test("suggested default distances and calendar intervals use the lower ends of the user's ranges",()=>{
  const expected={tire_tread:[1646,"2026-09-30"],rim:[1846,null],pedals:[1846,"2026-09-30"],fasteners_initial:[1446,null],fasteners:[1846,"2026-11-30"],bearings:[2346,"2026-11-30"],suspension_clean:[1546,null],suspension_function:[2346,"2026-11-30"],battery:[2346,"2026-11-30"],professional_inspection:[2346,"2027-08-30"]};
  for(const [id,[km,date]] of Object.entries(expected)){const schedule=m.suggestedMaintenanceSchedule(id,state,"wheel",wheel.id,"2026-08-30");assert.equal(schedule.dueOdometerKm,km,id);assert.equal(schedule.dueDate,date,id);}
});
test("date arithmetic clamps month ends, respects leap years, and uses calendar days through DST",()=>{
  assert.equal(m.addMaintenanceInterval("2026-01-31",{months:1}),"2026-02-28");
  assert.equal(m.addMaintenanceInterval("2028-01-31",{months:1}),"2028-02-29");
  assert.equal(m.addMaintenanceInterval("2028-02-29",{months:12}),"2029-02-28");
  assert.equal(m.addMaintenanceInterval("2026-11-30",{months:3}),"2027-02-28");
  assert.equal(m.addMaintenanceInterval("2026-03-28",{days:7}),"2026-04-04");
  assert.throws(()=>m.addMaintenanceInterval("2026-02-30",{months:1}),/valid date/);
});
test("without readings the selected vehicle baseline is used; missing targets never pretend to have zero mileage",()=>{
  const emptyReadings={...state,reading:[]};
  assert.equal(m.suggestedMaintenanceSchedule("tire_pressure",emptyReadings,"wheel",wheel.id,"2026-08-30").dueOdometerKm,150);
  assert.equal(m.suggestedMaintenanceSchedule("tire_pressure",state,"wheel","missing","2026-08-30").dueOdometerKm,null);
  assert.equal(m.maintenanceOdometer(state,"gear",gear.id),null);
});
test("condition, component and per-ride/per-charge templates do not invent date or mileage replacements",()=>{
  for(const id of ["tire_replacement","tube_valve_replacement","bearing_replacement","suspension_service","battery_repair","safety_check","charging_check"]){
    const value=draft(id),saved=m.maintenanceFromDraft(value,id);
    assert.equal(value.dateEnabled,false,id);assert.equal(value.mileageEnabled,false,id);assert.equal(value.repeatEnabled,false,id);
    assert.equal(saved.dueDate,null,id);assert.equal(saved.dueOdometerKm,null,id);assert.equal(saved.repeatKm,null,id);assert.equal(saved.repeatDays,null,id);
    assert.equal(stats.maintenanceStatus(saved,state,new Date("2026-08-30T12:00:00Z")),"planned");
  }
});
test("insurance enables Date without inventing expiry, preserves a 14-day lead and requires a real expiry",()=>{
  const value=draft("insurance");assert.equal(value.dateEnabled,true);assert.equal(value.dueDate,"");assert.equal(value.remindDays,"14");assert.equal(value.mileageEnabled,false);
  assert.throws(()=>m.maintenanceFromDraft(value,"insurance"),/Choose a due date/);
  const saved=m.maintenanceFromDraft({...value,dueDate:"2026-09-30"},"insurance");d.validateEdit(state,"maintenance",saved);
  assert.equal(saved.dueDate,"2026-09-30");assert.equal(saved.repeatMonths,null);
  assert.throws(()=>d.validateEdit(state,"maintenance",{...saved,dueDate:null,remindDaysBefore:null}),/expiry date/);
});
test("Date and Mileage checkboxes are independent and disabled reminders are not persisted or repeated",()=>{
  const initial=draft(),dateOnly=m.toggleMaintenanceReminder(initial,"mileage",false,state,"2026-08-30"),kmOnly=m.toggleMaintenanceReminder(initial,"date",false,state,"2026-08-30");
  const date=m.maintenanceFromDraft(dateOnly,"date"),km=m.maintenanceFromDraft(kmOnly,"km");
  assert.equal(date.dueOdometerKm,null);assert.equal(date.repeatKm,null);assert.equal(date.repeatDays,7);
  assert.equal(km.dueDate,null);assert.equal(km.remindDaysBefore,null);assert.equal(km.repeatDays,null);assert.equal(km.repeatMonths,null);assert.equal(km.repeatKm,100);
  const neither=m.maintenanceFromDraft(m.toggleMaintenanceReminder(kmOnly,"mileage",false,state),"neither");
  assert.equal(neither.repeatKm,null);assert.equal(neither.repeatDays,null);assert.equal(neither.dueDate,null);
});
test("re-enabling a reminder keeps manual edits and restores suggested values when blank",()=>{
  const manual={...draft(),dueDate:"2026-12-31",dueOdometer:"2000",dateEnabled:false,mileageEnabled:false};
  assert.equal(m.toggleMaintenanceReminder(manual,"date",true,state).dueDate,"2026-12-31");
  assert.equal(m.toggleMaintenanceReminder(manual,"mileage",true,state).dueOdometer,"2000");
  assert.equal(m.toggleMaintenanceReminder({...manual,dueDate:""},"date",true,state,"2026-08-30").dueDate,"2026-09-06");
});
test("choosing another vehicle recalculates its absolute odometer target without erasing date, title or notes",()=>{
  const initial={...draft(),dueDate:"2026-10-01",title:"My check",notes:"A note"};
  const next=m.retargetMaintenanceDraft(initial,state,"wheel",other.id);
  assert.equal(next.dueOdometer,"8036");assert.equal(next.dueDate,"2026-10-01");assert.equal(next.title,"My check");assert.equal(next.notes,"A note");
});
test("template changes reset only the suggested schedule and retain notes and completion choice",()=>{
  const initial={...draft(),notes:"Observed wear",completed:true,dateEnabled:false};
  const next=m.selectMaintenanceTemplate(initial,"bearings",state,"2026-08-30","lt");
  assert.equal(next.dueOdometer,"2346");assert.equal(next.dueDate,"2026-11-30");assert.equal(next.dateEnabled,true);assert.equal(next.title,"Variklio guolių būklės patikra");assert.equal(next.notes,"Observed wear");assert.equal(next.completed,true);
});
test("gear cannot store an odometer reminder and changing to vehicle-specific work selects a vehicle",()=>{
  const forGear=m.retargetMaintenanceDraft(draft(),state,"gear",gear.id);
  assert.equal(forGear.templateId,"custom");assert.equal(forGear.mileageEnabled,false);
  const noKm=m.toggleMaintenanceReminder(forGear,"mileage",true,state);assert.equal(noKm.mileageEnabled,false);
  const vehicleTask=m.selectMaintenanceTemplate(forGear,"tire_tread",state,"2026-08-30");assert.equal(vehicleTask.targetKind,"wheel");assert.ok(state.wheel.some(w=>w.id===vehicleTask.targetId));
  assert.throws(()=>d.validateEdit(state,"maintenance",{...item(),targetKind:"gear",targetId:gear.id}),/only target a vehicle/);
});
test("manual condition-based scheduling is possible without treating it as a manufacturer's replacement interval",()=>{
  const saved=m.maintenanceFromDraft({...draft("tire_replacement"),dateEnabled:true,dueDate:"2026-09-20",mileageEnabled:true,dueOdometer:"1600"},"replacement");
  d.validateEdit(state,"maintenance",saved);assert.equal(saved.templateId,"tire_replacement");assert.equal(saved.repeatKm,null);assert.equal(saved.repeatDays,null);assert.equal(saved.dueOdometerKm,1600);
});
test("reminders fire when EITHER date or mileage is reached; exceeding a threshold is overdue",()=>{
  const initial=item(),now=new Date("2026-08-30T12:00:00Z");
  assert.equal(stats.maintenanceStatus(initial,state,now),"upcoming");
  assert.equal(stats.maintenanceStatus({...initial,dueDate:"2026-08-30",dueOdometerKm:9999},state,now),"due");
  assert.equal(stats.maintenanceStatus({...initial,dueDate:"2027-01-01",dueOdometerKm:1346},state,now),"due");
  assert.equal(stats.maintenanceStatus({...initial,dueOdometerKm:1345},state,now),"overdue");
  assert.equal(stats.maintenanceStatus({...initial,dueDate:"2026-08-29"},state,now),"overdue");
  assert.equal(stats.maintenanceStatus({...initial,completedAt:now.toISOString()},state,now),"completed");
});
test("insurance reminder lead time and disabled mileage remain independent of high odometer readings",()=>{
  const saved=m.maintenanceFromDraft({...draft("insurance"),dueDate:"2026-09-10"},"insurance");
  assert.equal(stats.maintenanceStatus(saved,state,new Date("2026-08-26T12:00:00Z")),"upcoming");
  assert.equal(stats.maintenanceStatus(saved,state,new Date("2026-08-27T12:00:00Z")),"due");
});
test("late completion schedules the next check from actual completion and current odometer, not old targets",()=>{
  const completed={...item(),dueDate:"2026-06-01",dueOdometerKm:1200,completedAt:"2026-08-30T12:00:00.000Z"};
  const next=m.nextMaintenanceOccurrence(completed,state,"next");
  assert.equal(next.id,"next");assert.equal(next.dueDate,"2026-09-06");assert.equal(next.dueOdometerKm,1446);assert.equal(next.completedAt,null);assert.equal(next.repeatDays,7);
  assert.equal(completed.dueDate,"2026-06-01");assert.equal(completed.completedAt,"2026-08-30T12:00:00.000Z");
});
test("monthly recurrence clamps calendar dates and uses the newly selected vehicle's reading",()=>{
  const saved={...item("bearings"),targetId:other.id,completedAt:"2026-11-30T12:00:00.000Z"};
  const next=m.nextMaintenanceOccurrence(saved,state,"next");assert.equal(next.dueDate,"2027-02-28");assert.equal(next.dueOdometerKm,8936);assert.equal(next.repeatMonths,3);
});
test("initial fastener, condition and non-completed checks do not create unrequested successors",()=>{
  assert.equal(m.nextMaintenanceOccurrence(item(),state),null);
  assert.equal(m.nextMaintenanceOccurrence({...item("fasteners_initial"),completedAt:"2026-08-30T12:00:00Z"},state),null);
  assert.equal(m.nextMaintenanceOccurrence({...item("tire_replacement"),completedAt:"2026-08-30T12:00:00Z"},state),null);
});
test("turning off one reminder prevents it returning in the successor",()=>{
  const saved=m.maintenanceFromDraft({...draft(),dateEnabled:false,completed:true},"task",undefined,new Date("2026-08-30T12:00:00Z"));
  const next=m.nextMaintenanceOccurrence(saved,state,"next");assert.equal(next.dueDate,null);assert.equal(next.repeatDays,null);assert.equal(next.dueOdometerKm,1446);
});
test("explicit insurance recurrence retains its policy-expiry anchor instead of an early renewal day",()=>{
  const saved=m.maintenanceFromDraft({...draft("insurance"),dueDate:"2026-09-30",repeatEnabled:true,repeatTime:"12",repeatUnit:"months",completed:true},"policy",undefined,new Date("2026-09-15T12:00:00Z"));
  assert.equal(m.nextMaintenanceOccurrence(saved,state,"next").dueDate,"2027-09-30");
});
test("legacy maintenance records parse byte-for-byte without requiring new fields or changing saved targets",()=>{
  const legacy={id:"old-task",title:"My earlier tire check",category:"tire_tread",targetKind:"wheel",targetId:wheel.id,dueDate:"2026-12-10",dueOdometerKm:4000,remindDaysBefore:5,repeatKm:600,repeatMonths:2,completedAt:null,notes:"Keep this"};
  const op=d.makeOperation(state,"old-device",[change("maintenance",legacy)]),parsed=d.parseOperation(op);
  assert.equal(d.canonical(parsed),d.canonical(op));assert.deepEqual(parsed.changes[0].value,legacy);assert.equal(Object.hasOwn(parsed.changes[0].value,"repeatDays"),false);
  const edit=m.createMaintenanceDraft(state,{item:legacy,day:"2026-08-30"});assert.equal(edit.dueDate,"2026-12-10");assert.equal(edit.dueOdometer,"4000");assert.equal(edit.title,legacy.title);assert.equal(edit.repeatKm,"600");assert.equal(edit.repeatTime,"2");
});
test("invalid weekly intervals, zero repeats, missing targets and invalid reminder dates are rejected",()=>{
  const saved=item();
  for(const repeatDays of [0,-1,1.5,36501])assert.throws(()=>d.maintenanceSchema.parse({...saved,repeatDays}));
  assert.throws(()=>d.validateEdit(state,"maintenance",{...saved,repeatMonths:1}),/not both/);
  assert.throws(()=>d.validateEdit(state,"maintenance",{...saved,repeatKm:0}),/greater than zero/);
  assert.throws(()=>d.validateEdit(state,"maintenance",{...saved,targetId:"missing"}),/existing vehicle/);
  assert.throws(()=>d.maintenanceSchema.parse({...saved,dueDate:"2026-02-30"}));
  assert.throws(()=>m.maintenanceFromDraft({...draft(),dueOdometer:""},"bad"),/Due odometer/);
  assert.throws(()=>m.maintenanceFromDraft({...draft(),repeatTime:"",repeatKm:""},"bad"),/repeat interval/);
});
test("completion and successor are persisted together and reload with their new optional fields",async()=>{
  const namespace=`maintenance-atomic-${crypto.randomUUID()}`;
  await db.commitChanges(namespace,starting);
  await db.commit(namespace,"maintenance",item(),"task-one");
  const before=await db.loadWorkspace(namespace),completed={...before.state.maintenance[0],completedAt:"2026-08-30T12:00:00Z"},next=m.nextMaintenanceOccurrence(completed,before.state,"next");
  const op=await db.commitChanges(namespace,[change("maintenance",completed),change("maintenance",next)]);
  assert.equal(op.changes.length,2);const restored=await db.loadWorkspace(namespace);assert.equal(restored.state.maintenance.length,2);
  assert.equal(restored.state.maintenance.find(task=>task.id==="next").repeatDays,7);assert.equal(restored.state.maintenance.find(task=>task.id==="task-one").completedAt,completed.completedAt);
});
test("JSON and Excel history round-trips preserve weekly schedules, reminder flags and original records",async()=>{
  const saved=item(),op=d.makeOperation(state,"device-a",[change("maintenance",saved)]),operations=[baseOp,op];
  assert.deepEqual(d.parseBackup(d.backup(operations)),operations);
  const book=await x.readXlsx(x.writeXlsx(x.exportWorkbook(operations))),imported=await x.workbookImport(book,"UTC");
  assert.deepEqual(imported.operations,operations);assert.deepEqual(d.project(imported.operations).maintenance[0],saved);
  const header=book.Maintenance[0],row=book.Maintenance[1];assert.equal(row[header.indexOf("Repeat days")],7);assert.equal(row[header.indexOf("Template ID")],"tire_pressure");assert.equal(row[header.indexOf("Due odometer km")],1446);
  assert.equal(row[header.indexOf("Date reminder enabled")],"true");assert.equal(row[header.indexOf("Mileage reminder enabled")],"true");
});
test("simultaneous maintenance edits retain conflicts instead of overwriting one device's targets",()=>{
  const saved=item(),initial=d.makeOperation(state,"first",[change("maintenance",saved)]),current=d.project([baseOp,initial]);
  const a=d.makeOperation(current,"device-a",[change("maintenance",{...saved,dueDate:"2026-09-20"})]);
  const b=d.makeOperation(current,"device-b",[change("maintenance",{...saved,dueOdometerKm:1600})]);
  const combined=d.project([baseOp,initial,a,b]);assert.equal(combined.conflicts.length,1);assert.equal(combined.conflicts[0].kind,"maintenance");assert.equal(combined.conflicts[0].revisions.length,2);
});
test("mobile reminders prefer the active service worker instead of the unsupported Notification constructor",async()=>{
  const sent=[],platform={permission:()=>"granted",registration:async()=>({showNotification:async(title,options)=>{sent.push({title,options});}}),create:()=>{throw new Error("Mobile Notification constructor must not be called");}};
  const options={body:"Inspect tire",tag:"maintenance-one"};
  assert.equal(await showLocalNotification("Kairo Ride",options,()=>true,platform),true);assert.deepEqual(sent,[{title:"Kairo Ride",options}]);
});
test("notification failures and permission denial do not crash the app or count as successful delivery",async()=>{
  assert.equal(await showLocalNotification("Test",{},()=>true,{permission:()=>"denied",create:()=>{throw new Error("Must not show");}}),false);
  assert.equal(await showLocalNotification("Test",{},()=>true,{permission:()=>"granted",registration:async()=>({showNotification:async()=>{throw new Error("Not supported");}})}),false);
  assert.equal(await showLocalNotification("Test",{},()=>true,{permission:()=>"granted",create:()=>{throw new Error("Constructor unsupported");}}),false);
});
test("switching accounts or hiding the app while the worker is found cancels the old notification",async()=>{
  let active=true;const platform={permission:()=>"granted",registration:async()=>{active=false;return {showNotification:async()=>{throw new Error("Stale notification");}};}};
  assert.equal(await showLocalNotification("Test",{},()=>active,platform),false);
});
test("desktop notifications can fall back without a worker and a revoked permission is respected",async()=>{
  let count=0;const platform={permission:()=>"granted",registration:async()=>undefined,create:()=>count++};
  assert.equal(await showLocalNotification("Test",{},()=>true,platform),true);assert.equal(count,1);
  let granted=true;const revoked={permission:()=>granted?"granted":"denied",registration:async()=>{granted=false;return undefined;},create:()=>count++};
  assert.equal(await showLocalNotification("Test",{},()=>true,revoked),false);assert.equal(count,1);
});
