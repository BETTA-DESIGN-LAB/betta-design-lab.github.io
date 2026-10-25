import {loadManifold,Scope,bounds,type Part} from '@bdl/geometry';
import {build,fitSample,LED} from '../apps/lamp/src/geometry.ts';
import {DEFAULTS,sanitize} from '../apps/lamp/src/params.ts';
import {parseSTL} from '../apps/keycap/src/stl.ts';
import {toSTL,to3MF} from '@bdl/export';
import {groundPart} from '../apps/coaster/src/parts.ts';
const M=await loadManifold();let count=0;
function check(parts:Part[]){const s=new Scope();try{for(const p of parts){const mesh=new M.Mesh({numProp:3,vertProperties:p.mesh.positions,triVerts:p.mesh.indices});mesh.merge();const m=s.t(new M.Manifold(mesh));if(m.status()!=='NoError'||m.volume()<=0)throw Error('Lampada non valida: '+p.name);const d=m.decompose();d.forEach(x=>s.t(x));if(d.length!==1)throw Error('Lampada scollegata '+p.name);if(Math.abs(bounds([groundPart(p)]).min[2])>.001)throw Error('Pezzo non sul piatto');}if(!to3MF(parts.map(groundPart),{title:'Test lampada'}).length)throw Error('Export vuoto');}finally{s.free();}}
for(const shape of ['cylinder','bulb','waist'] as const)for(const texture of ['smooth','wave','spiral'] as const)for(const wall of [.6,.8,2]){check(build(M,{...DEFAULTS,shape,texture,wall,height:wall===2?50:150,diameter:wall===.6?80:110,amplitude:6,twist:180}).parts);count++;}
const s=new Scope();try{
 for(const [name,solid] of [['cube',s.t(M.Manifold.cube([100,100,150],true))],['sphere',s.t(M.Manifold.sphere(60,16))]] as const){const raw=solid.getMesh(),positions=new Float32Array(raw.numVert*3);for(let i=0;i<raw.numVert;i++)for(let j=0;j<3;j++)positions[i*3+j]=raw.vertProperties[i*raw.numProp+j];const part={id:name,name,color:'#ffffff',mesh:{positions,indices:new Uint32Array(raw.triVerts)}};const stl=toSTL([part]);const mesh=parseSTL(stl.buffer.slice(stl.byteOffset,stl.byteOffset+stl.byteLength) as ArrayBuffer);for(const orientation of ['z','x','flip'] as const){check(build(M,{...DEFAULTS,source:'stl',height:150,cut:35,orientation},mesh).parts);count++;}}
 const cube=s.t(M.Manifold.cube([20,20,100],true)).getMesh();const small={positions:new Float32Array(cube.vertProperties),indices:new Uint32Array(cube.triVerts)};let rejected=false;try{build(M,{...DEFAULTS,source:'stl',height:100},small);}catch{rejected=true;}if(!rejected)throw Error('STL senza spazio LED accettato');count++;
 check([fitSample(M,DEFAULTS.baseColor)]);
 const valid=sanitize({...DEFAULTS,height:NaN,wall:Infinity,source:'bad' as never});if(valid.height!==DEFAULTS.height||valid.wall!==DEFAULTS.wall||valid.source!==DEFAULTS.source)throw Error('Parametri non sanitizzati');
}finally{s.free();}
console.log(`Lampade: ${count} combinazioni, STL e campione incastro verificati.`);

// Verifica il montaggio del kit GIA' CABLATO: il filo scende dall'alto,
// mentre la USB e il comando rimangono fuori dalla base.
{
 const scope=new Scope(),t=<T extends {delete():void}>(v:T)=>scope.t(v);
 try{
  const parts=build(M,DEFAULTS).parts;
  const from=(part:Part)=>{const mesh=new M.Mesh({numProp:3,vertProperties:part.mesh.positions,triVerts:part.mesh.indices});mesh.merge();return t(new M.Manifold(mesh));};
  const base=from(parts[0]),shade=from(parts[1]);
  const wire=t(t(t(M.Manifold.cylinder(50,3,3,48)).rotate([90,0,0])).translate([0,-15,LED.floor+3]));
  const usb=t(t(M.Manifold.cube([18,30,10],true)).translate([0,-80,LED.floor+3]));
  const control=t(t(M.Manifold.cube([22,45,15],true)).translate([0,-125,LED.floor+3]));
  const module=t(t(M.Manifold.cylinder(LED.height,LED.diameter/2,LED.diameter/2,96)).translate([0,0,LED.floor]));
  for(let lift=0;lift<=24;lift+=1){
   for(const [name,part]of [['filo',wire],['USB esterna',usb],['comando esterno',control],['LED',module]] as const){
    const moving=t(part.translate([0,0,lift]));
    if(t(moving.intersect(base)).volume()>.001)throw Error('Montaggio dall’alto bloccato: '+name+' a quota '+lift);
   }
  }
  if(t(wire.intersect(shade)).volume()>.001)throw Error('Il paralume schiaccia il cavo');
  const floorProbe=t(t(M.Manifold.cube([6,5,2],true)).translate([0,-34,1.5]));
  if(t(floorProbe.subtract(base)).volume()>.001)throw Error('Fondo indebolito sotto il passaggio cavo');
  if(LED.cableSlotWidth<8)throw Error('Scanalatura cavo troppo stretta');
 }finally{scope.free();}
}
console.log('Lampade: percorso di inserimento dall’alto del cavo completo, USB esterna e fondo verificati.');
