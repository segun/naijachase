export const STATES = [
  "Abia","Adamawa","Akwa Ibom","Anambra","Bauchi","Bayelsa","Benue","Borno",
  "Cross River","Delta","Ebonyi","Edo","Ekiti","Enugu","Federal Capital Territory",
  "Gombe","Imo","Jigawa","Kaduna","Kano","Katsina","Kebbi","Kogi","Kwara",
  "Lagos","Nasarawa","Niger","Ogun","Ondo","Osun","Oyo","Plateau","Rivers",
  "Sokoto","Taraba","Yobe","Zamfara"
] as const;

export const HOME_BASES = STATES.filter(state => state !== "Federal Capital Territory");

const CAPITALS:Record<string,[number,number]>={
  "Abia":[5.53,7.49],"Adamawa":[9.20,12.48],"Akwa Ibom":[5.04,7.91],"Anambra":[6.21,7.07],"Bauchi":[10.31,9.84],"Bayelsa":[4.92,6.26],"Benue":[7.73,8.54],"Borno":[11.83,13.15],"Cross River":[4.98,8.34],"Delta":[6.20,6.73],"Ebonyi":[6.32,8.11],"Edo":[6.34,5.62],"Ekiti":[7.62,5.22],"Enugu":[6.45,7.51],"Gombe":[10.29,11.17],"Imo":[5.48,7.03],"Jigawa":[11.70,9.34],"Kaduna":[10.52,7.44],"Kano":[12.00,8.52],"Katsina":[12.99,7.60],"Kebbi":[12.45,4.20],"Kogi":[7.80,6.74],"Kwara":[8.50,4.55],"Lagos":[6.46,3.39],"Nasarawa":[8.49,8.52],"Niger":[9.62,6.55],"Ogun":[7.15,3.35],"Ondo":[7.25,5.19],"Osun":[7.77,4.56],"Oyo":[7.38,3.95],"Plateau":[9.93,8.89],"Rivers":[4.82,7.05],"Sokoto":[13.06,5.24],"Taraba":[8.89,11.36],"Yobe":[11.75,11.96],"Zamfara":[12.17,6.66]
};
export const STATE_COORDS:Record<string,[number,number]>={...CAPITALS,"Federal Capital Territory":[9.06,7.49]};
export function nearestHomeBase(latitude:number,longitude:number):string {
  let best="Lagos",distance=Infinity;
  for(const [state,[lat,lon]] of Object.entries(CAPITALS)){const d=(lat-latitude)**2+(lon-longitude)**2;if(d<distance){best=state;distance=d}}
  return best;
}

export const FIELDS = ["sex","height","skin_tone","hair","hobby","vehicle","accessory","feature"] as const;

// Response shapes come from the generated API contract; do not redefine them here.
export type {
  AuthResponse, CaseArchiveEntry, CaseResponse, ClientCommand, GameEvent, Player, PlayerSession,
  ProfileUpdate, ProgressionSummary, PublicGameState as PublicState, RankHistoryEntry
} from "../../contracts/typescript/api-v1.ts";
import type { PublicGameState as PublicState } from "../../contracts/typescript/api-v1.ts";
export type Screen = "welcome"|"cases"|"investigate"|"notebook"|"dossier"|"travel"|"warrant"|"results"|"settings"|"archive";

export function clock(minutes:number):string {
  const total=420+minutes, day=Math.floor(total/1440);
  const names=["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday","Next Monday"];
  const minute=total%1440;
  return `${names[day] ?? "After deadline"} ${String(Math.floor(minute/60)).padStart(2,"0")}:${String(minute%60).padStart(2,"0")}`;
}
export function progress(state:PublicState):number { return Math.min(100,Math.round((state.stage/7)*100)); }
export function safeId(value:string):boolean { return /^[A-Za-z0-9._-]{2,64}$/.test(value); }

export const DEADLINE_MINUTES = 10080;
export const TOTAL_STOPS = 8;

export type Zone = "North West"|"North East"|"North Central"|"South West"|"South South"|"South East";
export const ZONES:Record<Zone,readonly string[]>={
  "North West":["Jigawa","Kaduna","Kano","Katsina","Kebbi","Sokoto","Zamfara"],
  "North East":["Adamawa","Bauchi","Borno","Gombe","Taraba","Yobe"],
  "North Central":["Benue","Federal Capital Territory","Kogi","Kwara","Nasarawa","Niger","Plateau"],
  "South West":["Ekiti","Lagos","Ogun","Ondo","Osun","Oyo"],
  "South South":["Akwa Ibom","Bayelsa","Cross River","Delta","Edo","Rivers"],
  "South East":["Abia","Anambra","Ebonyi","Enugu","Imo"]
};
export function zoneOf(state:string):Zone|null {
  for(const [zone,members] of Object.entries(ZONES)) if(members.includes(state)) return zone as Zone;
  return null;
}


export function clockParts(minutes:number):{day:string;time:string;hour:number} {
  const total=420+Math.max(0,minutes),day=Math.floor(total/1440),minute=total%1440;
  const names=["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday","Next Monday"];
  const hour=Math.floor(minute/60);
  return {day:names[day]??"After deadline",time:`${String(hour).padStart(2,"0")}:${String(minute%60).padStart(2,"0")}`,hour};
}
export function dayPart(hour:number):"morning"|"afternoon"|"evening"|"night" {
  return hour>=5&&hour<12?"morning":hour>=12&&hour<17?"afternoon":hour>=17&&hour<20?"evening":"night";
}
export function timeLeft(elapsed:number):{minutes:number;label:string;percentUsed:number;urgent:boolean} {
  const minutes=Math.max(0,DEADLINE_MINUTES-elapsed);
  const days=Math.floor(minutes/1440),hours=Math.floor((minutes%1440)/60);
  const label=days>0?`${days}d ${hours}h left`:`${hours}h ${minutes%60}m left`;
  return {minutes,label,percentUsed:Math.min(100,Math.round((elapsed/DEADLINE_MINUTES)*100)),urgent:minutes<=1440};
}

