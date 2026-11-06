import assert from 'node:assert/strict';
import {loadManifold,Scope,bounds,type Part} from '@bdl/geometry';
import {build} from '../apps/keychain/src/geometry.ts';
import {DEFAULTS} from '../apps/keychain/src/params.ts';
import {arrange} from '../apps/box/src/placement.ts';
import {to3MF} from '@bdl/export';
import {unzipSync} from 'fflate';
import type {SvgArtwork} from '../apps/coaster/src/svg.ts';
const M=await loadManifold();
const g:SvgArtwork={name:'G',shapes:[[[[-.5,-.5],[.5,-.5],[.5,0],[0,0],[0,-.15],[.25,-.15],[.25,-.3],[-.25,-.3],[-.25,.3],[.5,.3],[.5,.5],[-.5,.5]]]]};
const solid=(s:Scope,p:Part)=>{const mesh=new M.Mesh({numProp:3,vertProperties:p.mesh.positions,triVerts:p.mesh.indices});mesh.merge();return s.t(new M.Manifold(mesh));};
for(const [width,depth]of [[180,120],[65,110],[140,45]]){
 const r=build(M,{...DEFAULTS,model:'initial',initial:'G',shape:'svg',loop:false,text:'',width,depth},{initial:g}),b=bounds(r.parts);
 assert.ok(Math.abs(b.max[0]-b.min[0]-width)<.001);assert.ok(Math.abs(b.max[1]-b.min[1]-depth)<.001);
}
for(const ratio of [2,5,8]){
 const name:SvgArtwork={name:"Nome",shapes:[[[[-ratio/2,-.5],[ratio/2,-.5],[ratio/2,.5],[-ratio/2,.5]]]]};
 const r=build(M,{...DEFAULTS,model:'initial',shape:'svg',loop:false,text:'Greta',initial:'G',width:180,depth:120},{initial:g,main:name});
 const b=bounds(r.parts.filter(p=>p.id.startsWith('Decorazione')));
 assert.ok(Math.abs(b.max[1]-b.min[1]-36)<.001,'Altezza nome costante con proporzioni di font diverse');
}
for(const letterBacking of [false,true])for(const letterStand of [false,true])for(const mode of ['relief','inlay','engrave'] as const){
 const s=new Scope(),r=build(M,{...DEFAULTS,model:'initial',shape:'svg',initial:'G',loop:false,text:'',width:180,depth:120,letterBacking,letterStand,mode},{initial:g});
 try{
  for(const p of r.parts){const m=solid(s,p);assert.equal(m.status(),'NoError');assert.ok(m.volume()>0);}
  assert.equal(r.parts.some(p=>p.id==='letter-backing'),letterBacking);
  assert.equal(r.parts.some(p=>p.id==='letter-stand'),letterStand);
  if(letterStand){
   const stand=solid(s,r.parts.find(p=>p.id==='letter-stand')!);
   assert.equal(stand.decompose().map(m=>s.t(m)).length,1);
   for(const part of r.parts.filter(p=>p.id!=='letter-stand'))assert.ok(s.t(stand.intersect(solid(s,part))).volume()<.001,'Sede senza collisione con lettera o fondo');
   assert.ok(bounds(r.parts).max[2]>120,'Anteprima montata in verticale');
  }
  const packed=arrange(r.printParts,256,256,{});
  assert.equal(packed.oversized.length,0);
  for(const plate of packed.plates)for(const p of plate)assert.ok(Math.abs(bounds([p]).min[2])<.001,'Ogni pezzo appoggia sul piatto');
  const z=unzipSync(to3MF(packed.plates[0]));assert.ok(z['3D/3dmodel.model']);assert.ok(!z['Metadata/project_settings.config']);
 }finally{s.free();}
}
console.log('Lettere: misure XY esatte, altezza nome indipendente dal font, fondo e piedistallo combinabili, sedi senza collisioni e piatti/export verificati.');
