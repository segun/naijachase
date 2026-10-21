<script lang="ts">
  import { recordAd, observeAd, outboundLink, type AdSource } from "./analytics.ts";
  import { halfInViewport } from "./measurement.ts";
  import { onMount } from "svelte";
  import { placements, scenePlacements, type Ad } from "./catalogue.ts";
  import { currentAds, adNow, adFor, subscribeAds } from "./service.ts";
  let { scene, inline = false }: {scene:string;inline?:boolean}=$props();
  let ads=$state<readonly Ad[]>([]),now=$state(0),selected=$state(""),failed=$state(0);
  let dialog:HTMLDialogElement;
  let opener:HTMLElement|null=null;
  const slots=$derived(scenePlacements(scene,ads,now));
  const placement=$derived(placements.find(p=>p.id===selected));
  const ad=$derived(ads.find(a=>a.placement_id===selected&&a.starts_at<=now&&a.ends_at>now));
  function open(id="",source:AdSource="details"){const active=adFor(id);if(active)recordAd(active,"click",source);selected=id;failed=0;opener=document.activeElement instanceof HTMLElement?document.activeElement:null;dialog.showModal();}
  function close(){dialog.close();opener?.focus();}
  onMount(()=>{
    const stop=subscribeAds(()=>{ads=[...currentAds()];now=adNow();});
    const receive=(event:Event)=>{const {id,source}=(event as CustomEvent<{id:string;source:AdSource}>).detail;if(placements.some(p=>p.id===id&&p.scene===scene))open(id,source);};
    window.addEventListener("nc-ad-open",receive);
    return()=>{stop();window.removeEventListener("nc-ad-open",receive);};
  });
  function measureImage(node:HTMLImageElement, id:string) {
    const stop=observeAd(id,"details",()=>{
      const r=node.getBoundingClientRect();
      return dialog.open&&node.complete&&node.naturalWidth>0&&halfInViewport({x:r.x,y:r.y,w:r.width,h:r.height},innerWidth,innerHeight)&&document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)===node;
    });
    return {destroy:stop};
  }
  function visit(event:Event) {
    const active=adFor(selected);
    if(!active){event.preventDefault();return;}
    (event.currentTarget as HTMLAnchorElement).href=outboundLink(active);
  }
  function key(event:KeyboardEvent){event.stopPropagation();}
</script>

<div class="scene-ads" class:inline><button type="button" class="ad-access" onclick={()=>open()}>Sponsors &amp; ad spaces</button></div>
<dialog bind:this={dialog} class="ad-dialog" onkeydown={key} oncancel={()=>opener?.focus()} aria-label="NaijaChase advertisements">
  <header><strong>{placement?.label ?? "Around this location"}</strong><button type="button" aria-label="Close advertisements" onclick={close}>Close ×</button></header>
  {#if placement}
    {#if ad && failed!==ad.creative_id}
      <p class="ad-label">Advertisement</p>{#key ad.creative_id}<img use:measureImage={ad.placement_id} class="ad-image" src={ad.image_url} alt={ad.alt_text} onerror={()=>failed=ad.creative_id} />{/key}
      <p>{ad.alt_text}</p><a class="visit-ad" href={outboundLink(ad)} target="_blank" rel="noopener noreferrer" onpointerdown={visit} oncontextmenu={visit} onclick={visit} onauxclick={visit}>Visit advertiser ↗</a><p class="ad-note">Opens a new tab. Your investigation stays here.</p>
    {:else}
      <div class="house-ad"><small>NAIJACHASE</small><h2>Make your brand the next big lead.</h2><p>Your customers dey here. Put your brand on the map.</p></div>
      <p>{ad ? "Artwork is temporarily unavailable." : "This space is available for advertising."} Placement: <strong>{placement.id}</strong>.</p>
      <p class="ad-note">Artwork: {placement.width} × {placement.height} pixels, or matching proportions.</p>
    {/if}
    <button type="button" onclick={()=>selected=""}>All spaces at this location</button>
  {:else}
    <p>Tap a space to view its artwork and advertiser link.</p>
    <div class="ad-spaces">{#each slots as slot}<button type="button" onclick={()=>open(slot.id)}><strong>{slot.label}</strong><span>{ads.some(a=>a.placement_id===slot.id)?"View advertisement":"Your brand could be here"}</span></button>{/each}</div>
  {/if}
</dialog>

<style>
  .scene-ads{position:absolute;left:1rem;top:calc(5rem + env(safe-area-inset-top));z-index:4}.scene-ads.inline{position:relative;inset:auto;margin:.65rem 0}.ad-access{background:#123e32e8;color:#ffdf9e;border:1px solid #d8bb77;border-radius:9px;padding:.55rem .8rem;font-size:.8rem;cursor:pointer}.ad-dialog{box-sizing:border-box;background:#102c25;color:#fff3d5;border:1px solid #b69c65;border-radius:16px;padding:20px;width:min(620px,calc(100vw - 24px));max-height:calc(100dvh - 32px);overflow:auto;box-shadow:0 20px 70px #0008}.ad-dialog::backdrop{background:#00180dcc}.ad-dialog header{display:flex;align-items:center;justify-content:space-between;gap:12px}.ad-dialog button,.visit-ad{display:inline-block;background:#176b4d;color:#fff2c7;border:1px solid #ad965e;border-radius:8px;padding:10px 14px;cursor:pointer;text-decoration:none}.ad-dialog button:focus-visible,.visit-ad:focus-visible{outline:3px solid #ffdf79;outline-offset:3px}.ad-label,.ad-note{font-size:12px;color:#c6d2c8}.ad-image{display:block;width:100%;max-height:55dvh;object-fit:contain}.house-ad{padding:30px 20px;margin-top:20px;background:#1b5440;border:5px solid #b69c65;text-align:center}.house-ad h2{font-size:clamp(24px,5vw,36px);color:#ffda8f}.ad-spaces{display:grid;gap:12px}.ad-spaces button{text-align:left}.ad-spaces span{display:block;font-size:12px;margin-top:6px}.ad-dialog p{line-height:1.5}.ad-dialog strong{overflow-wrap:anywhere}@media(max-width:960px){.scene-ads{top:calc(4rem + env(safe-area-inset-top));left:.6rem}.ad-access{font-size:.7rem;padding:.45rem .6rem}}
</style>
