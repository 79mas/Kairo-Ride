import assert from "node:assert/strict";
import test from "node:test";
import {tsImport} from "tsx/esm/api";
const stats=await tsImport("../lib/kairo/stats.ts",import.meta.url);
const d=await tsImport("../lib/kairo/domain.ts",import.meta.url);
const {AutoSyncScheduler,syncFailureKind}=await tsImport("../lib/kairo/auto-sync.ts",import.meta.url);
const wheel={id:"one",name:"One",baselineKm:100,baselineDate:"2026-01-01",color:"#f16305",notes:""};
const second={...wheel,id:"two",name:"Two",baselineKm:0};
const reading=(id,day,odometerKm,wheelId="one")=>({id,wheelId,at:`${day}T12:00:00.000Z`,odometerKm,notes:""});
const ride=(id,day,distanceKm,wheelId="one")=>({id,wheelId,name:id,at:`${day}T12:00:00.000Z`,localDate:day,timeZone:"UTC",distanceKm,tripId:null,notes:""});
const stateWith=(readings=[],rides=[],wheels=[wheel])=>d.project([d.makeOperation(d.project([]),"test-device",[
  ...wheels.map(value=>({kind:"wheel",entityId:value.id,value})),...readings.map(value=>({kind:"reading",entityId:value.id,value})),...rides.map(value=>({kind:"ride",entityId:value.id,value})),
])]);

