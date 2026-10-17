import assert from 'node:assert/strict';
import { loadManifold } from '@bdl/geometry';
import { DEFAULTS, sanitize } from '../apps/box/src/params.ts';
import { activeDividers, interiorRooms, interiorSize, readDividers } from '../apps/box/src/interior.ts';
import { FOOT_HEIGHT, GRID_FLOOR } from '../apps/box/src/gridfinity.ts';
import { buildBox } from '../apps/box/src/geometry.ts';
import { to3MF } from '@bdl/export';
import { unzipSync, strFromU8 } from 'fflate';

const M = await loadManifold();
for (const model of ['sliding','stackable','drawer'] as const) for (const gridfinity of [false,true]) {
  let p=sanitize({...DEFAULTS, model, gridfinity, gridOutput:'box', radius:6, interiorMode:'custom', dividerData:'[]'});
  const size=interiorSize(p),at=Math.round(size.width*.38*10)/10;
  p=sanitize({...p,dividerData:JSON.stringify([
    {axis:'vertical',at,start:0,end:size.depth},
    {axis:'horizontal',at:Math.round(size.depth*.45*10)/10,start:at,end:size.width},
  ])});
  const rooms=interiorRooms(p);
  assert.equal(rooms.length,3,`${model}/grid=${gridfinity}: tre vani indipendenti`);
  assert.ok(rooms.every(r=>r.rectangular));
  assert.ok(Math.abs(rooms.find(r=>r.x===0)!.width-(at-p.wall/2))<.01);
  const result=buildBox(M,p),part=result.parts.find(v=>v.id==='body')!;
  const mesh=new M.Mesh({numProp:3,vertProperties:part.mesh.positions,triVerts:part.mesh.indices});mesh.merge();
  const solid=new M.Manifold(mesh);
  assert.equal(solid.status(),'NoError');const components=solid.decompose();assert.equal(components.length,1,'Il fondo tiene uniti tutti i divisori');components.forEach(c=>c.delete());
  // Verifica un punto nel divisorio verticale e un punto nel vano lungo,
  // dove NON deve comparire il divisorio orizzontale della colonna destra.
  const z=p.height/2+(gridfinity?FOOT_HEIGHT+GRID_FLOOR:model!=='sliding'?2.3:0)+(model==='drawer'?p.wall+p.clearance:0);
  const probe=(x:number,y:number)=>{const box=M.Manifold.cube([.4,.4,.4],true).translate([-size.width/2+x,size.centerY+size.depth/2-y,z]);const intersection=solid.intersect(box);const volume=intersection.volume();intersection.delete();box.delete();return volume;};
  assert.ok(probe(at,size.depth*.3)>.05);
  assert.ok(probe(at/2,Math.round(size.depth*.45*10)/10)<1e-6,'Vano sinistro libero da divisori a tutta larghezza');
  const xml=strFromU8(unzipSync(to3MF(result.parts))['3D/3dmodel.model']);assert.ok(xml.includes('<mesh>')&&!xml.includes('NaN'));
  assert.deepEqual(activeDividers(sanitize(JSON.parse(JSON.stringify(p)))),activeDividers(p),'Salvataggio completo');
  const off=buildBox(M,{...p,dividers:false}).parts.find(v=>v.id==='body')!;
  assert.notEqual(off.mesh.indices.length,part.mesh.indices.length);
  solid.delete();
}
assert.deepEqual(readDividers('{broken',DEFAULTS),[]);
assert.deepEqual(readDividers('[{"axis":"vertical","at":null,"start":0,"end":30}]',DEFAULTS),[]);
const small=sanitize({...DEFAULTS,width:40,depth:35,wall:4,model:'drawer',interiorMode:'custom',dividerData:'[{"axis":"horizontal","at":999,"start":-10,"end":999}]'});
const [d]=activeDividers(small),smallSize=interiorSize(small);
assert.ok(d.at<=smallSize.depth-small.wall/2+.01 && d.start===0 && d.end<=smallSize.width+.01);
const partial=sanitize({...DEFAULTS,interiorMode:'custom',dividerData:'[{"axis":"vertical","at":30,"start":10,"end":40}]'});
assert.equal(interiorRooms(partial).length,1,'Un divisorio corto non crea un vano chiuso');
assert.equal(interiorRooms(partial)[0].rectangular,false);
console.log('Scatole: divisori liberi a T, misure nette, cassetti/Gridfinity, salvataggio ed export verificati.');
