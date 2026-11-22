import assert from 'node:assert/strict';
import {loadManifold,bounds,Scope,type Part} from '@bdl/geometry';
import {to3MF,toSTL} from '@bdl/export';
import {unzipSync,strFromU8} from 'fflate';
import {build} from '../apps/bubble/src/geometry.ts';
import {adhesiveSection} from '../apps/bubble/src/adhesive.ts';
import {DEFAULTS,sanitize,TEXTURES,MOUNTS} from '../apps/bubble/src/params.ts';
import {layout} from '../apps/bubble/src/layout.ts';
import type {Glyph} from '../apps/bubble/src/lettering.ts';

const M=await loadManifold();
const glyph:Glyph={char:'O',heightRatio:1,artwork:{name:'O',shapes:[[[[-.4,-.5],[.4,-.5],[.4,.5],[-.4,.5]],[[-.15,-.25],[-.15,.25],[.15,.25],[.15,-.25]]]]}};
const solid=(part:Part)=>new M.Manifold(new M.Mesh({numProp:3,vertProperties:part.mesh.positions,triVerts:part.mesh.indices}));
const signatures=new Set<string>();
// The counterless characters must fill spurious enclosed raster pockets.
// O retains the same input aperture in the existing texture/inflation checks.
for(const char of ['Z','z','S','C','2','5']){
  const result=build(M,sanitize({...DEFAULTS,height:35,mount:'none',texture:'smooth'}),[{...glyph,char}]);
  const mesh=solid(result.parts[0]);
  const probe=M.Manifold.cylinder(50,1,1,16).translate([0,0,-1]);
  const filled=mesh.intersect(probe);
  assert.ok(filled.volume()>1,char+': falso foro riempito');
  filled.delete();probe.delete();mesh.delete();
}
for(const [texture]of TEXTURES){
  const result=build(M,sanitize({...DEFAULTS,height:35,mount:'none',texture}),[glyph]);
  const mesh=solid(result.parts[0]);
  assert.equal(mesh.status(),'NoError',texture);
  assert.ok(mesh.volume()>0);
  const connected=mesh.decompose();assert.equal(connected.length,1,'Texture unita alla lettera: '+texture);connected.forEach(part=>part.delete());
  const center=M.Manifold.cylinder(100,.5,.5,16).translate([0,0,-1]);
  const intersection=mesh.intersect(center);
  assert.ok(intersection.isEmpty(),'Il foro di O resta passante per '+texture);
  assert.equal(bounds(result.parts).min[2],0);
  signatures.add(mesh.volume().toFixed(3));
  assert.ok(toSTL(result.parts).length>84);
  intersection.delete();center.delete();mesh.delete();
}
assert.equal(signatures.size,TEXTURES.length,'Texture geometricamente differenti');
for(const [mount] of MOUNTS){
  const result=build(M,sanitize({...DEFAULTS,height:65,mount,texture:'smooth',magnetDiameter:5,stripWidth:8,stripHeight:8}),[glyph]);
  assert.ok(!result.warnings.some(warning=>/troppo grande|insufficiente|sedi magnete/.test(warning)),mount+' deve trovare un fissaggio');
  assert.equal(result.parts.length,mount==='stand'?2:1);
  for(const part of result.parts){const mesh=solid(part);assert.equal(mesh.status(),'NoError',mount);assert.ok(mesh.volume()>0);mesh.delete();}
}
const model=build(M,sanitize({...DEFAULTS,height:35,mount:'none',texture:'smooth'}),[glyph,glyph,glyph,glyph]);
const machines=[{name:'Test',width:65,depth:65,speed:100}];
const packed=layout(model.parts,sanitize(DEFAULTS),machines);
assert.ok(packed.plates.length>1);
assert.equal(packed.oversized.length,0);assert.equal(packed.warnings.length,0);
assert.equal(packed.plates.flatMap(plate=>plate.parts).length,4);
const circular=layout(model.parts,sanitize({...DEFAULTS,roundBed:true}),[{...machines[0],width:100,depth:100}]);
assert.equal(circular.warnings.length,0);
const farm=layout(model.parts,sanitize(DEFAULTS),[machines[0],{...machines[0],name:'Seconda'}]);
assert.ok(farm.plates.some(plate=>plate.name.startsWith('Seconda')));
const file=unzipSync(to3MF(packed.plates[0].parts,{printProfile:false,objectGroups:packed.plates[0].parts.map(part=>({name:part.name,partIds:[part.id]}))}));
assert.ok(!file['Metadata/project_settings.config']);
assert.match(strFromU8(file['3D/3dmodel.model']),/colorgroup/);
const invalid=sanitize({...DEFAULTS,height:NaN,inflate:Infinity,colors:'no',mount:'invalid'});
assert.equal(invalid.height,DEFAULTS.height);assert.equal(invalid.mount,'none');
console.log('Bubble Letter: 12 texture distinte, fori passanti, 6 fissaggi, solidi, piatti, multi-stampante, STL e 3MF verificati.');

