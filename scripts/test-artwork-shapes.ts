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
