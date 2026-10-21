<script lang="ts">
  import { onMount } from "svelte";
  import { request, ApiError } from "./api.ts";
  type Summary={campaign_id:number;campaign:string;advertiser:string;placement:string;shown:number;clicks:number;visits:number};
  type EventRow={id:number;event_id:string;campaign:string;creative_id:number;placement:string;kind:string;source:string;occurred_at:number;destination:string};
  type Report={snapshot:number;start:number;end:number;shown:number;clicks:number;visits:number;total:number;summaries:Summary[];events:EventRow[];next:number|null};
  let {campaigns,expired}:{campaigns:{id:number;name:string}[];expired:(error:unknown)=>boolean}=$props();
  const local=(d:Date)=>new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16);
  let start=$state(local(new Date(Date.now()-30*86400000))),end=$state(local(new Date(Date.now()+60000)));
  let campaign=$state("0"),kind=$state(""),busy=$state(false),exporting=$state(false),error=$state("");
  let report=$state<Report|null>(null),applied=$state(""),history=$state<number[]>([]),cursor=$state(0);
  const timezone=Intl.DateTimeFormat().resolvedOptions().timeZone;
  const date=(ms:number)=>new Date(ms).toLocaleString(undefined,{year:"numeric",month:"short",day:"numeric",hour:"2-digit",minute:"2-digit",second:"2-digit"});
  const label=(kind:string)=>({impression:"Shown",click:"Ad clicked",visit:"Link opened"}[kind]??kind);
  async function load(before=0,reset=false){
    busy=true;error="";
    try {
      let query=applied;
      if(reset){
        const a=new Date(start).getTime(),b=new Date(end).getTime();
        if(!Number.isFinite(a)||!Number.isFinite(b)||b<=a||b-a>366*86400000)throw new Error("Choose a date range of 1 minute to 366 days.");
        query=new URLSearchParams({start:String(a),end:String(b),campaign,kind}).toString();
      }
      const result=await request<Report>(`/ads/analytics?${query}${before?`&before=${before}`:""}`);
      report=result;cursor=before;
      if(reset){applied=`${query}&snapshot=${result.snapshot}`;history=[];}
    } catch(e){if(!expired(e))error=e instanceof Error?e.message:"Unable to load ad measurements.";}
    finally{busy=false;}
  }
  async function next(){if(!report?.next)return;const previous=cursor;await load(report.next);if(!error)history=[...history,previous];}
  async function previous(){const before=history.at(-1);if(before===undefined)return;await load(before);if(!error)history=history.slice(0,-1);}
  async function download(type:"events"|"summary"){
    exporting=true;error="";
    try{
      const response=await fetch(`/admin-api/v1/ads/analytics?${applied}&export=${type}`,{credentials:"same-origin",cache:"no-store",signal:AbortSignal.timeout(60000)});
      if(!response.ok){const body=await response.json().catch(()=>({}));throw new ApiError(body.error??"Export failed. Please retry.",response.status);}
      const url=URL.createObjectURL(await response.blob());
      const anchor=document.createElement("a");anchor.href=url;anchor.download=`naijachase-ad-${type}-${new Date(report!.start).toISOString().slice(0,10)}.csv`;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    }catch(e){if(!expired(e))error=e instanceof Error?e.message:"Export failed.";}
    finally{exporting=false;}
  }
  onMount(()=>{void load(0,true);});
</script>

