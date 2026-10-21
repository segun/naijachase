<script lang="ts">
  import WitnessScene from "../src/scenes/witness/WitnessScene.svelte";
  import Stage from "../src/scenes/shared/Stage.svelte";
  import { T_ZOOM_START } from "../src/scenes/office/room-scene.ts";
  import { allRecipes,recipeFor } from "../src/scenes/witness/venue-recipes.ts";
  import { detail } from "../src/scenes/shared/detail.svelte.ts";
  import type { DetailChoice } from "../src/scenes/shared/detail-level.ts";
  import type { AppController } from "../src/state/app.svelte.ts";
  let scene=$state("office"),generation=$state(0),left=$state(false);
  let choice=$state<DetailChoice>("standard");
  const recipes=allRecipes();
  const app=$derived({avatar:{...recipeFor("market")!.witnesses[0]!,avatar_id:"avatar-01"},game:{state:{elapsed:0}},music:{enabled:false,duck:()=>{}},witnessVisit:{venueId:scene,venueName:scene.replaceAll("_"," "),arrival:"drive",role:"Witness",message:"The suspect bought a ticket to the north. They wore a red cap and carried a leather bag."},leaveWitness:()=>{left=true;}} as unknown as AppController);
  $effect(()=>{detail.choice=choice;});
</script>
<nav><label>Scene<select bind:value={scene} onchange={()=>{generation++;left=false;}}><option>office</option><option>garage</option>{#each recipes as r}<option value={r.id}>{r.id.replaceAll("_"," ")}</option>{/each}</select></label><label>Detail<select bind:value={choice}><option value="standard">Standard</option><option value="simple">Simple / 2D</option><option value="full">Full</option></select></label><button onclick={()=>{generation++;left=false;}}>Restart</button></nav>
{#key `${scene}-${generation}`}
  {#if left}<p class="done">Returned to office successfully.</p>
  {:else if scene==="office"||scene==="garage"}
    <Stage {app} adScene={scene} sheet={scene==="garage"?"dock":"crt"} exploreAt={scene==="office"?T_ZOOM_START:undefined} load={(canvas,options)=>scene==="office"?import("../src/scenes/office/chase3d-room.ts").then(m=>m.createRoomScene(canvas,options)):import("../src/scenes/garage/chase3d-garage.ts").then(m=>m.createGarageScene(canvas,options))} load2d={(canvas,options)=>import("../src/scenes/shared/room-2d.ts").then(m=>m.createRoom2D(canvas,options,scene==="office"?"office":"garage"))}>
      {#snippet children(awake,leave)}<section class="choices"><h2>{scene==="office"?"Case desk":"Choose transport"}</h2><button disabled={!awake} onclick={async()=>{await leave("drive");left=true;}}>Continue</button></section>{/snippet}
    </Stage>
  {:else}<WitnessScene {app} />{/if}
{/key}
<style>
  :global(body){margin:0;font-family:system-ui;background:#10251d;color:#fff1d0;--ink:#fff1d0;--gold:#e8bf68;--mono:monospace}nav{position:fixed;inset:0 0 auto;z-index:100;display:flex;gap:8px;background:#071b15;padding:8px;flex-wrap:wrap;font-size:12px}nav label{display:flex;align-items:center;gap:6px}select,button{padding:8px;font:inherit}.choices{padding:20px;color:#ffe8b5}.done{margin:100px 20px}.choices button{background:#1a6548;color:#ffdc97}@media(max-width:600px){nav{gap:4px;font-size:10px}nav select{max-width:105px;padding:5px}nav button{padding:5px}nav label{gap:3px}}
</style>
