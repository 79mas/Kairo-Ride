/* Browser worker template. The build inserts immutable asset URLs and a content hash. */
const PREFIX="kairo-ride-shell-__SCOPE_ID__-";
const CACHE=PREFIX+"__BUILD_ID__";
const BASE="__BASE_PATH__";
const HOME=BASE+"/";
const PRECACHE="__PRECACHE__";
self.addEventListener("install",event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE);
    for(const path of PRECACHE){
      const response=await fetch(new Request(new URL(path,self.location.origin),{cache:"reload",credentials:"same-origin"}));
      if(!response.ok||response.redirected)throw new Error("Programėlės nepavyko paruošti darbui be interneto.");
      await cache.put(path,response);
    }
    // No skipWaiting: keep the old application and its cache together until its tabs close.
  })());
});
self.addEventListener("activate",event=>{
  event.waitUntil((async()=>{
    for(const key of await caches.keys())if((key.startsWith(PREFIX)||(!BASE&&/^kairo-ride-shell-[a-f0-9]{16}$/.test(key)))&&key!==CACHE)await caches.delete(key);
    await self.clients.claim();
    for(const client of await self.clients.matchAll())client.postMessage({type:"KAIRO_OFFLINE_READY"});
  })());
});
self.addEventListener("message",event=>{
  if(event.data?.type==="CHECK_OFFLINE")event.waitUntil((async()=>{
    const cache=await caches.open(CACHE);
    if(await cache.match(HOME))event.source?.postMessage({type:"KAIRO_OFFLINE_READY"});
  })());
});
self.addEventListener("fetch",event=>{
  const request=event.request,url=new URL(request.url);
  if(request.method!=="GET"||url.origin!==self.location.origin||request.headers.has("Authorization"))return;
  // Runtime config can be activated by the owner without rewriting local data.
  if(url.pathname===HOME+"kairo-config.json"){
    event.respondWith((async()=>{try{const response=await fetch(request);if(response.ok){const cache=await caches.open(CACHE);await cache.put(url.pathname,response.clone());}return response;}catch{const cached=await(await caches.open(CACHE)).match(url.pathname);return cached??Response.error();}})());return;
  }
  const path=request.mode==="navigate"&&(url.pathname===HOME||url.pathname===HOME+"index.html")?HOME:url.pathname;
  if(!PRECACHE.includes(path))return;
  event.respondWith((async()=>{const cached=await(await caches.open(CACHE)).match(path);return cached??fetch(request);})());
});
