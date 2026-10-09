import { Scope, toMeshData, type MeshData, type Part, type ManifoldToplevel } from '@bdl/geometry';
import type { Params } from './params.ts';

/** STL in millimetri; nessuna riparazione silenziosa dei solidi aperti. */
export function parseSTL(buffer: ArrayBuffer): MeshData {
  if(buffer.byteLength>20_000_000)throw new Error('STL troppo grande: massimo 20 MB.');
  const v=new DataView(buffer);const count=buffer.byteLength>=84?v.getUint32(80,true):0;
  let a:number[]=[];
  if(count>0&&84+count*50===buffer.byteLength){if(count>150000)throw new Error('STL troppo complesso: massimo 150.000 triangoli.');for(let t=0;t<count;t++)for(let j=0;j<9;j++)a.push(v.getFloat32(84+t*50+12+j*4,true));}
  else {const text=new TextDecoder().decode(buffer);const vertices=[...text.matchAll(/vertex\s+([-+\d.eE]+)\s+([-+\d.eE]+)\s+([-+\d.eE]+)/g)];if(!/^\s*solid\b/i.test(text)||vertices.length<12||vertices.length%3||vertices.length>450000)throw new Error('STL ASCII non valido.');a=vertices.flatMap(m=>[Number(m[1]),Number(m[2]),Number(m[3])]);}
  if(a.some(n=>!Number.isFinite(n)||Math.abs(n)>100000))throw new Error('Coordinate STL non valide.');
  const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];for(let i=0;i<a.length;i++) {min[i%3]=Math.min(min[i%3],a[i]);max[i%3]=Math.max(max[i%3],a[i]);}
  const shift=[(min[0]+max[0])/2,(min[1]+max[1])/2,min[2]];
  return {positions:new Float32Array(a.map((n,i)=>n-shift[i%3])),indices:Uint32Array.from({length:a.length/3},(_,i)=>i)};
}
export function stlHeight(mesh:MeshData){let h=0;for(let i=2;i<mesh.positions.length;i+=3)h=Math.max(h,mesh.positions[i]);return h;}
export function buildSTLClicker(M:ManifoldToplevel,p:Params,mesh:MeshData):{parts:Part[],warnings:string[]} {
 const s=new Scope();try{
 const input=new M.Mesh({numProp:3,vertProperties:mesh.positions,triVerts:mesh.indices});input.merge();let body=s.t(new M.Manifold(input));
 if(body.status()!=='NoError'||body.isEmpty()||body.volume()<=0)throw new Error('Lo STL deve essere un solido chiuso, con normali orientate correttamente. Riparalo prima di importarlo.');
 body=s.t(body.scale(p.stlScale));const cut=p.cutHeight,plate=cut-3+p.mxCalibration,floor=plate-9.3;
 if(floor<1)throw new Error('Taglio troppo basso: occorrono almeno 13,3 mm sotto il taglio per lo switch MX.');
 if(body.boundingBox().max[2]-cut<6.4)throw new Error('Taglio troppo alto: occorrono almeno 6,4 mm sopra per lo scavo e il supporto della croce.');
 const cube=(x:number,y:number,h:number,z:number)=>s.t(s.t(M.Manifold.cube([x,y,h],true)).translate([p.switchX,p.switchY,z+h/2]));
 const low=s.t(body.trimByPlane([0,0,-1],-cut)),high=s.t(body.trimByPlane([0,0,1],cut));
 // Richiede materiale attorno alla sede e al soffitto, non soltanto un ingombro ampio.
 const support=cube(18.4,18.4,cut-floor,floor);if(s.t(support.subtract(low)).volume()>.01)throw new Error('Materiale insufficiente sotto il taglio: sposta lo switch o il piano di taglio.');
 const roof=cube(6.4,6.4,1.2,cut+5.2);if(s.t(roof.subtract(high)).volume()>.01)throw new Error('Materiale insufficiente sopra lo switch: sposta lo switch o il taglio.');
 let base=s.t(low.subtract(cube(16+p.socketFit,16+p.socketFit,plate-floor,floor)));base=s.t(base.subtract(cube(14+p.socketFit,14+p.socketFit,cut-plate+.1,plate)));
 let cap=s.t(high.subtract(cube(18+p.gap*2,18+p.gap*2,5.2,cut)));
 const collar=s.t(s.t(M.Manifold.cylinder(9.4,2.8,2.8,48)).translate([p.switchX,p.switchY,cut-4]));cap=s.t(cap.add(collar));
 const cross=s.t(cube(4.1+p.stemFit,1.17+p.stemFit,3.7,cut-4).add(cube(1.17+p.stemFit,4.1+p.stemFit,3.7,cut-4)));cap=s.t(cap.subtract(cross));
 // Libera nella base l'intera corsa del pulsante, incluse sagome concave e sporgenze.
 const swept=s.t(M.Manifold.union(Array.from({length:17},(_,i)=>s.t(cap.translate([0,0,p.mxTravel*i/16])))));base=s.t(base.subtract(swept));
 const parts:Part[]=[];for(const [id,name,color,m] of [['base','Corpo inferiore',p.baseColor,base],['cap','Corpo superiore / pulsante',p.capColor,cap]] as const){const pieces=m.decompose();pieces.forEach(x=>s.t(x));if(m.status()!=='NoError'||m.isEmpty()||pieces.length!==1)throw new Error('Il taglio genera pezzi scollegati o pareti insufficienti: cambia posizione.');parts.push({id,name,color,mesh:toMeshData(id==='cap'?s.t(m.translate([0,0,p.mxTravel])):m)});}
 return {parts,warnings:['Profilo MX nominale: verifica con una stampa di prova. A premuto la superficie esterna torna alla quota originale; una sottile giunzione resta visibile.']};
 }finally{s.free();}
}
