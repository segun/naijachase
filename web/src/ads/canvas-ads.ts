import { observeAd, canvasVisible } from "./analytics.ts";
import { halfInViewport } from "./measurement.ts";
import { placements, scenePlacements } from "./catalogue.ts";
import { adFor, adNow, currentAds, openAd, subscribeAds } from "./service.ts";
import { project, type Cam, type Item } from "../scenes/witness/witness-2d-kit.ts";

/** Canvas billboards participate in the renderer's depth sort, like other 2D scenery. */
export function canvasAds(canvas:HTMLCanvasElement,scene:string,redraw:()=>void){
  const images=new Map<number,HTMLImageElement>();let disposed=false;
  let hitboxes:{x:number;y:number;w:number;h:number;id:string}[]=[];
  const stop=subscribeAds(()=>{
    const ids=new Set(currentAds().map(a=>a.creative_id));for(const id of images.keys())if(!ids.has(id))images.delete(id);
    for(const p of scenePlacements(scene,currentAds(),adNow())){const ad=adFor(p.id);if(ad&&!images.has(ad.creative_id)){const image=new Image();images.set(ad.creative_id,image);image.onload=()=>{if(!disposed)redraw();};image.src=ad.image_url;}}
    queueMicrotask(()=>{if(!disposed)redraw();});
  });
  const observers=placements.filter(p=>p.scene===scene).map(p=>observeAd(p.id,"scene_2d",()=>{
    const box=hitboxes.find(b=>b.id===p.id),ad=adFor(p.id),image=ad?images.get(ad.creative_id):undefined;
    if(!box||!image?.complete||!image.naturalWidth)return false;
    const rect=canvas.getBoundingClientRect();
    return halfInViewport(box,rect.width,rect.height)&&halfInViewport({...box,x:box.x+rect.left,y:box.y+rect.top},innerWidth,innerHeight)&&canvasVisible(canvas,box.x+box.w/2,box.y+box.h/2);
  }));
  let down:{id:number;x:number;y:number;moved:boolean}|undefined;
  const start=(e:PointerEvent)=>{if(e.button===0)down={id:e.pointerId,x:e.clientX,y:e.clientY,moved:false};};
  const move=(e:PointerEvent)=>{if(down&&Math.hypot(e.clientX-down.x,e.clientY-down.y)>8)down.moved=true;};
  const end=(e:PointerEvent)=>{const d=down;down=undefined;if(!d||d.id!==e.pointerId||d.moved||Math.hypot(e.clientX-d.x,e.clientY-d.y)>8)return;const r=canvas.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top;const hit=[...hitboxes].reverse().find(h=>x>=h.x&&x<=h.x+h.w&&y>=h.y&&y<=h.y+h.h);if(hit)openAd(hit.id,"scene_2d");};
  const cancel=()=>{down=undefined;};
  canvas.addEventListener("pointerdown",start);canvas.addEventListener("pointermove",move);canvas.addEventListener("pointerup",end);canvas.addEventListener("pointercancel",cancel);
  return {
    items(g:CanvasRenderingContext2D,c:Cam):Item[]{
      hitboxes=[];
      return scenePlacements(scene,currentAds(),adNow()).flatMap(p=>{
        const delta=p.position.map((v,i)=>v-c.pos[i]!);if(delta.reduce((s,v,i)=>s+v*c.f[i]!,0)<=.3)return [];
        const point=project(c,...p.position as [number,number,number]);
        const w=p.size[0]!*point.k,h=p.size[1]!*point.k,x=point.x-w/2,y=point.y-h/2;
        return [{z:point.z,draw(){
          const ad=adFor(p.id),image=ad?images.get(ad.creative_id):undefined;
          g.fillStyle="#4b3928";g.fillRect(x-3,y-3,w+6,h+6);g.fillStyle="#174534";g.fillRect(x,y,w,h);
          if(image?.complete&&image.naturalWidth)g.drawImage(image,x,y,w,h);
          else {g.fillStyle="#ffdb8f";g.textAlign="center";g.font=`bold ${Math.max(5,Math.min(w/15,h/8))}px sans-serif`;["Your brand.","The next big lead."].forEach((line,i)=>g.fillText(line,point.x,y+h*(.38+i*.18)));}
          g.fillStyle="#09251e";g.fillRect(x,y+h*.85,w,h*.15);g.fillStyle="#ffe9b5";g.font=`${Math.max(4,Math.min(w/20,h/12))}px sans-serif`;g.textAlign="center";g.fillText(ad?"Ad · Tap to view":"Advertise on NaijaChase",point.x,y+h*.96);
          hitboxes.push({x,y,w,h,id:p.id});
        }}];
      });
    },
    dispose(){disposed=true;observers.forEach(stop=>stop());stop();images.clear();canvas.removeEventListener("pointerdown",start);canvas.removeEventListener("pointermove",move);canvas.removeEventListener("pointerup",end);canvas.removeEventListener("pointercancel",cancel);}
  };
}
