<script lang="ts">
  import AdAnalytics from "./AdAnalytics.svelte";
  import { onMount } from "svelte";
  import { request } from "./api.ts";
  type Placement = { id: string; scene: string; label: string; width: number; height: number; surface: string; segment: string };
  type Campaign = { id: number; revision: number; advertiser: string; contact: string; name: string; placement_id: string; status: string; starts_at: number; ends_at: number; alt_text: string; destination: string; creative_id: number };
  let { expired }: { expired: (error: unknown) => boolean } = $props();
  let placements = $state<Placement[]>([]), campaigns = $state<Campaign[]>([]);
  let servingEnabled=$state(false);
  let busy = $state(false), loading = $state(true), error = $state(""), success = $state("");
  let editing = $state<Campaign | null>(null);
  let advertiser = $state(""), contact = $state(""), name = $state(""), placementId = $state("office-right");
  let status = $state("draft"), altText = $state(""), destination = $state("");
  const local = (epoch: number) => { const d = new Date(epoch * 1000); return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16); };
  let start = $state(local(Date.now()/1000)), duration = $state(7), unit = $state("days");
  let upload = $state<string | undefined>(), preview = $state(""), fileKey = $state(0), previewMode = $state("desktop");
  let filter = $state("");
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const selected = $derived(placements.find(p => p.id === placementId));
  const end = $derived(new Date(start).getTime()/1000 + duration * (unit === "days" ? 86400 : 3600));
  const shown = $derived(campaigns.filter(c => `${c.name} ${c.advertiser} ${c.placement_id}`.toLowerCase().includes(filter.toLowerCase())));
  const date = (seconds: number) => Number.isFinite(seconds) ? new Date(seconds*1000).toLocaleString() : "Choose a start time";
  function campaignState(c: Campaign) { return c.status !== "live" ? c.status : c.ends_at <= Date.now()/1000 ? "expired" : c.starts_at > Date.now()/1000 ? "scheduled" : "live"; }
  async function load() {
    loading = true;
    try { const result = await request<{placements:Placement[];campaigns:Campaign[];serving_enabled:boolean}>("/ads"); placements=result.placements;campaigns=result.campaigns;servingEnabled=result.serving_enabled; }
    catch(e) { if (!expired(e)) error=e instanceof Error?e.message:"Unable to load campaigns"; }
    finally {loading=false;}
  }
  onMount(load);
  function reset() { editing=null;advertiser="";contact="";name="";status="draft";altText="";destination="";upload=undefined;preview="";fileKey++;start=local(Date.now()/1000);duration=7;unit="days";error=""; }
  function edit(c: Campaign) { reset();editing=c;advertiser=c.advertiser;contact=c.contact;name=c.name;placementId=c.placement_id;status=c.status;altText=c.alt_text;destination=c.destination;start=local(c.starts_at);duration=(c.ends_at-c.starts_at)/3600;unit="hours";preview=`/admin-api/v1/ads/creatives/${c.creative_id}`;document.getElementById("ad-editor")?.scrollIntoView({behavior:"smooth"}); }
  async function file(event: Event) {
    const chosen=(event.target as HTMLInputElement).files?.[0]; if(!chosen)return;
    error="";upload=undefined;preview="";
    if(chosen.size>2*1024*1024 || !["image/png","image/jpeg","image/webp"].includes(chosen.type)){error="Use a PNG, JPEG or WebP under 2 MB.";return;}
    try {
      const data=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=reject;reader.readAsDataURL(chosen);});
      const img=new Image();img.src=data;await img.decode();
      if(selected && Math.abs((img.width/img.height)/(selected.width/selected.height)-1)>.03){error=`This placement needs ${selected.width} × ${selected.height}, or the same proportions. Your image is ${img.width} × ${img.height}.`;return;}
      upload=data.split(",")[1];preview=data;
    } catch {error="That image could not be opened.";}
  }
  async function save(event: SubmitEvent) {
    event.preventDefault();if(busy)return;busy=true;error="";success="";
    try {
      await request("/ads",{method:"POST",body:JSON.stringify({id:editing?.id,revision:editing?.revision,advertiser,contact,name,placement_id:placementId,status,starts_at:Math.floor(new Date(start).getTime()/1000),ends_at:Math.floor(end),alt_text:altText,destination,image:upload})});
      reset();success="Campaign saved. Its schedule uses real time, independently of the game clock.";await load();
    } catch(e) {if(!expired(e))error=e instanceof Error?e.message:"Unable to save campaign";}
    finally {busy=false;}
  }
