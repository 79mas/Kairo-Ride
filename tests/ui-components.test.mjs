import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test, { after } from "node:test";
import { fileURLToPath } from "node:url";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

const root = fileURLToPath(new URL("..", import.meta.url));
const vite = await createServer({
  appType: "custom",
  configFile: false,
  root,
  resolve: { alias: { "@": root } },
  server: { middlewareMode: true, ws: false },
});

after(async () => {
  await vite.close();
});

async function readCssTree(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const contents = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        return readCssTree(entryPath);
      }
      return entry.name.endsWith(".css") ? readFile(entryPath, "utf8") : "";
    }),
  );
  return contents.join("\n");
}

test("ships a dark readable palette and motion safeguards", async () => {
  const css=await readCssTree(path.join(root,"dist"));
  assert.match(css,/--tw-enter-opacity/);
  assert.match(css,/prefers-reduced-motion:\s*reduce/);
  const color=name=>{const value=css.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`));assert.ok(value,`Missing theme token ${name}`);return value[1];};
  const luminance=hex=>{const c=hex.slice(1).match(/../g).map(h=>parseInt(h,16)/255).map(v=>v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4);return c[0]*0.2126+c[1]*0.7152+c[2]*0.0722;};
  const contrast=(a,b)=>{const x=luminance(a),y=luminance(b);return(Math.max(x,y)+0.05)/(Math.min(x,y)+0.05);};
  assert.ok(luminance(color("background"))<0.03,"Background must stay dark regardless of OS theme");
  assert.ok(contrast(color("foreground"),color("background"))>=7,"Main text contrast");
  assert.ok(contrast(color("muted-foreground"),color("card"))>=4.5,"Secondary text contrast");
  assert.ok(contrast(color("primary"),color("primary-foreground"))>=4.5,"Button text contrast");
});

test("forwards progress semantics to the primitive", async () => {
  const { Progress } = await vite.ssrLoadModule("/components/ui/progress.tsx");
  const html = renderToStaticMarkup(React.createElement(Progress, { value: 37 }));

  assert.match(html, /aria-valuenow="37"/);
  assert.match(html, /aria-valuetext="37%"/);
  assert.match(html, /data-state="loading"/);
});

test("emits chart themes for the starter's media dark mode", async () => {
  const { ChartStyle } = await vite.ssrLoadModule("/components/ui/chart.tsx");
  const html = renderToStaticMarkup(
    React.createElement(ChartStyle, {
      id: "contract",
      config: {
        latency: { theme: { light: "#ffffff", dark: "#000000" } },
      },
    }),
  );

  assert.match(html, /\[data-chart=contract\]/);
  assert.match(html, /@media \(prefers-color-scheme: dark\)/);
  assert.doesNotMatch(html, /\.dark/);
});

test("renders sidebar skeletons deterministically", async () => {
  const { SidebarMenuSkeleton } = await vite.ssrLoadModule(
    "/components/ui/sidebar.tsx",
  );
  const first = renderToStaticMarkup(React.createElement(SidebarMenuSkeleton));
  const second = renderToStaticMarkup(React.createElement(SidebarMenuSkeleton));

  assert.equal(first, second);
  assert.match(first, /--skeleton-width:70%/);
});

test("equipment tab renders saved gear with category, status, details and edit controls",async()=>{
  const {MainViews}=await vite.ssrLoadModule("/components/kairo/views.tsx");
  const {Tabs}=await vite.ssrLoadModule("/components/ui/tabs.tsx");
  const {project,makeOperation}=await vite.ssrLoadModule("/lib/kairo/domain.ts");
  const gear={id:"ui-gear",name:"Kelionės Cardo",category:"intercom",status:"spare",brand:"Cardo",model:"Packtalk",size:"",purchasedOn:"2026-01-10",notes:"Atsarginis laidas"};
  const state=project([makeOperation(project([]),"ui-device",[{kind:"gear",entityId:gear.id,value:gear}])]);
  const noop=()=>{};
  const html=renderToStaticMarkup(React.createElement(Tabs,{value:"gear"},React.createElement(MainViews,{state,actions:{openEditor:noop,openRide:noop,askDelete:noop,setDetail:noop},setView:noop,openStorage:noop})));
  assert.match(html,/>Gear</);assert.match(html,/Kelionės Cardo/);assert.match(html,/Intercom \/ Cardo/);
  assert.match(html,/Spare/);assert.match(html,/Packtalk/);assert.match(html,/Atsarginis laidas/);assert.match(html,/aria-label="Edit"/);
});

test("Ride UI combines odometer, notes and sortable columns without a second odometer view",async()=>{
  const {MainViews}=await vite.ssrLoadModule("/components/kairo/views.tsx");
  const {Tabs}=await vite.ssrLoadModule("/components/ui/tabs.tsx");
  const {project,makeOperation}=await vite.ssrLoadModule("/lib/kairo/domain.ts");
  const wheel={id:"ui-wheel",name:"Lynx-S",baselineKm:100,baselineDate:"2026-01-01",color:"#f16305",notes:""},reading={id:"ui-reading",wheelId:wheel.id,at:"2026-01-02T12:00:00.000Z",odometerKm:125,notes:"Check pressure"};
  const state=project([makeOperation(project([]),"ui-device",[{kind:"wheel",entityId:wheel.id,value:wheel},{kind:"reading",entityId:reading.id,value:reading}])]),noop=()=>{};
  const html=renderToStaticMarkup(React.createElement(Tabs,{value:"rides"},React.createElement(MainViews,{state,actions:{openEditor:noop,openRide:noop,askDelete:noop,setDetail:noop},setView:noop,openStorage:noop})));
  assert.match(html,/>Rides</);assert.match(html,/>Odometer · km</);assert.match(html,/>Notes</);assert.match(html,/Check pressure/);assert.doesNotMatch(html,/Odometer readings/);
  assert.match(html,/<table /);assert.match(html,/<thead /);assert.match(html,/<tbody /);assert.match(html,/aria-sort="descending"/);assert.match(html,/>km\/d</);
  assert.match(html,/type="range"/);assert.match(html,/aria-label="Scroll ride columns"/);assert.doesNotMatch(html,/ride-table-row/);
  assert.match(html,/ledger-col-notes"/);assert.match(html,/ledger-col-trip ledger-mobile-absent/);assert.match(html,/ledger-col-name ledger-mobile-absent/);
});

test("mobile rides retain table geometry, hide placeholder content, and provide a bounded scroll viewport",async()=>{
  const css=await readFile(path.join(root,"app/globals.css"),"utf8");
  assert.match(css,/\.ride-ledger-viewport\s*\{[^}]*overflow:auto;[^}]*max-height:/);
  assert.match(css,/\.ride-ledger-table th\s*\{[^}]*position:sticky;top:0/);
  assert.match(css,/\.ride-ledger-table \.ledger-mobile-absent\s*\{display:none\}/);
  assert.match(css,/\.ride-ledger-table \.ledger-empty\s*\{visibility:hidden\}/);
});

test("gear Used with is a compact dropdown and Ride form exposes Add as trip",async()=>{
  const {EntityForm}=await vite.ssrLoadModule("/components/kairo/forms.tsx"),{project,makeOperation}=await vite.ssrLoadModule("/lib/kairo/domain.ts");
  const helmet={id:"helmet",name:"Helmet",category:"helmet",status:"active",brand:"",model:"",size:"",purchasedOn:null,notes:""},cardo={...helmet,id:"cardo",name:"Cardo",category:"intercom"};
  const gearState=project([makeOperation(project([]),"ui-device",[{kind:"gear",entityId:helmet.id,value:helmet},{kind:"gear",entityId:cardo.id,value:cardo}])]),noop=()=>{};
  const gearHtml=renderToStaticMarkup(React.createElement(EntityForm,{editor:{kind:"gear",entity:cardo,parents:[],namespace:"local"},state:gearState,busy:false,onSave:noop,onCancel:noop}));
  assert.match(gearHtml,/class="multi-select"/);assert.match(gearHtml,/Select gear/);
  const wheel={id:"wheel",name:"Lynx-S",baselineKm:0,baselineDate:"2026-01-01",color:"#f16305",notes:""},rideState=project([makeOperation(project([]),"ui-device",[{kind:"wheel",entityId:wheel.id,value:wheel}])]);
  const rideHtml=renderToStaticMarkup(React.createElement(EntityForm,{editor:{kind:"ride",parents:[],namespace:"local"},state:rideState,busy:false,onSave:noop,onCancel:noop}));
  assert.match(rideHtml,/Add as trip/);assert.match(rideHtml,/Odometer after ride/);
});

async function maintenanceFixture(){
  const {EntityForm}=await vite.ssrLoadModule("/components/kairo/forms.tsx");
  const domain=await vite.ssrLoadModule("/lib/kairo/domain.ts");
  const maintenance=await vite.ssrLoadModule("/lib/kairo/maintenance.ts");
  const wheel={id:"maintenance-wheel",name:"Lynx-S",baselineKm:100,baselineDate:"2026-01-01",color:"#f16305",notes:""};
  const state=domain.project([domain.makeOperation(domain.project([]),"ui-device",[{kind:"wheel",entityId:wheel.id,value:wheel}])]);
  const noop=()=>{};
  const render=entity=>renderToStaticMarkup(React.createElement(EntityForm,{editor:{kind:"maintenance",entity,parents:[],namespace:"local"},state,busy:false,onSave:noop,onCancel:noop}));
  return {render,domain,maintenance,state,wheel,noop};
}
const inputTag=(html,label)=>html.match(new RegExp(`<input[^>]*aria-label="${label}"[^>]*>`))?.[0]??"";

test("maintenance form defaults to pressure, two independent checkboxes and an autofilled seven-day schedule",async()=>{
  const {render,domain,maintenance}=await maintenanceFixture(),html=render();
  assert.match(html,/value="Check tire pressure"/);
  assert.match(inputTag(html,"Date reminder"),/checked/);assert.match(inputTag(html,"Mileage reminder"),/checked/);
  assert.match(inputTag(html,"Due odometer"),/value="200"/);
  assert.ok(inputTag(html,"Due date").includes(`value="${maintenance.addMaintenanceInterval(domain.today(),{days:7})}"`));
  assert.match(html,/whichever comes first/);assert.match(html,/Use suggested intervals/);assert.match(html,/not an official Lynx-S/);assert.match(html,/not guaranteed when closed/);
  assert.match(inputTag(html,"Repeat time interval"),/value="7"/);
});
test("condition-based maintenance renders as a checklist with disabled date and mileage fields",async()=>{
  const {render,maintenance,state}=await maintenanceFixture();
  const item=maintenance.maintenanceFromDraft(maintenance.createMaintenanceDraft(state,{templateId:"tire_replacement"}),"condition");
  const html=render(item);
  assert.doesNotMatch(inputTag(html,"Date reminder"),/checked/);assert.doesNotMatch(inputTag(html,"Mileage reminder"),/checked/);
  assert.match(inputTag(html,"Due date"),/disabled/);assert.match(inputTag(html,"Due odometer"),/disabled/);
  assert.match(html,/unscheduled checklist/);assert.match(html,/no single replacement mileage/);
});
test("editing a saved legacy maintenance form does not apply new template intervals on open",async()=>{
  const {render,wheel}=await maintenanceFixture();
  const item={id:"legacy",title:"My previous task",category:"tire_tread",targetKind:"wheel",targetId:wheel.id,dueDate:"2027-01-15",dueOdometerKm:8000,remindDaysBefore:8,repeatKm:850,repeatMonths:6,completedAt:null,notes:"Original notes"};
  const html=render(item);
  assert.match(inputTag(html,"Due date"),/value="2027-01-15"/);assert.match(inputTag(html,"Due odometer"),/value="8000"/);
  assert.match(inputTag(html,"Repeat kilometres"),/value="850"/);assert.match(inputTag(html,"Repeat time interval"),/value="6"/);
  assert.match(html,/value="My previous task"/);assert.match(html,/Original notes/);
});
test("insurance form requests the actual expiry and keeps a 14-day reminder instead of guessing a date",async()=>{
  const {render,maintenance,state}=await maintenanceFixture();
  const value={...maintenance.maintenanceFromDraft({...maintenance.createMaintenanceDraft(state,{templateId:"insurance"}),dueDate:"2026-12-31"},"insurance"),dueDate:null};
  const html=render(value);
  assert.match(inputTag(html,"Date reminder"),/checked/);assert.match(inputTag(html,"Due date"),/required/);assert.match(inputTag(html,"Due date"),/value=""/);
  assert.match(inputTag(html,"Reminder days"),/value="14"/);assert.match(html,/no policy expiry is guessed/);
});
test("maintenance cards show weekly repetition, remaining distance, either-first logic and inspection guidance",async()=>{
  const {state,maintenance,noop}=await maintenanceFixture();
  const {MaintenanceCard}=await vite.ssrLoadModule("/components/kairo/views.tsx");
  const item=maintenance.maintenanceFromDraft(maintenance.createMaintenanceDraft(state),"card");
  const html=renderToStaticMarkup(React.createElement(MaintenanceCard,{item,state,actions:{openEditor:noop,openRide:noop,askDelete:noop,setDetail:noop}}));
  assert.match(html,/Whichever comes first/);assert.match(html,/7 days/);assert.match(html,/Distance remaining/);assert.match(html,/100 km/);
  assert.match(html,/What to check/);assert.match(html,/Manufacturer instructions take priority/);
});
test("mobile maintenance reminders stack and remain labelled independently",async()=>{
  const css=await readFile(path.join(root,"app/globals.css"),"utf8");
  assert.match(css,/@media\(max-width:540px\)\{\.maintenance-reminder-grid,\.maintenance-repeat \.form-grid \{grid-template-columns:1fr\}/);
  assert.match(css,/\.maintenance-toggle input:focus-visible/);
});
