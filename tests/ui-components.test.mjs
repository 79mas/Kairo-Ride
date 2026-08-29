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
  server: { middlewareMode: true },
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
  assert.match(html,/>Rides</);assert.match(html,/>Odometer</);assert.match(html,/>Notes</);assert.match(html,/Check pressure/);assert.doesNotMatch(html,/Odometer readings/);
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
