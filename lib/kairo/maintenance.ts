import {localDateTime,roundKm,today,uuid,wheelStats,type Maintenance,type State} from "./domain";

type Copy={en:string;lt:string};
type Language="en"|"lt";
type Interval={km?:number;days?:number;months?:number};
export type MaintenanceTemplate={
  id:string;category:Maintenance["category"];
  group:"inspection"|"condition"|"other";
  title:Copy;cadence:Copy;guidance:Copy;
  interval:Interval;repeat:boolean;gear?:boolean;
};
const copy=(en:string,lt:string):Copy=>({en,lt});

// User-suggested inspection reminders, NOT a manufacturer's service schedule.
// The lower end of each suggested range is the editable starting point.
export const MAINTENANCE_TEMPLATES:readonly MaintenanceTemplate[]=[
  {
    id:"safety_check",category:"custom",group:"inspection",
    title:copy("Pre-ride safety check","Trumpa saugos apžiūra"),
    cadence:copy("Before every ride","Prieš kiekvieną važiavimą"),
    guidance:copy("Check tire damage, pedal play, lights, warnings and unusual noises. This is a checklist, not a calendar or mileage interval.","Patikrink padangos pažeidimus, pedalų laisvumą, žibintus, įspėjimus ir neįprastus garsus. Tai kontrolinis sąrašas, ne datos ar ridos intervalas."),
    interval:{},repeat:false,
  },
  {
    id:"tire_pressure",category:"custom",group:"inspection",
    title:copy("Check tire pressure","Padangos slėgio matavimas"),
    cadence:copy("100–200 km or 1 week; also before a long ride","100–200 km arba savaitė; taip pat prieš ilgą važiavimą"),
    guidance:copy("Measure a cold tire. Follow the specific vehicle and tire instructions; no universal pressure is assumed. Default: 100 km / 7 days.","Matuok šaltą padangą. Vadovaukis konkrečios priemonės ir padangos instrukcija; universalaus slėgio nėra. Pradinis intervalas: 100 km / 7 d."),
    interval:{km:100,days:7},repeat:true,
  },
  {
    id:"tire_tread",category:"tire_tread",group:"inspection",
    title:copy("Inspect tire tread, sidewalls and valve","Protektoriaus, šonų ir ventilio patikra"),
    cadence:copy("300–500 km or 1 month","300–500 km arba mėnuo"),
    guidance:copy("Look for wear, cuts, cracks, bulges, foreign objects and pressure loss. Inspect condition; do not replace solely because this interval was reached. Default: 300 km / 1 month.","Įvertink nusidėvėjimą, įpjovimus, įtrūkimus, iškilimus, svetimkūnius ir slėgio praradimą. Intervalas skirtas patikrai, ne automatiniam keitimui. Pradinis: 300 km / 1 mėn."),
    interval:{km:300,months:1},repeat:true,
  },
  {
    id:"rim",category:"custom",group:"inspection",
    title:copy("Inspect rim","Ratlankio apžiūra"),
    cadence:copy("500 km and after a hard impact","500 km ir po stipraus smūgio"),
    guidance:copy("Check dents, cracks, tire seating and unusual wobble. A hard impact warrants an earlier check; the app cannot detect impacts.","Patikrink įlenkimus, įtrūkimus, padangos sėdėjimą ir neįprastą mušimą. Po stipraus smūgio tikrink anksčiau; programėlė smūgių neaptinka."),
    interval:{km:500},repeat:true,
  },
  {
    id:"pedals",category:"custom",group:"inspection",
    title:copy("Inspect pedals, hinges, axles and pins","Pedalų, šarnyrų, ašių ir smeigių patikra"),
    cadence:copy("500 km or 1 month","500 km arba mėnuo"),
    guidance:copy("Look for play, cracks, wear, missing parts and loose components.","Įvertink laisvumą, įtrūkimus, nusidėvėjimą, trūkstamus ar atsilaisvinusius elementus."),
    interval:{km:500,months:1},repeat:true,
  },
  {
    id:"fasteners_initial",category:"custom",group:"inspection",
    title:copy("Initial structural fastener check","Pirmoji konstrukcinių tvirtinimų patikra"),
    cadence:copy("After the first 100–300 km; one-off break-in check","Po pirmųjų 100–300 km; vienkartinė pradinė patikra"),
    guidance:copy("Use only when appropriate for a new vehicle's break-in. The suggested target is the current record + 100 km; adjust it if some break-in distance is already covered. Use specified torque. Afterwards, add the regular fastener inspection.","Tinka naujos priemonės pradinei patikrai. Siūlomas tikslas: dabartinis rodmuo + 100 km; pakoreguok, jei dalis pradinio atstumo jau nuvažiuota. Veržk tik numatytu momentu. Vėliau pridėk periodinę tvirtinimų patikrą."),
    interval:{km:100},repeat:false,
  },
  {
    id:"fasteners",category:"custom",group:"inspection",
    title:copy("Inspect structural fasteners","Periodinė konstrukcinių tvirtinimų patikra"),
    cadence:copy("500–1,000 km or 3 months","500–1 000 km arba 3 mėn."),
    guidance:copy("Inspect accessible fasteners for looseness and movement. Tighten only to the specified torque, not as hard as possible. Default: 500 km / 3 months.","Patikrink prieinamų tvirtinimų atsilaisvinimą ir judėjimą. Veržk tik numatytu momentu, ne kuo stipriau. Pradinis intervalas: 500 km / 3 mėn."),
    interval:{km:500,months:3},repeat:true,
  },
  {
    id:"bearings",category:"bearings",group:"inspection",
    title:copy("Inspect motor bearings","Variklio guolių būklės patikra"),
    cadence:copy("1,000 km or 3 months","1 000 km arba 3 mėn."),
    guidance:copy("Check new humming, rough rotation, cracking sounds or play. This is an inspection, not an automatic bearing replacement.","Įvertink naują ūžimą, šiurkštų sukimąsi, traškėjimą ar laisvumą. Tai patikra, ne automatinis guolių keitimas."),
    interval:{km:1000,months:3},repeat:true,
  },
  {
    id:"suspension_clean",category:"custom",group:"inspection",
    title:copy("Clean and inspect suspension exterior","Amortizacijos išorės valymas ir apžiūra"),
    cadence:copy("200–500 km and after a muddy or dusty ride","200–500 km ir po purvino ar dulkėto važiavimo"),
    guidance:copy("Inspect dirt near seals, surface damage and oil leaks. Clean earlier after dirt or dust exposure. Default: 200 km; no invented time interval.","Įvertink nešvarumus prie sandariklių, paviršių pažeidimus ir alyvos nuotėkį. Po purvo ar dulkių valyk anksčiau. Pradinis intervalas: 200 km; laiko intervalas nepriskirtas."),
    interval:{km:200},repeat:true,
  },
  {
    id:"suspension_function",category:"custom",group:"inspection",
    title:copy("Check suspension function","Amortizacijos veikimo patikra"),
    cadence:copy("1,000 km or 3 months","1 000 km arba 3 mėn."),
    guidance:copy("Check sticking, play, changed damping and leaks. Internal servicing follows the specific suspension component's instructions.","Patikrink strigimą, laisvumą, pasikeitusį slopinimą ir nuotėkį. Vidinį aptarnavimą atlik pagal konkretaus amortizatoriaus instrukciją."),
    interval:{km:1000,months:3},repeat:true,
  },
  {
    id:"charging_check",category:"custom",group:"inspection",gear:true,
    title:copy("Inspect charging port and cable","Įkrovimo jungties ir laido apžiūra"),
    cadence:copy("Before every charge","Prieš kiekvieną įkrovimą"),
    guidance:copy("Inspect moisture, damage, blackening, deformation and unusual heat. This is a checklist; the app cannot detect charging or physical condition.","Patikrink drėgmę, pažeidimus, pajuodavimą, deformaciją ir neįprastą kaitimą. Tai kontrolinis sąrašas; programėlė įkrovimo ir fizinės būklės neaptinka."),
    interval:{},repeat:false,
  },
  {
    id:"battery",category:"battery",group:"inspection",
    title:copy("Review battery and BMS records","Baterijos ir BMS rodiklių peržiūra"),
    cadence:copy("1,000 km or 3 months","1 000 km arba 3 mėn."),
    guidance:copy("Review charging changes, errors, temperatures and cell-group voltage differences if available. Do not open the battery. Mileage alone does not determine replacement.","Peržiūrėk įkrovimo pokyčius, klaidas, temperatūras ir elementų grupių įtampų skirtumus, jei prieinami. Baterijos neatidarinėk. Vien rida nenustato keitimo būtinybės."),
    interval:{km:1000,months:3},repeat:true,
  },
  {
    id:"professional_inspection",category:"custom",group:"inspection",
    title:copy("Professional preventive inspection","Bendra profilaktinė apžiūra servise"),
    cadence:copy("1,000–2,000 km or 1 year","1 000–2 000 km arba metai"),
    guidance:copy("Review structure, fasteners, bearings, suspension and, as needed, connections and seals. Not a requirement for a complete teardown each time. General Voltride guidance; default: 1,000 km / 12 months.","Įvertink konstrukciją, tvirtinimus, guolius, amortizaciją ir, pagal poreikį, jungtis bei sandarinimą. Nereikia kaskart visiškai išardyti. Bendras Voltride orientyras; pradinis: 1 000 km / 12 mėn."),
    interval:{km:1000,months:12},repeat:true,
  },
  {
    id:"tire_replacement",category:"tire_replacement",group:"condition",
    title:copy("Replace tire — condition based","Padangos keitimas pagal būklę"),
    cadence:copy("Wear, manufacturer limits or damage","Pagal nusidėvėjimą, gamintojo ribas ar pažeidimus"),
    guidance:copy("There is no single replacement mileage for all tires. Assess actual wear and damage against the tire manufacturer's limits. Set a manual reminder only if appropriate.","Vienodas keitimo kilometražas visoms padangoms netinka. Vertink faktinį nusidėvėjimą ir pažeidimus pagal padangos gamintojo ribas. Jei reikia, nustatyk rankinį priminimą."),
    interval:{},repeat:false,
  },
  {
    id:"tube_valve_replacement",category:"custom",group:"condition",
    title:copy("Replace tube or valve — condition based","Kameros ar ventilio keitimas pagal būklę"),
    cadence:copy("Leakage, damage or wear","Aptikus nesandarumą, pažeidimą ar susidėvėjimą"),
    guidance:copy("Assess leakage, damage and wear, including during tire replacement. No universal calendar or mileage replacement interval.","Vertink nesandarumą, pažeidimus ir susidėvėjimą, taip pat keičiant padangą. Universalaus datos ar ridos intervalo nėra."),
    interval:{},repeat:false,
  },
  {
    id:"bearing_replacement",category:"bearings",group:"condition",
    title:copy("Replace bearings — confirmed wear","Guolių keitimas patvirtinus nusidėvėjimą"),
    cadence:copy("Confirmed wear or damage","Patvirtinus nusidėvėjimą ar pažeidimą"),
    guidance:copy("Confirm wear or damage before replacement; a round mileage number alone is not a reason to replace bearings.","Prieš keitimą patvirtink nusidėvėjimą ar pažeidimą; vien apvali rida nėra priežastis keisti guolius."),
    interval:{},repeat:false,
  },
  {
    id:"suspension_service",category:"custom",group:"condition",
    title:copy("Service suspension oil and seals","Amortizatoriaus alyvos ir sandariklių aptarnavimas"),
    cadence:copy("Specific component instructions and condition","Pagal konkretaus komponento instrukciją ir būklę"),
    guidance:copy("Use the component's service instructions, intensity of use and condition. No universal EUC interval is provided; enter your component's interval manually.","Vadovaukis komponento instrukcija, eksploatavimo intensyvumu ir būkle. Universalaus EUC intervalo nėra; įvesk savo komponentui taikomą intervalą."),
    interval:{},repeat:false,
  },
  {
    id:"battery_repair",category:"battery",group:"condition",
    title:copy("Battery diagnostics or repair","Baterijos diagnostika ar remontas"),
    cadence:copy("Professional diagnostics and condition","Pagal profesionalią diagnostiką ir būklę"),
    guidance:copy("Repair or replacement requires diagnostics and condition assessment. Mileage or reduced range alone does not establish replacement need. Do not open the battery yourself.","Remontui ar keitimui reikia diagnostikos ir būklės įvertinimo. Vien rida ar sumažėjęs nuotolis nenustato keitimo poreikio. Pats baterijos neatidarinėk."),
    interval:{},repeat:false,
  },
  {
    id:"insurance",category:"insurance",group:"other",gear:true,
    title:copy("Renew insurance","Atnaujinti draudimą"),
    cadence:copy("Your policy's actual expiry date","Tikroji draudimo galiojimo pabaiga"),
    guidance:copy("Enter the expiry date from your policy. Reminder lead time starts at 14 days and is editable; no policy expiry is guessed.","Įvesk polise nurodytą galiojimo pabaigą. Priminimas numatytai prieš 14 dienų, jį galima keisti; galiojimo datos nespėjame."),
    interval:{},repeat:false,
  },
  {
    id:"custom",category:"custom",group:"other",gear:true,
    title:copy("Custom maintenance task","Individuali priežiūros užduotis"),
    cadence:copy("Your own schedule or condition check","Tavo grafikas arba būklės patikra"),
    guidance:copy("Choose a date, an odometer target, both, or keep an unscheduled checklist. Follow the vehicle and component instructions.","Pasirink datą, odometro tikslą, abu arba palik kontrolinį sąrašą be termino. Vadovaukis priemonės ir komponento instrukcija."),
    interval:{},repeat:false,
  },
];

