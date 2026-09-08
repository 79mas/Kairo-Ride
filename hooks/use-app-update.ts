"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import {appPath} from "@/lib/kairo/paths";

export type AppUpdate={version:string;buildId:string};
export function useAppUpdate({onOfflineReady,beforeActivate}:{onOfflineReady:()=>void;beforeActivate:()=>Promise<void>}){
  const registration=useRef<ServiceWorkerRegistration|null>(null),[update,setUpdate]=useState<AppUpdate|null>(null),[checking,setChecking]=useState(false),[activating,setActivating]=useState(false),[error,setError]=useState("");
  const inspect=useCallback((reg:ServiceWorkerRegistration)=>{
    if(reg.waiting&&navigator.serviceWorker.controller){registration.current=reg;reg.waiting.postMessage({type:"GET_BUILD_INFO"});}
  },[]);
  useEffect(()=>{
    if(!("serviceWorker" in navigator))return;
    let live=true,timer:ReturnType<typeof setInterval>|undefined;
    const message=(event:MessageEvent)=>{
      if(event.data?.type==="KAIRO_OFFLINE_READY"||event.data?.type==="KAIRO_ACTIVE")onOfflineReady();
      if(event.data?.type==="KAIRO_UPDATE_READY"||event.data?.type==="KAIRO_BUILD_INFO"){
        const reg=registration.current;if(live&&reg?.waiting&&navigator.serviceWorker.controller&&typeof event.data.version==="string")setUpdate({version:event.data.version,buildId:event.data.buildId});
      }
    };
    navigator.serviceWorker.addEventListener("message",message);
    void navigator.serviceWorker.register(appPath("sw.js"),{scope:appPath(),updateViaCache:"none"}).then(reg=>{
      if(!live)return;registration.current=reg;inspect(reg);reg.active?.postMessage({type:"CHECK_OFFLINE"});
      reg.addEventListener("updatefound",()=>{const worker=reg.installing;worker?.addEventListener("statechange",()=>{if(worker.state==="installed")inspect(reg);});});
      timer=setInterval(()=>{if(document.visibilityState==="visible")void reg.update().catch(()=>{});},15*60_000);
    }).catch(reason=>live&&setError(reason instanceof Error?reason.message:String(reason)));
    return()=>{live=false;if(timer)clearInterval(timer);navigator.serviceWorker.removeEventListener("message",message);};
  },[inspect,onOfflineReady]);
  const check=useCallback(async()=>{const reg=registration.current;if(!reg)return;setChecking(true);setError("");try{await reg.update();inspect(reg);}catch(reason){setError(reason instanceof Error?reason.message:String(reason));}finally{setChecking(false);}},[inspect]);
  const activate=useCallback(async()=>{const worker=registration.current?.waiting;if(!worker)return;setActivating(true);setError("");try{await beforeActivate();await new Promise<void>((resolve,reject)=>{const timeout=setTimeout(()=>reject(new Error("The update did not activate. Try again.")),15000);navigator.serviceWorker.addEventListener("controllerchange",()=>{clearTimeout(timeout);resolve();},{once:true});worker.postMessage({type:"ACTIVATE_UPDATE"});});location.reload();}catch(reason){setError(reason instanceof Error?reason.message:String(reason));setActivating(false);}},[beforeActivate]);
  return {update,checking,activating,error,check,activate};
}
