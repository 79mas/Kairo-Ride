/** A foreground-only scheduler. It never opens OAuth dialogs or stores tokens. */
export type SyncOutcome="success"|"retry"|"blocked"|"inactive";
type Clock={now:()=>number;setTimeout:(callback:()=>void,delay:number)=>unknown;clearTimeout:(id:unknown)=>void};
const systemClock:Clock={now:()=>Date.now(),setTimeout:(callback,delay)=>setTimeout(callback,delay),clearTimeout:id=>clearTimeout(id as ReturnType<typeof setTimeout>)};
export const SYNC_INTERVAL_MS=60_000;
export const SYNC_DEBOUNCE_MS=1_500;

export class AutoSyncScheduler {
  private active=false;
  private blocked=false;
  private timer:unknown;
  private deadline=Infinity;
  private running:Promise<SyncOutcome>|null=null;
  private lastStarted=-Infinity;
  private failures=0;
  private changedWhileRunning=false;
  private manualQueued=false;
  constructor(private run:(manual:boolean)=>Promise<SyncOutcome>,private clock:Clock=systemClock){}
  setActive(active:boolean){
    if(this.active===active)return;
    this.active=active;this.cancelTimer();
    if(active&&!this.blocked){this.failures=0;this.schedule(0);}
    if(!active)this.manualQueued=false;
  }
  /** Focus/pageshow wakes are throttled, unlike explicit Sync now. */
  wake(){if(this.active&&!this.blocked&&!this.running&&!this.failures)this.schedule(Math.max(0,5_000-(this.clock.now()-this.lastStarted)));}
  changed(){
    if(!this.active||this.blocked)return;
    if(this.running){this.changedWhileRunning=true;return;}
    if(!this.failures)this.schedule(SYNC_DEBOUNCE_MS,true);
  }
  requestNow():Promise<SyncOutcome>{
    this.blocked=false;this.failures=0;this.cancelTimer();
    if(this.running){this.manualQueued=true;return this.running;}
    return this.start(true);
  }
  private cancelTimer(){if(this.timer!==undefined)this.clock.clearTimeout(this.timer);this.timer=undefined;this.deadline=Infinity;}
  private schedule(delay:number,replace=false){
    if(!this.active||this.blocked)return;
    const deadline=this.clock.now()+delay;if(!replace&&this.deadline<=deadline)return;
    this.cancelTimer();this.deadline=deadline;
    this.timer=this.clock.setTimeout(()=>{this.timer=undefined;this.deadline=Infinity;void this.start(false);},delay);
  }
  private start(manual:boolean):Promise<SyncOutcome>{
    if(this.running)return this.running;
    if(!manual&&(!this.active||this.blocked))return Promise.resolve("inactive");
    this.cancelTimer();this.lastStarted=this.clock.now();this.changedWhileRunning=false;
    // Promise.resolve also captures synchronous adapter failures without leaking a rejection.
    const operation=Promise.resolve().then(()=>this.run(manual)).catch(()=>"blocked" as const);
    this.running=operation;
    void operation.then(outcome=>{
      this.running=null;
      if(this.manualQueued){this.manualQueued=false;void this.requestNow();return;}
      if(outcome==="blocked"||outcome==="inactive"){this.blocked=true;return;}
      if(outcome==="retry"){
        this.failures++;this.schedule(Math.min(300_000,5_000*2**Math.min(6,this.failures-1)));return;
      }
      this.failures=0;this.schedule(this.changedWhileRunning?SYNC_DEBOUNCE_MS:SYNC_INTERVAL_MS);
    });
    return operation;
  }
}

/** Only retry network failures, throttling and server errors automatically. */
export function syncFailureKind(error:unknown):"retry"|"blocked"{
  const status=typeof error==="object"&&error!==null&&"status"in error?Number(error.status):NaN;
  return error instanceof TypeError||status===408||status===429||status>=500?"retry":"blocked";
}