export const VOLTRIDE_MAINTENANCE_URL="https://voltride.com/electric-unicycle-maintenance-what-you-can-do-yourself-to-keep-your-wheel-in-good-condition/";
export function maintenanceTemplate(id:string):MaintenanceTemplate{
  return MAINTENANCE_TEMPLATES.find(item=>item.id===id)??MAINTENANCE_TEMPLATES.find(item=>item.id==="custom")!;
}
export function templateForMaintenance(item:Maintenance):MaintenanceTemplate{
  // A legacy custom task must never be guessed from its user-written title.
  return maintenanceTemplate(item.templateId??item.category);
}
export function addMaintenanceInterval(day:string,interval:Pick<Interval,"days"|"months">):string{
  const date=new Date(`${day}T12:00:00Z`);
  if(!Number.isFinite(+date)||date.toISOString().slice(0,10)!==day)throw new Error("Enter a valid date.");
  if(interval.months){
    const originalDay=date.getUTCDate();date.setUTCDate(1);date.setUTCMonth(date.getUTCMonth()+interval.months);
    date.setUTCDate(Math.min(originalDay,new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+1,0)).getUTCDate()));
  }
  if(interval.days)date.setUTCDate(date.getUTCDate()+interval.days);
  return date.toISOString().slice(0,10);
}
export function maintenanceOdometer(state:State,targetKind:Maintenance["targetKind"],targetId:string):number|null{
  const wheel=targetKind==="wheel"?state.wheel.find(item=>item.id===targetId):undefined;
  return wheel?wheelStats(wheel,state.reading).odometerKm:null;
}
export function suggestedMaintenanceSchedule(templateId:string,state:State,targetKind:Maintenance["targetKind"],targetId:string,day=today()){
  const template=maintenanceTemplate(templateId),{interval}=template,base=maintenanceOdometer(state,targetKind,targetId);
  return {
    dueDate:interval.days||interval.months?addMaintenanceInterval(day,interval):null,
    dueOdometerKm:interval.km&&base!==null?roundKm(base+interval.km):null,
    repeatKm:template.repeat&&base!==null?interval.km??null:null,
    repeatDays:template.repeat?interval.days??null:null,
    repeatMonths:template.repeat?interval.months??null:null,
  };
}

