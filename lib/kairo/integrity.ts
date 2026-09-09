import type {Entity,Kind,State} from "./domain";
import type {ErrorLanguage} from "./errors";

export type IntegrityNotice={title:string;message:string;action:string;count:number};
const kindName:Record<Kind,[string,string]>={wheel:["vehicle","transporto priemonės"],reading:["odometer record","odometro įrašo"],ride:["ride","važiavimo"],trip:["trip","kelionės"],gear:["gear item","ekipuotės elemento"],maintenance:["maintenance task","priežiūros užduoties"],attachment:["original file","originalaus failo"],goal:["goal","tikslo"]};
const entityLabel=(entity:Entity|undefined)=>{
  if(!entity)return "";
  if("name" in entity&&typeof entity.name==="string"&&entity.name.trim())return entity.name.trim();
  if("title" in entity&&typeof entity.title==="string"&&entity.title.trim())return entity.title.trim();
  if("localDate" in entity&&typeof entity.localDate==="string")return entity.localDate;
  if("at" in entity&&typeof entity.at==="string")return entity.at.slice(0,10);
  return "";
};

export function describeIntegrity(issues:string[],state:State,language:ErrorLanguage="en"):IntegrityNotice|null{
  if(!issues.length)return null;
  const first=issues[0],match=/^Record history is incomplete:\s*([a-z]+):([^\s.]+)\.$/i.exec(first);
  let subject=language==="lt"?"įrašo":"record";
  if(match&&match[1] in kindName){
    const kind=match[1] as Kind,entity=state[kind].find(item=>item.id===match[2]) as Entity|undefined,label=entityLabel(entity);
    subject=`${kindName[kind][language==="lt"?1:0]}${label?` “${label}”`:""}`;
  }
  const more=issues.length>1?(language==="lt"?` Dar ${issues.length-1} susijusi problema${issues.length-1===1?"":"os"}.`:` ${issues.length-1} more related issue${issues.length-1===1?"":"s"}.`):"";
  return language==="lt"?{
    title:"Įrašo istorija nepilna",
    message:`Trūksta ankstesnės ${subject} versijos. Sinchronizavimas pristabdytas, kad nebūtų sukurti neteisingi duomenys.${more}`,
    action:"Atkurk pilną JSON kopiją per Nustatymai → Import / Export ir sinchronizuok dar kartą.",count:issues.length,
  }:{
    title:"Record history is incomplete",
    message:`An earlier saved version of the ${subject} is missing. Synchronization is paused to prevent incorrect data.${more}`,
    action:"Restore a complete JSON backup in Settings → Import / Export, then sync again.",count:issues.length,
  };
}
