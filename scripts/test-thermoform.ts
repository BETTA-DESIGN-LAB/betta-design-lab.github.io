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
  assert.equal(r.parts.length,8);assert.equal(new Set(r.parts.map(p=>p.id)).size,8);
  for(const part of r.parts){const solid=fromPart(s,part);assert.equal(solid.status(),'NoError',shape+part.id);assert.ok(solid.volume()>0);assert.ok(Math.abs(bounds([part]).min[2])<.001,'Pezzo appoggiato');assert.equal(solid.decompose().map(p=>s.t(p)).length,1,'Un solo corpo per '+shape+part.id);}
  for(const part of r.parts.slice(0,2))assert.ok(Math.abs(bounds([part]).max[2]-p.sheet)<.001,'Sagome realmente piatte');
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
  const connector=fromPart(s,r.parts[4]),cap=fromPart(s,r.parts[5]);
  assert.ok(s.t(connector.intersect(cap)).volume()<.01,'Filetti maschio/femmina compatibili');
  for(const angle of [90,180,270]){const moving=s.t(s.t(cap.rotate([0,0,angle])).translate([0,0,2*angle/360]));const interference=s.t(connector.intersect(moving)).volume();assert.ok(interference<.01,`Avvitamento a ${angle}: ${interference}`);}
  assert.ok(toSTL(r.parts).length>84);const zip=unzipSync(to3MF(r.parts));assert.ok(!Object.keys(zip).some(k=>k.includes('project_settings')));assert.match(strFromU8(zip['3D/3dmodel.model']),/colorgroup/);
 }finally{s.free();}cases++;
}
const svg:SvgArtwork={name:'Sagoma esterna',shapes:[[[[-.5,-.5],[.5,-.5],[.5,.5],[0,.5],[-.5,.1]],[[-.1,-.1],[.1,-.1],[.1,.1],[-.1,.1]]]]};
for(const shape of ['svg','stl'] as const){const p={...DEFAULTS,shape},r=build(M,p,svg),s=new Scope();try{assert.equal(r.parts.length,8);assert.match(r.warnings[0],/asimmetrico/);const female=fromPart(s,r.parts[2]),male=fromPart(s,r.parts[3]);const closed=s.t(s.t(male.rotate([0,180,0])).translate([0,0,6+p.dome+p.sheet+p.clearance]));assert.ok(s.t(female.intersect(closed)).volume()<.01,'Stampi speculari accoppiati');assert.ok(bounds([r.parts[2]]).max[0]-bounds([r.parts[2]]).min[0]>p.width*2);}finally{s.free();}}
assert.throws(()=>build(M,{...DEFAULTS,shape:'svg'}),/Carica/);
assert.equal(sanitize({...DEFAULTS,width:NaN}).width,DEFAULTS.width);
const cube=M.Manifold.cube([20,30,10]);try{const m=cube.getMesh();const fixture:Part={id:'test',name:'STL',color:'#ffffff',mesh:{positions:new Float32Array(m.vertProperties),indices:new Uint32Array(m.triVerts)}};const bytes=toSTL([fixture]);const profile=stlProfile(M,parseSTL(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength) as ArrayBuffer));assert.equal(build(M,{...DEFAULTS,shape:'stl'},profile).parts.length,8);}finally{cube.delete();}
assert.throws(()=>validateArtwork({shapes:[[[[NaN,0],[1,0],[1,1]]]]}),/Coordinate/);
assert.equal(validateArtwork(JSON.parse(JSON.stringify(svg)))?.shapes.length,1);
// Regressione dalla prova fisica: sagoma libera a freddo, linguette trattenute.
for(const sheet of [.6,.8,1.6])for(const clearance of [.2,.3,.6]){
 const p=sanitize({...DEFAULTS,shape:'round',width:63,height:71,sheet,clearance}),r=build(M,p),s=new Scope();
 try{
  const front=fromPart(s,r.parts[0]),back=fromPart(s,r.parts[1]),female=fromPart(s,r.parts[2]),connector=fromPart(s,r.parts[4]),cap=fromPart(s,r.parts[5]),pin=fromPart(s,r.parts[6]);
  for(const dz of [0,1,3])for(const [x,y]of [[0,0],[.4,.4],[-.4,-.4]]){
   const cold=s.t(front.translate([x,y,3+p.dome+dz]));
   assert.ok(s.t(female.intersect(cold)).volume()<.001,'La sagoma deve entrare a freddo con margine laterale');
  }
  const clip=fromPart(s,r.formed.find(part=>part.id==='formed-bottom-clip')!);
  const flatBack=s.t(back.scale([-1,1,-1]));
  for(const [halfIndex,half]of [front,flatBack].entries()){
   assert.ok(s.t(half.intersect(clip)).volume()<.001,'Clip inferiore inserita senza collisione nelle linguette');
   const dz=(halfIndex===0?1:-1)*1.5;assert.ok(s.t(s.t(half.translate([0,0,dz])).intersect(clip)).volume()>.01,'La clip impedisce di aprire il fondo');
  }
  for(const dy of [-2,2])assert.ok(s.t(s.t(clip.translate([0,dy,0])).intersect(front)).volume()>.01,'Denti e arresto trattengono la clip');
  const seated=s.t(pin.translate([0,0,3-1.2/2]));
  assert.ok(s.t(connector.intersect(seated)).volume()<.001,'Il perno deve passare nel raccordo');
  assert.ok(s.t(cap.intersect(seated)).volume()<.001,'Il tappo deve avvitarsi con il perno inserito');
  const neckY=bounds([r.parts[0]]).max[1]-8;
  const tabs=[s.t(s.t(front.rotate([90,0,0])).translate([0,0,-neckY-2])),s.t(s.t(s.t(back.scale([1,1,-1])).rotate([90,0,0])).translate([0,0,-neckY-2]))];
  for(const tab of tabs){
   assert.ok(s.t(tab.intersect(seated)).volume()<.001,'Il perno deve attraversare il foro della linguetta');
   for(const z of [-1.5,1.5])assert.ok(s.t(s.t(tab.translate([0,0,z])).intersect(seated)).volume()>.05,'La linguetta non deve sfilarsi dal perno');
  }
  for(const y of [-2,2])assert.ok(s.t(s.t(seated.translate([0,y,0])).intersect(cap)).volume()>.05,'Il tappo deve impedire la fuoriuscita laterale del perno');
 }finally{s.free();}
}
console.log(`Thermoform: ${cases} kit, sagome piatte, solidi uniti, stampi senza collisioni, filetti ed export verificati; SVG/STL inclusi.`);
