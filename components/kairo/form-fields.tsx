"use client";
import type {ReactNode} from "react";
import {Label} from "@/components/ui/label";
import {Select,SelectTrigger,SelectValue,SelectContent,SelectItem} from "@/components/ui/select";
import {useI18n} from "@/lib/kairo/i18n";

export function Field({label,children,hint}:{label:string;children:ReactNode;hint?:string}){
  return <div className="field"><Label>{label}</Label>{children}{hint&&<p className="field-hint">{hint}</p>}</div>;
}
export function Pick({value,onChange,options,label}:{value:string;onChange:(v:string)=>void;options:{value:string;label:string}[];label:string}){
  const {tr}=useI18n();
  return <Select value={value||undefined} onValueChange={onChange}><SelectTrigger aria-label={label} className="form-select"><SelectValue placeholder={tr("Select…","Pasirink…")}/></SelectTrigger><SelectContent>{options.map(o=><SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent></Select>;
}
