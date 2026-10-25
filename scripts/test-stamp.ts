import assert from 'node:assert/strict';
import {loadManifold,Scope,bounds,type Part} from '@bdl/geometry';
import {build} from '../apps/stamp/src/geometry.ts';
import {DEFAULTS,sanitize,handleKind} from '../apps/stamp/src/params.ts';
import {attachment} from '../apps/stamp/src/thread.ts';
import {toSTL,to3MF} from '@bdl/export';
import {unzipSync,strFromU8} from 'fflate';
import type {SvgArtwork} from '../apps/coaster/src/svg.ts';
const M=await loadManifold();
const fixture:SvgArtwork={name:'L asimmetrica',shapes:[[[[-.45,-.35],[.45,-.35],[.45,-.15],[-.15,-.15],[-.15,.35],[-.45,.35]]]]};
const ring:SvgArtwork={name:'Foro',shapes:[[[[-.5,-.5],[.5,-.5],[.5,.5],[-.5,.5]],[[-.2,-.2],[-.2,.2],[.2,.2],[.2,-.2]]]]};
const solid=(s:Scope,p:Part)=>{const mesh=new M.Mesh({numProp:3,vertProperties:p.mesh.positions,triVerts:p.mesh.indices});mesh.merge();return s.t(new M.Manifold(mesh));};
let count=0;
for(const shape of ['rect','round','oval','contour'] as const)for(const handle of ['round','ergonomic','bridge','palm'] as const){
 const p=sanitize({...DEFAULTS,shape,handle,frame:true}),r=build(M,p,{text:fixture,extra:ring}),s=new Scope();
 try{
  assert.equal(r.parts.length,2);assert.equal(new Set(r.parts.map(p=>p.id)).size,2);
  for(const part of r.parts){const m=solid(s,part);assert.equal(m.status(),'NoError',shape+' '+handle+part.id);assert.ok(m.volume()>0);assert.equal(m.decompose().map(m=>s.t(m)).length,1);assert.ok(Math.abs(bounds([part]).min[2])<.001,'Parte sul piatto: '+handle+part.id);}
  const plate=solid(s,r.assembled[0]),grip=solid(s,r.assembled[1]);assert.ok(s.t(plate.intersect(grip)).volume()<.01,'Manico montato senza interferenze');
  const zip=unzipSync(to3MF(r.parts));assert.ok(!Object.keys(zip).some(k=>k.includes('project_settings')));assert.match(strFromU8(zip['3D/3dmodel.model']),/colorgroup/);assert.ok(toSTL(r.parts).length>84);
 }finally{s.free();}count++;
}
{
 const s=new Scope();try{
  const male=attachment(M,s),female=s.t(attachment(M,s,.3).add(s.t(M.Manifold.cylinder(1.6,7.4,6.3,72)))),blank=s.t(M.Manifold.cylinder(11,12,12,72)),plate=s.t(blank.subtract(female));
  for(const angle of [0,90,180,270]){const moved=s.t(s.t(male.rotate([0,0,-angle])).translate([0,0,-angle/180]));assert.ok(s.t(moved.intersect(plate)).volume()<.01,'Avvitamento: '+angle+' gradi, interferenza '+s.t(moved.intersect(plate)).volume());}
 }finally{s.free();}
}
{
 const p=sanitize({...DEFAULTS,text:'',x:12,textSize:40}),r=build(M,p,{text:fixture}),s=new Scope();
 try{
  const plate=solid(s,r.parts[0]),relief=s.t(plate.slice(11+.5)),ink=solid(s,r.imprint[1]),original=s.t(ink.slice(.7));
  assert.ok(s.t(relief.subtract(s.t(original.scale([-1,1])))).area()<.001,'Rilievo specchiato rispetto all’impronta');
  assert.ok(s.t(original.subtract(relief)).area()>1,'Fixture realmente asimmetrica');
 }finally{s.free();}
}
for(const width of [28,140])for(const handle of ['round','ergonomic','bridge','palm'] as const){const r=build(M,{...DEFAULTS,width,height:28,handle},{extra:ring});assert.equal(r.parts.length,2);}
assert.equal(build(M,{...DEFAULTS,text:''}).warnings.some(w=>w.includes('vuota')),true);
assert.equal(handleKind({...DEFAULTS,handle:'auto',width:100}),'bridge');
assert.equal(sanitize({...DEFAULTS,width:NaN}).width,DEFAULTS.width);
assert.throws(()=>build(M,DEFAULTS,{extra:{name:'Bad',shapes:[[[[NaN,0],[1,0],[1,1]]]]}}),/Coordinate/);
console.log('Timbri: '+count+' combinazioni, quattro manici, attacco comune, montaggio, specchiatura, limiti ed export verificati.');

// Piastra da 3 mm ai bordi, sede centrale invariata e rilievo sulla faccia opposta.
for(const base of [2.4,3,8]){
 const p=sanitize({...DEFAULTS,base}),r=build(M,p,{text:fixture}),s=new Scope();
 try{
  const plate=solid(s,r.parts[0]);
  const outside=s.t(s.t(M.Manifold.cube([3,3,20],true)).translate([p.width/2-5,0,10]));
  const strip=s.t(plate.intersect(outside)),b=strip.boundingBox();
  assert.ok(Math.abs(b.max[2]-11)<.001);
  assert.ok(Math.abs(b.min[2]-(11-base))<.001,'Spessore ai bordi esattamente quello scelto');
  const male=solid(s,r.assembled[1]),assembled=solid(s,r.assembled[0]);
  assert.ok(s.t(male.intersect(assembled)).volume()<.01,'Attacco comune conservato con piastra sottile');
 }finally{s.free();}
}
assert.equal(DEFAULTS.base,3);
