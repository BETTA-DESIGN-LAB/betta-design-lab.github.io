import assert from 'node:assert/strict';
import {loadManifold,Scope,bounds} from '@bdl/geometry';
import {buildBox} from '../apps/box/src/geometry.ts';
import {DEFAULTS} from '../apps/box/src/params.ts';
const M=await loadManifold();let runs=0;
for(const wall of [2,2.4,4])for(const radius of [0,6])for(const stackLid of [false,true]){
 const s=new Scope();try{
 const p={...DEFAULTS,model:'stackable' as const,gridfinity:false,wall,radius,stackLid,ribbed:false};
 const result=buildBox(M,p);const body=result.parts.find(p=>p.id==='body')!;assert.equal(bounds([body]).min[2],0);
 const raw=new M.Mesh({numProp:3,vertProperties:body.mesh.positions,triVerts:body.mesh.indices});raw.merge();const m=s.t(new M.Manifold(raw));assert.equal(m.status(),'NoError');const pieces=m.decompose();pieces.forEach(x=>s.t(x));assert.equal(pieces.length,1);
 const slice=s.t(m.slice(0.5));const center=s.t(M.CrossSection.square([10,10],true));assert.ok(s.t(center.subtract(slice)).area()<0.001,'Il centro del piede deve essere pieno');
 const upper=s.t(m.translate([0,0,p.height+0.25]));assert.ok(s.t(m.intersect(upper)).volume()<0.001,'Scatole impilate senza interferenze');runs++;
 }finally{s.free();}
}
console.log(`Fondo impilabile: ${runs} casi, centro pieno, solidi chiusi e incastro verificati.`);
