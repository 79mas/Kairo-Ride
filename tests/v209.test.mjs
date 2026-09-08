import assert from "node:assert/strict";
import test from "node:test";
import {readFile} from "node:fs/promises";
import {tsImport} from "tsx/esm/api";

const {exportSuccessMessage}=await tsImport("../components/kairo/export-dialog.tsx",import.meta.url);
const en=english=>english;
const lt=(_english,lithuanian)=>lithuanian;

test("v209 export success copy states the real format and destination only",()=>{
  assert.equal(exportSuccessMessage("xlsx",true,false,en),"Excel export completed successfully. The backup was saved to your device.");
  assert.equal(exportSuccessMessage("json",false,true,en),"JSON export completed successfully. The backup was saved to Google Drive.");
  assert.equal(exportSuccessMessage("xlsx",true,true,en),"Excel export completed successfully. The backup was saved to Google Drive and your device.");
  assert.equal(exportSuccessMessage("json",true,false,lt),"JSON eksportas įvyko sėkmingai. Atsarginė kopija išsaugota tavo įrenginyje.");
  assert.equal(exportSuccessMessage("xlsx",false,true,lt),"Excel eksportas įvyko sėkmingai. Atsarginė kopija išsaugota Google Drive.");
  assert.equal(exportSuccessMessage("json",true,true,lt),"JSON eksportas įvyko sėkmingai. Atsarginė kopija išsaugota Google Drive ir tavo įrenginyje.");
});

test("v209 export dialog reports success separately after all selected work completes",async()=>{
  const source=await readFile(new URL("../components/kairo/export-dialog.tsx",import.meta.url),"utf8");
  assert.match(source,/toast\.success\(exportSuccessMessage/);
  assert.match(source,/format:"json"\|"xlsx"/);
  assert.match(source,/if\(completed\).*close\(\)/);
  assert.match(source,/if\(local&&!localDone\)/);
  assert.match(source,/if\(drive&&!driveDone\)/);
});

test("v2091 service worker waits for explicit approval after caching the whole release",async()=>{
  const worker=await readFile(new URL("../build/pwa-worker.js",import.meta.url),"utf8");
  const installStart=worker.indexOf('self.addEventListener("install"');
  const activateStart=worker.indexOf('self.addEventListener("activate"');
  const install=worker.slice(installStart,activateStart);
  assert.match(install,/await cache\.put\(path,response\)/);assert.doesNotMatch(install,/skipWaiting/);
  assert.match(worker,/event\.data\?\.type==="ACTIVATE_UPDATE"[^\n]*self\.skipWaiting\(\)/);
});
