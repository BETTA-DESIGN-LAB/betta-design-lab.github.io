import assert from 'node:assert/strict';
import {loadManifold,Scope,bounds,type Part} from '@bdl/geometry';
import {toSTL,to3MF} from '@bdl/export';
import {unzipSync,strFromU8} from 'fflate';
import {build} from '../apps/thermoform/src/geometry.ts';
import {DEFAULTS,sanitize} from '../apps/thermoform/src/params.ts';
import type {SvgArtwork} from '../apps/coaster/src/svg.ts';
import {stlProfile,validateArtwork} from '../apps/thermoform/src/profile.ts';
import {parseSTL} from '../apps/keycap/src/stl.ts';
const M=await loadManifold();
const fromPart=(s:Scope,part:Part)=>{const m=new M.Mesh({numProp:3,vertProperties:part.mesh.positions,triVerts:part.mesh.indices});m.merge();return s.t(new M.Manifold(m));};
let cases=0;
for(const shape of ['ghost','pumpkin','heart','star','round'] as const)for(const pattern of ['solid','grid','diagonal'] as const){
 const p=sanitize({...DEFAULTS,shape,pattern}),r=build(M,p),s=new Scope();try{
  assert.equal(r.parts.length,6);assert.equal(new Set(r.parts.map(p=>p.id)).size,6);
  for(const part of r.parts){const solid=fromPart(s,part);assert.equal(solid.status(),'NoError',shape+part.id);assert.ok(solid.volume()>0);assert.ok(Math.abs(bounds([part]).min[2])<.001,'Pezzo appoggiato');assert.equal(solid.decompose().map(p=>s.t(p)).length,1,'Un solo corpo per '+shape+part.id);}
  for(const part of r.parts.slice(0,2))assert.ok(bounds([part]).max[2]>4.8,'Mezzo filetto presente sopra la rete piatta');
  assert.ok(!r.parts.some(part=>['connector','lock'].includes(part.id)),'Nessun raccordo o perno separato');
  if(shape==='ghost'||shape==='pumpkin'){
   const front=fromPart(s,r.parts[0]),back=fromPart(s,r.parts[1]);
   assert.ok(front.volume()-back.volume()<p.width*p.height*p.sheet*.08,'Solo occhi e bocca, nessun pannello rettangolare');
  }
  if(shape==='heart'){
   const front=fromPart(s,r.parts[0]),back=fromPart(s,r.parts[1]);
   const notch=s.t(s.t(M.Manifold.cube([p.width*.005,p.height*.04,p.sheet+1],true)).translate([0,p.height*.32,p.sheet/2]));
   assert.ok(s.t(front.intersect(notch)).volume()<.001,'Incavo del cuore libero sul fronte');
   assert.ok(s.t(back.intersect(notch)).volume()<.001,'Incavo del cuore libero sul retro');
  }
  const female=fromPart(s,r.parts[2]),male=fromPart(s,r.parts[3]);
  if(shape==='pumpkin'){const peaks=s.t(male.slice(3+p.dome*.8));assert.ok(peaks.decompose().map(p=>s.t(p)).length>=3,'Spicchi della zucca separati da solchi 3D');}
  const closed=s.t(s.t(male.rotate([0,180,0])).translate([0,0,6+p.dome+p.sheet+p.clearance]));
  const collision=s.t(female.intersect(closed)).volume();assert.ok(collision<.01,`Stampi abbinati senza collisioni: ${shape} ${pattern} ${collision}`);
  const front=fromPart(s,r.parts[0]),back=fromPart(s,r.parts[1]),cap=fromPart(s,r.parts.find(part=>part.id==='cap')!);
  const neckX=shape==='heart'?-p.width*.25:0,neckBase=bounds([r.parts[0]]).max[1]-8;
  const assembledBack=s.t(back.scale([-1,1,-1]));
  assert.ok(s.t(front.intersect(assembledBack)).volume()<.001,'Le due metà del filetto non si sovrappongono');
  const normalize=(solid:ReturnType<typeof fromPart>)=>s.t(s.t(solid.rotate([90,0,0])).translate([-neckX,0,-neckBase]));
  const complete=s.t(normalize(front).add(normalize(assembledBack)));
  assert.ok(s.t(complete.intersect(cap)).volume()<.01,'Tappo sulle due mezze filettature allineate');
  for(const angle of [90,180,270]){
   const moving=s.t(s.t(cap.rotate([0,0,angle])).translate([0,0,2*angle/360]));
   assert.ok(s.t(complete.intersect(moving)).volume()<.01,'Avvitamento continuo sulle due metà');
  }
  for(const [half,sign]of [[front,1],[assembledBack,-1]] as const){
   const moving=s.t(half.translate([0,0,sign*1.5]));
   assert.ok(s.t(normalize(moving).intersect(cap)).volume()>.02,'Il tappo trattiene ciascuna metà');
  }
  assert.ok(toSTL(r.parts).length>84);const zip=unzipSync(to3MF(r.parts));assert.ok(!Object.keys(zip).some(k=>k.includes('project_settings')));assert.match(strFromU8(zip['3D/3dmodel.model']),/colorgroup/);
 }finally{s.free();}cases++;
}
const svg:SvgArtwork={name:'Sagoma esterna',shapes:[[[[-.5,-.5],[.5,-.5],[.5,.5],[0,.5],[-.5,.1]],[[-.1,-.1],[.1,-.1],[.1,.1],[-.1,.1]]]]};
for(const shape of ['svg','stl'] as const){const p={...DEFAULTS,shape},r=build(M,p,svg),s=new Scope();try{assert.equal(r.parts.length,6);assert.match(r.warnings[0],/asimmetrico/);const female=fromPart(s,r.parts[2]),male=fromPart(s,r.parts[3]);const closed=s.t(s.t(male.rotate([0,180,0])).translate([0,0,6+p.dome+p.sheet+p.clearance]));assert.ok(s.t(female.intersect(closed)).volume()<.01,'Stampi speculari accoppiati');assert.ok(bounds([r.parts[2]]).max[0]-bounds([r.parts[2]]).min[0]>p.width*2);}finally{s.free();}}
assert.throws(()=>build(M,{...DEFAULTS,shape:'svg'}),/Carica/);
assert.equal(sanitize({...DEFAULTS,width:NaN}).width,DEFAULTS.width);
const cube=M.Manifold.cube([20,30,10]);try{const m=cube.getMesh();const fixture:Part={id:'test',name:'STL',color:'#ffffff',mesh:{positions:new Float32Array(m.vertProperties),indices:new Uint32Array(m.triVerts)}};const bytes=toSTL([fixture]);const profile=stlProfile(M,parseSTL(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength) as ArrayBuffer));assert.equal(build(M,{...DEFAULTS,shape:'stl'},profile).parts.length,6);}finally{cube.delete();}
assert.throws(()=>validateArtwork({shapes:[[[[NaN,0],[1,0],[1,1]]]]}),/Coordinate/);
assert.equal(validateArtwork(JSON.parse(JSON.stringify(svg)))?.shapes.length,1);
// Regressione dalla prova fisica: sagoma libera a freddo, filetto integrato e clip inferiore.
for(const sheet of [.6,.8,1.6])for(const clearance of [.2,.3,.6]){
 const p=sanitize({...DEFAULTS,shape:'round',width:63,height:71,sheet,clearance}),r=build(M,p),s=new Scope();
 try{
  const front=fromPart(s,r.parts[0]),back=fromPart(s,r.parts[1]),female=fromPart(s,r.parts[2]),male=fromPart(s,r.parts[3]);
  for(const dz of [0,1,3])for(const [x,y]of [[0,0],[.4,.4],[-.4,-.4]]){
   const cold=s.t(s.t(front.scale([1,1,-1])).translate([x,y,3+p.dome+p.sheet+dz]));
   assert.ok(s.t(female.intersect(cold)).volume()<.001,'La sagoma deve entrare a freddo con margine laterale');
  }
  const clip=fromPart(s,r.formed.find(part=>part.id==='formed-bottom-clip')!);
  const flatBack=s.t(back.scale([-1,1,-1]));
  for(const [halfIndex,half]of [front,flatBack].entries()){
   assert.ok(s.t(half.intersect(clip)).volume()<.001,'Clip inferiore inserita senza collisione nelle linguette');
   const dz=(halfIndex===0?1:-1)*.8;assert.ok(s.t(s.t(half.translate([0,0,dz])).intersect(clip)).volume()>.01,'La clip impedisce di aprire il fondo');
  }
  for(const dy of [-2,2])assert.ok(s.t(s.t(clip.translate([0,dy,0])).intersect(front)).volume()>.01,'Denti e arresto trattengono la clip');
  const closedMale=s.t(s.t(male.rotate([0,180,0])).translate([0,0,6+p.dome+p.sheet+p.clearance]));
  const seated=s.t(s.t(front.scale([1,1,-1])).translate([0,0,3+p.dome+p.sheet]));
  const neckBase=bounds([r.parts[0]]).max[1]-8;
  const neckBox=s.t(s.t(M.Manifold.cube([14,8.2,14],true)).translate([0,neckBase+4.1,3+p.dome]));
  const neckOnly=s.t(seated.intersect(neckBox));
  assert.ok(s.t(closedMale.intersect(neckOnly)).volume()<.01,'Il convesso non schiaccia il mezzo filetto');
 }finally{s.free();}
}
console.log(`Thermoform: ${cases} kit, reti piatte con mezzi filetti integrati, solidi uniti, stampi senza collisioni, filetti ed export verificati; SVG/STL inclusi.`);
