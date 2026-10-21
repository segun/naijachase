import "@babylonjs/core/Culling/ray";
// Kept behind scene imports: no Babylon dependency in the ad data or UI.
import { Vector3, Matrix } from "@babylonjs/core/Maths/math.vector";
import { observeAd, canvasVisible } from "../../ads/analytics.ts";
import type { Stage } from "./chase3d-stage.ts";
import { placements, scenePlacements } from "../../ads/catalogue.ts";
import { adFor, adNow, currentAds, openAd, subscribeAds } from "../../ads/service.ts";

export function addSceneAds(stage: Stage, canvas: HTMLCanvasElement, sceneId: string) {
  const {scene}=stage;
  let disposed=false;
  const records=placements.filter(p=>p.scene===sceneId).map(p=>{
    const width=768,height=Math.max(160,Math.round(width*p.height/p.width));
    const painted=stage.textured(`ad-${p.id}`,p.size[0]!,p.size[1]!,()=>{},width,height);
    painted.material.disableLighting=true;painted.material.emissiveTexture=painted.material.diffuseTexture;
    const mesh=stage.plane(`ad-${p.id}`,p.size[0]!,p.size[1]!,painted.material,...p.position as [number,number,number]);
    mesh.rotation.y=p.yaw;mesh.metadata={adPlacement:p.id};
    const texture=painted.material.diffuseTexture as import("@babylonjs/core/Materials/Textures/dynamicTexture").DynamicTexture;
    const frame=stage.box(`ad-frame-${p.id}`,p.size[0]!+.07,p.size[1]!+.07,.035,stage.mat("#3c3023"),...p.position as [number,number,number]);
    frame.rotation.y=p.yaw;frame.position.x+=Math.sin(p.yaw)*.025;frame.position.z+=Math.cos(p.yaw)*.025;
    // Freestanding visitor/perimeter boards have visible supports.
    const posts=sceneId!=="office"&&sceneId!=="garage" ? [-1,1].map(sign=>stage.box(`ad-post-${p.id}-${sign}`,.055,Math.max(.1,p.position[1]!-p.size[1]!/2),.06,stage.mat("#554a39"),p.position[0]!+sign*p.size[0]!*.4,(p.position[1]!-p.size[1]!/2)/2,p.position[2]!+.05)) : [];
    let identity="",generation=0,loaded=0;
    const draw=(image?: HTMLImageElement, paid=false)=>{
      const g=texture.getContext() as CanvasRenderingContext2D;g.fillStyle="#113e32";g.fillRect(0,0,width,height);
      if(image)g.drawImage(image,0,0,width,height);
      else {
        g.fillStyle="#f4cf7c";g.textAlign="center";g.font=`bold ${Math.min(56,width/14,height/5)}px sans-serif`;
        const lines=p.width/p.height<1 ? ["Make your", "brand the", "next big lead."] : ["All eyes on the chase.","Your brand could be here."];
        lines.forEach((line,i)=>g.fillText(line,width/2,height*.36+i*Math.min(70,height/5)));
      }
      g.fillStyle="#09251e";g.fillRect(0,height-38,width,38);g.fillStyle="#fff1ce";g.textAlign="center";g.font="bold 19px sans-serif";g.fillText(paid?"Ad · Tap to view":"Advertise on NaijaChase",width/2,height-12);
      texture.update();if(!disposed)scene.render();
    };
    const unobserve=observeAd(p.id,"scene_3d",()=>{
      if(!mesh.isEnabled()||!loaded||loaded!==adFor(p.id)?.creative_id||!scene.activeCamera)return false;
      const rect=canvas.getBoundingClientRect(),engine=scene.getEngine();
      const viewport=scene.activeCamera.viewport.toGlobal(engine.getRenderWidth(),engine.getRenderHeight());
      let seen=0;
      for(const x of [-.4,0,.4])for(const y of [-.4,0,.4]){
        const world=Vector3.TransformCoordinates(new Vector3(x*p.size[0]!,y*p.size[1]!,0),mesh.getWorldMatrix());
        const point=Vector3.Project(world,Matrix.IdentityReadOnly,scene.getTransformMatrix(),viewport);
        const px=point.x*rect.width/engine.getRenderWidth(),py=point.y*rect.height/engine.getRenderHeight();
        if(point.z>=0&&point.z<=1&&canvasVisible(canvas,px,py)&&scene.pick(px,py)?.pickedMesh===mesh)seen++;
      }
      return seen>=5;
    });
    return {p,mesh,frame,posts,unobserve,update(visible:boolean){
      mesh.setEnabled(visible);frame.setEnabled(visible);posts.forEach(m=>m.setEnabled(visible));
      const ad=visible?adFor(p.id):undefined,key=String(ad?.creative_id??"empty");
      if(key===identity)return;loaded=0;identity=key;const token=++generation;draw();
      if(ad){const image=new Image();image.onload=()=>{if(!disposed&&token===generation&&adFor(p.id)?.creative_id===ad.creative_id){loaded=ad.creative_id;draw(image,true);}};image.src=ad.image_url;}
    }};
  });
  const stop=subscribeAds(()=>{const selected=new Set(scenePlacements(sceneId,currentAds(),adNow()).map(p=>p.id));records.forEach(r=>r.update(selected.has(r.p.id)));if(!disposed)scene.render();});
  let pointer: {id:number;x:number;y:number;moved:boolean}|undefined;
  const down=(e:PointerEvent)=>{if(e.button===0)pointer={id:e.pointerId,x:e.clientX,y:e.clientY,moved:false};};
  const move=(e:PointerEvent)=>{if(pointer&&pointer.id===e.pointerId&&Math.hypot(e.clientX-pointer.x,e.clientY-pointer.y)>8)pointer.moved=true;};
  const up=(e:PointerEvent)=>{const p=pointer;pointer=undefined;if(!p||p.id!==e.pointerId||p.moved||Math.hypot(e.clientX-p.x,e.clientY-p.y)>8)return;const rect=canvas.getBoundingClientRect();const hit=scene.pick(e.clientX-rect.left,e.clientY-rect.top);const id=hit?.pickedMesh?.metadata?.adPlacement;if(typeof id==="string")openAd(id);};
  const cancel=()=>{pointer=undefined;};
  canvas.addEventListener("pointerdown",down);canvas.addEventListener("pointermove",move);canvas.addEventListener("pointerup",up);canvas.addEventListener("pointercancel",cancel);
  scene.onDisposeObservable.addOnce(()=>{disposed=true;records.forEach(r=>r.unobserve());stop();canvas.removeEventListener("pointerdown",down);canvas.removeEventListener("pointermove",move);canvas.removeEventListener("pointerup",up);canvas.removeEventListener("pointercancel",cancel);});
}
