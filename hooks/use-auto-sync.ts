"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import {AutoSyncScheduler,type SyncOutcome} from "@/lib/kairo/auto-sync";

export function useAutoSync({enabled,connected,online,pendingKey,run}:{enabled:boolean;connected:boolean;online:boolean;pendingKey:string;run:(manual:boolean)=>Promise<SyncOutcome>}){
  const latest=useRef(run),scheduler=useRef<AutoSyncScheduler|null>(null);
  const [visible,setVisible]=useState(()=>typeof document==="undefined"||document.visibilityState!=="hidden");
  useEffect(()=>{latest.current=run;},[run]);
  useEffect(()=>{
    const instance=new AutoSyncScheduler(manual=>latest.current(manual));scheduler.current=instance;
    const visibility=()=>{const active=document.visibilityState!=="hidden";setVisible(active);if(active)instance.wake();};
    const wake=()=>{visibility();instance.wake();};
    document.addEventListener("visibilitychange",visibility);window.addEventListener("focus",wake);window.addEventListener("pageshow",wake);
    return()=>{document.removeEventListener("visibilitychange",visibility);window.removeEventListener("focus",wake);window.removeEventListener("pageshow",wake);instance.setActive(false);scheduler.current=null;};
  },[]);
  useEffect(()=>{const instance=scheduler.current;instance?.setActive(enabled&&connected&&online&&visible);return()=>instance?.setActive(false);},[enabled,connected,online,visible]);
  useEffect(()=>{if(pendingKey)scheduler.current?.changed();},[pendingKey]);
  return useCallback(()=>scheduler.current?.requestNow()??Promise.resolve("inactive" as const),[]);
}
