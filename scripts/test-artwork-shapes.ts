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
