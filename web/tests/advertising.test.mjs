import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { placements, activeAd, scenePlacements, validAd } from "../src/ads/catalogue.ts";
import { allRecipes } from "../src/scenes/witness/venue-recipes.ts";
import { lookAround } from "../src/scenes/shared/look-around.ts";
const ad=(id,over={})=>({placement_id:id,creative_id:7,alt_text:"Company offer",destination:"https://example.com/offer",starts_at:100,ends_at:200,image_url:"/ads-api/v1/images/7",...over});

test("every witness venue and both rooms have release-controlled placements mirrored in SQL",()=>{
  const sql=fs.readFileSync(new URL("../../admin/backend/migrations/0003_advertising.sql",import.meta.url),"utf8");
  const ids=new Set();
  for(const scene of ["office","garage",...allRecipes().map(r=>r.id)])assert.ok(placements.some(p=>p.scene===scene),scene);
  for(const p of placements){
    assert.ok(!ids.has(p.id));ids.add(p.id);
    assert.equal(p.position.length,3);assert.ok(p.position.every(Number.isFinite));assert.ok(p.size.every(n=>n>0));
    assert.ok(Math.max(p.width,p.height)<=1600);
    assert.ok(Math.abs(p.width/p.height-p.size[0]/p.size[1])<.02);
    const seeded=sql.split("\n").find(line=>line.startsWith("INSERT INTO ad_placements")&&line.includes(`VALUES ('${p.id}',`));
    assert.ok(seeded);assert.deepEqual(JSON.parse(seeded.match(/,'(\{.*\})'\)/)[1].replaceAll("''", "'")),p);
  }
});
test("schedules use a half-open interval and expired split walls revert to one house ad",()=>{
  const a=ad("office-right-left");
  assert.equal(activeAd([a],a.placement_id,99),undefined);
  assert.equal(activeAd([a],a.placement_id,100),a);
  assert.equal(activeAd([a],a.placement_id,200),undefined);
  assert.deepEqual(scenePlacements("office",[a],150).map(p=>p.id),["office-right-left","office-right-right","office-clock"]);
  assert.deepEqual(scenePlacements("office",[a],200).map(p=>p.id),["office-right","office-clock"]);
});
test("public manifest rejects arbitrary image URLs, unsafe destinations and unknown slots",()=>{
  assert.ok(validAd(ad("office-right")));
  for(const change of [{image_url:"https://tracking.invalid/pixel"},{destination:"javascript:alert(1)"},{destination:"https://user:pass@example.com"},{placement_id:"unknown"},{ends_at:99},{creative_id:-1}])assert.ok(!validAd(ad("office-right",change)));
});
test("look-around changes the aim without moving the camera through scenery",()=>{
  const base={position:[3,1.55,-.9],target:[.8,1.35,1.95]};
  assert.deepEqual(lookAround(base,0,0).position,base.position);
  for(const yaw of [-10,-1,0,1,10])for(const pitch of [-10,0,10]){const shot=lookAround(base,yaw,pitch);assert.deepEqual(shot.position,base.position);assert.ok(shot.target.every(Number.isFinite));}
  assert.deepEqual(lookAround(base,100,100),lookAround(base,1.35,.4));
});

test("Canvas witness pauses after speaking, supports looking around, and leaves only on request",async()=>{
  const saved={window:globalThis.window,document:globalThis.document,fetch:globalThis.fetch,ResizeObserver:globalThis.ResizeObserver,requestAnimationFrame:globalThis.requestAnimationFrame,cancelAnimationFrame:globalThis.cancelAnimationFrame};
  let next=1;const queue=new Map();
  globalThis.window={devicePixelRatio:1};globalThis.document={hidden:false,addEventListener(){},removeEventListener(){}};
  globalThis.fetch=async()=>({ok:true,json:async()=>({server_time:100,ads:[]})});
  globalThis.ResizeObserver=class{observe(){}disconnect(){}};
  globalThis.requestAnimationFrame=fn=>{const id=next++;queue.set(id,fn);return id;};globalThis.cancelAnimationFrame=id=>queue.delete(id);
  const step=t=>{const jobs=[...queue.values()];queue.clear();jobs.forEach(fn=>fn(t));};
  const context=new Proxy({}, {get(_t,key){if(key==="createLinearGradient"||key==="createRadialGradient")return()=>({addColorStop(){}});if(key==="measureText")return()=>({width:20});return()=>{};},set(){return true;}});
  const canvas={clientWidth:800,clientHeight:450,getContext:()=>context,addEventListener(){},removeEventListener(){}};
  let handle;
  try{
    const {createWitnessScene2D}=await import("../src/scenes/witness/witness-2d.ts");
    handle=await createWitnessScene2D(canvas,{hour:12,recipe:allRecipes()[0],arrival:"drive",text:"They went north.",venueName:"Market",sound:false,onFrame(){},onFault(why){throw Error(why);}});
    let complete=false;const started=handle.start(3).then(()=>complete=true);
    step(10000);assert.equal(handle.now(),3,"fallback resumes at elapsed time");step(100000);await started;
    assert.ok(complete);const hold=handle.now();assert.ok(hold<handle.duration);
    handle.look(.2,.1);assert.equal(handle.now(),hold);assert.equal(queue.size,0,"idle exploration spends no animation frames");
    let left=false;const leaving=handle.leave().then(()=>left=true);assert.equal(left,false);step(100000);step(200000);await leaving;
    assert.equal(handle.now(),handle.duration);assert.ok(left);
  }finally{handle?.dispose();Object.assign(globalThis,saved);}
});