test("km/d uses 70 km / 7 calendar days from the same vehicle, never the other vehicle",()=>{
  const state=stateWith([reading("a","2026-01-02",110),reading("b","2026-01-09",180),reading("other","2026-01-08",25,"two")],[],[wheel,second]);
  const result=stats.rideEntries(state).find(entry=>entry.reading.id==="b");
  assert.equal(result.intervalDays,7);assert.equal(result.kmPerDay,10);assert.equal(result.distanceKm,70);
});
test("first km/d starts at the baseline; same-day intervals are one day; unknown distance stays unknown",()=>{
  const state=stateWith([reading("first","2026-01-01",120),{...reading("same","2026-01-01",125),at:"2026-01-01T13:00:00.000Z"}],[ride("unknown","2026-01-02",null)]);
  const entries=stats.rideEntries(state);
  assert.equal(entries.find(e=>e.reading?.id==="first").kmPerDay,20);
  assert.equal(entries.find(e=>e.reading?.id==="same").kmPerDay,5);
  assert.equal(entries.find(e=>e.ride?.id==="unknown").kmPerDay,null);
});
test("km/d uses calendar dates over daylight-saving changes and accepts distance-only rides",()=>{
  const localWheel={...wheel,baselineDate:"2026-03-28"};
  const state=stateWith([],[{...ride("dst-a","2026-03-29",10),at:"2026-03-28T23:30:00.000Z",timeZone:"Europe/Vilnius"},{...ride("dst-b","2026-04-05",70),at:"2026-04-04T22:30:00.000Z",timeZone:"Europe/Vilnius"}],[localWheel]);
  const entry=stats.rideEntries(state).find(e=>e.ride.id==="dst-b");assert.equal(entry.intervalDays,7);assert.equal(entry.kmPerDay,10);
});
test("an odometer estimate keeps its odometer interval despite an intervening distance-only ride",()=>{
  const state=stateWith([reading("a","2026-01-02",110),reading("b","2026-01-09",180)],[ride("standalone","2026-01-08",8)]);
  const entry=stats.rideEntries(state).find(e=>e.reading?.id==="b");assert.equal(entry.intervalDays,7);assert.equal(entry.kmPerDay,10);
});
test("inserting a historical reading recomputes the next km/d without changing the database",()=>{
  const a=reading("a","2026-01-02",110),b=reading("b","2026-01-09",180),insert=reading("insert","2026-01-06",120);
  const initial=stats.rideEntries(stateWith([a,b])).find(e=>e.reading.id==="b");
  const updatedState=stateWith([a,b,insert]),before=JSON.stringify(updatedState.reading);
  const updated=stats.rideEntries(updatedState).find(e=>e.reading.id==="b");
  assert.equal(initial.kmPerDay,10);assert.equal(updated.kmPerDay,20);assert.equal(JSON.stringify(updatedState.reading),before);
});
test("km/d and notes are sortable in both directions with stable ties",()=>{
  const state=stateWith([],[{...ride("slow","2026-01-08",70),notes:"A much longer note"},{...ride("fast","2026-01-09",30),notes:"-"}]);
  const entries=stats.rideEntries(state);
  assert.equal(stats.sortRideEntries(entries,state,"daily","desc")[0].name,"fast");
  assert.equal(stats.sortRideEntries(entries,state,"daily","asc")[0].name,"slow");
  assert.equal(stats.sortRideEntries(entries,state,"notes","desc")[0].name,"slow");
});
test("empty mobile cells distinguish real information from zero and dash placeholders",()=>{
  for(const value of [null,undefined,0,"","   ","-","—"," – ",NaN])assert.equal(stats.hasCellValue(value),false);
  for(const value of [0.1,10,"A note","Lynx-S","0 km remaining"])assert.equal(stats.hasCellValue(value),true);
});
test("hiding an older high-mileage vehicle removes its date range and values from all analytics series",()=>{
  const old={...wheel,baselineDate:"2024-01-01"},recent={...second,baselineDate:"2026-08-01"};
  const state=stateWith([],[ride("old","2024-01-05",8000),ride("recent-a","2026-08-03",25,"two"),ride("recent-b","2026-08-10",35,"two")],[old,recent]);
  for(const points of [stats.dailySeries(state,["two"]),stats.cumulativeSeries(state,["two"]),stats.monthlySeries(state,"en-US",["two"])]){
    assert.ok(points.every(p=>p.date.startsWith("2026-08")));assert.ok(points.every(p=>!("one"in p)));assert.ok(points.every(p=>p.total<=60));
  }
  assert.deepEqual(stats.cumulativeSeries(state,["two"]).map(p=>p.two),[25,60]);
  assert.deepEqual(stats.dailySeries(state,[]),[]);assert.deepEqual(stats.monthlySeries(state,"en-US",[]),[]);assert.deepEqual(stats.cumulativeSeries(state,[]),[]);
});
test("chart fit ignores hidden totals, fills the vertical space and keeps bar zero baselines",()=>{
  const data=[{date:"2026-01-01",one:9000,two:20,total:9020},{date:"2026-01-02",one:12000,two:60,total:12060}];
  assert.deepEqual(stats.fitChartDomain(data,["two"],"stacked"),[0,63]);
  assert.deepEqual(stats.fitChartDomain(data,["two"],"line"),[18,62]);
  const zoom=stats.fitChartDomain(data.slice(0,1),["two"],"line");assert.deepEqual(zoom,[19,21]);
  assert.deepEqual(stats.fitChartDomain(data,["one","two"],"stacked"),[0,12663]);
});
test("empty and all-zero chart selections always have a finite usable domain",()=>{
  assert.deepEqual(stats.fitChartDomain([],[],"line"),[0,1]);
  assert.deepEqual(stats.fitChartDomain([{date:"x",total:0,one:0}],["one"],"line"),[0,1]);
  assert.deepEqual(stats.fitChartDomain([{date:"x",total:7,one:7}],[],"stacked"),[0,1]);
});