export type Venue = {id:string;name:string;icon:"market"|"library"|"park";who:string;blurb:string};
export const VENUES:readonly Venue[]=[
  {id:"market",name:"Market",icon:"market",who:"Traders and loaders",blurb:"Crowded stalls where everyone notices who spends what."},
  {id:"library",name:"Library",icon:"library",who:"Librarians and researchers",blurb:"Quiet reading rooms. Careful people with careful memories."},
  {id:"motor_park",name:"Motor park",icon:"park",who:"Agberos, drivers and conductors",blurb:"Engines, horns and gossip about who left town and how."}
];
export const SUSPECTS=["NG-T001","NG-T002","NG-T003"] as const;

export const FIELD_META:Record<(typeof FIELDS)[number],{label:string;hint:string;placeholder:string}>={
  sex:{label:"Sex",hint:"How witnesses describe the suspect.",placeholder:"e.g. female"},
  height:{label:"Height",hint:"Tall, short, or something in between.",placeholder:"e.g. tall"},
  skin_tone:{label:"Skin tone",hint:"Use the witness's own wording.",placeholder:"e.g. dark brown"},
  hair:{label:"Hair",hint:"Style, colour or length.",placeholder:"e.g. braided"},
  hobby:{label:"Hobby",hint:"What the suspect spoke about with passion.",placeholder:"e.g. chess"},
  vehicle:{label:"Vehicle",hint:"How the suspect arrived or left.",placeholder:"e.g. motorbike"},
  accessory:{label:"Accessory",hint:"Something worn or carried.",placeholder:"e.g. gold watch"},
  feature:{label:"Distinguishing feature",hint:"Scars, marks or a memorable habit.",placeholder:"e.g. gap tooth"}
};

export function dossierCount(dossier:Record<string,string>):number {
  return FIELDS.filter(field=>(dossier[field]??"").trim().length>0).length;
}

export function stopPrefix(state:PublicState):string { return `${state.stage}|${state.current_state}|`; }
export function questionedHere(state:PublicState):string[] {
  const prefix=stopPrefix(state);
  return state.visited_venues.filter(v=>v.startsWith(prefix)).map(v=>v.slice(prefix.length));
}

export type Note = {stop:string;venue:string;message:string};
export function parseNotes(raw:string|null):Note[] {
  try{
    const value:unknown=JSON.parse(raw??"[]");
    if(!Array.isArray(value)) return [];
    return value.flatMap((item):Note[]=>{
      if(typeof item==="string") return [{stop:"Earlier",venue:"Witness",message:item}];
      if(item&&typeof item.message==="string") return [{stop:String(item.stop??"Earlier"),venue:String(item.venue??"Witness"),message:item.message}];
      return [];
    });
  }catch{return []}
}
export function groupNotes(notes:Note[]):{stop:string;notes:Note[]}[] {
  const groups:{stop:string;notes:Note[]}[]=[];
  for(const note of notes){
    const last=groups[groups.length-1];
    if(last&&last.stop===note.stop) last.notes.push(note); else groups.push({stop:note.stop,notes:[note]});
  }
  return groups;
}

export function initials(name:string):string {
  return name.split(/[\s._-]+/).filter(Boolean).slice(0,2).map(p=>p[0]!.toUpperCase()).join("")||"?";
}

// The catalogue has no list endpoint yet, so mission ids follow the NG-M#### convention.
// The server remains the authority and rejects unknown ids.
export const MISSION_COUNT = 1000;
export const missionId = (n:number):string => `NG-M${String(n).padStart(4,"0")}`;
export function missionNumber(id:string):number|null {
  const match=/^NG-M(\d{4})$/.exec(id);
  return match?Number(match[1]):null;
}
export function unplayedMissions(played:readonly string[]):string[] {
  const done=new Set(played);
  return Array.from({length:MISSION_COUNT},(_,i)=>missionId(i+1)).filter(id=>!done.has(id));
}
export function nextMission(played:readonly string[]):string|null { return unplayedMissions(played)[0] ?? null; }
export function randomMission(played:readonly string[],random:()=>number=Math.random):string|null {
  const open=unplayedMissions(played);
  return open.length?open[Math.floor(random()*open.length)]!:null;
}

export type AchievementDef = { id:string; title:string; description:string };

export function duration(minutes:number):string {
  const days=Math.floor(minutes/1440),hours=Math.floor((minutes%1440)/60),mins=minutes%60;
  if(days>0) return `${days}d ${hours}h`;
  if(hours>0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}
export function ratio(correct:number,wrong:number):string { return `${correct} of ${correct+wrong}`; }

export type ErrorKind = "signed_out"|"denied"|"conflict"|"rejected"|"rate_limited"|"other";
export function errorKind(status:number):ErrorKind {
  return status===401?"signed_out":status===403?"denied":status===409?"conflict":status===422?"rejected":status===429?"rate_limited":"other";
}
export const RATE_LIMIT_MESSAGE = "Too many attempts. Please wait a moment and try again.";
