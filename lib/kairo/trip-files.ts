import {type Attachment} from "./domain";

/** Prepare metadata without writing: the caller commits the trip, records and all blobs together. */
export async function prepareTripFiles(ownerId:string,files:File[]){
  if(!files.length)return {changes:[],blobs:[]};
  if(files.some(file=>file.size>512*1024*1024))throw new Error("The per-file limit is 512 MB.");
  const total=files.reduce((sum,file)=>sum+file.size,0);
  const estimate=typeof navigator!=="undefined"?await navigator.storage?.estimate?.():undefined;
  if(estimate?.quota!==undefined&&total>(estimate.quota-(estimate.usage??0))*.9)throw new Error("This device does not have enough space for these files. No changes were saved.");
  const attachments=files.map(file=>({id:crypto.randomUUID(),ownerKind:"trip" as const,ownerId,name:file.name.slice(0,160),mimeType:file.type||"application/octet-stream",size:file.size,addedAt:new Date().toISOString()} satisfies Attachment));
  return {changes:attachments.map(value=>({kind:"attachment" as const,entityId:value.id,value})),blobs:attachments.map((a,index)=>({attachmentId:a.id,blob:files[index]}))};
}
