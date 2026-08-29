import {readFile,rm,writeFile} from "node:fs/promises";
import {spawn} from "node:child_process";
import {fileURLToPath} from "node:url";
import {loadEnv} from "vite";

// Public OAuth client ID, never a client secret or service-account credential.
const root=fileURLToPath(new URL("..",import.meta.url));
const fileEnv=loadEnv("production",root,"");
process.env.KAIRO_BASE_PATH??=fileEnv.KAIRO_BASE_PATH??"";
const configPath=new URL("../public/kairo-config.json",import.meta.url);
const original=await readFile(configPath,"utf8");
const config=JSON.parse(original);
const configured=(process.env.GOOGLE_CLIENT_ID??fileEnv.GOOGLE_CLIENT_ID)?.trim();
if(configured)config.googleClientId=configured;
if(typeof config.googleClientId!=="string"||(config.googleClientId&&!/^[0-9]+-[a-z0-9]+\.apps\.googleusercontent\.com$/.test(config.googleClientId))){
  throw new Error("GOOGLE_CLIENT_ID must be a public Web OAuth client ID, never a client secret.");
}
if(!config.googleClientId)console.info("Google Drive is not configured: the local PWA and exports will still work.");

try {
  // Rolldown/Vite can retain an old hashed chunk across repeated local builds.
  // Always rebuild this explicit generated directory from an empty state.
  await rm(new URL("../dist/client",import.meta.url),{recursive:true,force:true});
  await writeFile(configPath,JSON.stringify(config,null,2)+"\n");
  const cli=fileURLToPath(new URL("../node_modules/vite/bin/vite.js",import.meta.url));
  const code=await new Promise((resolve,reject)=>{
    const child=spawn(process.execPath,[cli,"build"],{cwd:root,stdio:"inherit",env:process.env});
    child.once("error",reject);child.once("exit",(code,signal)=>resolve(code??(signal?1:0)));
  });
  process.exitCode=code;
  if(code===0)await writeFile(new URL("../dist/client/.nojekyll",import.meta.url),"");
} finally {
  // A CI variable must not dirty source files or accidentally enter a later commit.
  await writeFile(configPath,original);
}
