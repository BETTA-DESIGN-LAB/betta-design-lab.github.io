import {bounds,toMeshData,type CrossSection,type ManifoldToplevel,type Part,type Scope} from '@bdl/geometry';
import type {Params} from './params.ts';

/** Keep the print layout flat; the assembled preview uses the same meshes upright. */
export function initialSupports(M:ManifoldToplevel,s:Scope,p:Params,input:Part[],outline:CrossSection){
 const t=<T extends {delete():void}>(v:T)=>s.t(v),C=M.CrossSection;
 let parts=input;
 const shift=(part:Part,dz:number):Part=>{const positions=part.mesh.positions.slice();for(let i=2;i<positions.length;i+=3)positions[i]+=dz;return {...part,mesh:{...part.mesh,positions}};};
 if(p.letterBacking){
  const expanded=t(outline.offset(p.backingMargin,'Round',2,64));
  outline=t(C.union(expanded.toPolygons().map(r=>t(C.ofPolygons([r],'EvenOdd')))));
  parts=parts.map(part=>shift(part,p.backingThickness));
  parts.push({id:'letter-backing',name:'Sagoma di fondo',color:p.backingColor,mesh:toMeshData(t(outline.extrude(p.backingThickness)))});
 }
 if(!p.letterStand)return {parts,printParts:parts};
 const bb=bounds(parts),w=p.standWidth||bb.max[0]-bb.min[0]+12,depth=p.standDepth,h=p.standHeight;
 const seated=h-Math.min(8,h-2),z=seated-bb.min[1],thickness=p.thickness+(p.letterBacking?p.backingThickness:0),center=(bb.min[0]+bb.max[0])/2;
 const footprint=t(t(t(C.square([w-8,depth-8],true)).offset(4,'Round',2,64)).translate([center,0]));
 const blank=t(footprint.extrude(h));
 const socket=t(t(t(t(outline.offset(.25,'Round',2,64)).extrude(thickness+.5)).translate([0,0,-.25])).rotate([90,0,0]));
 const cutter=t(socket.translate([0,thickness/2,z]));
 const stand=t(blank.subtract(cutter));
 if(stand.status()!=='NoError'||stand.isEmpty())throw new Error('Base di appoggio non valida: aumenta la profondità.');
 const standPart:Part={id:'letter-stand',name:'Piedistallo con sede',color:p.backingColor,mesh:toMeshData(stand)};
 const printParts=[...parts,standPart];
 const upright=parts.map(part=>{const positions=part.mesh.positions.slice();for(let i=0;i<positions.length;i+=3){const y=positions[i+1],oldZ=positions[i+2];positions[i+1]=-oldZ+thickness/2;positions[i+2]=y+z;}return {...part,mesh:{...part.mesh,positions}};});
 return {parts:[...upright,standPart],printParts};
}
