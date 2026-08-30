"use client";
import {useEffect,useMemo,useRef,useState,type ReactNode} from "react";
import {ArrowDown,ArrowUp,ChevronLeft,ChevronRight,Paperclip,Pencil,Trash2,TriangleAlert} from "lucide-react";
import {Button} from "@/components/ui/button";
import {Table,TableBody,TableCaption,TableCell,TableHead,TableHeader,TableRow} from "@/components/ui/table";
import {formatDate,formatKm,type State} from "@/lib/kairo/domain";
import {hasCellValue,rideEntries,sortRideEntries,type RideSortKey} from "@/lib/kairo/stats";
import {useI18n} from "@/lib/kairo/i18n";
import {Pick} from "./forms";
import type {ViewActions} from "./views";

export function RideTable({state,actions}:{state:State;actions:ViewActions}){
  const {tr,locale}=useI18n();
  const [key,setKey]=useState<RideSortKey>("date"),[direction,setDirection]=useState<"asc"|"desc">("desc");
  const viewport=useRef<HTMLDivElement>(null),[scroll,setScroll]=useState({left:0,max:0});
  const entries=useMemo(()=>sortRideEntries(rideEntries(state),state,key,direction),[state,key,direction]);
  const wheels=new Map(state.wheel.map(w=>[w.id,w])),trips=new Map(state.trip.map(t=>[t.id,t.name])),fileCounts=new Map<string,number>();
  for(const file of state.attachment)if(file.ownerKind==="ride")fileCounts.set(file.ownerId,(fileCounts.get(file.ownerId)??0)+1);
  const labels:Record<RideSortKey,string>={date:tr("Date","Data"),wheel:tr("Vehicle","Priemonė"),distance:tr("Distance · km","Atstumas · km"),daily:"km/d",odometer:tr("Odometer · km","Odometras · km"),name:tr("Ride","Važiavimas"),trip:tr("Trip","Kelionė"),notes:tr("Notes","Pastabos"),files:tr("Files","Failai")};
  const columns=Object.keys(labels) as RideSortKey[];
  const optional:Partial<Record<RideSortKey,boolean>>={name:entries.some(e=>hasCellValue(e.name)),odometer:entries.some(e=>hasCellValue(e.odometerKm)),trip:entries.some(e=>hasCellValue(trips.get(e.tripId??""))),notes:entries.some(e=>hasCellValue(e.notes)),files:entries.some(e=>e.ride&&(fileCounts.get(e.ride.id)??0)>0)};
  const columnClass=(column:RideSortKey)=>`ledger-col-${column}${optional[column]===false?" ledger-mobile-absent":""}`;
  const preferred=(column:RideSortKey):"asc"|"desc"=>["date","odometer","distance","daily","notes","files"].includes(column)?"desc":"asc";
  function sort(column:RideSortKey){if(column===key)setDirection(v=>v==="asc"?"desc":"asc");else{setKey(column);setDirection(preferred(column));}}
  const arrow=direction==="asc"?<ArrowUp/>:<ArrowDown/>;
  const cell=(value:string|number|null|undefined,content?:ReactNode)=><span className={!hasCellValue(value)?"ledger-empty":undefined}>{content??(typeof value==="number"?formatKm(value,locale):hasCellValue(value)?value:"—")}</span>;
  useEffect(()=>{
    const element=viewport.current;if(!element)return;
    const update=()=>{const max=Math.max(0,element.scrollWidth-element.clientWidth),left=Math.min(max,Math.max(0,element.scrollLeft));setScroll(previous=>previous.max===max&&previous.left===left?previous:{left,max});};
    update();element.addEventListener("scroll",update,{passive:true});window.addEventListener("resize",update);
    const observer=typeof ResizeObserver!=="undefined"?new ResizeObserver(update):null;
    observer?.observe(element);const table=element.querySelector("table");if(table)observer?.observe(table);
    return()=>{observer?.disconnect();element.removeEventListener("scroll",update);window.removeEventListener("resize",update);};
  },[state,locale]);
  const pan=(delta:number)=>viewport.current?.scrollBy({left:delta,behavior:"auto"});
  return <section className="ride-ledger" aria-label={tr("Ride records","Važiavimų įrašai")}>
    <div className="ride-ledger-toolbar">
      <div className="ride-ledger-sort"><Pick label={tr("Sort rides","Rūšiuoti važiavimus")} value={key} onChange={value=>{setKey(value as RideSortKey);setDirection(preferred(value as RideSortKey));}} options={columns.map(value=>({value,label:labels[value]}))}/><Button variant="outline" size="icon" onClick={()=>setDirection(v=>v==="asc"?"desc":"asc")} aria-label={tr("Reverse sort","Keisti rūšiavimo kryptį")}>{arrow}</Button></div>
      <div className="ride-ledger-pan" aria-label={tr("Horizontal table scrolling","Horizontalus lentelės slinkimas")}>
        <Button variant="ghost" size="icon" disabled={scroll.left<=0} onClick={()=>pan(-280)} aria-label={tr("Scroll table left","Slinkti lentelę kairėn")}><ChevronLeft/></Button>
        <input type="range" min={0} max={Math.max(1,scroll.max)} value={scroll.left} disabled={scroll.max===0} step={1} aria-label={tr("Scroll ride columns","Slinkti važiavimų stulpelius")} aria-controls="ride-ledger-viewport" onChange={event=>{if(viewport.current)viewport.current.scrollLeft=Number(event.target.value);}}/>
        <Button variant="ghost" size="icon" disabled={scroll.left>=scroll.max-1} onClick={()=>pan(280)} aria-label={tr("Scroll table right","Slinkti lentelę dešinėn")}><ChevronRight/></Button>
      </div>
    </div>
    <p className="ride-ledger-help" id="ride-ledger-help">{tr("Tap a heading to sort. km/d estimates distance per calendar day since the previous entry for that vehicle; odometer records use the previous odometer date. Same-day entries use 1 day. It is not a measured ride speed or duration.","Paspausk antraštę rūšiavimui. km/d – atstumo per kalendorinę dieną įvertis nuo ankstesnio tos priemonės įrašo; odometro įrašams – nuo ankstesnio odometro datos. Tos pačios dienos įrašams naudojama 1 diena. Tai nėra išmatuotas greitis ar trukmė.")}</p>
    <div ref={viewport} id="ride-ledger-viewport" className="ride-ledger-viewport" tabIndex={0} role="region" aria-label={tr("Scrollable ride table","Slenkama važiavimų lentelė")} aria-describedby="ride-ledger-help">
      <Table className="ride-ledger-table"><TableCaption className="sr-only">{tr("Rides with estimated kilometres per day. Empty optional columns are hidden on small screens.","Važiavimai su kilometrų per dieną įverčiu. Tušti neprivalomi stulpeliai mažame ekrane paslepiami.")}</TableCaption>
        <TableHeader><TableRow>{columns.map(column=><TableHead key={column} scope="col" className={columnClass(column)} aria-sort={key===column?direction==="asc"?"ascending":"descending":"none"}><button type="button" onClick={()=>sort(column)} title={column==="notes"?tr("Sort by note length; longest notes first","Rūšiuoti pagal pastabų ilgį; ilgiausios pirmiau"):undefined}>{labels[column]}{key===column&&arrow}</button></TableHead>)}<TableHead scope="col"><span className="sr-only">{tr("Actions","Veiksmai")}</span></TableHead></TableRow></TableHeader>
        <TableBody>{entries.map(entry=>{
          const wheel=wheels.get(entry.wheelId),files=entry.ride?fileCounts.get(entry.ride.id)??0:0;
          const open=()=>entry.ride?actions.setDetail({kind:"ride",id:entry.ride.id}):actions.openRide(undefined,entry.reading);
          const remove=()=>entry.ride?actions.askDelete("ride",entry.ride,entry.reading):entry.reading&&actions.askDelete("reading",entry.reading);
          const values:Record<RideSortKey,ReactNode>={
            date:<button type="button" onClick={open} title={entry.warning??undefined}><time dateTime={entry.at}>{formatDate(entry.at,true,entry.ride?.timeZone,locale)}</time>{entry.warning&&<TriangleAlert aria-label={entry.warning}/>}</button>,
            wheel:<span className="ledger-vehicle"><i style={{background:wheel?.color}}/>{cell(wheel?.name)}</span>,
            distance:cell(entry.distanceKm),daily:<span title={entry.intervalDays!==null?`${formatKm(entry.distanceKm,locale)} km / ${entry.intervalDays} ${tr("days","d.")}`:undefined}>{cell(entry.kmPerDay)}</span>,
            odometer:cell(entry.odometerKm),name:hasCellValue(entry.name)?<button className="ledger-ellipsis" onClick={open} title={entry.name}>{entry.name}</button>:cell(entry.name),
            trip:cell(trips.get(entry.tripId??"")),notes:<span className="ledger-ellipsis" title={entry.notes}>{cell(entry.notes)}</span>,
            files:cell(files,files>0?<span className="ledger-files"><Paperclip/>{files}</span>:"—"),
          };
          return <TableRow key={entry.key} className={entry.warning?"warning-row":undefined}>{columns.map(column=><TableCell key={column} className={columnClass(column)}>{values[column]}</TableCell>)}<TableCell><div className="row-actions"><Button variant="ghost" size="icon" onClick={()=>actions.openRide(entry.ride,entry.reading)} aria-label={tr("Edit ride","Redaguoti važiavimą")}><Pencil/></Button><Button variant="ghost" size="icon" onClick={remove} aria-label={tr("Delete ride","Pašalinti važiavimą")}><Trash2/></Button></div></TableCell></TableRow>;
        })}</TableBody>
      </Table>
    </div>
  </section>;
}
