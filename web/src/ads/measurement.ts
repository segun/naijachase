/** One view after a continuous second; re-arm only after a full second out of view. */
export function exposureCounter() {
  let identity = "", since: number | undefined, away: number | undefined, counted = false;
  return (key: string, visible: boolean, now: number): boolean => {
    if (key !== identity) {identity=key;since=undefined;away=undefined;counted=false;}
    if (!visible || !key) {
      since=undefined;away ??= now;
      if(now-away>=1000)counted=false;
      return false;
    }
    if(away!==undefined&&now-away>=1000)counted=false;
    away=undefined;since ??= now;
    if(!counted && now-since>=1000){counted=true;return true;}
    return false;
  };
}
export type Rect = {x:number;y:number;w:number;h:number};
export function halfInViewport(r:Rect,width:number,height:number) {
  if(![r.x,r.y,r.w,r.h,width,height].every(Number.isFinite)||r.w<4||r.h<4)return false;
  const area=Math.max(0,Math.min(r.x+r.w,width)-Math.max(r.x,0))*Math.max(0,Math.min(r.y+r.h,height)-Math.max(r.y,0));
  return area>=r.w*r.h*.5;
}
