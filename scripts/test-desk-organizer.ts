import assert from 'node:assert/strict';
import {loadManifold,bounds,type Part} from '@bdl/geometry';
import {to3MF,toSTL} from '@bdl/export';
import {unzipSync} from 'fflate';
import {build} from '../apps/desk-organizer/src/geometry.ts';
import {DEFAULTS,sanitize,compartments,addCompartment} from '../apps/desk-organizer/src/params.ts';
import {arrange} from '../apps/box/src/placement.ts';
const M=await loadManifold();
function solid(part:Part){const mesh=new M.Mesh({numProp:3,vertProperties:part.mesh.positions,triVerts:part.mesh.indices});mesh.merge();return new M.Manifold(mesh);}
let count=0;
for(const style of ['onda','cannete'] as const)for(const base of [true,false])for(const plate of [[200,200],[256,256],[340,320]] as [number,number][]){
 const p=sanitize({...DEFAULTS,style,base}),r=build(M,p,{plate});assert.equal(r.blocked,false,JSON.stringify(r.warnings));
 assert.equal(r.parts.filter(p=>p.id.startsWith('module-')).length,4);assert.equal(r.parts.some(p=>p.id.startsWith('pin-')),false);
 if(!base)assert.equal(r.parts.length,4);
 for(const part of r.parts){const s=solid(part);try{assert.equal(s.status(),'NoError');assert.ok(s.volume()>0);const bits=s.decompose();assert.equal(bits.length,1);bits.forEach(b=>b.delete());assert.ok(Math.abs(bounds([part]).min[2])<1e-4);assert.ok(toSTL([part]).length>84);}finally{s.delete();}}
 const packed=arrange(r.parts,...plate,{});assert.equal(packed.oversized.length,0);assert.equal(packed.warnings.length,0);
 assert.ok(unzipSync(to3MF(packed.plates[0]))['3D/3dmodel.model']);
 // Guide e binari non devono occupare lo stesso volume nell'assemblato.
 const bases=r.assembled.filter(p=>p.id.startsWith('base-')).map(solid);
 for(const part of r.assembled.filter(p=>p.id.startsWith('module-'))){const s=solid(part);for(const b of bases){const hit=s.intersect(b);assert.ok(hit.volume()<.001,'Collisione guida/binario '+hit.volume());hit.delete();}
  s.delete();}bases.forEach(b=>b.delete());count++;
}
const flat=build(M,sanitize({...DEFAULTS,base:false}));for(const part of flat.parts){const s=solid(part),probe=M.Manifold.cylinder(.5,1,-1,16),hit=s.intersect(probe);assert.ok(hit.volume()>.1);hit.delete();probe.delete();s.delete();}
const invalid=build(M,sanitize({...DEFAULTS,width:140,depth:100}));assert.equal(invalid.blocked,true);
for(const style of ['onda','cannete'] as const)for(const shape of ['square','rounded'] as const){
 const moduleData=JSON.stringify([{id:'module-1',name:'Prova',shape,w:60,d:50,h:32,x:50,y:40}]);
 const p=sanitize({...DEFAULTS,style,moduleData}),r=build(M,p);
 assert.equal(r.blocked,false);assert.equal(compartments(p.moduleData)[0].shape,shape);
 const part=r.parts.find(p=>p.id==='module-1')!,s=solid(part),probe=M.Manifold.cube([20,20,1],true).translate([0,0,.5]),hit=s.intersect(probe);
 assert.ok(Math.abs(hit.volume()-400)<.01,'Il fondo deve essere piano e pieno');
 hit.delete();probe.delete();s.delete();
 assert.equal(compartments(p.moduleData)[0].y,40,'La posizione libera deve restare invariata');
}
const smallPlate=build(M,sanitize({...DEFAULTS,style:'cannete',moduleData:JSON.stringify([{id:'module-1',name:'Grande',w:190,d:80,h:40,x:10,y:10}])}),{plate:[180,180]});assert.ok(arrange(smallPlate.parts,180,180,{}).oversized.length>0,'Limite delle nervature sul piatto piccolo non rilevato');

assert.equal(addCompartment(DEFAULTS)?.length,5);assert.ok(addCompartment({...DEFAULTS,width:350,depth:220}));
assert.equal(compartments('bad').length,4);assert.ok(Number.isFinite(sanitize({...DEFAULTS,width:NaN}).width));
console.log('Desk organizer: '+count+' kit, solidi chiusi, fondi autonomi, base liscia e moduli squadrati, base sezionata e piatti verificati.');
