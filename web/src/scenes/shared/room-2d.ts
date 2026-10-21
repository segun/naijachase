// Canvas rooms consume the same poses, camera paths and time as their 3D siblings.
import type { SceneOptions, SceneHandle, Timeline } from "./chase3d-stage.ts";
import { ROOM, armAngles, legAngles, type Pose, type CameraShot } from "./scene-core.ts";
import * as office from "../office/room-scene.ts";
import * as garage from "../garage/garage-scene.ts";
import { makeCam, polygon, project, figure, fromPreset, type Item } from "../witness/witness-2d-kit.ts";
import { canvasAds } from "../../ads/canvas-ads.ts";
import { lookAround } from "./look-around.ts";

export async function createRoom2D(canvas:HTMLCanvasElement,options:SceneOptions,kind:"office"|"garage"):Promise<Omit<SceneHandle,"scene">>{
  const context=canvas.getContext("2d");if(!context)throw new Error("Canvas 2D is unavailable");
  const g:CanvasRenderingContext2D=context;
  let width=1,height=1,dpr=1,raf=0,now=options.startSeconds??0,from=now,started=-1,done:(()=>void)|undefined;
  let finished=false,disposed=false,departing=false,driving=false,yaw=0,pitch=0;
  let exploring=kind==="office"&&options.exploreAt!==undefined&&now<=office.T_ZOOM_START;
  let announced=false,zoomFrom:CameraShot|undefined;
  const ads=canvasAds(canvas,kind,()=>{if(finished&&!disposed)draw(now);});
  const paint=(p:Pose,shot:CameraShot,t:number)=>{
    const c=makeCam(shot,width,height);g.setTransform(dpr,0,0,dpr,0,0);g.fillStyle="#152820";g.fillRect(0,0,width,height);
    const {minX,maxX,minZ,maxZ}=ROOM;
    polygon(g,c,[[minX,0,minZ],[maxX,0,minZ],[maxX,0,maxZ],[minX,0,maxZ]],kind==="office"?"#634c36":"#4e565c");
    polygon(g,c,[[minX,0,maxZ],[maxX,0,maxZ],[maxX,3.1,maxZ],[minX,3.1,maxZ]],kind==="office"?"#d7caa7":"#71818a");
    polygon(g,c,[[minX,0,minZ],[minX,0,maxZ],[minX,3.1,maxZ],[minX,3.1,minZ]],"#8f947e");
    polygon(g,c,[[maxX,0,maxZ],[maxX,0,minZ],[maxX,3.1,minZ],[maxX,3.1,maxZ]],"#adb099");
    const items:Item[]=ads.items(g,c);
    function rect(x:number,y:number,z:number,w:number,h:number,color:string){const o=project(c,x,y,z);items.push({z:o.z,draw(){g.fillStyle=color;g.fillRect(o.x-w*o.k/2,o.y-h*o.k,w*o.k,h*o.k);}});}
    if(kind==="office"){
      rect(-3,0,3.95,1,2.25,"#443724");rect(-1.3,1.25,3.9,1.7,1.15,"#a87d43");rect(3.3,1.18,3.9,1.3,1.15,"#73a6b2");
      rect(.9,0,3.35,2.1,.75,"#62432b");rect(.9,.75,3.2,.68,.58,"#c6ba96");rect(.9,.85,3.15,.51,.36,"#063a20");
      const clock=project(c,.9,2.45,3.92);items.push({z:clock.z,draw(){g.fillStyle="#f4ead0";g.beginPath();g.arc(clock.x,clock.y,.23*clock.k,0,Math.PI*2);g.fill();g.strokeStyle="#26352b";g.lineWidth=2;g.beginPath();g.moveTo(clock.x,clock.y-.16*clock.k);g.lineTo(clock.x,clock.y);g.lineTo(clock.x+.12*clock.k,clock.y);g.stroke();}});
    }else{
      rect(1.2,0,3.95,4.9,2.4,"#9ca9ae");
      for(const [x,color] of [[-1.95,"#e3bb48"],[-.05,"#843746"],[1.9,"#237584"]] as const){
        const z=driving&&x===-1.95?garage.carZAt(t):2.1;
        rect(x,0,z,1.6,.9,color);rect(x,.85,z+.2,1.35,.6,"#253f46");rect(x-.63,0,z-.1,.25,.35,"#182322");rect(x+.63,0,z-.1,.25,.35,"#182322");
      }
    }
    if(options.preset&&p.visible){const o=project(c,p.x,0,p.z),legs=legAngles(p),arms=armAngles(p,t);items.push({z:o.z,draw(){figure(g,o,{...fromPreset(options.preset!),heading:p.heading,hips:legs.hips,knees:legs.knees,arms,lift:p.y});}});}
    items.sort((a,b)=>b.z-a.z).forEach(i=>i.draw());
  };
  const intro=(t:number)=>{
    if(kind==="office"){
      paint(office.poseAt(t),exploring&&t>=office.T_ZOOM_START?office.officeLookShot(yaw,pitch):zoomFrom?office.officeZoomShot(zoomFrom,t,width,height):office.shotAt(t,width,height),t);
      options.onGlass(office.glassAt(t));
      if(exploring&&t>=office.T_ZOOM_START&&!announced){announced=true;options.onExplore?.();}
    }else{
      const shot=t>=garage.T_END?lookAround(garage.wideShot(),yaw,pitch):garage.introShotAt(t);
      paint(garage.introPoseAt(t),garage.portraitGarageShot(shot,width/height),t);options.onGlass(garage.glassAt(t));
    }
  };
  let timeline:Timeline={end:kind==="office"?(exploring?office.T_ZOOM_START:office.T_END):garage.T_END,update:intro};
  function draw(t:number){if(disposed)return;try{timeline.update(t);}catch(e){options.onFault?.(String(e));}}
  function frame(stamp:number){if(disposed)return;if(started<0)started=stamp-from*1000;now=Math.min(timeline.end,(stamp-started)/1000);draw(now);if(now>=timeline.end){finished=true;done?.();done=undefined;}else raf=requestAnimationFrame(frame);}
  function play(next:Timeline,startAt=0){cancelAnimationFrame(raf);done?.();timeline=next;from=startAt;started=-1;finished=false;return new Promise<void>(resolve=>{done=resolve;raf=requestAnimationFrame(frame);});}
  const resize=()=>{width=Math.max(1,canvas.clientWidth);height=Math.max(1,canvas.clientHeight);dpr=Math.min(2,devicePixelRatio||1);canvas.width=width*dpr;canvas.height=height*dpr;if(finished)draw(now);};
  const observer=new ResizeObserver(resize);observer.observe(canvas);resize();raf=requestAnimationFrame(frame);
  return {
    now:()=>now,play,skip(){from=timeline.end;started=-1;},
    look(dx,dy){if(departing)return;yaw=Math.max(-1.35,Math.min(1.35,yaw+dx));pitch=Math.max(-.4,Math.min(.4,pitch+dy));draw(kind==="office"?office.T_ZOOM_START:garage.T_END);},
    continue(){if(!exploring)return;zoomFrom=office.officeLookShot(yaw,pitch);exploring=false;void play({end:office.T_END,update:intro},office.T_ZOOM_START);},
    leave(how){departing=true;if(kind==="office")return play({end:office.T_OUT_END,update(t){const p=office.outroPoseAt(t);paint(p,office.outroShotAt(t,p,width,height),t);options.onGlass(office.outroGlassAt(t));}});const hitch=how==="hitch";driving=!hitch;return play({end:hitch?garage.T_HITCH_END:garage.T_DRIVE_END,update(t){paint(hitch?garage.hitchPoseAt(t):garage.drivePoseAt(t),garage.outroShotAt(hitch?"hitch":"drive",t),t);options.onGlass(garage.outroGlassAt(t));}});},
    dispose(){disposed=true;cancelAnimationFrame(raf);observer.disconnect();ads.dispose();done?.();}
  };
}
