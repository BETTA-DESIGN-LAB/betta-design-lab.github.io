import assert from 'node:assert/strict';
import {loadManifold,type Part} from '@bdl/geometry';
import {DEFAULTS,INITIAL,fitOrganizer,moduleWarnings,compartments,addCompartment} from '../apps/desk-organizer/src/params.ts';
import {build} from '../apps/desk-organizer/src/geometry.ts';
import {arrange} from '../apps/box/src/placement.ts';
const M=await loadManifold();
for(const style of ['onda','cannete'] as const)for(const plate of [[180,180],[256,256],[340,320],[250,220]] as [number,number][]){
 const start=fitOrganizer({...DEFAULTS,style},plate);
 assert.ok(start.width<=plate[0]-14);assert.ok(start.depth<=plate[1]-14);
 assert.equal(moduleWarnings(start).length,0);
 for(const p of [start,fitOrganizer({...start,width:140,depth:100},plate,start)]){
  const result=build(M,p,{plate});assert.equal(result.blocked,false,JSON.stringify(result.warnings));assert.equal(result.tiles,1);
  assert.equal(compartments(p.moduleData).length,4);
  assert.equal(arrange(result.parts,...plate,{}).oversized.length,0);
  const bases=result.assembled.filter(p=>p.id.startsWith('base-'));
  const solid=(p:Part)=>{const mesh=new M.Mesh({numProp:3,vertProperties:p.mesh.positions,triVerts:p.mesh.indices});mesh.merge();return new M.Manifold(mesh);};
  for(const item of result.assembled.filter(p=>p.id.startsWith('module-'))){const m=solid(item);for(const base of bases){const b=solid(base),hit=m.intersect(b);assert.ok(hit.volume()<.001);hit.delete();b.delete();}m.delete();}
 }
 const bigger=fitOrganizer({...start,width:500,depth:350},plate,start);assert.ok(bigger.width<=plate[0]-14);assert.equal(moduleWarnings(bigger).length,0);
 const switched=fitOrganizer(start,[180,180],start);assert.ok(switched.width<=166);assert.equal(moduleWarnings(switched).length,0);
}
for(let n=1;n<=8;n++){
 const moduleData=JSON.stringify(Array.from({length:n},(_,i)=>({...INITIAL[i%4],id:'module-'+(i+1)})));
 const p=fitOrganizer({...DEFAULTS,width:140,depth:100,moduleData},[180,180]);
 assert.equal(compartments(p.moduleData).length,n);assert.equal(moduleWarnings(p).length,0);assert.ok(p.width<=166&&p.depth<=166);
 assert.equal(build(M,p,{plate:[180,180]}).blocked,false);
}
const free=fitOrganizer({...DEFAULTS,fitToPlate:false},[256,256]);assert.equal(free.width,270);
const p=fitOrganizer(DEFAULTS,[256,256]);assert.deepEqual(fitOrganizer(p,[256,256]),p,'Una configurazione valida non deve spostarsi da sola');
console.log('Desk: adattamento Bambu mini/256, piatti rettangolari, cambio stampante, riduzione base e 1–8 moduli senza collisioni verificati.');

let composition=fitOrganizer(DEFAULTS,[256,256]);
for(let n=5;n<=8;n++){
 const before=compartments(composition.moduleData),next=addCompartment(composition,[256,256]);assert.ok(next);
 const updated=fitOrganizer({...composition,moduleData:JSON.stringify(next)},[256,256],composition);
 assert.deepEqual(compartments(updated.moduleData).slice(0,-1),before,'Aggiungere non deve ridurre o spostare i contenitori');
 assert.equal(updated.width,Math.max(140,...next.map(m=>m.x+m.w+10)));
 assert.equal(updated.depth,Math.max(100,...next.map(m=>m.y+m.d+10)));
 assert.equal(moduleWarnings(updated).length,0);
 assert.equal(build(M,updated).blocked,false);
 composition=updated;
}
const manual=fitOrganizer({...composition,autoTray:false,width:140},[256,256],composition);
assert.equal(manual.width,140);
assert.deepEqual(compartments(manual.moduleData),compartments(composition.moduleData),'Le misure manuali del vassoio non devono alterare gli scomparti');
assert.ok(moduleWarnings(manual).length>0,'Vassoio manuale troppo piccolo: segnalare senza cambiare i contenitori');
console.log('Aggiunta 5–8 scomparti: ingombri e colori preservati, vassoio aderente agli ingombri, misure manuali indipendenti.');
