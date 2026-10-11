import {loadManifold,Scope,bounds,type Part} from '@bdl/geometry';
import {build,fitSample} from '../apps/lamp/src/geometry.ts';
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
