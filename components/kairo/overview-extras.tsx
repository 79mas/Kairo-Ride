"use client";
import {useEffect,useRef,useState} from "react";
import {ArrowDown,ArrowUp,ChevronDown,ChevronLeft,ChevronRight,Pencil} from "lucide-react";
import {Button} from "@/components/ui/button";
import {Progress} from "@/components/ui/progress";
import {Pick} from "./form-fields";
import {VehicleStatusBadge} from "./vehicle-status";
import {calendarMonthDays} from "@/lib/kairo/calendar";
import {canRecordWithWheel,formatDate,formatKm,today,wheelStats,type State,type Wheel} from "@/lib/kairo/domain";
import {maintenanceOdometer} from "@/lib/kairo/maintenance";
import {tripRideStats} from "@/lib/kairo/stats";
import {vehicleSelectOptions} from "@/lib/kairo/vehicle-status";
import {useI18n} from "@/lib/kairo/i18n";
import type {ViewActions} from "./views";

export function VehicleCard({wheel,state,actions,expanded}:{wheel:Wheel;state:State;actions:ViewActions;expanded:boolean}){
  const {tr,locale}=useI18n(),stats=wheelStats(wheel,state.reading),ref=useRef<HTMLDetailsElement>(null);
  useEffect(()=>{if(expanded&&ref.current){ref.current.open=true;ref.current.scrollIntoView({block:"center",behavior:"smooth"});}},[expanded]);
  return <details ref={ref} className="wheel-card panel vehicle-expandable" style={{"--wheel-color":wheel.color} as React.CSSProperties}>
    <summary className="vehicle-summary"><strong>{wheel.name}</strong><VehicleStatusBadge wheel={wheel} state={state}/><span>{formatKm(stats.trackedKm,locale)} km</span><ChevronDown/></summary>
    <div className="gear-body"><div className="section-heading"><h3>{tr("Vehicle details","Priemonės informacija")}</h3><Button variant="ghost" size="icon" onClick={()=>actions.openEditor("wheel",wheel)} aria-label={tr("Edit vehicle","Redaguoti priemonę")}><Pencil/></Button></div>
      {!canRecordWithWheel(wheel)&&<p className="vehicle-archived-note">{tr("Archive kept · new records disabled","Archyvas išsaugotas · nauji įrašai išjungti")}</p>}<dl><div><dt>{tr("Odometer","Odometras")}</dt><dd>{formatKm(stats.odometerKm,locale)} km</dd></div><div><dt>{tr("Baseline odometer","Pradinis odometras")}</dt><dd>{formatKm(wheel.baselineKm,locale)} km</dd></div><div><dt>{tr("History started","Istorijos pradžia")}</dt><dd>{formatDate(wheel.baselineDate,false,undefined,locale)}</dd></div><div><dt>{tr("Records","Įrašai")}</dt><dd>{stats.intervals.length}</dd></div></dl>{wheel.notes&&<p className="preserve-lines">{wheel.notes}</p>}
    </div></details>;
}

export function TripTable({state,actions}:{state:State;actions:ViewActions}){
  const {tr,locale,language}=useI18n(),[vehicle,setVehicle]=useState("all"),[sort,setSort]=useState("start"),[asc,setAsc]=useState(false);
  const rows=state.trip.filter(t=>!t.archived).map(trip=>({trip,stats:tripRideStats(trip,state)})).filter(row=>vehicle==="all"||row.stats.rides.some(r=>r.wheelId===vehicle));
  const columns=[["name",tr("Trip","Kelionė")],["start",tr("Start","Pradžia")],["end",tr("End","Pabaiga")],["vehicles",tr("Vehicles","Priemonės")],["distance",tr("Distance · km","Atstumas · km")],["rides",tr("Rides","Važiavimai")],["files",tr("Files","Failai")],["notes",tr("Notes","Pastabos")]];
  const names=(row:typeof rows[number])=>[...new Set(row.stats.rides.map(r=>state.wheel.find(w=>w.id===r.wheelId)?.name??""))].join(", ");
  const value=(row:typeof rows[number])=>sort==="name"?row.trip.name:sort==="start"?row.trip.startDate:sort==="end"?row.trip.endDate:sort==="distance"?row.stats.distanceKm:sort==="rides"?row.stats.rides.length:sort==="files"?row.stats.attachments.length:sort==="notes"?row.trip.notes.length:names(row);
  rows.sort((a,b)=>{const x=value(a),y=value(b);return (asc?1:-1)*(typeof x==="number"&&typeof y==="number"?x-y:String(x).localeCompare(String(y),locale))||a.trip.id.localeCompare(b.trip.id);});
  const viewport=useRef<HTMLDivElement>(null);
  return <section className="ride-ledger"><div className="ride-ledger-toolbar"><Pick label={tr("Filter trips by vehicle","Filtruoti keliones pagal priemonę")} value={vehicle} onChange={setVehicle} options={[{value:"all",label:tr("All vehicles","Visos priemonės")},...vehicleSelectOptions(state,language)]}/><div className="row-actions"><Button variant="outline" onClick={()=>viewport.current?.scrollBy({left:-280})} aria-label={tr("Scroll left","Slinkti kairėn")}><ChevronLeft/></Button><Button variant="outline" onClick={()=>viewport.current?.scrollBy({left:280})} aria-label={tr("Scroll right","Slinkti dešinėn")}><ChevronRight/></Button></div></div>
    <p className="field-hint">{tr("Vehicle filtering selects matching trips. Distances show each complete trip, including all its vehicles.","Priemonės filtras atrenka susijusias keliones. Atstumai rodo visą kelionę, įskaitant visas jos priemones.")}</p>
    <div ref={viewport} className="ride-ledger-viewport" tabIndex={0}><table className="trip-ledger-table"><thead><tr>{columns.map(([key,label])=><th key={key} aria-sort={sort===key?asc?"ascending":"descending":"none"}><button onClick={()=>{if(sort===key)setAsc(!asc);else{setSort(key);setAsc(key==="name"||key==="vehicles");}}}>{label}{sort===key&&(asc?<ArrowUp/>:<ArrowDown/>)}</button></th>)}</tr></thead><tbody>{rows.map(row=><tr key={row.trip.id} onClick={()=>actions.setDetail({kind:"trip",id:row.trip.id})}><td><button onClick={event=>{event.stopPropagation();actions.setDetail({kind:"trip",id:row.trip.id});}}>{row.trip.name}</button></td><td>{formatDate(row.trip.startDate,false,undefined,locale)}</td><td>{formatDate(row.trip.endDate,false,undefined,locale)}</td><td>{names(row)}</td><td>{formatKm(row.stats.distanceKm,locale)}{row.stats.unknownDistances>0?" + ?":""}</td><td>{row.stats.rides.length}</td><td>{row.stats.attachments.length||""}</td><td title={row.trip.notes}>{row.trip.notes.slice(0,100)}</td></tr>)}</tbody></table>{!rows.length&&<p>{tr("No matching trips.","Atitinkančių kelionių nėra.")}</p>}</div>
  </section>;
}

