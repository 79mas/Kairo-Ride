import {version} from "../../package.json";
export function exportName(format:"json"|"xlsx",date=new Date()){
  return `Kairo-Ride-${version}-${date.toISOString().replace(/[:.]/g,"-")}.${format}`;
}
