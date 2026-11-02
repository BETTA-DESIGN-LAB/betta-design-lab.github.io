import {loadManifold,Scope} from '@bdl/geometry';
import {attachment,ATTACH,fitSamples} from '../apps/lamp/src/attachment.ts';
import {build} from '../apps/lamp/src/geometry.ts';
import {DEFAULTS} from '../apps/lamp/src/params.ts';
const M=await loadManifold(),s=new Scope();try{
 const a=attachment(M,s),male=a.male(),female=a.female();
 const hit=(angle:number,lift=0)=>s.t(male.intersect(s.t(s.t(female.rotate([0,0,angle])).translate([0,0,lift])))).volume();
 for(let z=0;z<=24;z+=.5)if(hit(0,z)>.001)throw Error('Ingresso baionetta ostruito a '+z);
 for(let angle=0;angle>=ATTACH.rotation;angle--)if(hit(angle)>.001)throw Error('Rotazione ostruita a '+angle);
 if(hit(ATTACH.rotation,1)<.1)throw Error('Manca la ritenuta assiale');
 if(hit(-40)<.1)throw Error('Manca il finecorsa');
 if(hit(60)<.1)throw Error('Inserimento errato non rilevato');
 for(const p of fitSamples(M,'#ffffff')){
  const mesh=new M.Mesh({numProp:3,vertProperties:p.mesh.positions,triVerts:p.mesh.indices});mesh.merge();const solid=s.t(new M.Manifold(mesh));const chunks=solid.decompose();chunks.forEach(v=>s.t(v));
  if(solid.status()!=='NoError'||chunks.length!==1||solid.volume()<=0||Math.abs(solid.boundingBox().min[2])>.001)throw Error('Campione non valido: '+p.name);
 }
 const from=(p:ReturnType<typeof build>['parts'][number])=>{const mesh=new M.Mesh({numProp:3,vertProperties:p.mesh.positions,triVerts:p.mesh.indices});mesh.merge();return s.t(new M.Manifold(mesh));};
 const parts=build(M,DEFAULTS).parts,base=from(parts[0]),shade=from(parts[1]),neck=from(fitSamples(M,'#ffffff')[1]);
 for(let angle=0;angle>=ATTACH.rotation;angle--){
  const positioned=s.t(s.t(neck.rotate([0,0,angle])).translate([0,0,ATTACH.shoulder]));
  if(s.t(positioned.intersect(base)).volume()>.001)throw Error('Bordo integrato bloccato sulla base completa');
 }
 const locked=s.t(s.t(neck.rotate([0,0,ATTACH.rotation])).translate([0,0,ATTACH.shoulder]));
 if(s.t(locked.subtract(shade)).volume()>.01)throw Error('Campione diverso dal bordo integrato del paralume');
 if(s.t(s.t(locked.translate([0,0,1])).intersect(base)).volume()<.1)throw Error('Bordo integrato non trattenuto sulla base completa');
 console.log('Baionetta: inserimento, rotazione 25°, ritenuta, finecorsa e solidi campione verificati.');
}finally{s.free();}
