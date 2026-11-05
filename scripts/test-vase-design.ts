import assert from 'node:assert/strict';
import {loadManifold,Scope,bounds,type Part} from '@bdl/geometry';
import {toSTL,to3MF} from '@bdl/export';
import {unzipSync,strFromU8} from 'fflate';
import {buildVase} from '../apps/vase/src/geometry.ts';
import {DEFAULTS,PRESETS,SILHOUETTES,FINISHES,sanitize,type Silhouette,type Finish} from '../apps/vase/src/params.ts';
const M=await loadManifold();
const solid=(s:Scope,p:Part)=>{const mesh=new M.Mesh({numProp:3,vertProperties:p.mesh.positions,triVerts:p.mesh.indices});mesh.merge();return s.t(new M.Manifold(mesh));};
let cases=0;
for(const silhouette of Object.keys(SILHOUETTES) as Silhouette[])for(const finish of Object.keys(FINISHES) as Finish[]){
 const p=sanitize({...DEFAULTS,silhouette,finish,height:90,bottomDiameter:64,topDiameter:44,bellyDiameter:90,neckDiameter:36,ribCount:16,ribDepth:3,textureRows:8,patternStart:35,patternEnd:88,helix:80});
 const r=buildVase(M,p),s=new Scope();
 try{const body=solid(s,r.parts[0]);assert.equal(body.status(),'NoError',silhouette+'/'+finish);assert.ok(body.volume()>0);assert.equal(body.decompose().map(m=>s.t(m)).length,1);const b=bounds(r.parts);assert.ok(Math.abs(b.min[2])<.001&&Math.abs(b.max[2]-90)<.001);
 const probe=s.t(s.t(M.Manifold.cylinder(85,.5,.5,12)).translate([0,0,4]));assert.ok(s.t(body.intersect(probe)).volume()<.001,'Cavità aperta fino alla bocca');}finally{s.free();}cases++;
}
for(const profile of ['smooth','oval','roundedSquare','faceted','wavy','star'] as const){
 const p=sanitize({...DEFAULTS,silhouette:'hourglass',profile,sides:5,finish:'spiral',twist:-120,helix:180,wall:3,ribCount:20,ribDepth:5,height:90,drainageHole:true}),r=buildVase(M,p),s=new Scope();
 try{const body=solid(s,r.parts[0]);assert.equal(body.status(),'NoError');const probe=s.t(M.Manifold.cylinder(p.bottomThickness+.2,.5,.5,12));assert.ok(s.t(body.intersect(probe)).volume()<.001,'Drenaggio realmente passante');}finally{s.free();}
}
for(const preset of PRESETS){
 const r=buildVase(M,sanitize({...DEFAULTS,...preset.params}));
 const stl=toSTL(r.parts);assert.equal(stl.length,84+r.parts[0].mesh.indices.length/3*50);
 const zip=unzipSync(to3MF(r.parts));assert.ok(!Object.keys(zip).some(n=>n.includes('project_settings')));assert.match(strFromU8(zip['3D/3dmodel.model']),/<triangle /);
}
{
 const p=sanitize({...DEFAULTS,silhouette:'sphere',intensity:0,bottomDiameter:80,topDiameter:80,height:100,finish:'fins',ribCount:16,ribDepth:5,ribShape:'sharp',helix:0,patternStart:50,patternEnd:90,fade:5});
 const s=new Scope();
 try{
 const textured=solid(s,buildVase(M,p).parts[0]),plain=solid(s,buildVase(M,{...p,finish:'none'}).parts[0]);
 for(const z of [10,30,48,95]){const a=s.t(textured.slice(z)),b=s.t(plain.slice(z));assert.ok(s.t(a.subtract(b)).area()+s.t(b.subtract(a)).area()<.02,'Fuori fascia la superficie è davvero liscia');}
 const decorated=s.t(textured.slice(70)),base=s.t(plain.slice(70));assert.ok(s.t(decorated.subtract(base)).area()>20,'Nella fascia sono presenti lame reali');
 }finally{s.free();}
}
// Same dimensions and density must still produce recognisably different surfaces.
{
 const s=new Scope(),common=sanitize({...DEFAULTS,silhouette:'barrel',height:145,bottomDiameter:85,topDiameter:90,ribCount:12,textureRows:8,ribDepth:2.5,helix:100,patternStart:10,patternEnd:90});
 try{
 const honey=solid(s,buildVase(M,{...common,finish:'honeycomb'}).parts[0]);
 const crossed=solid(s,buildVase(M,{...common,finish:'lattice'}).parts[0]);
 for(const z of [45,70,95]){
 const a=s.t(honey.slice(z)),b=s.t(crossed.slice(z));
 assert.ok(s.t(a.subtract(b)).area()+s.t(b.subtract(a)).area()>30,'Nido e Incrocio devono avere geometrie distinte anche con gli stessi parametri');
 }
 }finally{s.free();}
}
const bad=sanitize({...DEFAULTS,patternStart:99,patternEnd:NaN,ribCount:Infinity,finish:'invalid' as Finish});
assert.ok(bad.patternStart<bad.patternEnd);assert.equal(bad.ribCount,DEFAULTS.ribCount);assert.equal(bad.finish,'none');
console.log('Vasi design: '+cases+' combinazioni, sei sezioni, fasce lisce reali, sei preset ed export verificati.');
