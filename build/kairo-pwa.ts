import {existsSync,readFileSync} from "node:fs";
import {createHash} from "node:crypto";
import {resolve} from "node:path";
import type {Plugin} from "vite";
import {normalizeBasePath} from "../lib/kairo/paths";

/** Every client chunk is precached. No Drive responses, tokens, or user records enter this cache. */
export function kairoPwa():Plugin{return {
  name:"kairo-pwa",apply:"build",
  generateBundle(options,bundle){
    if(!/(^|\/)dist\/client$/.test(String(options.dir??"").replaceAll("\\","/")))return;
    const base=normalizeBasePath(process.env.KAIRO_BASE_PATH??"");
    const publicFiles=["manifest.webmanifest","favicon.svg","favicon.ico","favicon-32.png","apple-touch-icon.png","icon-192.png","icon-512.png","icon-maskable-512.png","kairo-config.json","privacy.html"];
    const template=readFileSync(resolve("build/pwa-worker.js"),"utf8");
    const assets=Object.keys(bundle).filter(n=>/\.(js|css|woff2?)$/.test(n)).sort();
    const hash=createHash("sha256").update(base).update(template);
    for(const file of ["index.html","app/layout.tsx","app/page.tsx"])if(existsSync(resolve(file)))hash.update(readFileSync(resolve(file)));
    for(const file of publicFiles)hash.update(file).update(readFileSync(resolve("public",file)));
    for(const n of assets){hash.update(n);const item=bundle[n];hash.update(item.type==="chunk"?item.code:typeof item.source==="string"?item.source:item.source);}
    const version=hash.digest("hex").slice(0,16);
    const urls=[`${base}/`,...[...publicFiles,...assets].map(p=>`${base}/${p}`)];
    const scope=base?createHash("sha256").update(base).digest("hex").slice(0,12):"root";
    this.emitFile({type:"asset",fileName:"sw.js",source:template.replace("__BUILD_ID__",version).replace("__SCOPE_ID__",scope).replace('"__BASE_PATH__"',JSON.stringify(base)).replace('"__PRECACHE__"',JSON.stringify(urls))});
  },
};}
