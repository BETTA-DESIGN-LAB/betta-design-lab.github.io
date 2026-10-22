import {Scope,type ManifoldToplevel,type MeshData} from '@bdl/geometry';
import type {SvgArtwork} from '../../coaster/src/svg.ts';
import type {Placements} from '../../box/src/placement.ts';
export function readPlacements(value:unknown):Placements{
 if(value===undefined)return {};if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Posizioni non valide.');
 const out:Placements={};for(const [id,raw]of Object.entries(value)){const p=raw as Placements[string];if(!['front','back','female','male','connector','cap'].includes(id)||!p||![p.x,p.y,p.angle,p.plate].every(Number.isFinite)||Math.abs(p.x)>1000||Math.abs(p.y)>1000||Math.abs(p.angle)>360||!Number.isInteger(p.plate)||p.plate<0||p.plate>19)throw new Error('Posizione del pezzo non valida.');out[id]={x:p.x,y:p.y,angle:p.angle,plate:p.plate};}return out;
}
export function stlProfile(M:ManifoldToplevel,mesh:MeshData):SvgArtwork{
 const s=new Scope();try{
  if(!mesh||mesh.indices.length/3>60000)throw new Error('STL troppo complesso: massimo 60.000 triangoli.');
  const input=new M.Mesh({numProp:3,vertProperties:mesh.positions,triVerts:mesh.indices});input.merge();const solid=s.t(new M.Manifold(input));
  if(solid.status()!=='NoError'||solid.isEmpty()||solid.volume()<=0)throw new Error('Lo STL deve essere un solido chiuso. Riparalo prima del caricamento.');
  const profile=s.t(solid.project());const b=profile.bounds(),scale=Math.max(b.max[0]-b.min[0],b.max[1]-b.min[1]);if(scale<.001)throw new Error('Profilo STL vuoto.');
  const normalized=s.t(s.t(profile.translate([-(b.min[0]+b.max[0])/2,-(b.min[1]+b.max[1])/2])).scale(1/scale));
  return {name:'Profilo STL',shapes:[normalized.toPolygons()]};
 }finally{s.free();}
}
export function validateArtwork(value:unknown):SvgArtwork|undefined{
 if(value===undefined||value===null)return undefined;
 const a=value as SvgArtwork;let count=0;
 if(!a||!Array.isArray(a.shapes)||!a.shapes.length||a.shapes.length>500)throw new Error('SVG del progetto non valido.');
 for(const shape of a.shapes){if(!Array.isArray(shape))throw new Error('Contorni non validi.');for(const ring of shape){if(!Array.isArray(ring)||ring.length<3)throw new Error('Contorno incompleto.');count+=ring.length;if(count>30000)throw new Error('Progetto troppo complesso.');for(const pt of ring)if(!Array.isArray(pt)||pt.length!==2||pt.some(n=>!Number.isFinite(n)||Math.abs(n)>10))throw new Error('Coordinate non valide.');}}
 return {name:String(a.name??'Sagoma importata').slice(0,100),shapes:a.shapes};
}
