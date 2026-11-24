import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {loadManifold,bounds,Scope} from '@bdl/geometry';
import {build} from '../apps/city-map/src/geometry.ts';
import {pisaCathedral,PISA_CATHEDRAL_HEIGHT} from '../apps/city-map/src/cathedral.ts';
import {pitchedRoof} from '../apps/city-map/src/roofs.ts';
import {parseData,type Area} from '../apps/city-map/src/data.ts';
const M=await loadManifold();
const data=parseData(JSON.parse(readFileSync(new URL('../public/city-data/pisa-cathedral.json',import.meta.url),'utf8')));
assert.ok(pisaCathedral(data[0]));
assert.ok(pisaCathedral({type:'way',id:22945163}));
assert.ok(!pisaCathedral({type:'way',id:12,tags:{building:'cathedral',name:'Duomo'}}));
const area:Area={lat:43.723285,lon:10.3957275,span:240,aspect:'square'};
const settings={size:160,base:3,relief:1,fallback:8,roads:false,water:false,green:false};
const mesh=(p:ReturnType<typeof build>['solid'])=>new M.Manifold(new M.Mesh({numProp:3,vertProperties:p.mesh.positions,triVerts:p.mesh.indices}));
for(const relief of [.6,1,1.8]){
  const detailed=build(M,area,data,{...settings,relief});
  const simple=build(M,area,data,{...settings,relief,simple:true});
  const body=mesh(detailed.parts.find(p=>p.id==='buildings')!);
  const block=mesh(simple.parts.find(p=>p.id==='buildings')!);
  assert.equal(body.status(),'NoError');
  assert.ok(Math.abs(body.boundingBox().max[2]-(settings.base+PISA_CATHEDRAL_HEIGHT*settings.size/area.span*relief))<.02,'Altezza nominale del Duomo anche quando OSM non la indica');
  assert.ok(body.volume()<block.volume()*.66,'Navate basse separate dalla cupola, senza blocco pieno');
  const high=body.slice(settings.base+40*settings.size/area.span*relief);
  const low=body.slice(settings.base+10*settings.size/area.span*relief);
  assert.ok(high.area()>0&&high.area()<low.area()*.12,'La parte alta è concentrata nella cupola');
  const shells=body.decompose();assert.equal(shells.length,1,'Monumento continuo e stampabile');shells.forEach(p=>p.delete());
  assert.equal(detailed.counts.detached,0);
  for(const o of [high,low,body,block])o.delete();
}
// Clipping must use the full monument for orientation, even at the map edge.
const clipped=build(M,{...area,lon:area.lon+.0009,span:100},data,settings);
const cb=bounds([clipped.solid]);assert.ok(cb.min[0]>=-80-.001&&cb.max[0]<=80+.001);
const overlap={...data[0],id:987654,tags:{'building:part':'yes',height:'60'}};
const clean=build(M,area,data,settings),withPart=build(M,area,[...data,overlap],settings);
assert.equal(bounds([clean.solid]).max[2],bounds([withPart.solid]).max[2],'Le parti OSM sovrapposte non coprono la cupola');
for(const profile of ['gabled','hipped']){
  const scope=new Scope();try{
    const shape=scope.t(M.CrossSection.square([20,40],true));
    const roof=pitchedRoof(M,scope,shape,{'roof:shape':profile},12,4,3);
    assert.equal(roof.status(),'NoError');
    assert.ok(Math.abs(roof.boundingBox().max[2]-15)<.001);
    assert.ok(Math.abs(roof.volume()-(profile==='gabled'?8000:7733.3333))<3);
  }finally{scope.free();}
}
console.log('Pisa: dati OSM reali, Duomo a navate e cupola ellittica, altezza, ritaglio, parti sovrapposte e tetti a falde verificati.');
