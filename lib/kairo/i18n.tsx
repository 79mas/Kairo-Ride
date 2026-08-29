import {createContext,useContext,useEffect,useMemo,useState,type ReactNode} from "react";

export type Language="en"|"lt";
const LANGUAGE_KEY="kairo-language";

type I18n={
  language:Language;
  locale:string;
  setLanguage:(language:Language)=>void;
  tr:(english:string,lithuanian?:string)=>string;
};

const fallback:I18n={language:"en",locale:"en-US",setLanguage:()=>{},tr:english=>english};
const Context=createContext<I18n>(fallback);

export function LanguageProvider({children}:{children:ReactNode}){
  const [language,setLanguageState]=useState<Language>(()=>{
    if(typeof window==="undefined")return "en";
    return localStorage.getItem(LANGUAGE_KEY)==="lt"?"lt":"en";
  });
  const setLanguage=(next:Language)=>{localStorage.setItem(LANGUAGE_KEY,next);setLanguageState(next);};
  useEffect(()=>{document.documentElement.lang=language;},[language]);
  const value=useMemo<I18n>(()=>({
    language,
    locale:language==="lt"?"lt-LT":"en-US",
    setLanguage,
    tr:(english,lithuanian)=>language==="lt"?(lithuanian??english):english,
  }),[language]);
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
