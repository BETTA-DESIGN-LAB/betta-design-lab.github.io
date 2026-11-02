import {Scope,toMeshData,type Part,type ManifoldToplevel,type CrossSection,type Manifold,type Vec2} from '@bdl/geometry';
import {sanitize,compartments,moduleWarnings,type Params} from './params.ts';
export interface Result{parts:Part[];assembled:Part[];warnings:string[];blocked:boolean;tiles:number;}
export interface BuildOptions{plate?:[number,number];}
export function build(M:ManifoldToplevel,input:Params,options:BuildOptions={}):Result{
 const p=sanitize(input),modules=compartments(p.moduleData),s=new Scope(),t=<T extends{delete():void}>(v:T)=>s.t(v),C=M.CrossSection;
 const parts:Part[]=[],assembled:Part[]=[],warnings=moduleWarnings({...p,moduleData:JSON.stringify(modules)});let blocked=warnings.length>0;
 const plate=(options.plate??[256,256]).map(n=>Number.isFinite(n)?Math.max(80,Math.min(1000,n)):256);
 const rect=(w:number,d:number,r:number)=>{r=Math.min(r,w/2-.1,d/2-.1);return t(t(C.square([w-2*r,d-2*r],true)).offset(r,'Round',2,48));};
 const put=(id:string,name:string,solid:Manifold,color:string,at:[number,number,number]=[0,0,0],angle=0)=>{
  const pieces=solid.decompose().map(t);if(solid.isEmpty()||solid.status()!=='NoError'||solid.volume()<=0||pieces.length!==1)throw new Error('Solido non valido: '+name+' '+solid.status()+' '+solid.volume()+' ('+pieces.length+' corpi)');
  const part:Part={id,name,color,mesh:toMeshData(solid)};parts.push(part);
  assembled.push({...part,mesh:toMeshData(t(t(solid.rotate([0,0,angle])).translate(at)))});
 };
 try{
 const baseOutline=rect(p.width,p.depth,8),safeBase=t(baseOutline.offset(-3));
 let base=t(baseOutline.extrude(p.thickness+p.rim));
 if(p.rim>0)base=t(base.subtract(t(t(safeBase.extrude(p.rim+.1)).translate([0,0,p.thickness]))));
 // Verifica il profilo arrotondato prima di costruire le guide.
 for(const m of modules){const r=m.shape==='square'?2:p.style==='cannete'?Math.min(m.w,m.d)/2-.1:Math.min(10,m.w*.16,m.d*.16),face=rect(m.w,m.d,r),cx=m.x+m.w/2-p.width/2,cy=p.depth/2-m.y-m.d/2;
  if(p.base&&t(t(face.translate([cx,cy])).subtract(safeBase)).area()>.05){warnings.push(m.name+': fuori dal profilo arrotondato della base.');blocked=true;}}
 modules.forEach(m=>{
  const r=m.shape==='square'?2:p.style==='cannete'?Math.min(m.w,m.d)/2-.1:Math.min(10,m.w*.16,m.d*.16),face=rect(m.w,m.d,r),inner=t(face.offset(-p.wall,'Round',2,48));
  let outline:CrossSection=face;
  if(p.style==='cannete'){
   const circles:CrossSection[]=[];
   for(const ring of face.toPolygons())for(let i=0;i<ring.length;i++){
    const a=ring[i],b=ring[(i+1)%ring.length],steps=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/6));
    for(let j=0;j<steps;j++)circles.push(t(t(C.circle(.65,12)).translate([a[0]+(b[0]-a[0])*j/steps,a[1]+(b[1]-a[1])*j/steps])));
   }outline=t(C.union([face,...circles]));
  }
  let body=t(t(outline.extrude(m.h)).subtract(t(t(inner.extrude(m.h-p.floor+.1)).translate([0,0,p.floor]))));
  const cx=m.x+m.w/2-p.width/2,cy=p.depth/2-m.y-m.d/2;
  put(m.id,m.name,body,m.color??p.color,[cx,cy,p.base?p.thickness:0]);
 });
 let tiles=0;
 if(p.base){
  const cols=Math.ceil(p.width/(plate[0]-14)),rows=Math.ceil(p.depth/(plate[1]-14)),tw=p.width/cols,td=p.depth/rows,sockets:Manifold[]=[];
  const bow:Vec2[]=[[-6,-4],[-2,-2],[2,-2],[6,-4],[6,4],[2,2],[-2,2],[-6,4]];
  const keyFace=t(C.ofPolygons([bow],'NonZero')),keySolid=t(keyFace.extrude(2)),pocketFace=t(keyFace.offset(p.clearance,'Round',2,16)),jointSafe=t(baseOutline.offset(-4));
  const addJoint=(x:number,y:number,angle:number,id:string)=>{
   const profile=t(t(pocketFace.rotate(angle)).translate([x,y]));
   if(t(profile.subtract(jointSafe)).area()>.01)return;
   sockets.push(t(t(profile.extrude(2.02)).translate([0,0,-.01])));
   put('join-'+id,'Chiave base '+id,keySolid,p.baseColor,[x,y,0],angle);
  };
  for(let c=1;c<cols;c++)for(let r=0;r<rows;r++)for(const f of [.28,.72])addJoint(-p.width/2+c*tw,-p.depth/2+(r+f)*td,0,'x'+c+'-'+r+'-'+f);
  for(let r=1;r<rows;r++)for(let c=0;c<cols;c++)for(const f of [.28,.72])addJoint(-p.width/2+(c+f)*tw,-p.depth/2+r*td,90,'y'+r+'-'+c+'-'+f);
  if(sockets.length)base=t(base.subtract(t(M.Manifold.union(sockets))));
  for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){
   const top=p.thickness+p.rim,crop=t(t(M.Manifold.cube([tw+.000001,td+.000001,top+2],true)).translate([-p.width/2+(c+.5)*tw,-p.depth/2+(r+.5)*td,top/2]));
   const tile=t(base.intersect(crop));if(tile.isEmpty())continue;tiles++;
   put('base-'+r+'-'+c,cols*rows===1?'Vassoio base':'Base · sezione '+tiles,tile,p.baseColor);
  }
  if(tiles>1)warnings.push('Base divisa in '+tiles+' sezioni. Unisci le chiavi a farfalla dal lato inferiore prima di appoggiarla.');
 }
 return{parts,assembled,warnings,blocked,tiles};
 }finally{s.free();}
}
