import {appPath} from "./paths";

type NotificationPlatform={
  permission:()=>NotificationPermission;
  registration?:()=>Promise<Pick<ServiceWorkerRegistration,"showNotification">|undefined>;
  create?:(title:string,options:NotificationOptions)=>void;
};
const browserPlatform:NotificationPlatform={
  permission:()=>typeof Notification==="undefined"?"denied":Notification.permission,
  registration:async()=>{
    if(typeof navigator==="undefined"||!("serviceWorker"in navigator))return undefined;
    // Unlike .ready, this does not wait forever in development without a worker.
    const registration=await navigator.serviceWorker.getRegistration(appPath());
    return registration?.active?registration:undefined;
  },
  create:(title,options)=>{new Notification(title,options);},
};

/** Mobile browsers generally require showNotification on a service worker.
 * Failure must not crash the app or mark an undelivered reminder as sent. */
export async function showLocalNotification(title:string,options:NotificationOptions,stillActive=()=>true,platform:NotificationPlatform=browserPlatform):Promise<boolean>{
  try{
    if(!stillActive()||platform.permission()!=="granted")return false;
    const registration=await platform.registration?.();
    if(!stillActive()||platform.permission()!=="granted")return false;
    if(registration){await registration.showNotification(title,options);return true;}
    if(platform.create){platform.create(title,options);return true;}
  }catch{/* In-app due status remains visible even when system notifications fail. */}
  return false;
}
