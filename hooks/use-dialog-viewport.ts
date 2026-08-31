import {useEffect} from "react";

/** The visible viewport shrinks for the keyboard even when CSS vh does not. */
export function useDialogViewport(){
  useEffect(()=>{
    const viewport=window.visualViewport,root=document.documentElement;
    let frame=0;
    const update=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{
      root.style.setProperty("--dialog-viewport-height",`${viewport?.height??window.innerHeight}px`);
      root.style.setProperty("--dialog-viewport-top",`${viewport?.offsetTop??0}px`);
      const focused=document.activeElement;
      if(focused instanceof HTMLElement&&focused.matches("input,textarea,select")&&(viewport?.scale??1)===1){
        const dialog=focused.closest<HTMLElement>('[role="dialog"]');
        if(dialog){
          for(let parent=focused.parentElement;parent;parent=parent.parentElement){
            if(/auto|scroll/.test(getComputedStyle(parent).overflowY)&&parent.scrollHeight>parent.clientHeight){
              const field=focused.getBoundingClientRect(),box=parent.getBoundingClientRect();
              if(field.bottom>box.bottom-12)parent.scrollTop+=field.bottom-box.bottom+12;
              else if(field.top<box.top+12)parent.scrollTop+=field.top-box.top-12;
            }
            if(parent===dialog)break;
          }
        }
      }
    });};
    update();viewport?.addEventListener("resize",update);viewport?.addEventListener("scroll",update);window.addEventListener("resize",update);document.addEventListener("focusin",update);
    return()=>{cancelAnimationFrame(frame);viewport?.removeEventListener("resize",update);viewport?.removeEventListener("scroll",update);window.removeEventListener("resize",update);document.removeEventListener("focusin",update);root.style.removeProperty("--dialog-viewport-height");root.style.removeProperty("--dialog-viewport-top");};
  },[]);
}