const gentle=build(M,sanitize({...DEFAULTS,height:45,mount:'none',texture:'smooth',inflate:0}),[glyph]);
const balloon=build(M,sanitize({...DEFAULTS,height:45,mount:'none',texture:'smooth',inflate:100}),[glyph]);
const gentleBounds=bounds(gentle.parts),balloonBounds=bounds(balloon.parts);
assert.ok(balloonBounds.max[0]-balloonBounds.min[0]>gentleBounds.max[0]-gentleBounds.min[0]+5,'Gonfiaggio allarga realmente il tratto');
assert.ok(balloonBounds.max[2]>gentleBounds.max[2]+2,'Gonfiaggio aumenta il volume in profondità');
console.log('Bubble Letter: passaggio da leggermente gonfio a palloncino verificato nelle geometrie.');

for(const inflate of [0,25,55,80,100]){
  const r=build(M,sanitize({...DEFAULTS,height:40,mount:'none',texture:'knit',inflate}),[glyph]);
  const letter=solid(r.parts[0]);
  const aperture=M.Manifold.cylinder(100,4.5,4.5,48).translate([0,0,-1]);
  const blockage=letter.intersect(aperture);
  assert.ok(blockage.isEmpty(),'Foro della O visibile e passante a gonfiaggio '+inflate);
  blockage.delete();aperture.delete();letter.delete();
}
console.log('Bubble Letter: apertura utile della O conservata a cinque livelli di gonfiaggio.');

const mountParams=sanitize({...DEFAULTS,height:65,mount:'stand',texture:'smooth'});
const removable=build(M,mountParams,[glyph]);
const placement=removable.letters[0];
assert.ok(placement.slot&&placement.stand&&placement.standHeight);
const supportPart=removable.parts.find(part=>part.id===placement.stand)!;
const support=solid(supportPart),body=solid(removable.parts.find(part=>part.id===placement.id)!);
const theta=mountParams.lean*Math.PI/180,cosine=Math.cos(theta),sine=Math.sin(theta);
const inserted=support.warp(v=>{
  const [x,y,z]=v;
  v[0]=z-mountParams.standThickness/2+placement.slot![0];
  v[1]=sine*x+cosine*y+placement.bottom;
  v[2]=-cosine*x+sine*y;
});
const collision=inserted.intersect(body);
assert.ok(collision.volume()<.03,'Linguetta inserita senza collisioni con la lettera');
const released=inserted.translate([0,0,-7]),releaseCollision=released.intersect(body);
assert.ok(releaseCollision.isEmpty(),'Il piedistallo si sfila dal retro');
const supportBounds=support.boundingBox();
const projectedHeight=supportBounds.max[1]/cosine;
const projection=M.CrossSection.square([mountParams.standThickness,projectedHeight],true).translate([placement.slot![0],placement.bottom+projectedHeight/2]);
const aperture2d=M.CrossSection.square([65*.3,65*.5],true);
const visible=projection.intersect(aperture2d);
assert.ok(visible.area()<.001,'Piedistallo nascosto nel foro della O');
for(const object of [visible,aperture2d,projection,releaseCollision,released,collision,inserted,body,support])object.delete();
for(const magnets of [2,3,4]){
  const r=build(M,sanitize({...DEFAULTS,height:65,mount:'magnet',texture:'smooth',magnets,magnetDiameter:5}),[glyph]);
  const positions=r.letters[0].magnetPositions!;
  assert.equal(positions.length,magnets);
  const ys=positions.map(p=>p[1]),xs=positions.map(p=>p[0]);
  assert.ok(Math.max(...ys)-Math.min(...ys)>30,'Magneti distribuiti su tutta l’altezza');
  if(magnets===4)assert.ok(Math.max(...xs)-Math.min(...xs)>25,'Magneti distribuiti anche sui due lati');
}
console.log('Bubble Letter: supporto rimovibile senza collisioni, foro della O libero e magneti distribuiti verificati.');

