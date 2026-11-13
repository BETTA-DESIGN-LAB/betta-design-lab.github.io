export interface Point { lat:number; lon:number }
type Tags = Record<string,string>;
interface Member {type:string;ref:number;role:string;geometry?:Point[]}
export interface Element {
  type:string; id:number; tags?:Tags; geometry?:Point[]; members?:Member[];
}
export interface Area extends Point {span:number; aspect:'square'|'landscape'|'portrait'}
export const FLORENCE:Area={lat:43.773,lon:11.2568,span:900,aspect:'square'};
export const ATTRIBUTION='© contributori di OpenStreetMap (ODbL) · https://www.openstreetmap.org/copyright';
export const LAT_METRES=111132;
export const lonMetres=(lat:number)=>111320*Math.cos(lat*Math.PI/180);
export function extent(a:Area):[number,number] {
  return [a.span*(a.aspect==='portrait'?2/3:1),a.span*(a.aspect==='landscape'?2/3:1)];
}
export function bbox(a:Area):[number,number,number,number] {
  const [w,h]=extent(a),dy=h/2/LAT_METRES,dx=w/2/lonMetres(a.lat);
  return [a.lat-dy,a.lon-dx,a.lat+dy,a.lon+dx];
}
export function parseData(value:unknown):Element[] {
  const d=value as {remark?:string;elements?:Element[]}|null;
  if(d?.remark||!Array.isArray(d?.elements))throw new Error('Il servizio non ha restituito una mappa completa. Riprova con un’area più piccola.');
  if(d.elements.length>9000)throw new Error('L’area contiene troppi elementi. Riduci il lato della selezione.');
  return d.elements.filter(e=>e&&typeof e.id==='number'&&(e.type==='way'||e.type==='relation'));
}
export function areaQuery(a:Area):string {
  const [s,w,n,e]=bbox(a);
  if(w < -180 || e >180) throw new Error('Sposta la selezione affinché rimanga entro il meridiano ±180°.');
  const b=[s,w,n,e].map(v=>v.toFixed(7)).join(',');
  const filters=['nwr[building]','nwr["building:part"]','way[highway]','way[railway~"^(rail|light_rail|tram|narrow_gauge)$"]','nwr[natural=water]','nwr[waterway=riverbank]',
    'way[waterway~"^(river|stream|canal)$"]','nwr[leisure=park]','nwr[landuse~"^(grass|forest|recreation_ground)$"]','nwr[natural=wood]'];
  return '[out:json][timeout:25][maxsize:67108864];('+filters.map(f=>f+'('+b+');').join('')+');out geom;';
}
type RawElement=Element & Partial<Point> & {nodes?:number[]};
export function expandOsmMap(value:unknown):Element[] {
  const raw=(value as {elements?:RawElement[]}|null)?.elements;
  if(!Array.isArray(raw))throw new Error('Dati OpenStreetMap incompleti.');
  const nodes=new Map(raw.filter(e=>e.type==='node'&&point(e)).map(e=>[e.id,{lat:e.lat!,lon:e.lon!}]));
  const ways=new Map(raw.filter(e=>e.type==='way').map(e=>[e.id,e.nodes?.map(id=>nodes.get(id))]));
  const geometry=(id:number)=>{const points=ways.get(id);return points?.every(point)?points:undefined;};
  const elements=raw.filter(e=>{
    if(e.type!=='way'&&e.type!=='relation')return false;
    const t=e.tags;
    return t&&(t.building||t['building:part']||t.highway||t.railway||t.waterway||
      t.natural==='water'||t.natural==='wood'||t.leisure==='park'||/^(grass|forest|recreation_ground)$/.test(t.landuse??''));
  }).map(({id,type,tags,members})=>({
    id,type,tags,geometry:type==='way'?geometry(id):undefined,
    members:members?.map(member=>({...member,geometry:member.type==='way'?geometry(member.ref):undefined})),
  }));
  return parseData({elements});
}
export async function fetchArea(a:Area,signal:AbortSignal,onFallback?:()=>void):Promise<Element[]> {
  const query=areaQuery(a);
  try{
    const reply=await fetch('https://overpass.private.coffee/api/interpreter?'+new URLSearchParams({data:query}),
      {signal:AbortSignal.any([signal,AbortSignal.timeout(8000)])});
    if(!reply.ok)throw new Error();
    return parseData(await reply.json());
  }catch{
    signal.throwIfAborted();
    onFallback?.();
    if(a.span<=1200){
      const [s,w,n,e]=bbox(a);
      const reply=await fetch('https://api.openstreetmap.org/api/0.6/map.json?'+new URLSearchParams({bbox:[w,s,e,n].join(',')}),{signal});
      if(reply.ok)return expandOsmMap(await reply.json());
    }else{
      const reply=await fetch('https://overpass-api.de/api/interpreter?'+new URLSearchParams({data:query}),{signal});
      if(reply.ok)return parseData(await reply.json());
    }
    throw new Error('Dati cartografici indisponibili per questa selezione. Riprova o riduci l’area.');
  }
}
const point=(p:Partial<Point>|undefined):p is Point=>!!p&&Number.isFinite(p.lat)&&Number.isFinite(p.lon);
const same=(a:Point,b:Point)=>a.lat===b.lat&&a.lon===b.lon;
function closed(points:Point[]|undefined):points is Point[] {
  return !!points&&points.length>=4&&points.every(point)&&same(points[0],points.at(-1)!);
}
function stitch(members:Member[]):Point[][] {
  const paths=members.filter(m=>m.geometry?.length&&m.geometry.every(point)).map(m=>m.geometry!.slice());
  const rings:Point[][]=[];
  while(paths.length) {
    const ring=paths.pop()!;
    while(!same(ring[0],ring.at(-1)!)) {
      const end=ring.at(-1)!;
      const next=paths.findIndex(p=>same(p[0],end)||same(p.at(-1)!,end));
      if(next<0)break;
      const path=paths.splice(next,1)[0];
      if(!same(path[0],end))path.reverse();
      ring.push(...path.slice(1));
    }
    if(closed(ring))rings.push(ring);
  }
  return rings;
}
export function polygons(e:Element):{outer:Point[][];inner:Point[][]} {
  if(e.type==='way')return {outer:closed(e.geometry)?[e.geometry]:[],inner:[]};
  const members=(e.members??[]).filter(m=>m.type==='way');
  return {outer:stitch(members.filter(m=>m.role==='outer'||!m.role)),inner:stitch(members.filter(m=>m.role==='inner'))};
}
export function metres(value:string|undefined):number {
  const raw=(value??'').trim().replace(',','.');
  const match=raw.match(/^(\d+(?:\.\d+)?)\s*(m|ft|feet|')?$/i);
  return match?Math.min(900,Number(match[1])*(match[2]&&!/^m$/i.test(match[2])?.3048:1)):0;
}
export function buildingHeight(tags:Tags,fallback:number):{metres:number;kind:'height'|'levels'|'estimate'} {
  const height=metres(tags.height??tags['building:height']);
  if(height>0)return {metres:height,kind:'height'};
  const levels=Number(tags['building:levels']);
  if(Number.isFinite(levels)&&levels>0)return {metres:Math.min(900,levels*3),kind:'levels'};
  return {metres:fallback,kind:'estimate'};
}