const flush=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
function fakeClock(){
  let time=0,id=0;const timers=new Map();
  return {now:()=>time,setTimeout:(callback,delay)=>{const handle=++id;timers.set(handle,{at:time+delay,callback});return handle;},clearTimeout:handle=>timers.delete(handle),
    advance:async ms=>{const end=time+ms;await flush();for(let safety=0;safety<1000;safety++){
      const next=[...timers].filter(([,value])=>value.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];
      if(!next){time=end;await flush();return;}time=next[1].at;timers.delete(next[0]);next[1].callback();await flush();
    }throw new Error("Timer loop did not settle");},pending:()=>timers.size};
}
test("automatic sync polls every minute even when there are no local writes",async()=>{
  const clock=fakeClock(),calls=[],scheduler=new AutoSyncScheduler(async manual=>{calls.push({at:clock.now(),manual});return "success";},clock);
  scheduler.setActive(true);await clock.advance(0);await clock.advance(59999);assert.equal(calls.length,1);
  await clock.advance(1);assert.deepEqual(calls,[{at:0,manual:false},{at:60000,manual:false}]);scheduler.setActive(false);
});
test("new changes debounce, wake events throttle, and hiding or going offline cancels scheduled work",async()=>{
  const clock=fakeClock(),calls=[],scheduler=new AutoSyncScheduler(async()=>{calls.push(clock.now());return "success";},clock);
  scheduler.setActive(true);await clock.advance(0);scheduler.wake();scheduler.wake();await clock.advance(4999);assert.equal(calls.length,1);
  await clock.advance(1);assert.equal(calls.length,2);
  scheduler.changed();await clock.advance(500);scheduler.changed();await clock.advance(1499);assert.equal(calls.length,2);
  await clock.advance(1);assert.equal(calls.length,3);
  scheduler.setActive(false);await clock.advance(600000);assert.equal(calls.length,3);assert.equal(clock.pending(),0);
  scheduler.setActive(true);await clock.advance(0);assert.equal(calls.length,4);scheduler.setActive(false);
});
test("transient failures retry with backoff instead of disabling automatic sync",async()=>{
  const clock=fakeClock(),calls=[],scheduler=new AutoSyncScheduler(async()=>{calls.push(clock.now());return calls.length<3?"retry":"success";},clock);
  scheduler.setActive(true);await clock.advance(0);scheduler.changed();scheduler.wake();await clock.advance(4999);assert.equal(calls.length,1);
  await clock.advance(1);assert.equal(calls.length,2);await clock.advance(10000);assert.equal(calls.length,3);
  assert.deepEqual(calls,[0,5000,15000]);await clock.advance(60000);assert.equal(calls.length,4);scheduler.setActive(false);
});
test("automatic sync does not overlap uploads and follows changes made during an upload",async()=>{
  const clock=fakeClock();let finish,calls=0;
  const scheduler=new AutoSyncScheduler(async()=>{calls++;if(calls===1)return new Promise(resolve=>{finish=resolve;});return "success";},clock);
  scheduler.setActive(true);await clock.advance(0);scheduler.changed();scheduler.wake();await clock.advance(120000);assert.equal(calls,1);
  finish("success");await flush();await clock.advance(1499);assert.equal(calls,1);await clock.advance(1);assert.equal(calls,2);scheduler.setActive(false);
});
test("permissions or integrity errors stop background retries until an explicit retry",async()=>{
  const clock=fakeClock(),calls=[],scheduler=new AutoSyncScheduler(async manual=>{calls.push(manual);return calls.length===1?"blocked":"success";},clock);
  scheduler.setActive(true);await clock.advance(0);scheduler.changed();scheduler.wake();await clock.advance(600000);assert.deepEqual(calls,[false]);
  scheduler.setActive(false);scheduler.setActive(true);await clock.advance(60000);assert.deepEqual(calls,[false]);
  await scheduler.requestNow();await flush();assert.deepEqual(calls,[false,true]);scheduler.setActive(false);
});
test("manual sync remains available with automatic sync disabled",async()=>{
  const clock=fakeClock(),calls=[],scheduler=new AutoSyncScheduler(async manual=>{calls.push(manual);return "success";},clock);
  await scheduler.requestNow();await flush();await clock.advance(600000);assert.deepEqual(calls,[true]);assert.equal(clock.pending(),0);
});
test("retry classification does not treat invalid access or missing history as a transient failure",()=>{
  for(const error of [new TypeError("Failed to fetch"),{status:429},{status:503},{status:408}])assert.equal(syncFailureKind(error),"retry");
  for(const error of [new Error("History is missing"),{status:401},{status:403},{status:400},new DOMException("Aborted","AbortError")])assert.equal(syncFailureKind(error),"blocked");
});
