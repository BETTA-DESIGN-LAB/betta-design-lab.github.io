import assert from 'node:assert/strict';
import { loadManifold, Scope, bounds } from '@bdl/geometry';
import { artworkSection } from '../apps/shared/artwork-geometry.ts';
import type { SvgArtwork } from '../apps/coaster/src/svg.ts';
import { build as keychain } from '../apps/keychain/src/geometry.ts';
import { DEFAULTS as chainDefaults } from '../apps/keychain/src/params.ts';
import { buildKeycap } from '../apps/keycap/src/geometry.ts';
import { DEFAULTS as capDefaults } from '../apps/keycap/src/params.ts';

const M = await loadManifold();
const ring: SvgArtwork = { name: 'Contorno con occhi', filledShapes: [], shapes: [[
  [[-.5,-.5],[.5,-.5],[.5,.5],[-.5,.5]],
  [[-.4,-.4],[-.4,.4],[.4,.4],[.4,-.4]],
], [[[ -.12,-.05 ],[.12,-.05],[.12,.05],[-.12,.05]]]] };
const original = JSON.stringify(ring);
for (let repeat = 0; repeat < 2; repeat++) {
  const s = new Scope();
  try {
    const ink = artworkSection(M, s, ring), body = artworkSection(M, s, ring, true);
    assert.ok(ink.area() < .5, 'La decorazione conserva i vuoti originali');
    assert.ok(Math.abs(body.area() - 1) < 1e-6, 'La sagoma riempie occhi e bocca');
    assert.equal(body.decompose().map(p => s.t(p)).length, 1);
  } finally { s.free(); }
}
assert.equal(JSON.stringify(ring), original, 'Il disegno originale resta intatto');
const chain = keychain(M, { ...chainDefaults, model: 'svg', shape: 'svg', loop: false, mode: 'relief', width: 50, depth: 50 }, { main: ring });
assert.ok(chain.parts.some(p => p.id === 'base'));
for (const compact of [true, false]) {
  const result = buildKeycap(M, { ...capDefaults, shape: 'artwork', size: 50, compact, mode: 'relief', keychain: false }, ring);
  const cap = result.parts.find(p => p.id === 'cap')!;
  const b = bounds([cap]);
  assert.ok(Math.abs(b.max[0] - b.min[0] - 50) < .01, 'Pulsante segue la sagoma senza offset');
  for (const part of result.parts) {
    const mesh = new M.Mesh({ numProp: 3, vertProperties: part.mesh.positions, triVerts: part.mesh.indices });
    mesh.merge(); const solid = new M.Manifold(mesh);
    assert.equal(solid.status(), 'NoError'); assert.ok(solid.volume() > 0); solid.delete();
  }
}
console.log('Sagome SVG: linee accettate, fori riempiti, originale conservato, cache e pulsanti senza offset verificati.');

// L'anello scorre anche su una lettera concava, restando solidale al corpo.
const letterN: SvgArtwork = { name: 'N', shapes: [[[
  [-.5,-.5],[-.3,-.5],[-.3,.1],[.3,-.5],[.5,-.5],
  [.5,.5],[.3,.5],[.3,-.1],[-.3,.5],[-.5,.5],
]]] };
for (let angle = -180; angle < 180; angle += 15) {
  const result = keychain(M, { ...chainDefaults, model: 'initial', initial: 'N', text: '', shape: 'svg', width: 50, depth: 50, ringAngle: angle, ringType: 'external' }, { initial: letterN });
  const part = result.parts.find(p => p.id === 'base')!;
  const mesh = new M.Mesh({ numProp: 3, vertProperties: part.mesh.positions, triVerts: part.mesh.indices });
  mesh.merge(); const solid = new M.Manifold(mesh);
  try {
    assert.equal(solid.status(), 'NoError');
    const pieces = solid.decompose();
    try { assert.equal(pieces.length, 1, `Anello scollegato dalla N a ${angle} gradi`); }
    finally { pieces.forEach(p => p.delete()); }
    const b = bounds([part]);
    if (angle === 0) assert.ok(b.max[0] > 29, 'Anello spostato sul lato destro');
    if (angle === -180) assert.ok(b.min[0] < -29, 'Anello spostato sul lato sinistro');
  } finally { solid.delete(); }
}
console.log('Anello sulla N: 24 posizioni lungo il contorno, sempre solidale al corpo.');

