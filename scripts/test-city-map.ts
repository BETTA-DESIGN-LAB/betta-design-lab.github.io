import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {bounds,loadManifold,Scope} from '@bdl/geometry';
import {to3MF,toSTL} from '@bdl/export';
import {unzipSync,strFromU8} from 'fflate';
import {buildingHeight,expandOsmMap,FLORENCE,parseData} from '../apps/city-map/src/data.ts';
import {build} from '../apps/city-map/src/geometry.ts';
import {MAGNETS,magnetPocket,rearMount} from '../apps/city-map/src/accessories.ts';
import {FORMS} from '../apps/city-map/src/forms.ts';
import {bbox,type Element} from '../apps/city-map/src/data.ts';

assert.deepEqual(buildingHeight({height:'30 ft'},8),{metres:9.144,kind:'height'});
assert.deepEqual(buildingHeight({'building:levels':'3'},8),{metres:9,kind:'levels'});
assert.deepEqual(buildingHeight({},8),{metres:8,kind:'estimate'});
assert.throws(()=>parseData({remark:'timed out',elements:[]}));
const data=parseData(JSON.parse(readFileSync(new URL('../public/city-data/florence.json',import.meta.url),'utf8')));
const model=build(await loadManifold(),FLORENCE,data,{size:180,base:3,relief:1.4,fallback:8,roads:true,water:true,green:true});
assert.deepEqual(model.parts.map(p=>p.id),['base','parks','water','roads','paths','buildings']);
assert.ok(model.counts.height>10&&model.counts.levels>400);
const box=bounds([model.solid]);
assert.deepEqual(box.min,[-90,-90,0]);
assert.equal(box.max[0],90);assert.equal(box.max[1],90);
assert.ok(box.max[2]>30,'Il Duomo comprende la cupola e la lanterna mappate');
const stl=toSTL([model.solid]);
assert.equal(stl.length,84+50*model.solid.mesh.indices.length/3);
const zip=unzipSync(to3MF(model.parts,{printProfile:false}));
assert.match(strFromU8(zip['3D/3dmodel.model']),/Edifici/);
assert.ok(!zip['Metadata/project_settings.config']);
console.log('Mappe 3D: campione di Firenze, volumi mappati, solidi ed export verificati.');

const shaped=build(await loadManifold(),FLORENCE,data,{size:180,base:3,relief:1.4,fallback:8,
  roads:true,water:true,green:true,style:'miniature',waterMode:'incised',marker:true,stand:true},
  {steps:2,metres:[42,44,45,43,46,48,44,47,52]},[[[[-1,-1],[1,-1],[1,1],[-1,1]]]]);
assert.equal(shaped.width,188);assert.equal(shaped.depth,198);
assert.equal(shaped.trayFloor,2.4);
assert.ok(shaped.tray);
assert.equal(shaped.trayPreview?.[1].id,"tray-writing");
assert.notEqual(shaped.trayPreview?.[1].color,shaped.tray.color);
assert.ok(Math.abs(bounds([shaped.tray]).max[2]-5.05)<.01,"Il bordo accoglie la mappa e include la scritta");
assert.ok(shaped.stand&&shaped.markers);
assert.ok(shaped.parts.some(part=>part.name==='Acqua incisa'));
assert.ok(bounds(shaped.parts).max[2]>box.max[2]);
console.log('Mappe 3D: quote effettive, terreno, alveo, cornice e supporto verificati.');

