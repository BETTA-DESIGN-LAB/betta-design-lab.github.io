import type {ManifoldToplevel,Scope} from '@bdl/geometry';
import {formPoints} from './forms.ts';
import type {TextShape} from './caption.ts';
import type {Point} from './data.ts';

export function pins(text:string):Array<Point&{ball:boolean}>{
 return text.split('\n').slice(0,12).flatMap(line=>{
   const [a,b,kind]=line.trim().split(/[,;\s]+/);
   const lat=Number(a),lon=Number(b);
   return a&&b&&Number.isFinite(lat)&&Number.isFinite(lon)&&Math.abs(lat)<=90&&Math.abs(lon)<=180?
     [{lat,lon,ball:kind==='ball'}]:[];
 });
}

export function readGpx(source:string):Point[][]{
 const doc=new DOMParser().parseFromString(source,'application/xml');
 if(doc.documentElement.localName!=='gpx'||doc.querySelector('parsererror'))throw new Error('File GPX non valido.');
 const segments=Array.from(doc.querySelectorAll('trkseg,rte')).map(segment=>
   Array.from(segment.children).flatMap(node=>{
     if(node.localName!=='trkpt'&&node.localName!=='rtept')return [];
     const a=node.getAttribute('lat'),b=node.getAttribute('lon'),lat=Number(a),lon=Number(b);
     return a!==null&&b!==null&&Number.isFinite(lat)&&Number.isFinite(lon)&&Math.abs(lat)<=90&&Math.abs(lon)<=180?[{lat,lon}]:[];
   })).filter(points=>points.length>=2);
 const count=segments.reduce((total,segment)=>total+segment.length,0);
 if(!count)throw new Error('Il GPX non contiene un percorso.');
 if(count>12000)throw new Error('Il GPX contiene oltre 12.000 punti. Esporta una traccia più corta.');
 return segments;
}

// Bambu Lab Maker's Supply, Round Magnet dimensions in mm.
export const MAGNETS=[
  ['CA015',2,2],['CA014',3,1],['CA001',4,2],['CA002',5,1],['CA003',5,2],['CA006',5,3],
  ['CA004',6,2],['CA007',6,3],['CA013',6,4],['CA005',8,2],['CA008',8,3],['CA016',10,2],
  ['CA009',10,3],['CA017',12,2],['CA010',12,3],['CA018',15,2],['CA011',15,3],
  ['CA019',20,2],['CA012',20,3],['CA020',25,2],['CA021',25,3],
] as const;
export const DEFAULT_MAGNET='CA005';
export function magnetPocket(code:string){
  const [sku,diameter,thickness]=MAGNETS.find(([sku])=>sku===code)??MAGNETS.find(([sku])=>sku===DEFAULT_MAGNET)!;
  return {sku,diameter:diameter+.2,depth:thickness+.1};
}

export function rearMount(M:ManifoldToplevel,s:Scope,mode:string,size:number,magnetCode=DEFAULT_MAGNET as string){
 const t=<T extends {delete():void}>(v:T)=>s.t(v),C=M.CrossSection;
 const magnet=mode==='magnet'?magnetPocket(magnetCode):undefined;
 const w=Math.max(32,Math.min(85,size*.58)),d=mode==='led'?36:Math.max(20,(magnet?.diameter??0)+4);
 const thickness=Math.max(4,(magnet?.depth??0)+1.5);
 const outline=t(t(C.square([w-4,d-4],true)).offset(2,'Round',2,24));
 let plate=t(outline.extrude(thickness));
 const bore=(x:number,y:number,r:number,height:number,z:number)=>
   t(t(t(C.circle(r,48)).extrude(height)).translate([x,y,z]));
 if(magnet){
   const radius=magnet.diameter/2;
   const offset=Math.min(w*.28,w/2-radius-2);
   const centers=2*offset>=magnet.diameter+2?[-offset,offset]:[0];
   for(const x of centers)plate=t(plate.subtract(bore(x,0,radius,magnet.depth+.05,thickness-magnet.depth)));
 }else if(mode==='wall'){
   for(const x of [-w*.29,w*.29]){
     const entry=bore(x,-3,4.4,4.2,-.1);
     const stem=t(t(M.Manifold.cube([3.8,9,4.2],true)).translate([x,0,2]));
     const head=t(t(M.Manifold.cube([8.8,8,1.9],true)).translate([x,1,1.05]));
     plate=t(plate.subtract(t(M.Manifold.union([entry,stem,head]))));
   }
 }else if(mode==='led'){
   const groove=t(t(M.Manifold.cube([w+1,10.5,2.2],true)).translate([0,0,3.4]));
   plate=t(plate.subtract(groove));
 }
 return plate;
}

export const MARKER_PEG_RADIUS=1.15;
export const MARKER_PEG_LENGTH=1.55;
export const MARKER_SOCKET_RADIUS=1.4;
export const MARKER_SOCKET_DEPTH=1.8;

export function markerMesh(M:ManifoldToplevel,s:Scope,shape:string,initial?:TextShape){
  const t=<T extends {delete():void}>(object:T)=>s.t(object),C=M.CrossSection;
  let face=t(C.ofPolygons([formPoints(shape==='heart'?'heart':'star',9,9)],'EvenOdd'));
  if(shape==='initial'&&initial?.length){
    const outline=t(C.union(initial.map(glyph=>t(C.ofPolygons(glyph,'EvenOdd')))));
    if(!outline.isEmpty()){
      const b=outline.bounds();
      const scale=8/Math.max(b.max[0]-b.min[0],b.max[1]-b.min[1]);
      const centered=t(t(outline.translate([-(b.max[0]+b.min[0])/2,-(b.max[1]+b.min[1])/2])).scale(scale));
      // Anchor the peg on a filled stroke, including initials with a central hole.
      const candidates=Array.from({length:81},(_,i)=>[(i%9-4)*.8,(Math.floor(i/9)-4)*.8] as [number,number])
        .sort((a,b)=>Math.hypot(...a)-Math.hypot(...b));
      const probe=t(C.circle(.23,12));
      const anchor=candidates.find(point=>t(centered.intersect(t(probe.translate(point)))).area()>.025);
      if(anchor)face=t(centered.translate([-anchor[0],-anchor[1]]));
    }
  }
  const head=t(t(face.extrude(1.6)).translate([0,0,-.03]));
  const peg=t(t(M.Manifold.cylinder(MARKER_PEG_LENGTH+.1,MARKER_PEG_RADIUS,MARKER_PEG_RADIUS,48))
    .translate([0,0,-MARKER_PEG_LENGTH]));
  return t(head.add(peg));
}
