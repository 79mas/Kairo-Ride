export type ErrorLanguage="en"|"lt";
export type UserErrorExplanation={title:string;message:string;action:string};

const uuid=/\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi;
const accountNamespace=/\bgoogle:\d+\b/gi;
const technical=/^(?:\[\{|\{|TypeError:|RangeError:|AbortError:)|"code"\s*:|unrecognized_keys|invalid_type/i;
const text=(language:ErrorLanguage,en:string,lt:string)=>language==="lt"?lt:en;
const rawMessage=(error:unknown)=>{
  if(error instanceof Error)return error.message||error.name;
  if(typeof error==="string")return error;
  try{return JSON.stringify(error);}catch{return String(error);}
};
const clean=(value:string)=>value.replace(uuid,"the affected record").replace(accountNamespace,"the connected account").replace(/\s+/g," ").trim().slice(0,600);

function validationFields(error:unknown,raw:string){
  const source=typeof error==="object"&&error!==null&&"issues" in error?(error as {issues?:unknown}).issues:(()=>{try{return JSON.parse(raw);}catch{return null;}})();
  if(!Array.isArray(source))return [];
  const fields=new Set<string>();
  for(const issue of source){
    if(!issue||typeof issue!=="object")continue;
    const row=issue as {path?:unknown;keys?:unknown};
    if(Array.isArray(row.path)&&row.path.length)fields.add(row.path.map(String).join("."));
    if(Array.isArray(row.keys))for(const key of row.keys)fields.add(String(key));
  }
  return [...fields].filter(Boolean).slice(0,8);
}

/** Converts technical failures into a title, plain-language meaning and next action.
 * Raw errors remain available only inside the expandable Diagnostics details. */
export function explainError(error:unknown,language:ErrorLanguage="en"):UserErrorExplanation{
  const raw=rawMessage(error),message=clean(raw),lower=raw.toLowerCase(),name=error instanceof Error?error.name:"";
  const fields=validationFields(error,raw);
  if(name==="AbortError"||/signal is aborted|aborted without reason/.test(lower))return {
    title:text(language,"Action stopped","Veiksmas sustabdytas"),
    message:text(language,"The interrupted operation did not remove any saved records or local files.","Nutrauktas veiksmas nepašalino jokių išsaugotų įrašų ar vietinių failų."),
    action:text(language,"Resume it when you are ready.","Kai būsi pasiruošęs, tęsk veiksmą."),
  };
  if(name==="QuotaExceededError"||/device storage is full|not enough space/.test(lower))return {
    title:text(language,"This device is out of storage space","Šiame įrenginyje trūksta vietos"),
    message:text(language,"The new change or file was not saved; earlier data is unchanged.","Naujas pakeitimas ar failas neišsaugotas; ankstesni duomenys nepakeisti."),
    action:text(language,"Export a JSON backup, free some storage, then try again.","Eksportuok JSON kopiją, atlaisvink vietos ir bandyk dar kartą."),
  };
  if(/failed to fetch|could not reach google drive|networkerror|network request failed/.test(lower))return {
    title:text(language,"Google Drive could not be reached","Nepavyko pasiekti Google Drive"),
    message:text(language,"The network, browser privacy protection or Google temporarily blocked the request. Local data is safe.","Užklausą laikinai sustabdė tinklas, naršyklės privatumo apsauga arba Google. Vietiniai duomenys saugūs."),
    action:text(language,"Check the connection, reopen Kairo Ride and press Refresh access, then Sync now.","Patikrink ryšį, iš naujo atverk Kairo Ride, paspausk Atnaujinti prieigą ir Sinchronizuoti."),
  };
  if(/invalid time value|invalid date/.test(lower))return {
    title:text(language,"A date could not be displayed","Nepavyko parodyti datos"),
    message:text(language,"A chart or record contained a date that this view could not interpret. Your data was not changed.","Grafike ar įraše buvo data, kurios šis vaizdas negalėjo suprasti. Duomenys nepakeisti."),
    action:text(language,"Update the app and reopen Analytics. If it repeats, create a Diagnostics report.","Atnaujink programą ir iš naujo atverk Analitiką. Jei kartojasi, sukurk diagnostikos ataskaitą."),
  };
  if(/history is incomplete|data history is missing|missing history|linked to .*removed or has not synced/.test(lower))return {
    title:text(language,"Record history is incomplete","Įrašo istorija nepilna"),
    message:text(language,"An earlier saved revision is missing, so synchronization paused to avoid producing incorrect data.","Trūksta ankstesnės išsaugotos versijos, todėl sinchronizavimas pristabdytas, kad nesukurtų neteisingų duomenų."),
    action:text(language,"Restore a complete JSON backup in Settings → Import / Export, then sync again.","Atkurk pilną JSON kopiją per Nustatymai → Import / Export ir sinchronizuok dar kartą."),
  };
  if(fields.length||technical.test(raw))return {
    title:text(language,"Saved data needs a compatibility check","Išsaugintiems duomenims reikia suderinamumo patikros"),
    message:fields.length?text(language,`This app version did not recognize these fields: ${fields.join(", ")}.`,`Ši programos versija neatpažino šių laukų: ${fields.join(", ")}.`):text(language,"The received data did not match the format expected by this app version.","Gauti duomenys neatitiko formato, kurio tikėjosi ši programos versija."),
    action:text(language,"Confirm that every device uses the latest version. Then import a current JSON backup or create a Diagnostics report.","Patikrink, ar visuose įrenginiuose naudojama naujausia versija. Tada importuok dabartinę JSON kopiją arba sukurk diagnostikos ataskaitą."),
  };
  if(/access expired|refresh google access|status.?401/.test(lower))return {
    title:text(language,"Google access expired","Baigėsi Google prieigos galiojimas"),
    message:text(language,"Kairo Ride kept all changes on this device but cannot reach its Drive folder yet.","Kairo Ride išsaugojo visus pakeitimus šiame įrenginyje, bet kol kas negali pasiekti Drive aplanko."),
    action:text(language,"Open Settings → Synchronization and press Refresh access.","Atverk Nustatymai → Sinchronizavimas ir paspausk Atnaujinti prieigą."),
  };
  if(/permission was not granted|google denied|status.?403|drive permission/.test(lower))return {
    title:text(language,"Google Drive permission is unavailable","Google Drive leidimas nepasiekiamas"),
    message:text(language,"The request was denied. Records and files remain on this device.","Užklausa atmesta. Įrašai ir failai liko šiame įrenginyje."),
    action:text(language,"Refresh access. If it repeats, the project owner should check OAuth and Drive API settings.","Atnaujink prieigą. Jei kartojasi, projekto savininkas turi patikrinti OAuth ir Drive API nustatymus."),
  };
  if(/rate.?limit|status.?429|google is unavailable/.test(lower))return {
    title:text(language,"Google Drive is temporarily busy","Google Drive laikinai užimtas"),
    message:text(language,"Synchronization did not finish, but local data is safe.","Sinchronizavimas nebaigtas, tačiau vietiniai duomenys saugūs."),
    action:text(language,"Leave automatic sync enabled or try Sync now later.","Palik įjungtą automatinį sinchronizavimą arba bandyk vėliau."),
  };
  const useful=message&&message.length<=360&&!technical.test(message)?message:text(language,"The requested action could not be completed. Earlier records and local files were not removed.","Nepavyko atlikti prašyto veiksmo. Ankstesni įrašai ir vietiniai failai nebuvo pašalinti.");
  return {
    title:text(language,"Action could not be completed","Veiksmo atlikti nepavyko"),
    message:useful,
    action:text(language,"Try once more. If it repeats, open Settings → Diagnostics and create a report.","Bandyk dar kartą. Jei kartojasi, atverk Nustatymai → Diagnostika ir sukurk ataskaitą."),
  };
}

export function friendlyError(error:unknown,language:ErrorLanguage="en"){
  const value=explainError(error,language);return `${value.title}. ${value.message} ${value.action}`;
}

const codeTitle=(code:string,language:ErrorLanguage)=>{
  const known:Record<string,[string,string]>={
    "APP.STARTED":["Application opened","Programa atidaryta"],"ACCOUNT.ACTIVATED":["Google account workspace opened","Atverta Google paskyros duomenų erdvė"],
    "DRIVE.SYNC_COMPLETE":["Synchronization completed","Sinchronizavimas baigtas"],"DRIVE.SYNC_CANCELLED":["Synchronization stopped safely","Sinchronizavimas saugiai sustabdytas"],
    "DRIVE.SYNC_FAILED":["Google Drive synchronization did not finish","Google Drive sinchronizavimas nebaigtas"],"DRIVE.FILE_PARTIAL":["Some original files were not uploaded","Kai kurie originalūs failai neįkelti"],
    "UI.CRASH":["A screen could not be displayed","Nepavyko parodyti ekrano"],"JS.UNHANDLED":["An unexpected app error occurred","Įvyko netikėta programos klaida"],"JS.REJECTION":["A background action failed","Foninis veiksmas nepavyko"],
    "DB.OPEN_FAILED":["Local data could not be opened","Nepavyko atverti vietinių duomenų"],"DB.MIGRATION_COMPLETE":["Local data was upgraded","Vietiniai duomenys atnaujinti"],
    "RECORD.SAVED":["Record saved on this device","Įrašas išsaugotas šiame įrenginyje"],"RECORD.SAVE_FAILED":["Record was not saved","Įrašas neišsaugotas"],
    "FILES.SAVED_LOCAL":["Original files saved on this device","Originalūs failai išsaugoti šiame įrenginyje"],"FILES.SAVE_LOCAL_FAILED":["Original file was not saved","Originalus failas neišsaugotas"],
    "IMPORT.COMPLETE":["Import completed","Importas baigtas"],"IMPORT.FAILED":["Import did not complete","Importas nebaigtas"],"EXPORT.PREPARE_FAILED":["Export could not be prepared","Nepavyko paruošti eksporto"],
    "DIAGNOSTICS.SELF_CHECK":["Application self-check completed","Programos savikontrolė baigta"],"SYNC.CONFLICT_RESOLVED":["Synchronization conflict resolved","Sinchronizavimo konfliktas išspręstas"],
  };
  const exact=known[code];if(exact)return text(language,...exact);
  const words=code.toLowerCase().replace(/[._-]+/g," ").replace(/\b\w/g,value=>value.toUpperCase());
  return text(language,words||"Application event",words||"Programos įvykis");
};

export function explainDiagnosticEvent(code:string,message:string,level:string,language:ErrorLanguage="en"):UserErrorExplanation{
  const title=codeTitle(code,language),isFailure=level==="error"||level==="critical"||/FAILED|CRASH|UNHANDLED|REJECTION|PARTIAL/.test(code);
  if(isFailure){const explained=explainError(new Error(message),language);return {title,message:explained.message,action:explained.action};}
  return {title,message:clean(message)||text(language,"The application recorded this event.","Programa užfiksavo šį įvykį."),action:""};
}