// Portachiavi: sagoma fedele, senza riempire i fori o duplicare il disegno.
const skull: SvgArtwork = { name: 'Teschio con vuoti', shapes: [[
  [[-.5,-.5],[.5,-.5],[.5,.5],[-.5,.5]],
  [[-.35,.1],[-.15,.1],[-.15,.3],[-.35,.3]],
  [[.15,.1],[.35,.1],[.35,.3],[.15,.3]],
  [[-.25,-.35],[.25,-.35],[.25,-.2],[-.25,-.2]],
]] };
for (const mode of ['relief','inlay','engrave'] as const) for (const svgOffset of [0, 1.6]) {
  const scope = new Scope();
  try {
    const params = { ...chainDefaults, model:'svg' as const, shape:'svg' as const, loop:false, width:60, depth:50, scale:80, angle:23, x:8, y:-3, mode, svgOffset };
    const expected = scope.t(scope.t(artworkSection(M, scope, skull).scale(40).rotate(23)).translate([8,-3]));
    const result = keychain(M, params, { main: skull });
    const solids = result.parts.map(part => {
      const mesh = new M.Mesh({ numProp:3, vertProperties:part.mesh.positions, triVerts:part.mesh.indices });
      mesh.merge();const solid=scope.t(new M.Manifold(mesh));assert.equal(solid.status(),'NoError');return solid;
    });
    if (svgOffset===0) {
      assert.equal(result.parts.length,1,'Sagoma senza seconda copia');
      const section=scope.t(solids[0].slice(params.thickness/2));
      assert.ok(scope.t(section.subtract(expected)).area()<.001);
      assert.ok(scope.t(expected.subtract(section)).area()<.001,'Vuoti e dettagli originali conservati');
      assert.ok(Math.abs(solids[0].volume()-expected.area()*params.thickness)<.01);
    } else {
      assert.ok(result.parts.length>1,'Offset aggiunge il livello superiore');
      assert.ok(result.parts.some(p=>p.color===params.artColor));
      const upper=scope.t(M.Manifold.union(solids.slice(1)));
      const section=scope.t(upper.slice(params.thickness+params.relief/2));
      assert.ok(scope.t(section.subtract(expected)).area()<.001);
      assert.ok(scope.t(expected.subtract(section)).area()<.001,'SVG superiore non ridotto né spostato');
      assert.ok(Math.abs(bounds(result.parts).max[2]-params.thickness-params.relief)<.001);
    }
  } finally { scope.free(); }
}
console.log('Portachiavi SVG: pieni/vuoti fedeli, nessun doppione, offset a due livelli allineati verificati.');

// File già pieni e file a contorni: i dettagli cambiano tecnica, non posizione.
for(const artwork of [ring,skull])for(const svgTreatment of ['through','engrave','inlay','relief'] as const)for(const svgOffset of [0,2]){
 const scope=new Scope();try{
  const p={...chainDefaults,model:'svg' as const,shape:'svg' as const,loop:false,width:50,depth:50,svgTreatment,svgOffset};
  const result=keychain(M,p,{main:artwork});
  const solids=result.parts.map(part=>{const mesh=new M.Mesh({numProp:3,vertProperties:part.mesh.positions,triVerts:part.mesh.indices});mesh.merge();const solid=scope.t(new M.Manifold(mesh));assert.equal(solid.status(),'NoError');assert.ok(solid.volume()>0);return solid;});
  const bottom=scope.t(solids[0].slice(.2)),top=scope.t(solids[0].slice(p.thickness-.2));
  if(svgTreatment==='through')assert.ok(Math.abs(bottom.area()-top.area())<.001,'Fori realmente passanti');
  if(svgTreatment==='engrave'||svgTreatment==='inlay')assert.ok(bottom.area()>top.area()+1,'Sede interna con fondo');
  if(svgTreatment==='relief'||svgTreatment==='inlay'){
   assert.ok(solids.length>1,'Dettagli esportabili in secondo colore');
   const upper=scope.t(M.Manifold.union(solids.slice(1)));
   assert.ok(scope.t(upper.intersect(solids[0])).volume()<.001,'Parti senza sovrapposizioni');
   assert.ok(Math.abs(bounds(result.parts).max[2]-(p.thickness+(svgTreatment==='relief'?p.relief:0)))<.001);
  }else assert.equal(result.parts.length,1,'Nessun disegno duplicato');
 }finally{scope.free();}
}
console.log('Dettagli SVG: 16 casi, fori passanti, incisioni con fondo, intarsi e rilievi senza doppioni.');
