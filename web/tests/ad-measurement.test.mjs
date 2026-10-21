import test from "node:test";
import assert from "node:assert/strict";
import {exposureCounter,halfInViewport} from "../src/ads/measurement.ts";

test("views require a continuous second and stationary pictures count only once",()=>{
  const sample=exposureCounter();
  assert.equal(sample("7",true,0),false);
  assert.equal(sample("7",true,999),false);
  assert.equal(sample("7",true,1000),true);
  assert.equal(sample("7",true,30000),false);
});
test("brief visibility interruptions reset the dwell timer, not a counted exposure",()=>{
  const sample=exposureCounter();
  sample("7",true,0);sample("7",false,500);
  assert.equal(sample("7",true,750),false);
  assert.equal(sample("7",true,1500),false);
  assert.equal(sample("7",true,1750),true);
  sample("7",false,2000);sample("7",true,2250);
  assert.equal(sample("7",true,4000),false);
  sample("7",false,5000);
  assert.equal(sample("7",true,6250),false);
  assert.equal(sample("7",true,7250),true);
});
test("replacement creatives and expired artwork cannot inherit an impression",()=>{
  const sample=exposureCounter();sample("7",true,0);assert.equal(sample("7",true,1000),true);
  assert.equal(sample("8",true,1100),false);assert.equal(sample("8",true,2100),true);
  assert.equal(sample("",false,2200),false);assert.equal(sample("",true,5000),false);
});
test("viewport threshold excludes offscreen, tiny and invalid billboards",()=>{
  assert.equal(halfInViewport({x:-50,y:0,w:100,h:100},100,100),true);
  assert.equal(halfInViewport({x:-51,y:0,w:100,h:100},100,100),false);
  assert.equal(halfInViewport({x:-50,y:-50,w:100,h:100},100,100),false);
  assert.equal(halfInViewport({x:0,y:0,w:3,h:3},100,100),false);
  assert.equal(halfInViewport({x:NaN,y:0,w:100,h:100},100,100),false);
});

test("measurement respects consent, retries idempotently and preserves views during renderer handoff",async()=>{
  const keys=["document","localStorage","fetch","performance","setInterval","clearInterval"];
  const saved=Object.fromEntries(keys.map(key=>[key,globalThis[key]]));
  let now=0,choice="no",seq=0;const timers=new Map(),events=[];
  const ad={placement_id:"office-right",creative_id:7,alt_text:"Offer",destination:"https://example.com/offer",starts_at:1,ends_at:1000,image_url:"/ads-api/v1/images/7"};
  globalThis.document={hidden:false,addEventListener(){},removeEventListener(){}};
  globalThis.localStorage={getItem:()=>choice};globalThis.performance={now:()=>now};
  globalThis.setInterval=fn=>{timers.set(++seq,fn);return seq;};globalThis.clearInterval=id=>timers.delete(id);
  globalThis.fetch=async(url,options)=>{
    if(url.endsWith("manifest"))return {ok:true,json:async()=>({server_time:100,ads:[ad]})};
    events.push(JSON.parse(options.body));
    assert.equal(options.credentials,"omit");
    return {status:events.length===1?503:204};
  };
  const flush=()=>new Promise(resolve=>setImmediate(resolve));
  const tick=ms=>{now=ms;for(const fn of [...timers.values()])fn();};
  let stopAds,stopView;
  try{
    const {recordAd,outboundLink,observeAd}=await import("../src/ads/analytics.ts");
    const {subscribeAds}=await import("../src/ads/service.ts");
    recordAd(ad,"click","details");assert.equal(events.length,0);assert.equal(outboundLink(ad),ad.destination);
    choice="yes";recordAd(ad,"click","details");await flush();
    assert.equal(events.length,2);assert.deepEqual(events[0],events[1],"one UUID reused on retry");
    assert.match(outboundLink(ad),/^\/ads-api\/v1\/out\/7\/[a-f0-9-]{36}$/);
    assert.notEqual(outboundLink(ad),outboundLink(ad),"fresh activations have separate IDs");
    stopAds=subscribeAds(()=>{});await flush();
    stopView=observeAd("office-right","scene_3d",()=>true);tick(0);tick(1000);await flush();
    assert.equal(events.filter(e=>e.kind==="impression").length,1);
    stopView();stopView=observeAd("office-right","scene_2d",()=>true);tick(2000);await flush();
    assert.equal(events.filter(e=>e.kind==="impression").length,1,"handoff does not count twice");
    choice="no";tick(3000);recordAd(ad,"click","details");await flush();assert.equal(events.length,3);
    choice="yes";document.hidden=true;recordAd(ad,"click","details");await flush();assert.equal(events.length,3);
  }finally{stopView?.();stopAds?.();Object.assign(globalThis,saved);}
});
