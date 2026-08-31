import {readNumberFormat,saveNumberFormat,numberPreferenceKey,type NumberFormat} from "./numbers";
import {createContext,useContext,useEffect,useMemo,useState,type ReactNode} from "react";
import {calendarPreferenceKey,readCalendarPreferences,saveCalendarPreferences,DEFAULT_CALENDAR,type CalendarPreferences} from "./calendar";

export type Language="en"|"lt";
const LANGUAGE_KEY="kairo-language";

type I18n=CalendarPreferences & {
  numberFormat:NumberFormat; setNumberFormat:(value:NumberFormat)=>void;
  language:Language;
  locale:string;
  setLanguage:(language:Language)=>void;
  tr:(english:string,lithuanian?:string)=>string;
  setCalendar:(value:Partial<CalendarPreferences>)=>void;
};

const fallback:I18n={numberFormat:"space-comma",setNumberFormat:()=>{},language:"en",locale:"en-US",setLanguage:()=>{},tr:english=>english,...DEFAULT_CALENDAR,setCalendar:()=>{}};
const Context=createContext<I18n>(fallback);

export function LanguageProvider({children}:{children:ReactNode}){
  const [numberFormat,setNumberState]=useState(readNumberFormat);
  const setNumberFormat=(value:NumberFormat)=>{saveNumberFormat(value);setNumberState(value);};
  useEffect(()=>{const update=(e:StorageEvent)=>{if(e.key===numberPreferenceKey())setNumberState(readNumberFormat());};window.addEventListener("storage",update);return()=>window.removeEventListener("storage",update);},[]);
  const [calendar,setCalendarState]=useState(readCalendarPreferences);
  const setCalendar=(patch:Partial<CalendarPreferences>)=>{setCalendarState(current=>{const next={...current,...patch};saveCalendarPreferences(next);return next;});};
  useEffect(()=>{const update=(event:StorageEvent)=>{if(event.key===calendarPreferenceKey())setCalendarState(readCalendarPreferences());};window.addEventListener("storage",update);return()=>window.removeEventListener("storage",update);},[]);
  const [language,setLanguageState]=useState<Language>(()=>{
    if(typeof window==="undefined")return "en";
    return localStorage.getItem(LANGUAGE_KEY)==="lt"?"lt":"en";
  });
  const setLanguage=(next:Language)=>{localStorage.setItem(LANGUAGE_KEY,next);setLanguageState(next);};
  useEffect(()=>{document.documentElement.lang=language;},[language]);
  const value=useMemo<I18n>(()=>({
    language,numberFormat,setNumberFormat,
    locale:language==="lt"?"lt-LT":"en-US",
    setLanguage,
    ...calendar,setCalendar,
    tr:(english,lithuanian)=>language==="lt"?(lithuanian??english):english,
  }),[language,calendar,numberFormat]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useI18n(){return useContext(Context);}

export const ltGearCategories={
  helmet:"Šalmai",footwear:"Avalynė",protection:"Apsaugos",gloves:"Pirštinės",clothing:"Apranga",
  camera:"Veiksmo kameros",intercom:"Ryšio įranga / Cardo",bag:"Kuprinės ir krepšiai",charging:"Įkrovikliai ir laidai",other:"Kiti priedai",
} as const;
export const ltGearStatuses={active:"Naudojama",spare:"Atsarginė",retired:"Nebenaudojama"} as const;
export const ltMaintenanceCategories={
  tire_tread:"Patikrinti protektorių",bearings:"Patikrinti guolius",tire_replacement:"Pakeisti padangą",
  battery:"Įvertinti baterijos būklę",insurance:"Draudimas",custom:"Kita užduotis",
} as const;
