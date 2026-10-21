import { activeAd, validAd, type Ad } from "./catalogue.ts";
let ads: Ad[] = [], serverAt = 0, sampledAt = 0, inFlight = false;
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | undefined;
let lastFetch = 0;
export const adNow = () => serverAt ? serverAt + (performance.now()-sampledAt)/1000 : Date.now()/1000;
export const currentAds = () => ads;
export const adFor = (id: string) => activeAd(ads,id,adNow());
const notify = () => listeners.forEach(f=>f());
async function refresh() {
  if (inFlight || document.hidden || !listeners.size) return;
  inFlight = true;lastFetch = performance.now();
  const controller = new AbortController(), timeout=setTimeout(()=>controller.abort(),6000);
  try {
    const response=await fetch("/ads-api/v1/manifest",{signal:controller.signal,cache:"no-store",credentials:"omit"});
    if(!response.ok)throw new Error("Ads unavailable");
    const data=await response.json();
    if(!Array.isArray(data.ads) || !Number.isFinite(data.server_time))throw new Error("Invalid manifest");
    ads=data.ads.filter(validAd).slice(0,100);serverAt=data.server_time;sampledAt=performance.now();
  } catch {ads=[];}
  finally {clearTimeout(timeout);inFlight=false;notify();}
}
function tick() {
  const fresh=ads.filter(a=>a.ends_at>adNow());
  if(fresh.length!==ads.length){ads=fresh;notify();}
  if(performance.now()-lastFetch>=15000)void refresh();
}
function visibility(){if(!document.hidden){tick();void refresh();}}
export function subscribeAds(listener: () => void): () => void {
  listeners.add(listener);listener();
  if(!timer){timer=setInterval(tick,1000);document.addEventListener("visibilitychange",visibility);void refresh();}
  return ()=>{listeners.delete(listener);if(!listeners.size){clearInterval(timer);timer=undefined;document.removeEventListener("visibilitychange",visibility);}};
}
export function openAd(id: string, source: "scene_3d" | "scene_2d" = "scene_3d"){window.dispatchEvent(new CustomEvent("nc-ad-open",{detail:{id,source}}));}
