import assert from 'node:assert/strict';
import {loadManifold,Scope} from '@bdl/geometry';
import {traceLetterContours} from '../apps/keychain/src/letter-contours.ts';
import {artworkSection} from '../apps/shared/artwork-geometry.ts';
import {build} from '../apps/keychain/src/geometry.ts';
import {DEFAULTS} from '../apps/keychain/src/params.ts';
import {to3MF,toSTL} from '@bdl/export';
import {unzipSync} from 'fflate';
const M=await loadManifold();
for(const n of [128,512]){
 const data=new Uint8ClampedArray(n*n*4).fill(255);let pixels=0;
 for(let y=0;y<n;y++)for(let x=0;x<n;x++){const rr=Math.hypot(x+.5-n/2,y+.5-n/2);if(rr<n*.42&&rr>n*.21){const i=(y*n+x)*4;data[i]=data[i+1]=data[i+2]=0;pixels++;}}
 const art=traceLetterContours({width:n,height:n,data},'O'),s=new Scope();
 try{
  assert.equal(art.shapes[0].length,2,'Contorno esterno e foro devono restare distinti');
  const cs=artworkSection(M,s,art),center=s.t(M.CrossSection.circle(.1,32));assert.ok(s.t(cs.intersect(center)).area()<1e-8);
  const width=Math.round(n*.84);assert.ok(Math.abs(cs.area()-pixels/width**2)<.02);
  assert.ok(art.shapes[0].flat().length<1000,'Contorni efficienti senza migliaia di rettangoli');
  const result=build(M,{...DEFAULTS,model:'initial',shape:'svg',text:'',initial:'O',width:50,depth:50,loop:false},{initial:art});
  for(const p of result.parts){const mesh=new M.Mesh({numProp:3,vertProperties:p.mesh.positions,triVerts:p.mesh.indices});mesh.merge();const solid=s.t(new M.Manifold(mesh));assert.equal(solid.status(),'NoError');assert.ok(solid.volume()>0);}
  assert.ok(toSTL(result.parts).length>84);assert.ok(unzipSync(to3MF(result.parts))['3D/3dmodel.model']);
 }finally{s.free();}
}
console.log('Portachiavi: contorni ad alta definizione, foro della O conservato, solidi ed export verificati.');