export type MaintenanceDraft={
  templateId:string;title:string;notes:string;targetKind:Maintenance["targetKind"];targetId:string;
  dateEnabled:boolean;dueDate:string;remindDays:string;mileageEnabled:boolean;dueOdometer:string;
  repeatEnabled:boolean;repeatKm:string;repeatTime:string;repeatUnit:"days"|"months";completed:boolean;
};
export function createMaintenanceDraft(state:State,options:{item?:Maintenance;templateId?:string;targetKind?:Maintenance["targetKind"];targetId?:string;day?:string;language?:Language}={}):MaintenanceDraft{
  const {item,language="en",day=today()}=options;
  const targetKind=item?.targetKind??options.targetKind??(state.wheel.length?"wheel":"gear");
  const targetId=item?.targetId??options.targetId??(targetKind==="wheel"?state.wheel[0]?.id:state.gear[0]?.id)??"";
  const template=maintenanceTemplate(item?.templateId??item?.category??options.templateId??(targetKind==="wheel"?"tire_pressure":"custom"));
  const schedule=item??suggestedMaintenanceSchedule(template.id,state,targetKind,targetId,day);
  return {
    templateId:item?.templateId??template.id,title:item?.title??(template.id==="custom"?"":template.title[language]),notes:item?.notes??"",targetKind,targetId,
    dateEnabled:!!schedule.dueDate||template.id==="insurance",dueDate:schedule.dueDate??"",remindDays:String(item?.remindDaysBefore??(template.id==="insurance"?14:0)),
    mileageEnabled:schedule.dueOdometerKm!==null,dueOdometer:schedule.dueOdometerKm===null?"":String(schedule.dueOdometerKm),
    repeatEnabled:!!(schedule.repeatKm||schedule.repeatDays||schedule.repeatMonths),repeatKm:schedule.repeatKm===null?"":String(schedule.repeatKm),
    repeatTime:!schedule.repeatDays&&!schedule.repeatMonths?"":String(schedule.repeatDays??schedule.repeatMonths),repeatUnit:schedule.repeatDays?"days":"months",completed:!!item?.completedAt,
  };
}
export function selectMaintenanceTemplate(draft:MaintenanceDraft,templateId:string,state:State,day=today(),language:Language="en"):MaintenanceDraft{
  const template=maintenanceTemplate(templateId);
  const targetKind=!template.gear?"wheel":draft.targetKind;
  const targetId=targetKind===draft.targetKind?draft.targetId:(state.wheel[0]?.id??"");
  return {...createMaintenanceDraft(state,{templateId:template.id,targetKind,targetId,day,language}),notes:draft.notes,completed:draft.completed};
}
export function retargetMaintenanceDraft(draft:MaintenanceDraft,state:State,targetKind:Maintenance["targetKind"],targetId:string):MaintenanceDraft{
  const template=maintenanceTemplate(draft.templateId);
  if(targetKind==="gear"&&!template.gear)return {...createMaintenanceDraft(state,{templateId:"custom",targetKind,targetId}),title:draft.title,notes:draft.notes,completed:draft.completed};
  const base=maintenanceOdometer(state,targetKind,targetId);
  return {...draft,targetKind,targetId,mileageEnabled:targetKind==="wheel"&&draft.mileageEnabled,dueOdometer:base!==null&&template.interval.km?String(roundKm(base+template.interval.km)):""};
}
export function toggleMaintenanceReminder(draft:MaintenanceDraft,kind:"date"|"mileage",enabled:boolean,state:State,day=today()):MaintenanceDraft{
  const suggested=suggestedMaintenanceSchedule(draft.templateId,state,draft.targetKind,draft.targetId,day);
  if(kind==="date")return {...draft,dateEnabled:enabled,dueDate:draft.dueDate||suggested.dueDate||""};
  return {...draft,mileageEnabled:enabled&&draft.targetKind==="wheel",dueOdometer:draft.dueOdometer||(suggested.dueOdometerKm===null?"":String(suggested.dueOdometerKm))};
}
function inputNumber(value:string,label:string,positive=false):number{
  const result=Number(value.trim().replace(",","."));
  if(!value.trim()||!Number.isFinite(result)||result<0||(positive&&result===0))throw new Error(`${label}: enter ${positive?"a number greater than zero":"zero or a positive number"}.`);
  return result;
}
export function maintenanceFromDraft(draft:MaintenanceDraft,id:string,original?:Maintenance,now=new Date()):Maintenance{
  if(draft.dateEnabled&&!draft.dueDate)throw new Error("Choose a due date or disable the Date reminder.");
  const template=maintenanceTemplate(draft.templateId),date=draft.dateEnabled,mileage=draft.mileageEnabled&&draft.targetKind==="wheel";
  const repeatTime=draft.repeatEnabled&&date&&draft.repeatTime.trim()?inputNumber(draft.repeatTime,"Repeat interval",true):null;
  const repeatKm=draft.repeatEnabled&&mileage&&draft.repeatKm.trim()?inputNumber(draft.repeatKm,"Repeat distance",true):null;
  if(draft.repeatEnabled&&(date||mileage)&&repeatTime===null&&repeatKm===null)throw new Error("Enter a repeat interval or turn off repetition.");
  return {
    id,title:draft.title,category:original&&draft.templateId===original.templateId?original.category:template.category,
    targetKind:draft.targetKind,targetId:draft.targetId,templateId:draft.templateId,
    dueDate:date?draft.dueDate:null,dueOdometerKm:mileage?inputNumber(draft.dueOdometer,"Due odometer"):null,
    remindDaysBefore:date?inputNumber(draft.remindDays||"0","Reminder days"):null,
    repeatKm,repeatDays:repeatTime!==null&&draft.repeatUnit==="days"?repeatTime:null,repeatMonths:repeatTime!==null&&draft.repeatUnit==="months"?repeatTime:null,
    completedAt:draft.completed?(original?.completedAt??now.toISOString()):null,notes:draft.notes,
  };
}
/** The completion and this successor are saved in ONE operation by the caller. */
export function nextMaintenanceOccurrence(item:Maintenance,state:State,nextId=uuid()):Maintenance|null{
  if(!item.completedAt)return null;
  const days=item.dueDate?item.repeatDays??null:null,months=item.dueDate?item.repeatMonths:null;
  const km=item.dueOdometerKm!==null&&item.targetKind==="wheel"?item.repeatKm:null;
  if(!(days&&days>0)&&!(months&&months>0)&&!(km&&km>0))return null;
  const completedDay=localDateTime(item.completedAt).slice(0,10),base=maintenanceOdometer(state,item.targetKind,item.targetId);
  if(km&&base===null)throw new Error("Select an existing vehicle before repeating mileage-based maintenance.");
  // An explicitly recurring insurance policy keeps its expiry anchor, not the
  // earlier day the user paid for renewal. Its next actual expiry still needs review.
  const anchorDay=item.category==="insurance"&&item.dueDate?item.dueDate:completedDay;
  const dueDate=days||months?addMaintenanceInterval(anchorDay,{days:days??undefined,months:months??undefined}):null;
  return {...item,id:nextId,dueDate,dueOdometerKm:km&&base!==null?roundKm(base+km):null,repeatKm:km,repeatMonths:months,...(item.repeatDays!==undefined?{repeatDays:days}:{}),remindDaysBefore:dueDate?item.remindDaysBefore:null,completedAt:null};
}
