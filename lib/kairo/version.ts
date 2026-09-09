export const APP_VERSION = "2.0.9.2";
export const DATA_SCHEMA_VERSION = 2;

export type BuildInfo = {version:string;buildId:string;builtAt:string};

let cached:Promise<BuildInfo>|undefined;
export function readBuildInfo():Promise<BuildInfo>{
  if(typeof window==="undefined")return Promise.resolve({version:APP_VERSION,buildId:"source",builtAt:""});
  if(!cached)cached=fetch(new URL("build-meta.json",document.baseURI),{cache:"no-store"})
    .then(async response=>{
      if(!response.ok)throw new Error("Build information is unavailable.");
      const value=await response.json() as Partial<BuildInfo>;
      if(value.version!==APP_VERSION||typeof value.buildId!=="string")throw new Error("Build information does not match the running app.");
      return {version:value.version,buildId:value.buildId,builtAt:typeof value.builtAt==="string"?value.builtAt:""};
    }).catch(()=>({version:APP_VERSION,buildId:"unknown",builtAt:""}));
  return cached;
}
