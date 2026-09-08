"use client";
import {useEffect,useState} from "react";
import {appPath} from "@/lib/kairo/paths";

const key=`kairo-upload-wake-lock@${appPath()}`;
export function useUploadWakeLock(active:boolean){
  const [enabled,setEnabledState]=useState(()=>{try{return localStorage.getItem(key)!=="off";}catch{return true;}});
  useEffect(()=>{
    if(!active||!enabled||document.visibilityState!=="visible"||!("wakeLock" in navigator))return;
    let lock:WakeLockSentinel|undefined,cancelled=false;
    void navigator.wakeLock.request("screen").then(value=>{if(cancelled)void value.release();else lock=value;}).catch(()=>{});
    return()=>{cancelled=true;void lock?.release();};
  },[active,enabled]);
  const setEnabled=(value:boolean)=>{try{localStorage.setItem(key,value?"on":"off");}catch{/* optional preference */}setEnabledState(value);};
  return {enabled,setEnabled,supported:typeof navigator!=="undefined"&&"wakeLock" in navigator};
}
