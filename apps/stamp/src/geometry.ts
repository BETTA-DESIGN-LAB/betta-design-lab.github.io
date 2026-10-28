import {Scope,toMeshData,type Part,type ManifoldToplevel,type CrossSection,type Manifold,type Vec2} from '@bdl/geometry';
import type {SvgArtwork} from '../../coaster/src/svg.ts';
import {validateArtwork} from './validation.ts';
import {sanitize,handleKind,type Params} from './params.ts';
import {attachment} from './thread.ts';
export interface Design{text?:SvgArtwork;extra?:SvgArtwork;}
export interface Result{parts:Part[];imprint:Part[];assembled:Part[];warnings:string[];}
export function build(M:ManifoldToplevel,input:Params,design:Design={}):Result{
 const p=sanitize(input),s=new Scope(),t=<T extends {delete():void}>(v:T)=>s.t(v),C=M.CrossSection,warnings:string[]=[];
 try{
 const circle=(r:number)=>t(C.circle(r,96));
 const rect=(w:number,h:number,r=0)=>r>.01?t(t(C.square([Math.max(.1,w-2*r),Math.max(.1,h-2*r)],true)).offset(r,'Round',2,48)):t(C.square([w,h],true));
 const artwork=(a:SvgArtwork|undefined,size:number,x:number,y:number,angle:number,maxHeight?:number)=>{
  a=validateArtwork(a);if(!a)return undefined;
  const raw=t(C.union(a.shapes.map(r=>t(C.ofPolygons(r,'EvenOdd')))));
  if(raw.isEmpty())return undefined;
  const b=raw.bounds(),w=b.max[0]-b.min[0],h=b.max[1]-b.min[1],k=maxHeight===undefined?size/Math.max(w,h):Math.min(size/w,maxHeight/h);
  return t(t(t(t(raw.translate([-(b.max[0]+b.min[0])/2,-(b.max[1]+b.min[1])/2])).scale(k)).rotate(angle)).translate([x,y]));
 };
 const fit=p.shape==='round'||p.shape==='oval'?.70:1;
 const text=artwork(design.text,(p.width-6)*fit*p.textSize/100,p.x,p.y,p.angle,((p.shape==='round'?p.width:p.height)-6)*fit*p.textSize/100),rawExtra=artwork(design.extra,p.extraSize,p.extraX,p.extraY,p.extraAngle);
 const extra=rawExtra&&p.extraThicken>0?t(rawExtra.offset(p.extraThicken/2,'Round',2,32)):rawExtra;
 const contents=[text,extra].filter((v):v is CrossSection=>!!v);
 let outline:CrossSection;
 if(p.shape==='contour'&&contents.length){
  const filled=contents.flatMap(v=>v.toPolygons().map(r=>t(C.ofPolygons([r],'EvenOdd'))));
  outline=t(t(C.union(filled)).offset(4,'Round',2,48));
  // Un'unica piastra e spazio strutturale per l'attacco, anche con lettere separate.
  outline=t(outline.add(circle(12)));
  if(outline.decompose().map(t).length>1){outline=t(C.hull([outline]));warnings.push('Gli elementi distanti sono collegati da una base continua.');}
 }else{outline=p.shape==='round'?circle(p.width/2):p.shape==='oval'?t(circle(1).scale([p.width/2,p.height/2])):rect(p.width,p.height,p.radius);}
 const safe=t(outline.offset(-2.5,'Round',2,40));
 const edits:Part[]=[],features:CrossSection[]=[];
 const decorate=(raw:CrossSection|undefined,id:string)=>{
  if(!raw)return;const clip=t(raw.intersect(safe));
  if(t(raw.subtract(clip)).area()>.01)warnings.push('Una parte di '+(id==='text'?'testo':'SVG/icona')+' esce dalla base: spostala o ridimensionala.');
  if(clip.isEmpty())return;
  features.push(clip);edits.push({id,name:id==='text'?'Testo':'SVG / icona',color:'#111111',mesh:toMeshData(t(t(clip.extrude(.7)).translate([0,0,.5])))});
 };
 decorate(text,'text');decorate(extra,'extra');
 if(p.frame){
  const outer=t(outline.offset(-1,'Round',2,40)),inner=t(outer.offset(-p.frameWidth,'Round',2,40)),frame=t(outer.subtract(inner));features.push(frame);
  edits.push({id:'frame',name:'Cornice',color:'#111111',mesh:toMeshData(t(t(frame.extrude(.7)).translate([0,0,.5])))});
 }
 if(!features.length)warnings.push('Piastra vuota: aggiungi testo, SVG, icona o cornice per creare un’impronta.');
 const detail=t(C.union(features));
 // La filettatura rimane identica: spessore solo locale, sotto il manico.
 const top=11,mirrored=t(outline.scale([-1,1]));
 const thinPlate=t(t(mirrored.extrude(p.base)).translate([0,0,top-p.base]));
 const boss=t(t(M.Manifold.cylinder(top,10,10,96)).intersect(t(mirrored.extrude(top))));
 const plateSolid=t(thinPlate.add(boss));
 const lead=t(M.Manifold.cylinder(1.6,7.1+p.clearance,6+p.clearance,72));
 const socket=t(attachment(M,s,p.clearance).add(lead));
 let plate=t(plateSolid.subtract(socket));
 if(!detail.isEmpty())plate=t(plate.add(t(t(t(detail.scale([-1,1])).extrude(p.relief+.05)).translate([0,0,top-.05]))));
 const kind=handleKind(p);let body:Manifold,h=kind==='palm'?12:kind==='bridge'?26:30;
 if(kind==='bridge'){
  const width=Math.max(46,Math.min(90,p.width*.72));
  const face=rect(width,26,6),cut=rect(width-18,15,5);
  const arch=t(t(face.subtract(cut)).extrude(12));
  body=t(t(arch.rotate([90,0,0])).translate([0,6,13]));
  // La traversa superiore è il piano di arresto del filetto.
  warnings.push('Manico a ponte: controlla i supporti sotto la traversa nello slicer.');
 }else{
  const radii=kind==='round'?[10,12,11,7,6.5]:kind==='palm'?[18,19,17,10,7]:[10,13,12,8,6.5];
  const profile:Vec2[]=[[0,0],...radii.map((r,i):Vec2=>[r,i*h/4]),[0,h]];
  body=t(t(C.ofPolygons([profile])).revolve(96));
 }
 const shaft=t(attachment(M,s).translate([0,0,h-.05])),handle=t(body.add(shaft));
 const put=(id:string,name:string,solid:Manifold):Part=>{
  if(solid.status()!=='NoError'||solid.isEmpty()||solid.volume()<=0)throw new Error('Geometria non valida: '+name);
  if(solid.decompose().map(t).length!==1)throw new Error('Parti scollegate: '+name);
  return {id,name,color:p.color,mesh:toMeshData(solid)};
 };
 const parts=[put('plate','Piastra timbro specchiata',plate),put('handle','Manico '+({round:'tondo',ergonomic:'ergonomico',bridge:'a ponte',palm:'da palmo'}[kind]),handle)];
 const basePreview={id:'paper',name:'Anteprima impronta',color:'#ffffff',mesh:toMeshData(t(outline.extrude(.5)))};
 const flip=(solid:Manifold)=>t(t(solid.rotate([0,180,0])).translate([0,0,top+p.relief]));
 const assembled=[put('plate','Timbro',flip(plate)),put('handle','Manico montato',flip(t(handle.translate([0,0,-h]))))];
 return {parts,imprint:[basePreview,...edits],assembled,warnings};
 }finally{s.free();}
}
