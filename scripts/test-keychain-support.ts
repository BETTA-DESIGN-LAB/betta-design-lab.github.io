import assert from 'node:assert/strict';
import {loadManifold,Scope,bounds,type Part} from '@bdl/geometry';
import {build} from '../apps/keychain/src/geometry.ts';
import {DEFAULTS,sanitize,MAX_LETTER_SIZE} from '../apps/keychain/src/params.ts';
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

// Il piedistallo deve poter cambiare piatto senza spostare i volumi della lettera.
{
 const r=build(M,{...DEFAULTS,model:'initial',shape:'svg',initial:'G',loop:false,text:'',width:180,depth:120,letterStand:true},{initial:g});
 const parts=r.printParts;
 const groups=[{name:'Lettera con scritta',partIds:parts.filter(p=>p.id!=='letter-stand').map(p=>p.id)},{name:'Piedistallo con sede',partIds:['letter-stand']}];
 const files=unzipSync(to3MF(parts,{objectGroups:groups,printProfile:false}));
 const model=new TextDecoder().decode(files['3D/3dmodel.model']);
 const settings=new TextDecoder().decode(files['Metadata/model_settings.config']);
 const buildXml=model.split('<build>')[1].split('</build>')[0];
 assert.equal((buildXml.match(/<item /g)||[]).length,2,'Lettera e piedistallo sono oggetti indipendenti');
 const ids=[...model.matchAll(/<(?:object|m:colorgroup) id="(\d+)"/g)].map(m=>m[1]);
 assert.equal(new Set(ids).size,ids.length,'ID risorse senza collisioni');
 assert.equal((model.match(/<component objectid=/g)||[]).length,parts.length,'Ogni volume compare una sola volta');
 assert.equal((settings.match(/<model_instance>/g)||[]).length,2);
 assert.ok(!files['Metadata/project_settings.config'],'Nessun preset stampante sovrascritto');
 const fallback=new TextDecoder().decode(unzipSync(to3MF(parts))['3D/3dmodel.model']);
 assert.equal((fallback.split('<build>')[1].match(/<item /g)||[]).length,1,'Gli altri generatori conservano il comportamento precedente');
}
console.log('3MF: piedistallo indipendente, raggruppamento volumi e preset verificati.');

// Misure del solo piedistallo: nessuna scala applicata alla lettera o al nome.
{
 const opts={...DEFAULTS,model:'initial' as const,shape:'svg' as const,initial:'G',loop:false,text:'',width:180,depth:120,thickness:8,letterStand:true};
 const original=build(M,opts,{initial:g});
 for(const [standWidth,standDepth,standHeight] of [[120,30,6],[80,18,8],[200,55,12]]){
  const result=build(M,{...opts,standWidth,standDepth,standHeight},{initial:g});
  const stand=result.printParts.find(p=>p.id==='letter-stand')!,b=bounds([stand]);
  assert.ok(Math.abs(b.max[0]-b.min[0]-standWidth)<.001);
  assert.ok(Math.abs(b.max[1]-b.min[1]-standDepth)<.001);
  assert.ok(Math.abs(b.max[2]-b.min[2]-standHeight)<.001);
  for(const part of result.printParts.filter(p=>p.id!=='letter-stand')){
   assert.deepEqual(part.mesh.positions,original.printParts.find(p=>p.id===part.id)!.mesh.positions,'Lettera non ridimensionata');
  }
  const scope=new Scope();
  try{
   const base=solid(scope,stand);assert.equal(base.status(),'NoError');
   assert.equal(base.decompose().map(m=>scope.t(m)).length,1);
   for(const p of result.parts.filter(p=>p.id!=='letter-stand'))assert.ok(scope.t(base.intersect(solid(scope,p))).volume()<.001,'Sede compatibile');
  }finally{scope.free();}
 }
}
console.log('Piedistallo: larghezza, profondità e altezza indipendenti; lettera invariata e sede senza collisioni.');

{
 const settings=sanitize({...DEFAULTS,model:'initial',initial:'G',shape:'svg',loop:false,text:'',width:350,depth:350});
 assert.equal(settings.width,350);assert.equal(settings.depth,350);
 assert.equal(sanitize({...settings,width:900,depth:900}).width,MAX_LETTER_SIZE);
 const r=build(M,settings,{initial:g}),b=bounds(r.printParts);
 assert.ok(Math.abs(b.max[0]-b.min[0]-350)<.001);
 assert.ok(Math.abs(b.max[1]-b.min[1]-350)<.001);
 const small=arrange(r.printParts,256,256,{});assert.ok(small.oversized.length>0,'Avviso sul piatto più piccolo');
 const fitting=build(M,{...settings,width:340,depth:340},{initial:g});
 const large=arrange(fitting.printParts,350,350,{});assert.equal(large.oversized.length,0,'Margine di stampa conservato');
}
console.log('Lettere fino a 350 × 350 mm: misure reali e limiti del piatto verificati.');
