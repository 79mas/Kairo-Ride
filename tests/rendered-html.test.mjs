import assert from "node:assert/strict";
import test from "node:test";
import {readFile,readdir,stat} from "node:fs/promises";
import {runInNewContext} from "node:vm";

const base=(process.env.KAIRO_BASE_PATH??"").replace(/\/$/,"");
const origin="https://kairo.example.test";
const output=new URL("../dist/client/",import.meta.url);

test("exports an English-first Kairo Ride application without a personal-data server", async()=>{
  const html=await readFile(new URL("../dist/client/index.html",import.meta.url),"utf8");
  assert.match(html,/<title>Kairo Ride<\/title>/);
  assert.match(html,/<html[^>]*lang="en"/);
  assert.match(html,/<html[^>]*class="dark"/);
  assert.ok(html.includes(`${base}/manifest.webmanifest`));
  assert.ok(html.includes(`${base}/apple-touch-icon.png`));
  assert.match(html,/name="theme-color" content="#08090b"/);
  for(const [,url] of html.matchAll(/(?:src|href)="(\/[^"#?]+)"/g)){
    assert.ok(url.startsWith(base+"/"),`Wrong project prefix: ${url}`);
    assert.ok((await stat(new URL(url.slice(base.length+1)||"index.html",output))).isFile(),`Missing referenced file: ${url}`);
  }
  assert.doesNotMatch(html,/codex-preview|Starter Project/);
});
test("offline worker includes actual client assets and avoids Google API caching", async()=>{
  const worker=await readFile(new URL("../dist/client/sw.js",import.meta.url),"utf8");
  assert.doesNotMatch(worker,/__BUILD_ID__|__PRECACHE__/);
  const assets=await readdir(new URL("../dist/client/assets/",import.meta.url));
  for(const asset of assets.filter(a=>/\.(js|css)$/.test(a)))assert.ok(worker.includes(asset),`Missing offline asset: ${asset}`);
  assert.match(worker,/url.origin!==self.location.origin/);
});

test("manifest and every precached URL resolve inside the actual GitHub project",async()=>{
  const manifest=JSON.parse(await readFile(new URL("manifest.webmanifest",output),"utf8"));
  const manifestURL=new URL(`${base}/manifest.webmanifest`,origin);
  for(const field of ["start_url","scope","id"])assert.equal(new URL(manifest[field],manifestURL).pathname,base+"/");
  for(const icon of manifest.icons){
    const url=new URL(icon.src,manifestURL);assert.ok(url.pathname.startsWith(base+"/"));
    const png=await readFile(new URL(url.pathname.slice(base.length+1),output));
    assert.equal(png.toString("hex",0,8),"89504e470d0a1a0a");
    assert.equal(`${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`,icon.sizes);
  }
  const worker=await readFile(new URL("sw.js",output),"utf8");
  const shell=runInNewContext(worker+";({PRECACHE,HOME})",{self:{addEventListener(){},location:{origin}}});
  assert.equal(shell.HOME,base+"/");
  for(const url of shell.PRECACHE){
    assert.ok(url.startsWith(shell.HOME));
    assert.ok((await stat(new URL(url.slice(base.length+1)||"index.html",output))).isFile(),`Missing offline resource: ${url}`);
  }
});

test("worker serves the installed app offline and never removes another project's cache",async()=>{
  const handlers={},stores=new Map();let online=true;
  const caches={keys:async()=>[...stores.keys()],delete:async key=>stores.delete(key),open:async key=>{
    if(!stores.has(key))stores.set(key,new Map());const data=stores.get(key);
    return {put:async(key,response)=>data.set(key,response.clone()),match:async key=>data.get(key)?.clone()};
  }};
  const worker=await readFile(new URL("sw.js",output),"utf8");
  const shell=runInNewContext(worker+";({PREFIX,CACHE,HOME,PRECACHE})",{
    URL,Request,Response,caches,
    fetch:async request=>{if(!online)throw new Error("offline");return new Response("cached "+new URL(request.url).pathname);},
    self:{location:{origin},addEventListener:(name,fn)=>{handlers[name]=fn;},clients:{claim:async()=>{},matchAll:async()=>[]}},
  });
  stores.set(shell.PREFIX+"previous-build",new Map());stores.set("kairo-ride-shell-another-project-123",new Map());
  const wait=async name=>{let promise;handlers[name]({waitUntil:p=>{promise=p;}});await promise;};
  await wait("install");await wait("activate");online=false;
  assert.ok(!stores.has(shell.PREFIX+"previous-build"));assert.ok(stores.has("kairo-ride-shell-another-project-123"));
  async function fetchEvent(path,mode="cors",headers=new Headers()){
    let promise;handlers.fetch({request:{url:new URL(path,origin).href,method:"GET",mode,headers},respondWith:p=>{promise=p;}});return promise;
  }
  assert.equal(await(await fetchEvent(shell.HOME,"navigate")).text(),"cached "+shell.HOME);
  assert.equal(await(await fetchEvent(shell.HOME+"index.html","navigate")).text(),"cached "+shell.HOME);
  const asset=shell.PRECACHE.find(p=>p.endsWith(".js"));assert.equal(await(await fetchEvent(asset)).text(),"cached "+asset);
  assert.equal(await(await fetchEvent(shell.HOME+"kairo-config.json")).text(),"cached "+shell.HOME+"kairo-config.json");
  assert.equal(await fetchEvent("https://www.googleapis.com/drive/v3/files"),undefined);
  assert.equal(await fetchEvent("/another-project/"),undefined);
  assert.equal(await fetchEvent(asset,"cors",new Headers({Authorization:"Bearer never-cache-me"})),undefined);
});
