<script lang="ts">
  import { untrack } from "svelte";
  import "../../styles/terminal.css";
  import "../../styles/witness.css";
  import type { AppController } from "../../state/app.svelte";
  import { clockParts } from "../../domain/model.ts";
  import { detail } from "../shared/detail.svelte.ts";
  import { detailKey } from "../shared/detail-level.ts";
  import { recipeFor } from "./venue-recipes.ts";
  import type { WitnessFrame, WitnessHandle } from "./witness-driver.ts";
  import type { Page } from "./witness-scene.ts";
  import { reportSceneFallback } from "../../telemetry.ts";
  import SceneAds from "../../ads/SceneAds.svelte";

  let { app }: { app: AppController } = $props();
  // svelte-ignore state_referenced_locally
  const visit=app.witnessVisit;
  const recipe=visit?recipeFor(visit.venueId):undefined;
  const stored=()=>{try{return sessionStorage.getItem("nc-witness-2d")==="1";}catch{return false;}};
  const level=$derived(detail.resolved);
  let broken=$state(stored()),terminal=$state(false),failure=$state("");
  const mode=$derived(level.renderer==="3d"&&!broken?"3d":"2d");
  const canvasKey=$derived(`${mode}-${detailKey(level)}`);
  let canvas=$state<HTMLCanvasElement>(),ready=$state(false),holding=$state(false),reading=$state(false),leaving=$state(false);
  let frame=$state<WitnessFrame>({fade:0,subtitle:null}),words=$state<string[]>([]),pages=$state<Page[]>([]);
  let heard=$state(false),finished=false,resumeAt=0;
  let handle:WitnessHandle|undefined;
  let yaw=0,pitch=0;
  let pointer:{id:number;x:number;y:number}|undefined;
  const page=$derived(frame.subtitle?pages[frame.subtitle.page]:undefined);
  // svelte-ignore state_referenced_locally
  const hour=clockParts(app.game?.state.elapsed??0).hour;
  let lastChoice=detail.choice;
  $effect(()=>{const choice=detail.choice;if(choice!==lastChoice){lastChoice=choice;broken=false;terminal=false;failure="";try{sessionStorage.removeItem("nc-witness-2d");}catch{}}});
  function finish(){if(finished)return;finished=true;app.leaveWitness();}
  async function depart(h:WitnessHandle,at?:number){
    let timeout:ReturnType<typeof setTimeout>|undefined;
    try{await Promise.race([h.leave?.(at),new Promise(resolve=>{timeout=setTimeout(resolve,12000);})]);}
    catch{ /* The saved account remains available even if departure fails. */ }
    finally{clearTimeout(timeout);}
  }
  async function leave(){
    if(leaving||finished)return;
    leaving=true;reading=false;
    if(handle?.leave&&ready&&!terminal){
      handle.skip();
      // The existing start promise settles at the interview pause before departure.
      const h=handle;
      await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));
      if(finished||handle!==h)return;
      await depart(h);
      if(handle!==h&&!terminal)return;
    }
    finish();
  }
  function showClue(){reading=!reading;if(reading&&!holding)handle?.skip();}
  function fallback(at:number,why:string){
    if(finished)return;resumeAt=at;failure=why;ready=false;
    reportSceneFallback("witness",why);
    if(mode==="3d"){broken=true;try{sessionStorage.setItem("nc-witness-2d","1");}catch{}}
    else{terminal=true;reading=true;if(leaving)finish();}
  }
  $effect(()=>{
    if(!visit||!recipe){finish();return;}
    const target=canvas,current=mode,key=canvasKey,{quality,models,reducedMotion}=level;
    if(terminal||!target||target.dataset.key!==key)return;
    let cancelled=false,lastTick=performance.now();
    const controller=new AbortController();let local:WitnessHandle|undefined;
    const alreadyHolding=untrack(()=>holding);
    const watchdog=setInterval(()=>{if(document.hidden||untrack(()=>holding&&!leaving))return;if(performance.now()-lastTick>(local?3500:10000))fallback(local?.now()??resumeAt,"No frames from renderer");},500);
    const {sound,preset}=untrack(()=>({sound:app.music.enabled,preset:app.avatar}));
    if(sound)app.music.duck(true);
    const options={preset,hour,quality,models,signal:controller.signal,recipe,arrival:visit.arrival,text:visit.message,venueName:visit.venueName||"Venue",sound,reducedMotion,
      onTick:()=>{if(!cancelled){lastTick=performance.now();ready=true;}},
      onFrame:(f:WitnessFrame)=>{if(!cancelled){frame=f;if(f.subtitle)heard=true;}},
      onSlow:()=>{if(!cancelled&&current==="3d")fallback(local?.now()??0,"Low frame rate");},
      onFault:(why:string)=>{if(!cancelled)fallback(local?.now()??0,why);}
    };
    const load=current==="3d"?import("./chase3d-witness.ts").then(m=>m.createWitnessScene):import("./witness-2d.ts").then(m=>m.createWitnessScene2D);
    load.then(create=>{if(cancelled)throw new DOMException("Cancelled","AbortError");return create(target,options);}).then(async h=>{
      if(cancelled){h.dispose();return;}local=h;handle=h;words=h.words;pages=h.pages;
      const continueDeparture=untrack(()=>leaving);
      const departureAt=resumeAt;
      const done=h.start(resumeAt||undefined);if(alreadyHolding||continueDeparture)h.skip();
      await done;
      if(cancelled)return;
      holding=true;h.look?.(yaw,pitch);app.music.duck(false);
      if(continueDeparture){await depart(h,departureAt);if(!cancelled)finish();}
    }).catch(e=>{if(!cancelled)fallback(local?.now()??resumeAt,e instanceof Error?e.message:String(e));});
    return()=>{cancelled=true;clearInterval(watchdog);if(local&&!finished)resumeAt=local.now();controller.abort();local?.dispose();if(handle===local)handle=undefined;if(sound)app.music.duck(false);};
  });
  function look(dx:number,dy:number){if(!holding||leaving||reading)return;const x=Math.max(-1.35,Math.min(1.35,yaw+dx)),y=Math.max(-.4,Math.min(.4,pitch+dy));handle?.look?.(x-yaw,y-pitch);yaw=x;pitch=y;}
  function down(e:PointerEvent){if(!holding||leaving||e.button!==0)return;pointer={id:e.pointerId,x:e.clientX,y:e.clientY};canvas?.setPointerCapture(e.pointerId);}
  function move(e:PointerEvent){if(pointer?.id!==e.pointerId)return;look((pointer.x-e.clientX)*.004,(e.clientY-pointer.y)*.003);pointer.x=e.clientX;pointer.y=e.clientY;}
  function up(){pointer=undefined;}
  function key(e:KeyboardEvent){
    if(e.defaultPrevented||e.metaKey||e.ctrlKey||e.altKey||(e.target instanceof Element&&e.target.closest("button,input,select,textarea,a,dialog")))return;
    if(holding&&["ArrowLeft","ArrowRight","ArrowUp","ArrowDown"].includes(e.key)){e.preventDefault();look(e.key==="ArrowLeft"?-.1:e.key==="ArrowRight"?.1:0,e.key==="ArrowUp"?.06:e.key==="ArrowDown"?-.06:0);}
    else if(e.key==="Escape"){e.preventDefault();if(reading)reading=false;else showClue();}
  }
