import assert from "node:assert/strict";
import test,{after} from "node:test";
import {readFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {createServer} from "vite";

const root=fileURLToPath(new URL("..",import.meta.url));
const vite=await createServer({appType:"custom",configFile:false,root,resolve:{alias:{"@":root}},server:{middlewareMode:true,ws:false}});
after(async()=>{await vite.close();});
const d=await vite.ssrLoadModule("/lib/kairo/domain.ts");
const calendar=await vite.ssrLoadModule("/lib/kairo/calendar.ts");
const {LanguageProvider}=await vite.ssrLoadModule("/lib/kairo/i18n.tsx");
const {EntityForm}=await vite.ssrLoadModule("/components/kairo/forms.tsx");
const {DateInput,DateTimeInput}=await vite.ssrLoadModule("/components/kairo/date-input.tsx");
const {MainViews}=await vite.ssrLoadModule("/components/kairo/views.tsx");
const {AnalyticsView}=await vite.ssrLoadModule("/components/kairo/history-charts.tsx");
const {GoalForecasts,EarthProgress}=await vite.ssrLoadModule("/components/kairo/goals.tsx");
const {Tabs}=await vite.ssrLoadModule("/components/ui/tabs.tsx");
const wheel={id:"wheel-ui206",name:"Lynx-S",baselineKm:100,baselineDate:"2026-07-31",color:"#f16305",notes:""};
const record={id:"ride-ui206",wheelId:wheel.id,at:"2026-08-30T12:00:00.000Z",odometerKm:400,notes:""};
const ride={id:record.id,wheelId:wheel.id,at:record.at,name:"",tripId:null,distanceKm:null,notes:""};
const gear={id:"helmet",name:"My helmet",category:"helmet",status:"active",brand:"Brand",model:"Model",size:"L",purchasedOn:"2026-08-01",usedWithGearIds:[],notes:"My notes"};
const noop=()=>{},actions={openEditor:noop,openRide:noop,askDelete:noop,setDetail:noop,addGoal:async()=>{}};
const change=(kind,value)=>({kind,value,entityId:value.id});
const fixture=(changes=[change("wheel",wheel)])=>d.project([d.makeOperation(d.project([]),"ui206-device",changes)]);
const render=element=>renderToStaticMarkup(element);
const form=(state,editor={kind:"ride"})=>render(React.createElement(EntityForm,{state,editor:{parents:[],namespace:"local",...editor},busy:false,onSave:async()=>{},onCancel:noop}));
const input=(html,label)=>html.match(new RegExp(`<input[^>]*aria-label="${label}"[^>]*>`))?.[0]??"";
const view=(name,state)=>render(React.createElement(Tabs,{value:name},React.createElement(MainViews,{state,actions,setView:noop,openStorage:noop})));

test("New ride name is optional, odometer required, distance an output rather than an input",()=>{
  const html=form(fixture());
  assert.match(html,/Name \(optional\)/);
  assert.doesNotMatch(input(html,"Name"),/required=/);
  assert.match(input(html,"Odometer after ride"),/required=""/);
  assert.match(html,/<output[^>]*aria-label="Ride distance"[^>]*aria-live="polite"/);
  assert.equal(input(html,"Ride distance"),"");
  assert.match(input(html,"Date and time"),/placeholder="yyyy\/mm\/dd"/);
  assert.match(input(html,"Date and time"),/required=""/);
  assert.match(input(html,"Time"),/type="time"/);
});
test("editing a paired ride renders its calculated distance and cannot remove required odometer",()=>{
  const state=fixture([change("wheel",wheel),change("reading",record),change("ride",ride)]);
  const html=form(state,{kind:"ride",entity:ride,reading:record});
  assert.match(html,/<output[^>]*>300 km<\/output>/);
  assert.match(input(html,"Odometer after ride"),/value="400"/);
  assert.match(input(html,"Odometer after ride"),/required=""/);
});
test("legacy distance-only metadata edit is visibly explained instead of demanding invented history",()=>{
  const legacy={...ride,distanceKm:300},state=fixture([change("wheel",wheel),change("ride",legacy)]);
  const html=form(state,{kind:"ride",entity:legacy});
  assert.match(html,/Legacy distance-only record/);
  assert.doesNotMatch(input(html,"Odometer after ride"),/required=/);
  assert.match(html,/<output[^>]*>300 km<\/output>/);
});
test("calendar controls show the configured format and weekday order independently of English",()=>{
  const original=Object.getOwnPropertyDescriptor(globalThis,"localStorage");
  Object.defineProperty(globalThis,"localStorage",{configurable:true,value:{getItem:key=>key===calendar.calendarPreferenceKey()?JSON.stringify({dateFormat:"dd.mm.yyyy",weekStartsOn:0}):null}});
  try{
    const html=render(React.createElement(LanguageProvider,null,React.createElement(DateInput,{"aria-label":"Chosen date",value:"2026-08-30",onValueChange:noop,required:true})));
    assert.match(input(html,"Chosen date"),/value="30\.08\.2026"/);
    assert.match(input(html,"Chosen date"),/placeholder="dd\.mm\.yyyy"/);
    assert.ok(html.indexOf('class="calendar-weekday">Sun')<html.indexOf('class="calendar-weekday">Mon'));
    assert.match(html,/aria-label="Previous month"/);assert.match(html,/aria-label="Next month"/);
    assert.match(html,/aria-label="30\.08\.2026"[^>]*aria-pressed="true"/);
  } finally {if(original)Object.defineProperty(globalThis,"localStorage",original);else delete globalThis.localStorage;}
  const defaultHtml=render(React.createElement(DateInput,{"aria-label":"Default date",value:"2026-08-30",onValueChange:noop}));
  assert.match(input(defaultHtml,"Default date"),/value="2026\/08\/30"/);
});
test("date/time input separates formatted date and time without browser-local date rendering",()=>{
  const html=render(React.createElement(DateTimeInput,{"aria-label":"Record date",value:"2026-08-30T17:20",required:true,onValueChange:noop}));
  assert.match(input(html,"Record date"),/value="2026\/08\/30"/);
  assert.match(input(html,"Time"),/value="17:20"/);
  assert.doesNotMatch(html,/type="datetime-local"/);
});
test("Gear renders one collapsed expandable item with only icon and name in its summary",()=>{
  const state=fixture([change("gear",gear),change("gear",{...gear,id:"cardo",name:"Cardo",category:"intercom",usedWithGearIds:[gear.id]})]);
  const html=view("gear",state),cards=[...html.matchAll(/<details class="gear-card gear-expandable panel"[^>]*>/g)];
  assert.equal(cards.length,2);assert.ok(cards.every(([tag])=>!tag.includes(" open")));
  const summaries=[...html.matchAll(/<summary class="gear-summary">([\s\S]*?)<\/summary>/g)].map(match=>match[1]);
  assert.equal(summaries.length,2);
  for(const summary of summaries){
    assert.match(summary,/<svg/);assert.match(summary,/<h2>/);
    assert.doesNotMatch(summary,/My notes|<dl>|row-actions|Purchased|Used with/);
  }
  assert.match(html,/class="gear-body"/);assert.match(html,/Used with/);assert.match(html,/2026\/08\/01/);assert.match(html,/My notes/);
});
test("inactive Fleet vehicles are last and have conspicuous labelled status without losing total",()=>{
  const inactive={...wheel,id:"broken",name:"A broken wheel",status:"critical"};
  const state=fixture([change("wheel",inactive),change("wheel",wheel),change("reading",{...record,wheelId:inactive.id})]);
  const html=view("overview",state),fleet=html.match(/<div class="fleet-strip">([\s\S]*?)<\/section>/)?.[1]??"";
  assert.ok(fleet.indexOf('class="fleet-name">Lynx-S')<fleet.indexOf('class="fleet-name">A broken wheel'));
  assert.match(fleet,/class="fleet-inactive"/);assert.match(fleet,/vehicle-status-critical/);assert.match(fleet,/300 km/);
});
test("Garage has exactly one edit pencil per vehicle and its status remains editable",()=>{
  const state=fixture([change("wheel",wheel),change("wheel",{...wheel,id:"other",name:"Other",status:"sold"})]);
  const html=view("wheels",state);
  assert.equal((html.match(/lucide-pencil/g)??[]).length,2);
  assert.equal((html.match(/aria-label="Edit vehicle"/g)??[]).length,2);
});
test("Analytics offers custom total/vehicle goals even before the first distance record",()=>{
  const html=render(React.createElement(AnalyticsView,{state:fixture(),actions}));
  assert.match(html,/Distance goals/);assert.match(html,/aria-label="Global progress goal"/);
  assert.match(html,/Add goal/);assert.match(html,/Around the Earth/);
  assert.match(html,/30 calendar days/);
  assert.match(html,/selected period/);
});
test("goal card renders selected scope, target, progress and the inactive forecast explanation",()=>{
  const state=fixture([change("wheel",{...wheel,status:"in_repair"}),change("reading",record),change("goal",{id:"goal",wheelId:wheel.id,targetKm:10000,createdAt:record.at})]);
  const html=render(React.createElement(GoalForecasts,{state,actions}));
  assert.match(html,/Lynx-S/);assert.match(html,/10,000/);assert.match(html,/vehicle-status-in_repair/);
  assert.match(html,/Forecast paused/);assert.match(html,/role="progressbar"/);
  assert.match(html,/aria-label="Edit goal: Distance goal \(Lynx-S, all time\)"/);
  assert.doesNotMatch(html,/aria-label="Delete goal/);
});
test("Earth footer progress exposes exact totals and percentages above one lap accessibly",()=>{
  const state=fixture([change("wheel",wheel),change("reading",{...record,odometerKm:80250})]);
  const html=render(React.createElement(EarthProgress,{state}));
  assert.match(html,/80,150 \/ 40,075 km/);assert.match(html,/200%/);
  assert.match(html,/aria-valuenow="100"/);assert.match(html,/aria-valuetext="200%"/);
});
test("grouped charts retain quiet click/focus affordances and format every full date",async()=>{
  const history=await readFile(new URL("../components/kairo/history-charts.tsx",import.meta.url),"utf8");
  const views=await readFile(new URL("../components/kairo/views.tsx",import.meta.url),"utf8");
  const css=await readFile(new URL("../app/globals.css",import.meta.url),"utf8");
  assert.doesNotMatch(history+views,/stackId=/);
  assert.match(history,/"grouped"/);assert.match(views,/"grouped"/);
  assert.match(history,/tickFormatter=\{dateLabel\}/);
  assert.match(history,/rgba\(255,255,255,\.035\)/);
  assert.match(views,/rgba\(255,255,255,\.035\)/);
  assert.match(css,/\.recharts-surface:focus-visible[^}]*outline:1px solid/);
});
test("save wiring remembers a vehicle only after committing; settings expose date and week choices",async()=>{
  const app=await readFile(new URL("../components/kairo/app.tsx",import.meta.url),"utf8");
  const forms=await readFile(new URL("../components/kairo/forms.tsx",import.meta.url),"utf8");
  const settings=await readFile(new URL("../components/kairo/storage-panel.tsx",import.meta.url),"utf8");
  assert.match(app,/await commitChanges\(form.namespace,changes\);\s*if\(!form.entity&&!form.reading\)rememberRecordVehicle/);
  assert.match(app,/validateRideRecord\(validationState/);assert.match(forms,/validateRideRecord\(/);
  assert.match(app,/preferredRecordVehicle\(state,namespace.current\)/);
  assert.match(settings,/Dates & calendar/);assert.match(settings,/Date format/);assert.match(settings,/Week starts on/);
  const date=await readFile(new URL("../components/kairo/date-input.tsx",import.meta.url),"utf8");
  assert.match(date,/setCustomValidity/);assert.match(date,/else if \(key && inRange\(key\)\) onValueChange\(key\)/);
});

test("v207 Rides, Trips, Garage and Gear have no direct Delete controls",()=>{
 const trip={id:"trip207",name:"Weekend",startDate:"2026-08-29",endDate:"2026-08-30",notes:""};
 const state=fixture([change("wheel",wheel),change("reading",record),change("ride",{...ride,tripId:trip.id}),change("trip",trip),change("gear",gear)]);
 for(const name of ["rides","trips","wheels","gear"]){
   const html=view(name,state);assert.doesNotMatch(html,/lucide-trash|aria-label="Delete/);
 }
 assert.match(view("trips",state),/trip-ledger-table/);
 assert.match(view("rides",state),/Filter rides by vehicle/);
 assert.match(view("trips",state),/Filter trips by vehicle/);
 assert.match(view("wheels",state),/<details[^>]*vehicle-expandable/);
});
test("v207 archived vehicles leave Fleet but their records still count",()=>{
 const state=fixture([change("wheel",{...wheel,archived:true}),change("reading",record)]);
 const html=view("overview",state);
 assert.doesNotMatch(html,/class="fleet-name">Lynx-S/);
 assert.match(view("rides",state),/Archived/);
});
test("v207 Hero keeps all three averages and adds Last ride and Last trip",async()=>{
 const {DashboardHero}=await vite.ssrLoadModule("/components/kairo/views.tsx");
 const state=fixture([change("wheel",wheel),change("reading",record),change("ride",ride)]);
 const html=render(React.createElement(DashboardHero,{state}));
 const source=await readFile(new URL("../components/kairo/views.tsx",import.meta.url),"utf8");
 for(const value of ["Last ride","Last trip","km/d","km/w","km/m"])assert.ok(source.includes(value));
 assert.match(html,/Last ride/);
 assert.match(html,/class="hero-primary"/);assert.match(html,/<strong>300<\/strong>/);
});
test("v207 Maintenance calendar exposes seven weekday headings and next mileage task",async()=>{
 const {MaintenanceCalendar}=await vite.ssrLoadModule("/components/kairo/overview-extras.tsx");
 const task={id:"care",title:"Tire pressure",category:"custom",targetKind:"wheel",targetId:wheel.id,dueDate:"2026-08-31",dueOdometerKm:500,repeatKm:100,repeatMonths:null,remindDaysBefore:0,completedAt:null,notes:""};
 const state=fixture([change("wheel",wheel),change("reading",record),change("maintenance",task)]);
 const html=render(React.createElement(MaintenanceCalendar,{state,actions}));
 assert.equal((html.match(/class="weekday"/g)??[]).length,7);
 assert.match(html,/Next mileage-based task/);assert.match(html,/Remaining: 100 km/);assert.match(html,/Tire pressure/);
});
test("v207 Settings groups and deferred Apply are wired explicitly",async()=>{
 const source=await readFile(new URL("../components/kairo/storage-panel.tsx",import.meta.url),"utf8");
 for(const label of ["Appearance & regional settings","Synchronization","Import / Export","Information","Apply","Cancel"])assert.ok(source.includes(label));
 assert.match(source,/showCloseButton=\{false\}/);assert.match(source,/function apply\(/);
 assert.match(source,/checked=\{draft.auto\}/);assert.match(source,/Discard unapplied settings/);
});
test("v207 all Gear sorting directions and subtle chart focus are present",async()=>{
 const source=await readFile(new URL("../components/kairo/views.tsx",import.meta.url),"utf8");
 for(const key of ["name","category","status"])assert.ok(source.includes('sortGear("'+key+'")'));
 assert.match(source,/setGearAsc\(!gearAsc\)/);
 const css=await readFile(new URL("../app/globals.css",import.meta.url),"utf8");
 assert.match(css,/\.recharts-wrapper \*:focus \{outline:none!important\}/);
 assert.match(css,/\.earth-progress \{max-width:none/);
});
test("v207 global goal bar includes name, scope, period and target",()=>{
 const html=render(React.createElement(EarthProgress,{state:fixture()}));
 assert.match(html,/Around the Earth \(all vehicles, all time\) — 40,075 km/);
});