const plain=build(M,sanitize({...DEFAULTS,height:65,mount:'none',texture:'smooth'}),[glyph]);
const plainBody=solid(plain.parts.find(part=>part.id==='letter-0')!);
const recessed=build(M,sanitize({...DEFAULTS,height:65,mount:'magnet',texture:'smooth',magnets:4,magnetDiameter:5}),[glyph]);
const recessedBody=solid(recessed.parts.find(part=>part.id==='letter-0')!);
const protrusion=recessedBody.subtract(plainBody);
assert.ok(protrusion.volume()<.0001,'Le sedi magnetiche non aggiungono materiale fuori dal corpo arrotondato');
for(const result of [plain,recessed,removable]){
  for(const part of result.parts)assert.ok(Math.abs(bounds([part]).min[2])<.00001,'Ogni pezzo stampabile appoggia su Z=0');
  const letter=result.parts.find(part=>part.id===result.letters[0].id)!;
  const angle=result===removable?mountParams.lean*Math.PI/180:0;
  const v=letter.mesh.positions;
  let floor=Infinity;
  for(let i=0;i<v.length;i+=3)floor=Math.min(floor,(v[i+1]-result.letters[0].bottom)*Math.cos(angle)+v[i+2]*Math.sin(angle));
  assert.ok(Math.abs(floor)<.0001,'La lettera in piedi appoggia sul piano reale');
}
for(const object of [protrusion,recessedBody,plainBody])object.delete();
console.log('Bubble Letter: nessuna sporgenza dalle sedi magnete, appoggio effettivo in piedi e pezzi stampabili a Z=0 verificati.');

