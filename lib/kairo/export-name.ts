import {APP_VERSION} from "./version";
export function exportName(format:"json"|"xlsx",date=new Date()){
  return `Kairo-Ride-${APP_VERSION}-${date.toISOString().replace(/[:.]/g,"-")}.${format}`;
}
