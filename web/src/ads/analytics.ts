import { getUsageChoice } from "../usage.ts";
import { adFor } from "./service.ts";
import { exposureCounter } from "./measurement.ts";
import type { Ad } from "./catalogue.ts";
export type AdSource = "scene_3d" | "scene_2d" | "details";
export const measurementAllowed = () => getUsageChoice() === "yes";
export function recordAd(ad: Ad, kind:"impression"|"click", source:AdSource) {
  if(!measurementAllowed() || document.hidden)return;
  const event={event_id:crypto.randomUUID(),creative_id:ad.creative_id,kind,source};
  // Reuse the event ID for a single bounded retry; database uniqueness prevents duplicates.
  const send=()=>fetch("/ads-api/v1/events",{method:"POST",credentials:"omit",keepalive:true,headers:{"Content-Type":"application/json"},body:JSON.stringify(event),signal:AbortSignal.timeout(5000)});
  void send().then(async r=>{if(r.status>=500&&measurementAllowed())await send();}).catch(()=>{});
}
export function outboundLink(ad:Ad) {
  return measurementAllowed() ? `/ads-api/v1/out/${ad.creative_id}/${crypto.randomUUID()}` : ad.destination;
}
// Retain counters briefly during 3D → 2D handoff so one exposure is not doubled.
const exposures=new Map<string,{sample:ReturnType<typeof exposureCounter>;released:number}>();
/** Polls stationary pictures too; no renderer loop or game-clock change is needed. */
export function observeAd(id:string,source:AdSource,visible:()=>boolean) {
  const key=`${source==="details"?"details":"scene"}:${id}`, now=performance.now();
  for(const [key,value] of exposures)if(value.released&&now-value.released>1000)exposures.delete(key);
  let entry=exposures.get(key);
  if(!entry){entry={sample:exposureCounter(),released:0};exposures.set(key,entry);}
  entry.released=0;
  const {sample}=entry;
  const poll=()=>{
    const ad=adFor(id);
    const shown=!!ad && measurementAllowed() && !document.hidden && visible();
    if(sample(ad?String(ad.creative_id):"",shown,performance.now())&&ad)recordAd(ad,"impression",source);
  };
  const timer=setInterval(poll,250);
  const hidden=()=>{sample("",false,performance.now());};
  document.addEventListener("visibilitychange",hidden);
  return()=>{entry.released=performance.now();clearInterval(timer);document.removeEventListener("visibilitychange",hidden);};
}
export function canvasVisible(canvas:HTMLCanvasElement,x:number,y:number) {
  const rect=canvas.getBoundingClientRect();
  const px=rect.left+x,py=rect.top+y;
  return px>=0&&py>=0&&px<innerWidth&&py<innerHeight&&document.elementFromPoint(px,py)===canvas;
}