const standSizes=[];
const ovalRing=(rx:number,ry:number)=>Array.from({length:96},(_,i):[number,number]=>[Math.cos(i*Math.PI/48)*rx,Math.sin(i*Math.PI/48)*ry]);
const ovalGlyph:Glyph={char:'O',heightRatio:1,artwork:{name:'O arrotondata',shapes:[[ovalRing(.4,.5),ovalRing(.15,.25).reverse()]]}};
for(const height of [35,65,130]){
  const params=sanitize({...DEFAULTS,height,mount:'stand',texture:'smooth'});
  const result=build(M,params,[ovalGlyph]);
  const info=result.letters[0];
  assert.ok(info.stand&&info.slot&&info.standLength&&info.standThickness&&info.tongueHeight,'Supporto automatico a '+height+' mm');
  assert.ok(info.standLength<height*.34,'Coda proporzionata al tratto pieno, '+height+' mm');
  const mesh=solid(result.parts.find(part=>part.id===info.stand)!);
  const b=mesh.boundingBox();
  assert.ok(Math.abs(b.max[0]-info.standLength)<.001);
  assert.ok(Math.abs(b.max[2]-info.standThickness)<.001);
  const angle=params.lean*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle);
  const inserted=mesh.warp(v=>{
    const [x,y,z]=v;
    v[0]=z-info.standThickness!/2+info.slot![0];
    v[1]=s*x+c*y+info.bottom;
    v[2]=-c*x+s*y;
  });
  const letter=solid(result.parts.find(part=>part.id===info.id)!);
  const overlap=inserted.intersect(letter);
  assert.ok(overlap.volume()<.03,'Incastro adattato alla misura '+height);
  const enlargedHole=M.CrossSection.ofPolygons([ovalRing(height*.15,height*.25)],'EvenOdd').offset(Math.max(2,Math.min(5,height*.04)),'Round',2,64);
  const projectedTop=b.max[1]/c;
  const silhouette=M.CrossSection.square([info.standThickness,projectedTop-1],true).translate([info.slot[0],info.bottom+(projectedTop+1)/2]);
  const nearAperture=silhouette.intersect(enlargedHole);
  assert.ok(nearAperture.area()<.001,'Punta del supporto distanziata dal foro a '+height+' mm');
  nearAperture.delete();silhouette.delete();enlargedHole.delete();
  standSizes.push({height,length:info.standLength,tab:info.tongueHeight});
  overlap.delete();letter.delete();inserted.delete();mesh.delete();
}
assert.ok(standSizes[0].length<standSizes[1].length&&standSizes[1].length<standSizes[2].length);
assert.ok(standSizes[0].tab<standSizes[1].tab);
console.log('Bubble Letter: piedistallo e linguetta adattivi a 35, 65 e 130 mm verificati.');

const slender:Glyph={char:'I',heightRatio:1,artwork:{name:'I',shapes:[[[[-.09,-.5],[.09,-.5],[.09,.5],[-.09,.5]]]]}};
const adhesiveLayouts=[];
for(const letter of [slender,ovalGlyph]){
  const params=sanitize({...DEFAULTS,height:80,mount:'adhesive',texture:'smooth'});
  const fitted=build(M,params,[letter]),unmodified=build(M,{...params,mount:'none'},[letter]);
  const seats=fitted.letters[0].adhesiveSeats!;
  assert.ok(seats.length>=1&&seats.length<=2,'Una o due sedi per '+letter.char);
  const base=solid(unmodified.parts[0]),cut=solid(fitted.parts[0]);
  const added=cut.subtract(base);
  assert.ok(added.volume()<.0001,'Sedi interamente ricavate nel corpo');
  for(const seat of seats){
    assert.ok(seat.width>=3&&seat.height>=3);
    const scope=new Scope();
    try {
      const profile=adhesiveSection(M,scope,seat);
      const cavity=scope.t(scope.t(profile.extrude(.55)).translate([0,0,.02]));
      const remaining=scope.t(cavity.intersect(cut));
      assert.ok(remaining.volume()<.001,'La sede viene realmente scavata');
      const backing=scope.t(scope.t(profile.extrude(.8)).translate([0,0,.7]));
      const outside=scope.t(backing.subtract(base));
      assert.ok(outside.volume()<.01,'Resta materiale dietro la sede e attorno ai fori');
    }finally{scope.free();}
  }
  adhesiveLayouts.push(seats);
  added.delete();cut.delete();base.delete();
}
assert.equal(adhesiveLayouts[0].length,1,'Una sede verticale sul tratto lungo della I');
assert.equal(adhesiveLayouts[1].length,2,'Due sedi distinte sulla O con foro');
assert.ok(adhesiveLayouts[0][0].height>adhesiveLayouts[0][0].width,'Sede ruotata automaticamente sul tratto verticale');
console.log('Bubble Letter: adesivi automatici, una o due sedi, orientamento, scavo reale e parete residua verificati.');