</script>

<svelte:window onkeydown={key} />
<div class="room witness explorable-witness" class:account-open={reading} role="region" aria-label="Meeting the witness">
  {#if !terminal}
    {#key canvasKey}<canvas class="room-canvas" class:ready data-mode={mode} data-key={canvasKey} bind:this={canvas} aria-hidden="true" onpointerdown={down} onpointermove={move} onpointerup={up} onpointercancel={up}></canvas>{/key}
    <div class="witness-fade" style:opacity={ready?1-frame.fade:0}></div>
    {#if !ready}<p class="room-loading" role="status">Preparing the location…</p>{/if}
  {/if}
  {#if failure}<p class="scene-fallback" role="status">{terminal?"The scene is unavailable. Your full clue is saved below.":"Continuing in the 2D scene."}</p>{/if}
  {#if reading||terminal}
    <section class="witness-reading" aria-label="Witness account"><h2>{visit?.role||"Witness"} · {visit?.venueName}</h2><p class="witness-account-text">{visit?.message}</p><p class="muted">Saved to Clues.</p>{#if !terminal}<button class="btn" type="button" onclick={()=>reading=false}>Back to looking around</button>{/if}</section>
  {:else if page&&frame.subtitle&&!holding}
    <div class="witness-caption" aria-hidden="true"><p class="caption-who">{visit?.role}</p><p class="caption-line">{#each words.slice(page.from,page.to) as word,i}<span class:said={page.from+i<frame.subtitle.spoken}>{word}</span>{" "}{/each}</p></div>
  {/if}
  <p class="sr-only" role="status">{#if heard&&visit}{visit.role}: {visit.message}{/if}</p>
  <div class="witness-actions"><span>{holding?"Drag, swipe or use arrow keys to look around.":"Your clue is saved. You can read it at any time."}</span><div><button class="btn" type="button" disabled={leaving} onclick={showClue}>{reading?"Close clue":"Read clue"}</button><button class="btn btn-primary" type="button" disabled={leaving} onclick={leave}>{leaving?"Returning…":"Return to office"}</button></div></div>
  {#if recipe}<SceneAds scene={recipe.id} />{/if}
</div>
<style>
  .explorable-witness{background:#112a23}.witness-actions{position:absolute;z-index:4;bottom:max(1rem,env(safe-area-inset-bottom));left:50%;transform:translateX(-50%);width:min(36rem,calc(100% - 2rem));text-align:center;background:#0b281feb;border:1px solid #b5aa8066;border-radius:12px;padding:12px;color:#fff0cf}.witness-actions span{font-size:12px;display:block;margin-bottom:10px}.witness-actions>div{display:flex;justify-content:center;gap:10px}.witness-reading{position:absolute;z-index:3;left:50%;transform:translateX(-50%);bottom:9rem;width:min(42rem,calc(100% - 2rem));max-height:55%;overflow:auto;padding:20px;background:#0b281ff5;border:1px solid #9a9876;border-radius:14px;color:#fff2d3;box-sizing:border-box}.witness-reading h2{font-size:16px}.witness-reading .witness-account-text{font-size:clamp(16px,2vw,21px)}.scene-fallback{position:absolute;top:8rem;left:1rem;z-index:3;color:#fff2d3;font-size:12px}.explorable-witness :global(.witness-caption){bottom:9rem;max-height:35%}@media(max-width:960px) and (orientation:portrait){.witness-actions{bottom:max(1rem,env(safe-area-inset-bottom))}.witness-reading{top:auto;bottom:9rem;max-height:42%}.explorable-witness :global(.witness-caption){top:auto;bottom:auto;align-self:start;max-height:calc(100dvh - min(42dvh,62.5vw) - 15rem);margin-bottom:9rem}}
</style>
