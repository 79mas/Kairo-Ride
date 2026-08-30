import assert from "node:assert/strict";
import test,{after} from "node:test";
import {readFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {createServer} from "vite";
import {toast} from "sonner";

const root=fileURLToPath(new URL("..",import.meta.url));
const vite=await createServer({appType:"custom",configFile:false,root,resolve:{alias:{"@":root}},server:{middlewareMode:true,ws:false}});
after(async()=>{await vite.close();});
const d=await vite.ssrLoadModule("/lib/kairo/domain.ts");
const {EntityForm,titles}=await vite.ssrLoadModule("/components/kairo/forms.tsx");
const {DashboardHero,MainViews}=await vite.ssrLoadModule("/components/kairo/views.tsx");
const {Tabs}=await vite.ssrLoadModule("/components/ui/tabs.tsx");
const {VehicleReminderList,VehicleStatusBadge,notifyVehicleMaintenance}=await vite.ssrLoadModule("/components/kairo/vehicle-status.tsx");
const wheel={id:"wheel-ui",name:"Lynx-S",baselineKm:100,baselineDate:"2026-01-01",color:"#f16305",notes:""};
const record={id:"record-ui",wheelId:wheel.id,at:"2026-08-29T12:00:00.000Z",odometerKm:180,notes:"Saved archive"};
const ride={id:record.id,name:"Archive ride",wheelId:wheel.id,at:record.at,tripId:null,distanceKm:80,notes:""};
const change=(kind,value)=>({kind,value,entityId:value.id});
const fixture=(wheels=[wheel],records=[])=>d.project([d.makeOperation(d.project([]),"ui-device",[...wheels.map(w=>change("wheel",w)),...records.map(r=>change("reading",r))])]);
const noop=()=>{};
const copy={tr:en=>en,locale:"en-US"};
const form=(state,editor={kind:"ride"})=>renderToStaticMarkup(React.createElement(EntityForm,{state,editor:{parents:[],namespace:"local",...editor},busy:false,onSave:async()=>{},onCancel:noop}));

test("Garage renders six labelled, editable statuses without hiding archive vehicles",()=>{
  const wheels=d.WHEEL_STATUSES.map(status=>({...wheel,id:status,name:`Vehicle ${status}`,status,statusNote:status==="attention"?"Inspect tire":""}));
  const state=fixture(wheels);
  const html=renderToStaticMarkup(React.createElement(Tabs,{value:"wheels"},React.createElement(MainViews,{state,actions:{openEditor:noop,openRide:noop,askDelete:noop,setDetail:noop},setView:noop,openStorage:noop})));
  for(const w of wheels){
    assert.ok(html.includes(`aria-label="Change status for: ${w.name}"`),`Editable badge for ${w.name}`);
    assert.ok(html.includes(`vehicle-status-${w.status}`));
    assert.ok(html.includes(d.wheelStatusLabels[w.status]));
  }
  assert.equal((html.match(/Archive kept · new records disabled/g)??[]).length,3);
  assert.match(html,/>Records</);assert.doesNotMatch(html,/>Readings</);
});

test("new-record form skips inactive vehicles and disables Save when none are eligible",()=>{
  const inactive={...wheel,status:"critical"},spare={...wheel,id:"spare",name:"Spare wheel",status:"spare"};
  const html=form(fixture([inactive,spare]));
  assert.doesNotMatch(html,/class="[^"]*record-status-warning/);
  assert.doesNotMatch(html,/<button[^>]*type="submit"[^>]*disabled/);
  const blocked=form(fixture([inactive]));
  assert.ok(/class="[^"]*record-status-warning/.test(blocked),"No eligible vehicle produces a clear alert");
  assert.match(blocked,/<button[^>]*type="submit"[^>]*disabled/);
  assert.equal(titles.reading,"Odometer record");
});

test("archived inactive record remains editable in the same Ride form",()=>{
  const state=fixture([{...wheel,status:"sold"}],[record]);
  const html=form(state,{kind:"ride",reading:record});
  assert.match(html,/archived record/i);
  assert.doesNotMatch(html,/<button[^>]*type="submit"[^>]*disabled/);
  const withRide={...state,ride:[ride]};
  assert.doesNotMatch(form(withRide,{kind:"ride",entity:ride,reading:record}),/<button[^>]*type="submit"[^>]*disabled/);
});

test("vehicle editor exposes Status dropdown and a manual Active! reminder",()=>{
  const w={...wheel,status:"attention",statusNote:"Inspect tire first"},state=fixture([w]);
  const html=form(state,{kind:"wheel",entity:w});
  assert.match(html,/role="combobox"[^>]*aria-label="Vehicle status"/);
  assert.match(html,/Maintenance reminder/);
  assert.match(html,/Inspect tire first/);
  assert.match(html,/required=""/);
  assert.match(html,/automatically/i);
  assert.match(html,/manually/i);
});

