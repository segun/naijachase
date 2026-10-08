import { STATE_COORDS } from "./model.ts";

// Schematic outline (lat, lon) of Nigeria. It is a stylised silhouette for orientation, not a survey.
const OUTLINE:[number,number][]=[
  [11.7,3.6],[13.0,4.0],[13.5,4.5],[13.85,5.5],[13.6,6.8],[13.4,8.0],[13.5,9.2],[13.3,10.5],[13.5,12.0],
  [13.7,13.4],[13.2,14.4],[12.3,14.65],[11.2,14.1],[10.2,13.6],[9.4,13.2],[8.4,12.5],[7.4,11.9],[6.9,11.2],
  [6.6,11.0],[6.4,10.0],[5.6,9.5],[4.9,8.9],[4.5,8.5],[4.4,7.8],[4.3,7.0],[4.35,6.1],[5.0,5.3],[5.7,5.0],[6.2,4.5],
  [6.4,3.4],[6.4,2.7],[7.6,2.7],[9.0,2.75],[10.0,3.1],[11.0,3.6]
];
export const MAP_W=1000, MAP_H=800;
const SCALE=81, WEST=2.5, NORTH=14.2;

export function project(lat:number,lon:number):{x:number;y:number} {
  return {x:(lon-WEST)*SCALE,y:(NORTH-lat)*SCALE};
}
export function outlinePath():string {
  return OUTLINE.map(([lat,lon],i)=>{const p=project(lat,lon);return `${i?"L":"M"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`}).join(" ")+"Z";
}
export function statePoint(state:string):{x:number;y:number}|null {
  const c=STATE_COORDS[state];
  return c?project(c[0],c[1]):null;
}
export function percentPoint(state:string):{left:string;top:string}|null {
  const p=statePoint(state);
  return p?{left:`${(p.x/MAP_W*100).toFixed(2)}%`,top:`${(p.y/MAP_H*100).toFixed(2)}%`}:null;
}