const M=await loadManifold();
const [south,west,north,east]=bbox(FLORENCE);
const at=(u:number,v:number)=>({lon:west+(east-west)*u,lat:south+(north-south)*v});
const square=(id:number,tags:Record<string,string>,x:number,y:number,w:number,h:number):Element=>({
  type:'way',id,tags,geometry:[at(x,y),at(x+w,y),at(x+w,y+h),at(x,y+h),at(x,y)],
});
const line=(id:number,tags:Record<string,string>,a:[number,number],b:[number,number]):Element=>({
  type:'way',id,tags,geometry:[at(...a),at(...b)],
});
const little=[
  square(1,{building:'yes',height:'22'},.44,.44,.13,.13),
  square(2,{building:'yes',height:'12'},.92,.90,.08,.09),
  square(3,{natural:'water'},.54,.22,.14,.30),
  square(4,{leisure:'park'},.21,.55,.21,.20),
  line(5,{highway:'residential',bridge:'yes'},[.4,.33],[.78,.33]),
  line(6,{railway:'rail'},[.2,.45],[.35,.85]),
];
const sample={size:90,base:3,relief:1,fallback:8,roads:true,water:true,green:true};
const lettering={title:[[[[-1,-1],[1,-1],[1,1],[-1,1]]]] as [number,number][][][]};
for(const [form] of FORMS){
  const r=build(M,FLORENCE,little,{...sample,form,frame:true,keyring:form!=='cube',mount:'magnet'},undefined,lettering);
  assert.ok(r.mount,form+' supporto magnetico');
  if(form==='cube'){
    assert.ok(r.parts.some(p=>p.id==='caption'),form+' scritta');
    assert.equal(r.tray,undefined);
  }else{
    assert.ok(r.tray,form+' base separata');
    assert.ok(!r.parts.some(p=>p.id==='caption'||p.id==='frame'),form+' mappa indipendente');
    const trayMesh=r.tray.mesh,mapMesh=r.solid.mesh;
    const tray=new M.Manifold(new M.Mesh({numProp:3,vertProperties:trayMesh.positions,triVerts:trayMesh.indices}));
    const map=new M.Manifold(new M.Mesh({numProp:3,vertProperties:mapMesh.positions,triVerts:mapMesh.indices}));
    const seated=map.translate([0,0,r.trayFloor]);
    const overlap=tray.intersect(seated);
    assert.ok(Math.abs(overlap.volume())<.01,form+' incastro senza interferenze');
    const pieces=tray.decompose();
    assert.equal(pieces.filter(piece=>Math.abs(piece.volume())>1e-5).length,1,form+' vassoio unito');
    for(const mesh of [...pieces,overlap,seated,map,tray])mesh.delete();
  }
  if(form==='circle')assert.equal(r.counts.height,1,'Il cerchio esclude gli edifici negli angoli');
  if(form==='cube')assert.ok(bounds(r.parts).max[2]>=72,'La mappa del cubo è sulla faccia superiore');
}
const extra=build(M,FLORENCE,little,{...sample,frame:true,trees:true,highlight:true,mount:'wall',
  extraPins:'43.772,11.255,ball',north:true,scaleBar:true},undefined,lettering,[[at(.23,.38),at(.68,.67)]]);
for(const id of ['route','highlight','rails','bridges','trees'])assert.ok(extra.parts.some(p=>p.id===id),id);
assert.ok(extra.mount);
const bands=build(M,FLORENCE,little,{...sample,colorMode:'height',cut1:2.4,mount:'led'});
assert.deepEqual(bands.changes,[2.4]);assert.equal(bands.parts.length,2);assert.ok(bands.mount);
console.log('Mappe 3D: nove sagome con cornice, scritte, accessori, livelli e fasce di colore verificati.');

const pinPoint=at(.35,.60);
const moved=build(M,FLORENCE,little,{...sample,marker:true,markerPosition:pinPoint.lat+','+pinPoint.lon,
  colorMode:'ams4',roadColor:'#111111',buildingColor:'#ffffff',groundColor:'#ffffff'});
const pin=moved.placedMarkers!;
assert.ok(moved.markers&&!moved.parts.some(part=>part.id==='marker'));
const pinBounds=bounds([pin]);
assert.ok(Math.abs((pinBounds.min[0]+pinBounds.max[0])/2+13.5)<.01,'Il segnaposto si sposta sull’asse X');
assert.ok(Math.abs((pinBounds.min[1]+pinBounds.max[1])/2-9)<.01,'Il segnaposto si sposta sull’asse Y');
assert.equal(pin.color,'#ff4b16');
assert.equal(moved.counts.detached,0);
const fallback=expandOsmMap({elements:[
  {type:'node',id:10,...at(.45,.45)},
  {type:'node',id:11,...at(.55,.45)},
  {type:'way',id:20,nodes:[10,11],tags:{highway:'residential'}},
  {type:'way',id:21,nodes:[10,11]},
  {type:'relation',id:30,members:[{type:'way',ref:21,role:'outer'}],tags:{building:'yes'}},
]});
assert.deepEqual(fallback[0].geometry,[at(.45,.45),at(.55,.45)]);
assert.deepEqual(fallback[1].members?.[0].geometry,fallback[0].geometry);
console.log('Mappe 3D: posizione libera del segnaposto e lettura della fonte di riserva verificate.');

const baptistery=square(22945162,{building:'chapel',height:'55',wikidata:'Q1278477'},.47,.47,.06,.06);
const pisaDetail=build(M,FLORENCE,[baptistery],{...sample,size:200});
const pisaSimple=build(M,FLORENCE,[baptistery],{...sample,size:200,simple:true});
const detailed=pisaDetail.parts.find(part=>part.id==='buildings')!;
const simplified=pisaSimple.parts.find(part=>part.id==='buildings')!;
assert.equal(pisaDetail.counts.detached,0);
assert.ok(Math.abs(bounds([detailed]).max[2]-(sample.base+55*200/900))<.01);
const upperRadius=(part:typeof detailed)=>{
  let radius=0;
  for(let i=0;i<part.mesh.positions.length;i+=3){
    const [x,y,z]=part.mesh.positions.subarray(i,i+3);
    if(z>=sample.base+48*200/900)radius=Math.max(radius,Math.hypot(x,y));
  }
  return radius;
};
assert.ok(upperRadius(detailed)<upperRadius(simplified)*.5,'La calotta si restringe verso la lanterna');
assert.ok(toSTL([pisaDetail.solid]).length>toSTL([pisaSimple.solid]).length);
console.log('Mappe 3D: Battistero con calotta, lanterna e solido continuo verificato.');