test("Hero labels the four secondary stats between two borders without filtering its main average",async()=>{
  const other={...wheel,id:"other",name:"Second wheel"},state=fixture([wheel,other],[record,{...record,id:"second-record",wheelId:other.id,odometerKm:160}]);
  const previous=Object.getOwnPropertyDescriptor(globalThis,"localStorage");
  try{
    let selection="all";
    Object.defineProperty(globalThis,"localStorage",{configurable:true,value:{getItem:key=>key==="kairo-dashboard-wheel"?selection:null,setItem:noop}});
    const all=renderToStaticMarkup(React.createElement(DashboardHero,{state}));
    assert.match(all,/<div class="hero-vehicle-scope" aria-live="polite">All vehicles<\/div>/);
    selection=wheel.id;
    const selected=renderToStaticMarkup(React.createElement(DashboardHero,{state}));
    assert.match(selected,/<div class="hero-vehicle-scope" aria-live="polite">Lynx-S<\/div>/);
    const main=html=>html.match(/class="hero-primary">([\s\S]*?)<\/div>/)[1];
    assert.equal(main(all),main(selected));
    assert.match(all,/140 km/);assert.match(selected,/80 km/);
    selection="removed-wheel";
    assert.match(renderToStaticMarkup(React.createElement(DashboardHero,{state})),/aria-live="polite">All vehicles<\/div>/);
  }finally{
    if(previous)Object.defineProperty(globalThis,"localStorage",previous);else delete globalThis.localStorage;
  }
  const css=await readFile(new URL("../app/globals.css",import.meta.url),"utf8");
  assert.match(css,/\.hero-vehicle-scope\s*\{[^}]*border-top:1px[^}]*border-bottom:1px/);
});

test("maintenance popup contains the wheel, actual tasks, deadline and odometer threshold",()=>{
  const task={id:"task-ui",title:"Inspect bearings <script>",dueDate:"2026-09-01",dueOdometerKm:1346};
  const reminders=[{wheel,tasks:[task],note:"Stop if you hear unusual noise"}];
  const html=renderToStaticMarkup(React.createElement(VehicleReminderList,{reminders,...copy}));
  assert.match(html,/Lynx-S/);assert.match(html,/Stop if you hear unusual noise/);
  assert.match(html,/Inspect bearings &lt;script&gt;/);assert.doesNotMatch(html,/<script>/);
  assert.match(html,/Due:/);assert.match(html,/Odometer: 1,346 km/);
  const flagged={...wheel,status:"attention",statusNote:"Inspect tire"};
  assert.match(renderToStaticMarkup(React.createElement(VehicleStatusBadge,{wheel:flagged,state:fixture([flagged])})),/>Active!</);
});

test("each Garage or new-record event can show the reminder again without notification permission",()=>{
  const warning=toast.warning,dismiss=toast.dismiss,calls=[],dismissed=[];
  toast.warning=(title,options)=>{calls.push({title,...options});return options.id;};
  toast.dismiss=id=>{dismissed.push(id);return id;};
  try{
    const reminders=[{wheel,tasks:[],note:"Inspect tire"}];
    notifyVehicleMaintenance(reminders,copy,"garage");
    notifyVehicleMaintenance(reminders,copy,"garage");
    notifyVehicleMaintenance(reminders,copy,"record");
    assert.equal(calls.length,3);
    assert.equal(calls[0].id,calls[1].id,"Repeated events replace rather than stack old reminders");
    assert.notEqual(calls[0].id,calls[2].id);
    assert.equal(calls[0].duration,15000);assert.equal(calls[0].closeButton,true);
    notifyVehicleMaintenance([],copy,"record");
    assert.deepEqual(dismissed,["kairo-vehicle-maintenance-record"]);
  }finally{toast.warning=warning;toast.dismiss=dismiss;}
});

test("Garage navigation and new-record vehicle selection are wired to maintenance reminders",async()=>{
  const app=await readFile(new URL("../components/kairo/app.tsx",import.meta.url),"utf8");
  const forms=await readFile(new URL("../components/kairo/forms.tsx",import.meta.url),"utf8");
  const fields=await readFile(new URL("../components/kairo/form-fields.tsx",import.meta.url),"utf8");
  assert.match(app,/if\(next==="wheels"\)notifyVehicleMaintenance\(garageReminders\(state\)/);
  assert.ok(/onValueChange=\{v=>changeView\(v as View\)\}/.test(app),"Tabs route through the reminder-aware handler");
  assert.match(app,/!ride&&!reading&&!prepareNewRecord\(\)/);
  assert.match(forms,/function selectVehicle\(next:string\)[\s\S]*?notifyVehicleMaintenance/);
  assert.match(fields,/disabled=\{o\.disabled\}/);
});

test("Settings contains the requested feedback address and an independent in-app-reminder explanation",async()=>{
  const settings=await readFile(new URL("../components/kairo/storage-panel.tsx",import.meta.url),"utf8");
  assert.match(settings,/href="mailto:kairosbytomas@gmail.com"/);
  assert.match(settings,/feedback, comments and suggestions/);
  assert.match(settings,/Pastabų, komentarų ir pasiūlymų/);
  assert.match(settings,/do not require notification permission/);
});
