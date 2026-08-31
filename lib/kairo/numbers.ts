import {appPath} from "./paths";
export const NUMBER_FORMATS=["space-comma","comma-dot","dot-comma","space-dot"] as const;
export type NumberFormat=typeof NUMBER_FORMATS[number];
export const numberPreferenceKey=()=>`kairo-number-format@${appPath()}`;
export function readNumberFormat():NumberFormat {
  try{const value=localStorage.getItem(numberPreferenceKey());return NUMBER_FORMATS.includes(value as NumberFormat)?value as NumberFormat:"space-comma";}catch{return "space-comma";}
}
export function saveNumberFormat(value:NumberFormat){localStorage.setItem(numberPreferenceKey(),value);}
export function formatNumber(value:number,options:Intl.NumberFormatOptions={},format=readNumberFormat()):string {
  if(!Number.isFinite(value))return "—";
  const group=format==="comma-dot"?",":format==="dot-comma"?".":"\u00a0",decimal=format==="space-comma"||format==="dot-comma"?",":".";
  return new Intl.NumberFormat("en-US",{maximumFractionDigits:2,...options}).formatToParts(value).map(part=>part.type==="group"?group:part.type==="decimal"?decimal:part.value).join("");
}
