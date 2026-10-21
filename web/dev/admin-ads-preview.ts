// Development-only UI fixture. Vite's production input contains only index.html.
import { mount } from "svelte";
import Ads from "../../admin/frontend/src/Ads.svelte";
import placements from "../../shared/ad-placements.json";
const sampledAt=Date.now();
const campaigns: Record<string,unknown>[]=[];
const images=new Map<number,string>();
const originalFetch=window.fetch.bind(window);
window.fetch=async(input,options)=>{
  if(String(input).startsWith("/admin-api/v1/ads/analytics?")){
    const query=new URL(String(input),location.origin).searchParams;
    const start=Number(query.get("start")),end=Number(query.get("end"));
    const all=Array.from({length:285},(_,i)=>({id:285-i,event_id:`demo-${i}`,campaign:"NaijaChase demo sponsor",creative_id:1,placement:"office-right",kind:i<245?"impression":i<273?"click":"visit",source:"details",occurred_at:sampledAt-i*60000,destination:"https://example.com"}));
    const filtered=all.filter(e=>e.occurred_at>=start&&e.occurred_at<end&&(!query.get("kind")||query.get("kind")===e.kind));
    const shown=filtered.filter(e=>e.kind==="impression").length,clicks=filtered.filter(e=>e.kind==="click").length,visits=filtered.filter(e=>e.kind==="visit").length;
    const summaries=filtered.length?[{campaign_id:1,campaign:"NaijaChase demo sponsor",advertiser:"Example company",placement:"office-right",shown,clicks,visits}]:[];
    const remaining=filtered.filter(e=>!Number(query.get("before"))||e.id<Number(query.get("before"))),events=remaining.slice(0,100);
    if(query.has("export")){
      const rows=query.get("export")==="events"?filtered:summaries,columns=Object.keys(rows[0]??{note:""});
      return new Response([columns.join(","),...rows.map(row=>columns.map(k=>JSON.stringify((row as Record<string,unknown>)[k])).join(","))].join("\r\n"),{headers:{"Content-Type":"text/csv"}});
    }
    return Response.json({start,end,snapshot:285,summaries,events,shown,clicks,visits,total:filtered.length,next:remaining.length>100?events.at(-1)!.id:null});
  }
  if(String(input)==="/admin-api/v1/ads"){
    if(options?.method==="POST"){
      const campaign=JSON.parse(String(options.body));
      const old=campaigns.findIndex(c=>c.id===campaign.id);
      const id=campaign.id??campaigns.length+1;
      if(campaign.image)images.set(id,`data:image/png;base64,${campaign.image}`);
      delete campaign.image;
      const saved={...campaign,id,creative_id:id,revision:(campaign.revision??0)+1};
      if(old>=0)campaigns[old]=saved;else campaigns.push(saved);
      return Response.json({id});
    }
    return Response.json({placements,campaigns,serving_enabled:true});
  }
  return originalFetch(input,options);
};
mount(Ads,{target:document.getElementById("app")!,props:{expired:()=>false}});