export function MaintenanceCalendar({state,actions}:{state:State;actions:ViewActions}){
  const {tr,locale,weekStartsOn,language}=useI18n(),[month,setMonth]=useState(()=>today().slice(0,7)),[selected,setSelected]=useState(today),[vehicle,setVehicle]=useState("all");
  const pending=state.maintenance.filter(m=>!m.archived&&!m.completedAt&&(vehicle==="all"||m.targetKind==="wheel"&&m.targetId===vehicle));
  const days=calendarMonthDays(month,weekStartsOn),items=pending.filter(m=>m.dueDate===selected);
  function move(delta:number){const d=new Date(month+"-01T12:00:00Z");d.setUTCMonth(d.getUTCMonth()+delta);const key=d.toISOString().slice(0,7);setMonth(key);setSelected(key+"-01");}
  const mileage=pending.flatMap(item=>{const odo=maintenanceOdometer(state,item.targetKind,item.targetId);return item.dueOdometerKm!==null&&odo!==null?[{item,odo,remaining:item.dueOdometerKm-odo}]:[];}).sort((a,b)=>a.remaining-b.remaining)[0];
  return <section className="maintenance-calendar panel"><div className="section-heading"><h2>{new Intl.DateTimeFormat(locale,{month:"long",year:"numeric",timeZone:"UTC"}).format(new Date(month+"-01T12:00:00Z"))}</h2><div className="row-actions"><Button variant="ghost" onClick={()=>move(-1)} aria-label={tr("Previous month","Ankstesnis mėnuo")}><ChevronLeft/></Button><Button variant="ghost" onClick={()=>{setMonth(today().slice(0,7));setSelected(today());}}>{tr("Today","Šiandien")}</Button><Button variant="ghost" onClick={()=>move(1)} aria-label={tr("Next month","Kitas mėnuo")}><ChevronRight/></Button></div></div>
    <Pick label={tr("Maintenance vehicle","Priežiūros priemonė")} value={vehicle} onChange={setVehicle} options={[{value:"all",label:tr("All vehicles and gear","Visos priemonės ir ekipuotė")},...vehicleSelectOptions(state,language)]}/>
    <div className="maintenance-month-grid">{Array.from({length:7},(_,i)=><span className="weekday" key={i}>{new Intl.DateTimeFormat(locale,{weekday:"short",timeZone:"UTC"}).format(new Date(Date.UTC(2024,0,7+(weekStartsOn+i)%7)))}</span>)}{days.map((day,i)=>day?<button key={day} className={selected===day?"selected":day===today()?"today":""} aria-pressed={selected===day} aria-label={formatDate(day)+" · "+pending.filter(m=>m.dueDate===day).map(m=>m.title).join(", ")} onClick={()=>setSelected(day)}>{Number(day.slice(-2))}{pending.some(m=>m.dueDate===day)&&<i/>}</button>:<span key={"empty"+i}/>)}</div>
    <div className="calendar-tasks"><strong>{formatDate(selected,false,undefined,locale)}</strong>{items.length?items.map(item=><button key={item.id} onClick={()=>actions.openEditor("maintenance",item)}>{item.title} · {(item.targetKind==="wheel"?state.wheel:state.gear).find(t=>t.id===item.targetId)?.name}</button>):<p className="field-hint">{tr("No scheduled tasks on this date.","Šią dieną suplanuotų darbų nėra.")}</p>}</div>
    <div className="maintenance-distance"><h3>{tr("Next mileage-based task","Artimiausias darbas pagal ridą")}</h3>{mileage?<><p>{mileage.item.title} · {state.wheel.find(w=>w.id===mileage.item.targetId)?.name}</p><strong>{mileage.remaining<0?tr("Overdue by ","Pradelsta "):tr("Remaining: ","Liko: ")}{formatKm(Math.abs(mileage.remaining),locale)} km</strong><Progress value={Math.max(0,Math.min(100,100*(1-mileage.remaining/(mileage.item.repeatKm??Math.max(1,mileage.item.dueOdometerKm!)))))} aria-label={mileage.item.title}/><p className="field-hint">{formatKm(mileage.odo,locale)} / {formatKm(mileage.item.dueOdometerKm,locale)} km</p></>:<p>{tr("No mileage-based tasks scheduled.","Darbų pagal ridą nesuplanuota.")}</p>}</div>
  </section>;
}