const magnetScope=new Scope();
try{
  for(const [code,d,h] of MAGNETS)for(const size of [40,200]){
    const mount=rearMount(M,magnetScope,'magnet',size,code);
    assert.equal(mount.status(),'NoError',code);
    const top=mount.boundingBox().max[2],floor=top-h-.1;
    assert.ok(floor>=1.499,code);
    const below=magnetScope.t(mount.slice(floor-.02)).area();
    const above=magnetScope.t(mount.slice(floor+.02)).area();
    const holeArea=24*((d+.2)/2)**2*Math.sin(2*Math.PI/48);
    const seats=Math.round((below-above)/holeArea);
    assert.ok((seats===1||seats===2)&&Math.abs(below-above-seats*holeArea)<.01,code);
  }
  assert.deepEqual(magnetPocket('unknown'),{sku:'CA005',diameter:8.2,depth:2.1});
}finally{magnetScope.free();}
console.log('Mappe 3D: diametro, profondità e fondo dei 21 formati magnete verificati.');

const normalTray=build(M,FLORENCE,little,{...sample,form:'circle',frame:true});
const thickerTray=build(M,FLORENCE,little,{...sample,form:'circle',frame:true,trayThickness:6});
assert.equal(thickerTray.trayFloor,6);
assert.deepEqual(thickerTray.solid.mesh,normalTray.solid.mesh);
assert.ok(Math.abs(bounds([thickerTray.tray!]).max[2]-8)<.01);
assert.equal(thickerTray.width,normalTray.width);
assert.equal(thickerTray.depth,normalTray.depth);

for(const [form] of FORMS.filter(([form])=>form!=='cube')){
  const top=build(M,FLORENCE,little,{...sample,form,frame:true,captionPosition:'top'},undefined,lettering);
  const wall=build(M,FLORENCE,little,{...sample,form,frame:true,captionPosition:'wall'},undefined,lettering);
  assert.ok(top.trayPreview&&wall.trayPreview,form);
  const bare=build(M,FLORENCE,little,{...sample,form,frame:true});
  assert.equal(top.width,bare.width,form+' larghezza senza targhetta');
  assert.equal(top.depth,bare.depth,form+' profondità senza targhetta');
  assert.ok(bounds([top.trayPreview[1]]).min[2]>top.trayFloor+1.95,form+' scritta sopra');
  assert.ok(bounds([wall.trayPreview[1]]).max[2]<wall.trayFloor+2,form+' scritta sulla parete');
}

const rowCaption={...lettering,coordinates:[[[[-3,-1],[3,-1],[3,1],[-3,1]]]] as [number,number][][][]};
for(const order of ['front','back']){
  const r=build(M,FLORENCE,little,{...sample,form:'drop',frame:true,captionPosition:'top',coordinateOrder:order},undefined,rowCaption);
  const mesh=r.trayPreview![1].mesh;
  const text=new M.Manifold(new M.Mesh({numProp:3,vertProperties:mesh.positions,triVerts:mesh.indices}));
  const pieces=text.decompose().sort((a,b)=>a.volume()-b.volume());
  assert.equal(pieces.length,2);
  const center=(part:typeof text)=>{const {min,max}=part.boundingBox();return (min[0]+max[0])/2;};
  assert.equal(center(pieces[1])>center(pieces[0]),order==='front');
  for(const piece of pieces)piece.delete();
  text.delete();
}

const toManifold=(part:NonNullable<typeof moved.markers>)=>new M.Manifold(new M.Mesh({
  numProp:3,vertProperties:part.mesh.positions,triVerts:part.mesh.indices,
}));
const markerMeshes=new Set<number>();
for(const markerShape of ['star','heart','initial']){
  const marked=build(M,FLORENCE,[],{...sample,marker:true,markerShape},undefined,{marker:lettering.title});
  assert.ok(marked.markers&&marked.placedMarkers);
  const map=toManifold(marked.solid),marker=toManifold(marked.markers);
  const pieces=marker.decompose();
  assert.equal(pieces.length,1,markerShape);
  assert.ok(Math.abs(marker.boundingBox().min[2])<.001);
  assert.ok(Math.abs(map.rayCast([0,0,5],[0,0,-1])[0].position[2]-1.2)<.001,markerShape+' foro cieco');
  assert.ok(Math.abs(map.rayCast([2,0,5],[2,0,-1])[0].position[2]-3)<.001);
  assert.doesNotThrow(()=>toSTL([marked.markers!]));
  markerMeshes.add(Math.round(marker.volume()*100));
  for(const mesh of [...pieces,map,marker])mesh.delete();
}
assert.equal(markerMeshes.size,3);
console.log('Mappe 3D: tre forme separabili, foro cieco e STL verificati.');