<section class="analytics" aria-labelledby="analytics-heading">
  <h2 id="analytics-heading">Advertisement performance</h2>
  <p>Measured activity from players who allow measurement. <strong>Shown</strong> means loaded artwork visible for at least one second. <strong>Ad clicked</strong> means the player opened its details. <strong>Link opened</strong> records the outbound redirect; it does not confirm the advertiser’s page loaded. These are event counts, not unique people.</p>
  <form onsubmit={(event)=>{event.preventDefault();void load(0,true);}}>
    <fieldset disabled={busy||exporting}>
      <label>From ({timezone})<input required type="datetime-local" bind:value={start}/></label>
      <label>Until (exclusive)<input required type="datetime-local" bind:value={end}/></label>
      <label>Campaign<select bind:value={campaign}><option value="0">All campaigns</option>{#each campaigns as c}<option value={String(c.id)}>{c.name} · #{c.id}</option>{/each}</select></label>
      <label>Event type<select bind:value={kind}><option value="">All events</option><option value="impression">Shown</option><option value="click">Ad clicked</option><option value="visit">Link opened</option></select></label>
      <button type="submit">{busy?"Loading…":"Apply / refresh"}</button>
    </fieldset>
  </form>
  {#if error}<p role="alert" class="error">{error}</p>{/if}
  {#if report}
    <p class="note">Report: {date(report.start)} → {date(report.end)} ({timezone}). Pages and exports exclude later arrivals; refresh to include new events.</p>
    <div class="totals"><div><strong>{report.shown.toLocaleString()}</strong><span>Shown</span></div><div><strong>{report.clicks.toLocaleString()}</strong><span>Ad clicks</span></div><div><strong>{report.visits.toLocaleString()}</strong><span>Link opens</span></div></div>
    <div class="exports"><button disabled={busy||exporting||!!error} onclick={()=>download("summary")}>Export totals · CSV</button><button disabled={busy||exporting||!!error} onclick={()=>download("events")}>Export individual events · CSV</button><span>Opens in Excel. Event exports include all matching rows, up to 50,000; narrow the date range for larger reports. Timestamps in exports use UTC.</span></div>
    <h3>By campaign and placement</h3>
    <div class="table-scroll"><table><thead><tr><th>Campaign / company</th><th>Placement</th><th>Shown</th><th>Ad clicks</th><th>Link opens</th></tr></thead><tbody>{#each report.summaries as row}<tr><td>{row.campaign} · #{row.campaign_id}<small>{row.advertiser}</small></td><td>{row.placement}</td><td>{row.shown.toLocaleString()}</td><td>{row.clicks.toLocaleString()}</td><td>{row.visits.toLocaleString()}</td></tr>{:else}<tr><td colspan="5">No measured activity in this period.</td></tr>{/each}</tbody></table></div>
    <h3>Individual events <small>({report.total.toLocaleString()} total)</small></h3>
    <div class="table-scroll"><table><thead><tr><th>Time ({timezone})</th><th>Event</th><th>Campaign / creative</th><th>Placement / source</th><th>Record</th></tr></thead><tbody>{#each report.events as row}<tr><td>{date(row.occurred_at)}</td><td>{label(row.kind)}</td><td>{row.campaign}<small>Creative #{row.creative_id}</small></td><td>{row.placement}<small>{row.source.replaceAll("_"," ")}</small></td><td>#{row.id}</td></tr>{:else}<tr><td colspan="5">No events to display.</td></tr>{/each}</tbody></table></div>
    <div class="pagination"><button disabled={busy||!history.length} onclick={previous}>Previous</button><span>Page {history.length+1} · up to 100 events per page</span><button disabled={busy||!report.next} onclick={next}>Next</button></div>
  {:else if busy}<p role="status">Loading measurements…</p>{/if}
</section>
<style>
  .analytics{padding:24px;border:1px solid #dbe3df;border-radius:14px;background:white;min-width:0}.analytics h2{margin-top:0}.analytics p{line-height:1.6}.analytics fieldset{display:flex;flex-wrap:wrap;gap:14px;padding:0;border:0;align-items:end}.analytics label{display:grid;gap:6px;font-size:13px;font-weight:600;min-width:0}.analytics input,.analytics select,.analytics button{font:inherit;padding:10px;border:1px solid #aabeb3;border-radius:7px;background:white;color:#204c39;max-width:100%;box-sizing:border-box}.analytics button{cursor:pointer;background:#edf6f0}.analytics button:disabled{opacity:.5;cursor:default}.totals{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:20px 0}.totals div{padding:16px;background:#eaf5ef;border-radius:9px;display:grid;gap:6px}.totals strong{font-size:28px}.totals span{font-size:13px}.note,.exports span,.pagination,small{font-size:12px;color:#53675b}.exports{display:flex;gap:10px;flex-wrap:wrap;align-items:center}.exports span{flex-basis:100%}.table-scroll{overflow-x:auto}table{width:100%;border-collapse:collapse;font-size:13px;text-align:left}th,td{padding:12px 10px;border-bottom:1px solid #dce5df;vertical-align:top}td small{display:block;margin-top:4px}th{white-space:nowrap}.pagination{display:flex;gap:14px;align-items:center;justify-content:space-between;margin-top:15px}.error{background:#ffe8e5;color:#84281c;padding:12px}@media(max-width:600px){.analytics{padding:16px}.analytics label{width:100%}.totals div{padding:10px}.totals strong{font-size:23px}}
</style>