</script>

<div class="ads-manager">
  <AdAnalytics {campaigns} {expired} />
  {#if !loading&&!servingEnabled}<p role="status">Campaigns can be prepared here. Public ad serving is currently disabled in server configuration.</p>{/if}
  {#if error}<p class="ad-error" role="alert">{error}</p>{/if}
  {#if success}<p class="ad-success" role="status">{success}</p>{/if}
  <form id="ad-editor" onsubmit={save}>
    <div class="ad-title"><h2>{editing ? "Edit campaign" : "New advertisement"}</h2>{#if editing}<button type="button" onclick={reset}>New campaign</button>{/if}</div>
    <p>Choose a scenery placement, upload the artwork and set how long it runs. Large wall placements and their left/right alternatives share availability.</p>
    <fieldset disabled={busy || loading}>
      <div class="ad-fields">
        <label>Company<input required maxlength="160" bind:value={advertiser} placeholder="Company name" /></label>
        <label>Company contact<input maxlength="254" bind:value={contact} placeholder="Email or phone (optional)" /></label>
        <label>Campaign name<input required maxlength="160" bind:value={name} placeholder="October launch" /></label>
        <label>Placement<select bind:value={placementId}>{#each placements as p}<option value={p.id}>{p.scene.replaceAll("_"," ")} — {p.label}</option>{/each}</select></label>
        <label>Advertiser link<input required type="url" maxlength="2048" bind:value={destination} placeholder="https://company.com/offer" /></label>
        <label>Image description<input required maxlength="240" bind:value={altText} placeholder="Describe the offer for players" /></label>
        <label>Starts ({timezone})<input required type="datetime-local" bind:value={start} /></label>
        <label>Duration<div class="duration"><input required type="number" min="0.1" max={unit === "days" ? 366 : 8784} step="0.1" bind:value={duration} /><select aria-label="Duration unit" bind:value={unit}><option value="days">Days</option><option value="hours">Hours</option></select></div></label>
        <label>Status<select bind:value={status}><option value="draft">Draft — hidden</option><option value="live">Published — follows schedule</option><option value="paused">Paused — hidden</option></select></label>
        <label>Artwork {#key fileKey}<input type="file" accept="image/png,image/jpeg,image/webp" onchange={file} required={!editing} />{/key}<small>PNG, JPEG or WebP · up to 2 MB. {selected?.width} × {selected?.height} recommended; matching proportions required.</small></label>
      </div>
      <p>Ends: <strong>{date(end)}</strong></p>
      <div class="preview-controls"><strong>Artwork preview</strong><button type="button" aria-pressed={previewMode === "desktop"} onclick={()=>previewMode="desktop"}>Desktop</button><button type="button" aria-pressed={previewMode === "mobile"} onclick={()=>previewMode="mobile"}>Mobile</button></div>
      <div class="preview-wall" class:phone={previewMode === "mobile"}><div class="preview-art" style:aspect-ratio={`${selected?.width ?? 2} / ${selected?.height ?? 1}`}>{#if preview}<img src={preview} alt={altText || "Advertisement preview"} />{:else}<span>All eyes on the chase.<br />Your brand could be here.</span>{/if}<small>{preview ? "Ad" : "Advertise on NaijaChase"}</small></div></div>
      <p class="ad-note">Preview shows artwork proportions. Perspective and visibility depend on the player's camera. A blank or unavailable slot displays a NaijaChase message.</p>
      <button class="save-ad" type="submit" disabled={busy || (!editing && !upload)}>{busy ? "Saving…" : editing ? "Save changes" : "Save campaign"}</button>
    </fieldset>
  </form>
  <section aria-label="Campaigns">
    <div class="ad-title"><h2>Campaigns</h2><button type="button" disabled={loading} onclick={load}>Refresh</button></div>
    <label>Find campaign<input type="search" bind:value={filter} placeholder="Company, campaign or placement" /></label>
    {#if loading}<p role="status">Loading campaigns…</p>{/if}
    {#each shown as c}<article class="campaign"><div><strong>{c.name}</strong><span class="ad-status">{campaignState(c)}</span><p>{c.advertiser} · {placements.find(p=>p.id===c.placement_id)?.label} · {placements.find(p=>p.id===c.placement_id)?.scene.replaceAll("_"," ")}</p><small>{date(c.starts_at)} → {date(c.ends_at)}</small></div><button type="button" onclick={()=>edit(c)}>Edit / pause / extend</button></article>{:else}{#if !loading}<p>No matching campaigns. Empty spaces use the NaijaChase artwork.</p>{/if}{/each}
    {#if campaigns.length >= 1000}<p>Showing the latest 1,000 campaigns.</p>{/if}
  </section>
</div>

<style>
  .ads-manager{display:grid;gap:24px}.ads-manager form,.ads-manager section{background:white;border:1px solid #dbe3df;border-radius:14px;padding:24px;min-width:0}.ad-title{display:flex;justify-content:space-between;gap:12px;align-items:center}.ad-title h2{margin:0}.ads-manager p{line-height:1.5}.ads-manager fieldset{border:0;padding:0;margin:0;min-width:0}.ad-fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px}.ads-manager label{display:grid;gap:8px;font-size:14px;font-weight:600;min-width:0}.ads-manager input,.ads-manager select{box-sizing:border-box;width:100%;min-width:0;padding:11px;border:1px solid #bccac3;border-radius:7px;background:white;color:#203d35}.ads-manager small,.ad-note{font-size:12px;font-weight:400;color:#52665e}.duration{display:flex;gap:8px}.duration select{width:100px}.ads-manager button{padding:10px 15px;border:1px solid #aac1b5;border-radius:7px;background:#f4f8f5;color:#174d3a;cursor:pointer}.ads-manager button:disabled{opacity:.6;cursor:wait}.ads-manager .save-ad{background:#176b4d;color:white}.preview-controls{display:flex;gap:8px;align-items:center;margin-bottom:12px;flex-wrap:wrap}.preview-controls [aria-pressed=true]{background:#176b4d;color:white}.preview-wall{max-width:720px;padding:24px;background:#d6ccba;border-bottom:12px solid #67513e;transition:max-width .2s}.preview-wall.phone{max-width:260px}.preview-art{position:relative;margin:auto;max-width:100%;max-height:330px;border:6px solid #463c2b;background:#113f34;color:#f4d083;display:flex;align-items:center;justify-content:center;overflow:hidden;text-align:center;font-size:clamp(14px,2vw,24px);padding:0}.preview-art img{width:100%;height:100%;object-fit:contain}.preview-art small{position:absolute;bottom:0;right:0;background:#142a23;color:white;padding:4px 8px;font-size:10px}.ad-error,.ad-success{padding:16px;border-radius:8px;background:#ffe8e5;color:#862b20}.ad-success{background:#e0f3e8;color:#14523a}.campaign{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:20px 0;border-bottom:1px solid #e3e9e5}.campaign p{margin:7px 0}.ad-status{display:inline-block;margin-left:10px;background:#e5eee9;border-radius:20px;padding:3px 9px;font-size:12px}.campaign button{flex-shrink:0}@media(max-width:700px){.ads-manager form,.ads-manager section{padding:16px}.ad-fields{grid-template-columns:1fr}.campaign{align-items:start;flex-direction:column}.preview-wall{padding:12px}.preview-art{max-height:220px}}
</style>
