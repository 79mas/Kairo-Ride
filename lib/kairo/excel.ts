import { KINDS, gearCategoryLabels, gearStatusLabels, maintenanceCategoryLabels, makeOperation, parseOperation, project, type Kind, type Operation, type Reading, type Wheel, wheelStats } from "./domain";
import {templateForMaintenance} from "./maintenance";

type Cell = string | number | boolean | null;
export type Workbook = Record<string, Cell[][]>;
const encoder=new TextEncoder();
const decoder=new TextDecoder();
const xml=(value: unknown)=>String(value??"").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&apos;");
const crcTable=Array.from({length:256},(_,n)=>{let c=n;for(let i=0;i<8;i++)c=(c&1)?0xedb88320^(c>>>1):c>>>1;return c>>>0;});
function crc32(bytes: Uint8Array){let crc=0xffffffff;for(const b of bytes)crc=crcTable[(crc^b)&255]^(crc>>>8);return (crc^0xffffffff)>>>0;}
function column(n: number){let s="";for(n++;n>0;n=Math.floor((n-1)/26))s=String.fromCharCode(65+(n-1)%26)+s;return s;}

/** Small, dependency-free OOXML writer. Text is always inlineStr, never an Excel formula. */
export function writeXlsx(book: Workbook): Uint8Array {
  const names=Object.keys(book);
  const files: Record<string,string>={
    "[Content_Types].xml":`<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${names.map((_,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}</Types>`,
    "_rels/.rels":`<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    "xl/workbook.xml":`<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${names.map((n,i)=>`<sheet name="${xml(n)}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join("")}</sheets></workbook>`,
    "xl/_rels/workbook.xml.rels":`<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${names.map((_,i)=>`<Relationship Id="rId${i+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join("")}</Relationships>`,
  };
  names.forEach((name,i)=>{
    const rows=book[name];const count=Math.max(1,...rows.map(r=>r.length));
    files[`xl/worksheets/sheet${i+1}.xml`]=`<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${Array.from({length:count},(_,j)=>`<col min="${j+1}" max="${j+1}" width="${j===0?38:24}" customWidth="1"/>`).join("")}</cols><sheetData>${rows.map((row,ri)=>`<row r="${ri+1}">${row.map((v,ci)=>v===null?"":typeof v==="number"?`<c r="${column(ci)}${ri+1}"><v>${v}</v></c>`:`<c r="${column(ci)}${ri+1}" t="inlineStr"><is><t xml:space="preserve">${xml(v)}</t></is></c>`).join("")}</row>`).join("")}</sheetData><autoFilter ref="A1:${column(count-1)}${Math.max(1,rows.length)}"/></worksheet>`;
  });
  return zipStore(files);
}
export function zipStore(files: Record<string,string>): Uint8Array {
  const local: Uint8Array[]=[];const central: Uint8Array[]=[];let offset=0;
  for(const [path,content] of Object.entries(files)){
    const name=encoder.encode(path), bytes=encoder.encode(content), crc=crc32(bytes);
    const h=new Uint8Array(30+name.length);const v=new DataView(h.buffer);
    v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint16(6,0x800,true);v.setUint32(14,crc,true);v.setUint32(18,bytes.length,true);v.setUint32(22,bytes.length,true);v.setUint16(26,name.length,true);h.set(name,30);
    const c=new Uint8Array(46+name.length);const w=new DataView(c.buffer);
    w.setUint32(0,0x02014b50,true);w.setUint16(4,20,true);w.setUint16(6,20,true);w.setUint16(8,0x800,true);w.setUint32(16,crc,true);w.setUint32(20,bytes.length,true);w.setUint32(24,bytes.length,true);w.setUint16(28,name.length,true);w.setUint32(42,offset,true);c.set(name,46);
    local.push(h,bytes);central.push(c);offset+=h.length+bytes.length;
  }
  const centralSize=central.reduce((n,b)=>n+b.length,0);const end=new Uint8Array(22);const e=new DataView(end.buffer);
  e.setUint32(0,0x06054b50,true);e.setUint16(8,central.length,true);e.setUint16(10,central.length,true);e.setUint32(12,centralSize,true);e.setUint32(16,offset,true);
  const all=new Uint8Array(offset+centralSize+22);let p=0;for(const b of [...local,...central,end]){all.set(b,p);p+=b.length;}return all;
}

/** Limits are checked before and while inflating, including malicious ZIP declarations. */
export async function unzipXml(bytes: Uint8Array): Promise<Record<string,string>> {
  if(bytes.byteLength>25*1024*1024)throw new Error("Excel import limit is 25 MB.");
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  let end=-1;for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--)if(view.getUint32(i,true)===0x06054b50){end=i;break;}
  if(end<0)throw new Error("This is not a valid .xlsx file.");
  const count=view.getUint16(end+10,true);let p=view.getUint32(end+16,true);let total=0;
  if(count>2000 || count===65535)throw new Error("The Excel archive is too large or unsupported.");
  const result:Record<string,string>=Object.create(null);
  for(let i=0;i<count;i++){
    if(p+46>bytes.length||view.getUint32(p,true)!==0x02014b50)throw new Error("The Excel archive structure is damaged.");
    const flags=view.getUint16(p+8,true),method=view.getUint16(p+10,true),size=view.getUint32(p+20,true),rawSize=view.getUint32(p+24,true),nameSize=view.getUint16(p+28,true),extra=view.getUint16(p+30,true),comment=view.getUint16(p+32,true),start=view.getUint32(p+42,true),crc=view.getUint32(p+16,true);
    const path=decoder.decode(bytes.subarray(p+46,p+46+nameSize));p+=46+nameSize+extra+comment;
    if(!(path.endsWith(".xml")||path.endsWith(".rels")))continue;
    if(path.includes("..")||path.startsWith("/")||Object.hasOwn(result,path))throw new Error("Invalid paths in the Excel archive.");
    if(flags&1)throw new Error("Remove the Excel file password before importing.");
    if(rawSize>20*1024*1024 || total+rawSize>50*1024*1024)throw new Error("Excel extraction limit exceeded.");
    if(start+30>bytes.length||view.getUint32(start,true)!==0x04034b50)throw new Error("The Excel file is damaged.");
    const localNameSize=view.getUint16(start+26,true);
    if(decoder.decode(bytes.subarray(start+30,start+30+localNameSize))!==path||view.getUint16(start+8,true)!==method)throw new Error("Excel archive headers do not match.");
    const dataStart=start+30+localNameSize+view.getUint16(start+28,true);
    if(dataStart+size>bytes.length)throw new Error("The Excel file is incomplete.");
    const compressed=bytes.slice(dataStart,dataStart+size);let data:Uint8Array;
    if(method===0)data=compressed;
    else if(method===8){
      if(typeof DecompressionStream==="undefined")throw new Error("This browser cannot import Excel. Use an up-to-date Chrome, Safari or Firefox.");
      const reader=new Blob([compressed]).stream().pipeThrough(new DecompressionStream("deflate-raw")).getReader();const chunks:Uint8Array[]=[];let read=0;
      try {for(;;){const {done,value}=await reader.read();if(done)break;read+=value.length;if(read>20*1024*1024||read+total>50*1024*1024)throw new Error("Excel extraction limit exceeded.");chunks.push(value);}}
      catch(e){await reader.cancel().catch(()=>{});throw e;}
      data=new Uint8Array(read);let pos=0;chunks.forEach(c=>{data.set(c,pos);pos+=c.length;});
    }else throw new Error("Unsupported Excel compression.");
    if(data.length!==rawSize||crc32(data)!==crc)throw new Error("Excel integrity check failed.");
    total+=data.length;result[path]=decoder.decode(data);
  }
  return result;
}

function parseXml(s: string) {
  if(/<!DOCTYPE|<!ENTITY/i.test(s))throw new Error("Unsafe Excel XML content.");
  const doc=new DOMParser().parseFromString(s,"application/xml");
  if(doc.getElementsByTagNameNS("*","parsererror").length)throw new Error("The Excel XML is damaged.");return doc;
}
const xmlElements=(root:Document|Element,name:string)=>[...root.getElementsByTagNameNS("*",name)];
const OFFICE_REL="http://schemas.openxmlformats.org/officeDocument/2006/relationships";
export async function readXlsx(bytes: Uint8Array): Promise<Workbook> {
  const files=await unzipXml(bytes);
  if(!files["xl/workbook.xml"]||!files["xl/_rels/workbook.xml.rels"])throw new Error("Excel workbook content was not found.");
  const doc=parseXml(files["xl/workbook.xml"]);
  if(["1","true"].includes(xmlElements(doc,"workbookPr")[0]?.getAttribute("date1904")??""))throw new Error("This file uses the 1904 date system. Save it with the standard 1900 date system.");
  const rels=new Map(xmlElements(parseXml(files["xl/_rels/workbook.xml.rels"]),"Relationship").filter(r=>r.getAttribute("TargetMode")!=="External").map(r=>[r.getAttribute("Id"),r.getAttribute("Target")!]));
  const shared=files["xl/sharedStrings.xml"]?xmlElements(parseXml(files["xl/sharedStrings.xml"]),"si").map(n=>xmlElements(n,"t").map(t=>t.textContent??"").join("")):[];
  const book:Workbook=Object.create(null);let rows=0;
  for(const sheet of xmlElements(doc,"sheet")){
    const target=rels.get(sheet.getAttributeNS(OFFICE_REL,"id")??sheet.getAttribute("r:id"));if(!target)continue;
    const path=target.startsWith("/")?target.slice(1):`xl/${target}`;if(!files[path])continue;
    const matrix:Cell[][]=[];
    for(const row of xmlElements(parseXml(files[path]),"row")){
      if(++rows>20_000)throw new Error("One import supports up to 20,000 rows.");
      const cells:Cell[]=[];
      for(const cell of xmlElements(row,"c")){
        const ref=cell.getAttribute("r")??"A1";const letters=ref.match(/^[A-Z]+/)?.[0]??"A";let col=0;for(const c of letters)col=col*26+c.charCodeAt(0)-64;
        if(col>100)continue;
        const type=cell.getAttribute("t"),raw=xmlElements(cell,"v")[0]?.textContent??"";
        let value:Cell=raw;
        if(type==="s")value=shared[Number(raw)]??"";
        else if(type==="inlineStr")value=xmlElements(cell,"t").map(t=>t.textContent??"").join("");
        else if(type==="e")value=null;
        else if(raw!==""&&type!=="str"&&type!=="d")value=Number(raw);
        cells[col-1]=value;
      }
      if(cells.some(v=>v!==null&&v!==""&&v!==undefined))matrix.push(cells);
    }
    book[sheet.getAttribute("name")??"Sheet"]=matrix;
  }
  return book;
}

async function stableId(prefix: string, input: string){const digest=await crypto.subtle.digest("SHA-256",encoder.encode(input));return `${prefix}-${[...new Uint8Array(digest)].slice(0,16).map(n=>n.toString(16).padStart(2,"0")).join("")}`;}
function excelDate(value: Cell): string {
  if(typeof value==="number")return new Date(Math.round((value-25569)*86400000)).toISOString().slice(0,19);
  const s=String(value??"").trim().replace(" ","T");
  if(!/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?)?$/.test(s))throw new Error(`Unrecognised date: ${String(value).slice(0,40)}.`);
  return s.length===10?`${s}T12:00:00`:s;
}
/** Interpret Excel's zone-less wall clock in the explicitly selected IANA zone. */
export function zonedInstant(wall: string, timeZone: string): string {
  const target=Date.parse(`${wall}Z`);if(!Number.isFinite(target))throw new Error("Invalid import date.");
  const fmt=new Intl.DateTimeFormat("en-CA",{timeZone,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit",hourCycle:"h23"});
  const local=(n:number)=>{const p=Object.fromEntries(fmt.formatToParts(n).map(p=>[p.type,p.value]));return Date.parse(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}Z`);};
  let t=target;for(let i=0;i<4;i++){const next=t+target-local(t);if(next===t)break;t=next;}
  if(local(t)!==target)throw new Error(`Time ${wall} does not exist in the selected time zone because of a daylight-saving transition. Check the source.`);
  return new Date(t).toISOString();
}
function num(v: Cell, label: string){const n=typeof v==="number"?v:Number(String(v??"").replace(",","."));if(v===null||v===""||v===undefined||!Number.isFinite(n))throw new Error(`Missing number: ${label}.`);return n;}
export type ImportPreview={operations:Operation[];warnings:string[];counts:Record<Kind,number>;source:string};
export async function workbookImport(book:Workbook, timeZone:string):Promise<ImportPreview>{
  if(book.KairoInfo?.[1]?.[0]==="kairo-ride-v1"){
    const groups=new Map<string,{part:number;text:string}[]>();
    for(const row of (book.History??[]).slice(1)){
      const key=String(row[0]);const chunks=groups.get(key)??[];chunks.push({part:Number(row[1]),text:String(row[2]??"")});groups.set(key,chunks);
    }
    const operations=[...groups.entries()].map(([id,chunks])=>{
      chunks.sort((a,b)=>a.part-b.part);
      if(chunks.some((c,i)=>c.part!==i))throw new Error("The History sheet is missing part of the record history.");
      const op=parseOperation(JSON.parse(chunks.map(c=>c.text).join("")));if(op.id!==id)throw new Error("A History record ID does not match its content.");return op;
    });
    if(!operations.length && ["Wheels","Readings","Rides","Trips","Gear","Maintenance","Attachments"].some(k=>(book[k]?.length??0)>1))throw new Error("This export is missing recovery history. Use a JSON backup.");
    const state=project(operations);
    return {operations,warnings:["The immutable History sheet is imported. Manual edits to the other Excel sheets are not written into record history."],counts:Object.fromEntries(KINDS.map(k=>[k,state[k].length])) as Record<Kind,number>,source:"Kairo Ride export"};
  }
  if(!book.Rides || !book.Models)throw new Error("Use PWA-EUC-prog-track.xlsx with Rides and Models sheets, or a Kairo Ride export. The old mixed-vehicle EUC.xlsx must be reviewed separately because vehicles cannot be guessed safely.");
  const wheels:Wheel[]=[];const reading:Reading[]=[];const warnings:string[]=[];const modelIds=new Map<string,string>();
  for(const [i,row] of book.Models.slice(1).entries()){
    const name=String(row[0]??"").trim();if(!name)continue;
    if(modelIds.has(name))throw new Error(`Vehicle “${name}” is duplicated in the Models sheet.`);
    const id=await stableId("legacy-wheel",name);modelIds.set(name,id);
    wheels.push({id,name,baselineKm:num(row[1],`Models ${i+2}`),baselineDate:excelDate(row[2]).slice(0,10),color:/^#[0-9a-fA-F]{6}$/.test(String(row[3]))?String(row[3]):["#f16305","#13c6e8","#f0b429"][i%3],notes:""});
  }
  const header=book.Rides[0].map(String);const index=(h:string)=>{const i=header.indexOf(h);if(i<0)throw new Error(`The Rides sheet is missing column ${h}.`);return i;};
  const dateCol=index("Date"),modelCol=index("Model"),odoCol=index("Input ODM"),idCol=index("ID"),noteCol=header.indexOf("Remarks");
  const existing=new Set<string>();
  for(const [i,row] of book.Rides.slice(1).entries()){
    const wheelId=modelIds.get(String(row[modelCol]??"").trim());if(!wheelId)throw new Error(`Unknown vehicle in Rides row ${i+2}.`);
    const rawId=String(row[idCol]??"");if(!rawId)throw new Error(`Rides row ${i+2} has no ID.`);
    const id=await stableId("legacy-reading",rawId);if(existing.has(id))throw new Error(`Rides row ${i+2} repeats an ID.`);existing.add(id);
    reading.push({id,wheelId,at:zonedInstant(excelDate(row[dateCol]),timeZone),odometerKm:num(row[odoCol],`Rides ${i+2}`),notes:String(row[noteCol]??""),sourceOrder:i+2});
  }
  for(const wheel of wheels){const stats=wheelStats(wheel,reading);if(stats.warnings)warnings.push(`${wheel.name}: review ${stats.warnings} readings for their time or odometer sequence.`);}
  warnings.push("Baseline odometers and entered readings are imported. Old calculated Km / Total km columns are ignored and distances are recalculated.");
  warnings.push(`Excel wall-clock times are interpreted in ${timeZone}. Readings are not turned into invented ride records.`);
  const changes=[...wheels.map(value=>({kind:"wheel" as const,value,entityId:value.id})),...reading.map(value=>({kind:"reading" as const,value,entityId:value.id}))];
  const operation=makeOperation(project([]),"legacy-import",changes);
  // Same source values produce the same import operation: importing twice is idempotent.
  operation.createdAt="2000-01-01T00:00:00.000Z";
  operation.id=await stableId("legacy-import",JSON.stringify(changes));
  return {operations:[parseOperation(operation)],warnings,counts:{wheel:wheels.length,reading:reading.length,ride:0,trip:0,gear:0,maintenance:0,attachment:0},source:"Legacy PWA odometer archive"};
}

export function exportWorkbook(operations:Operation[]):Workbook{
  const s=project(operations);const names=new Map(s.wheel.map(w=>[w.id,w.name]));const trips=new Map(s.trip.map(t=>[t.id,t.name]));const gearNames=new Map(s.gear.map(g=>[g.id,g.name]));
  return {
    KairoInfo:[["Format","Note"],["kairo-ride-v1","Odometer intervals and manually entered ride distances are never added together."],["Recovery","History is the exact recovery source; editing the other sheets does not change History."],["Attachments","Original files are not embedded in Excel. Drive links work for the owner."],["Time","ISO dates ending in Z are UTC. Baseline and trip dates are calendar dates."],["History","Use JSON for very large histories; an Excel cell is limited to 32767 characters."]],
    Wheels:[["ID","Name","Baseline km","Baseline date","Color","Notes"],...s.wheel.map(w=>[w.id,w.name,w.baselineKm,w.baselineDate,w.color,w.notes])],
    Readings:[["ID","Wheel ID","Wheel","At (UTC)","Odometer km","Notes"],...s.reading.map(r=>[r.id,r.wheelId,names.get(r.wheelId)??"",r.at,r.odometerKm,r.notes])],
    Rides:[["ID","Name","Wheel ID","Wheel","At (UTC)","Distance km","Trip ID","Trip","Notes","Local date","Time zone"],...s.ride.map(r=>[r.id,r.name,r.wheelId,names.get(r.wheelId)??"",r.at,r.distanceKm,r.tripId,trips.get(r.tripId??"")??"",r.notes,r.localDate??"",r.timeZone??""])],
    Trips:[["ID","Name","Start date","End date","Notes"],...s.trip.map(t=>[t.id,t.name,t.startDate,t.endDate,t.notes])],
    Gear:[["ID","Name","Category","Status","Brand","Model","Size","Purchased on","Used with IDs","Used with","Notes"],...s.gear.map(g=>[g.id,g.name,gearCategoryLabels[g.category],gearStatusLabels[g.status],g.brand,g.model,g.size,g.purchasedOn,(g.usedWithGearIds??[]).join(", "),(g.usedWithGearIds??[]).map(id=>gearNames.get(id)??id).join(", "),g.notes])],
    Maintenance:[["ID","Task","Category","Target kind","Target ID","Target","Due date","Due odometer km","Remind days before","Repeat km","Repeat months","Completed (UTC)","Notes","Template ID","Template","Repeat days","Date reminder enabled","Mileage reminder enabled"],...s.maintenance.map(m=>[m.id,m.title,maintenanceCategoryLabels[m.category],m.targetKind,m.targetId,m.targetKind==="wheel"?names.get(m.targetId)??m.targetId:gearNames.get(m.targetId)??m.targetId,m.dueDate,m.dueOdometerKm,m.remindDaysBefore,m.repeatKm,m.repeatMonths,m.completedAt,m.notes,m.templateId??"",m.templateId?templateForMaintenance(m).title.en:"",m.repeatDays??null,!!m.dueDate,m.dueOdometerKm!==null])],
    Attachments:[["ID","Owner kind","Owner ID","Name","Size bytes","Added (UTC)","Drive URL"],...s.attachment.map(a=>[a.id,a.ownerKind,a.ownerId,a.name,a.size,a.addedAt,a.driveId?`https://drive.google.com/file/d/${a.driveId}/view`:"Not uploaded to Drive yet"])],
    History:[["Operation ID","Part (from 0)","JSON fragment"],...operations.flatMap(op=>{const json=JSON.stringify(op);const rows:Cell[][]=[];for(let p=0;p<json.length;){let end=Math.min(p+30000,json.length);if(end<json.length&&/[\uD800-\uDBFF]/.test(json[end-1]))end--;rows.push([op.id,rows.length,json.slice(p,end)]);p=end;}return rows;})],
  };
}
