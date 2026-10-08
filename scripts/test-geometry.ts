// Test della geometria in Node: costruisce ogni combinazione di forma × motivo × tecnica
// e verifica che i pezzi siano solidi chiusi (manifold), non vuoti e nelle misure attese.
// Gira in CI e in locale con `pnpm test`.

import { assemblySeats, loadManifold } from '@bdl/geometry';
import { buildCoaster } from '../apps/coaster/src/geometry.ts';
import { DEFAULTS, sanitize as sanitizeCoaster, type CoasterParams } from '../apps/coaster/src/params.ts';
import { buildVase } from '../apps/vase/src/geometry.ts';
import { DEFAULTS as VASE_DEFAULTS, sanitize } from '../apps/vase/src/params.ts';
import { stripSvgDoctype } from '../apps/coaster/src/svg.ts';
import { groundPart, separateParts } from '../apps/coaster/src/parts.ts';
import { bounds } from '@bdl/geometry';
import { unzipSync, strFromU8 } from 'fflate';
import { toSTL, to3MF } from '@bdl/export';
import { buildKeycap, buildFitTest } from '../apps/keycap/src/geometry.ts';
import { DEFAULTS as KEYCAP_DEFAULTS, sanitize as sanitizeKeycap } from '../apps/keycap/src/params.ts';
import { traceRaster } from '../apps/keycap/src/artwork.ts';
import { printPart as printKeycapPart, printAssembly as printKeycapAssembly } from '../apps/keycap/src/parts.ts';

import { build as buildKeychain } from '../apps/keychain/src/geometry.ts';
import { DEFAULTS as CHAIN_DEFAULTS, sanitize as sanitizeChain } from '../apps/keychain/src/params.ts';
import { qrArtwork } from '../apps/keychain/src/artwork.ts';
const M = await loadManifold();
let failures = 0;
let runs = 0;
const fail = (msg: string) => { failures++; console.error('✗', msg); };

const shapes = ['round', 'square', 'hex', 'oct'] as const;
const patterns = ['none', 'rings', 'hex', 'stripes', 'grid', 'waves', 'dots'] as const;
const modes = ['inlay', 'relief'] as const;

for (const shape of shapes) for (const pattern of patterns) for (const patternMode of modes) for (const corkRecess of [false, true]) {
  const p: CoasterParams = { ...DEFAULTS, shape, pattern, patternMode, corkRecess };
  const label = `${shape}/${pattern}/${patternMode}${corkRecess ? '/cork' : ''}`;
  runs++;
  const t0 = performance.now();
  const { parts } = buildCoaster(M, p);
  const ms = performance.now() - t0;
  if (!parts.length || !parts[0].mesh.indices.length) { fail(`${label}: base vuota`); continue; }
  if (pattern !== 'none' && parts.length !== 2) fail(`${label}: atteso 2 pezzi, trovati ${parts.length}`);
  for (const part of parts) {
    // Ricostruisce un Manifold dalla mesh: se non è chiusa/valida, status != NoError.
    const mesh = new M.Mesh({ numProp: 3, vertProperties: part.mesh.positions, triVerts: part.mesh.indices });
    mesh.merge();
    const solid = new M.Manifold(mesh);
    if (solid.status() !== 'NoError') fail(`${label}/${part.id}: mesh non valida (${solid.status()})`);
    if (solid.volume() <= 0) fail(`${label}/${part.id}: volume nullo`);
    const bb = solid.boundingBox();
    if (part.id === 'base') {
      const w = bb.max[0] - bb.min[0];
      if (Math.abs(w - p.size) > p.size * 0.16) fail(`${label}: larghezza ${w.toFixed(1)} lontana da ${p.size}`);
      if (Math.abs(bb.min[2]) > 1e-3) fail(`${label}: la base non poggia sul piatto (z min ${bb.min[2]})`);
    }
    solid.delete();
  }
  if (ms > 1500) fail(`${label}: troppo lento (${ms.toFixed(0)} ms)`);
}

// Gli export producono file non vuoti e un 3MF che è uno zip.
const { parts } = buildCoaster(M, DEFAULTS);
const stl = toSTL(parts);
if (stl.length < 1000) fail('STL troppo piccolo');
const tmf = to3MF(parts);
if (tmf[0] !== 0x50 || tmf[1] !== 0x4b) fail('3MF non è uno zip');

// Vasi: tutti i profili, torsione nei due sensi, conicità e drenaggio.
for (const profile of ['smooth', 'faceted', 'wavy'] as const)
for (const twist of [-180, 0, 180])
for (const [bottomDiameter, topDiameter] of [[95, 120], [220, 50], [50, 240]])
for (const drainageHole of [false, true]) {
  const p = sanitize({ ...VASE_DEFAULTS, profile, twist, bottomDiameter, topDiameter,
    sides: 3, waveDepth: 14, wall: 5, bottomThickness: 10, height: 60,
    drainageHole, drainageDiameter: 220 });
  const label = `vase/${profile}/${twist}/${bottomDiameter}-${topDiameter}/${drainageHole}`;
  runs++;
  const { parts } = buildVase(M, p);
  const mesh = new M.Mesh({ numProp: 3, vertProperties: parts[0].mesh.positions, triVerts: parts[0].mesh.indices });
  mesh.merge();
  const solid = new M.Manifold(mesh);
  try {
    if (solid.status() !== 'NoError' || solid.volume() <= 0) fail(`${label}: solido non valido`);
    if (profile === 'smooth' && twist === 0 && !drainageHole) {
      // Volume analitico del tronco di cono: rileva anche cavità disallineate
      // che rimangono manifold e aperte al centro.
      const r = p.bottomDiameter / 2;
      const scale = p.topDiameter / p.bottomDiameter;
      const slope = (scale - 1) / p.height;
      const integral = (z: number) => z + slope * z * z + slope * slope * z * z * z / 3;
      const areaFactor = 128 / 2 * Math.sin(2 * Math.PI / 128);
      const innerRadius = r - p.wall / Math.min(1, scale) / Math.cos(Math.PI / 128);
      const expected = areaFactor * (r * r * integral(p.height) - innerRadius * innerRadius * (integral(p.height) - integral(p.bottomThickness)));
      if (Math.abs(solid.volume() - expected) > expected * 0.0001) fail(`${label}: cavità non allineata al guscio`);
    }
    const bb = solid.boundingBox();
    if (Math.abs(bb.min[2]) > 1e-3 || Math.abs(bb.max[2] - p.height) > 1e-3) fail(`${label}: altezza/fondo errati`);
    // Il centro deve essere vuoto sopra il fondo e pieno sotto, salvo drenaggio.
    const probe = M.Manifold.cylinder(p.height - p.bottomThickness - 2, 0.5, -1, 12);
    const above = probe.translate([0, 0, p.bottomThickness + 1]);
    const overlap = solid.intersect(above);
    if (overlap.volume() > 1e-5) fail(`${label}: bocca/cavità chiusa`);
    overlap.delete(); above.delete(); probe.delete();
    const baseProbe = M.Manifold.cylinder(p.bottomThickness - 0.2, 0.5, -1, 12);
    const base = baseProbe.translate([0, 0, 0.1]);
    const baseOverlap = solid.intersect(base);
    if (drainageHole ? baseOverlap.volume() > 1e-5 : Math.abs(baseOverlap.volume() - base.volume()) > 1e-5) fail(`${label}: fondo/drenaggio errato`);
    baseOverlap.delete(); base.delete(); baseProbe.delete();
    const stl = toSTL(parts);
    const triangles = parts[0].mesh.indices.length / 3;
    if (stl.length !== 84 + triangles * 50 || new DataView(stl.buffer).getUint32(80, true) !== triangles) fail(`${label}: STL errato`);
    const archive = unzipSync(to3MF(parts));
    const model = strFromU8(archive['3D/3dmodel.model']);
    if (!model.includes('unit="millimeter"') || model.includes('NaN') || model.includes('Infinity') || (model.match(/<triangle /g) ?? []).length !== triangles) fail(`${label}: 3MF errato`);
  } finally { solid.delete(); }
}
const invalid = sanitize({ ...VASE_DEFAULTS, height: NaN, wall: Infinity, color: '"/><invalid>', drainageHole: 'false' as unknown as boolean });
if (invalid.height !== VASE_DEFAULTS.height || invalid.wall !== VASE_DEFAULTS.wall || invalid.color !== VASE_DEFAULTS.color || invalid.drainageHole) fail('vase: parametri non validi accettati');

// Import SVG: fori preservati, intarsio/incisione con sughero e sagome connesse.
const artwork = { name: 'anello.svg', shapes: [[
  [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]],
  [[-0.15, -0.15], [0.15, -0.15], [0.15, 0.15], [-0.15, 0.15]],
]] } as import('../apps/coaster/src/svg.ts').SvgArtwork;
for (const svgUse of ['decoration', 'shape'] as const)
for (const patternMode of ['relief', 'inlay', 'engrave'] as const)
for (const corkRecess of [false, true]) {
  runs++;
  const p = sanitizeCoaster({ ...DEFAULTS, svgUse, patternMode, corkRecess, pattern: svgUse === 'shape' ? 'none' : 'hex', baseHeight: 1.6, corkDepth: 3, patternHeight: 3 });
  const { parts } = buildCoaster(M, p, artwork);
  const label = `svg/${svgUse}/${patternMode}/${corkRecess}`;
  const expectedParts = svgUse === 'shape' || patternMode === 'engrave' || (corkRecess && patternMode === 'inlay') ? 1 : 2;
  if (parts.length !== expectedParts) fail(`${label}: numero pezzi errato`);
  for (const part of parts) {
    const mesh = new M.Mesh({ numProp: 3, vertProperties: part.mesh.positions, triVerts: part.mesh.indices });
    mesh.merge();
    const solid = new M.Manifold(mesh);
    try {
      if (solid.status() !== 'NoError' || solid.volume() <= 0) fail(`${label}: mesh non valida`);
      if (part.id === 'base' && Math.abs(solid.boundingBox().min[2]) > 1e-3) fail(`${label}: base sollevata`);
      // Il foro del disegno deve restare vuoto nel motivo e attraversare la sagoma.
      if (part.id !== 'base' || svgUse === 'shape') {
        const probe = M.Manifold.cylinder(20, 1, -1, 12);
        const hit = solid.intersect(probe);
        if (hit.volume() > 1e-5) fail(`${label}: foro SVG perso`);
        hit.delete(); probe.delete();
      }
    } finally { solid.delete(); }
  }
  if (!unzipSync(to3MF(parts))['3D/3dmodel.model'] || toSTL(parts).length < 84) fail(`${label}: export non valido`);
}
const volumeOf = (parts: import('@bdl/geometry').Part[]) => parts.reduce((sum, part) => {
  const mesh = new M.Mesh({ numProp: 3, vertProperties: part.mesh.positions, triVerts: part.mesh.indices });
  mesh.merge();
  const solid = new M.Manifold(mesh);
  try { return sum + solid.volume(); } finally { solid.delete(); }
}, 0);
const blankVolume = volumeOf(buildCoaster(M, { ...DEFAULTS, pattern: 'none' }).parts);
for (const patternMode of ['inlay', 'engrave', 'relief'] as const) {
  const volume = volumeOf(buildCoaster(M, { ...DEFAULTS, svgUse: 'decoration', patternMode }, artwork).parts);
  if (patternMode === 'inlay' && Math.abs(volume - blankVolume) > 0.01) fail('svg: intarsio non riempie esattamente l’incavo');
  if (patternMode === 'engrave' && volume >= blankVolume - 1) fail('svg: incisione non asporta materiale');
  if (patternMode === 'relief' && volume <= blankVolume + 1) fail('svg: rilievo non aggiunge materiale');
}

try {
  buildCoaster(M, { ...DEFAULTS, svgUse: 'shape' }, { name: 'separati.svg', shapes: [
    [[[-0.5, -0.5], [-0.3, -0.5], [-0.3, -0.3], [-0.5, -0.3]]],
    [[[0.3, 0.3], [0.5, 0.3], [0.5, 0.5], [0.3, 0.5]]],
  ] });
  fail('svg: sagoma disconnessa accettata');
} catch (error) {
  if (!(error instanceof Error) || !error.message.includes('connessa')) fail('svg: errore inatteso per sagoma disconnessa');
}

const lines = { name: 'linee.svg', filledShapes: [], shapes: [[[
  [-0.5, -0.05], [0.5, -0.05], [0.5, 0.05], [-0.5, 0.05],
]]] } as import('../apps/coaster/src/svg.ts').SvgArtwork;
for (const patternMode of ['inlay', 'relief', 'engrave'] as const) {
  runs++;
  const parts = buildCoaster(M, { ...DEFAULTS, svgUse: 'decoration', patternMode }, lines).parts;
  if (parts.length !== (patternMode === 'engrave' ? 1 : 2) || volumeOf(parts) <= 0) fail('svg: decorazione da linee non valida');
}
try {
  buildCoaster(M, { ...DEFAULTS, svgUse: 'shape' }, lines);
  fail('svg: sagoma senza riempimento accettata');
} catch (error) {
  if (!(error instanceof Error) || !error.message.includes('aree piene')) fail('svg: errore inatteso per linee come sagoma');
}

const twoElements = { name: 'due.svg', shapes: [
  [[[-0.4, -0.1], [-0.2, -0.1], [-0.2, 0.1], [-0.4, 0.1]]],
  [[[0.2, -0.1], [0.4, -0.1], [0.4, 0.1], [0.2, 0.1]]],
] } as import('../apps/coaster/src/svg.ts').SvgArtwork;
for (const patternMode of ['inlay', 'relief', 'engrave'] as const) {
  runs++;
  const parts = buildCoaster(M, { ...DEFAULTS, svgUse: 'decoration', patternMode }, twoElements).parts;
  if (parts.length !== (patternMode === 'engrave' ? 1 : 3)) fail(`svg/${patternMode}: elementi non separati`);
  const original = parts.map((part) => new Float32Array(part.mesh.positions));
  const arranged = separateParts(parts);
  for (let i = 0; i < parts.length; i++) {
    const grounded = groundPart(parts[i]);
    if (Math.abs(bounds([grounded]).min[2]) > 1e-5 || Math.abs(bounds([arranged[i]]).min[2]) > 1e-5) fail('svg: pezzo separato non poggia sul piano');
    if (parts[i].mesh.positions.some((value, k) => value !== original[i][k])) fail('svg: vista separata modifica l’assemblato');
    const mesh = new M.Mesh({ numProp: 3, vertProperties: grounded.mesh.positions, triVerts: grounded.mesh.indices });
    mesh.merge(); const solid = new M.Manifold(mesh);
    if (solid.status() !== 'NoError' || solid.volume() <= 0) fail('svg: pezzo separato non valido');
    solid.delete();
    for (let j = 0; j < i; j++) {
      const a = bounds([arranged[i]]), b = bounds([arranged[j]]);
      if (a.min[0] < b.max[0] && a.max[0] > b.min[0] && a.min[1] < b.max[1] && a.max[1] > b.min[1]) fail('svg: pezzi separati sovrapposti');
    }
  }
  const model = strFromU8(unzipSync(to3MF(arranged))['3D/3dmodel.model']);
  if ((model.match(/<mesh>/g) ?? []).length !== parts.length) fail('svg: 3MF perde oggetti separati');
}

const legacySvg = '<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 20010904//EN" "http://www.w3.org/TR/2001/REC-SVG-20010904/DTD/svg10.dtd"><svg/>';
if (stripSvgDoctype(legacySvg) !== '<svg/>') fail('svg: DOCTYPE standard non rimosso');
try {
  stripSvgDoctype('<!DOCTYPE svg [<!ENTITY example "value">]><svg/>');
  fail('svg: entità XML accettate');
} catch { /* Le entità personalizzate non fanno parte dei tracciati SVG supportati. */ }

// Clicker: i pezzi restano chiusi, sede e croce aperte, corsa libera di 4 mm.
for (const shape of ['square', 'round', 'hex', 'artwork'] as const)
for (const mode of ['inlay', 'relief', 'engrave'] as const)
for (const switches of [1, 2, 3])
for (const compact of [false, true]) {
  runs++;
  const p = sanitizeKeycap({ ...KEYCAP_DEFAULTS, shape, mode, switches, compact, size: 18, keychain: true });
  // Un anello ha il centro vuoto: il nucleo strutturale deve comunque reggere il socket.
  const res = buildKeycap(M, p, artwork);
  const solids = res.parts.map((part) => {
    const mesh = new M.Mesh({ numProp: 3, vertProperties: part.mesh.positions, triVerts: part.mesh.indices });
    mesh.merge(); const m = new M.Manifold(mesh);
    if (m.status() !== 'NoError' || m.volume() <= 0) fail(`clicker/${shape}/${mode}/${switches}/${part.id}: mesh non valida`);
    return m;
  });
  try {
    const base = solids[res.parts.findIndex((part) => part.id === 'base')];
    const cap = solids[res.parts.findIndex((part) => part.id === 'cap')];
    const pressed = cap.translate([0, 0, -4]);
    const hit = base.intersect(pressed);
    if (hit.volume() > 0.001) fail(`clicker/${shape}/${mode}/${switches}: pulsante collide con base durante la corsa`);
    hit.delete(); pressed.delete();
    for (let i = 0; i < switches; i++) {
      const x = (i - (switches - 1) / 2) * p.spacing;
      const stemProbe = M.Manifold.cylinder(3.5, 0.4, -1, 12);
      const stemAt = stemProbe.translate([x, 0, (compact ? 12.4 : 13.4)]);
      const stemHit = cap.intersect(stemAt);
      if (stemHit.volume() > 0.001) fail('clicker: socket MX chiuso');
      stemHit.delete(); stemAt.delete(); stemProbe.delete();
      const seatProbe = M.Manifold.cylinder(8, 1, -1, 12);
      const seatAt = seatProbe.translate([x, 0, compact ? 1.1 : 1.9]);
      const seatHit = base.intersect(seatAt);
      if (seatHit.volume() > 0.001) fail('clicker: sede switch chiusa');
      seatHit.delete(); seatAt.delete(); seatProbe.delete();
    }
    if (Math.abs(bounds(res.parts.filter((part) => part.id === 'base')).min[2]) > 0.001) fail('clicker: base sollevata');
    const model = strFromU8(unzipSync(to3MF(res.parts))['3D/3dmodel.model']);
    if ((model.match(/<mesh>/g) ?? []).length !== res.parts.length) fail('clicker: export perde pezzi');
    const printParts = printKeycapAssembly(res.parts, p.size);
    const printModel = strFromU8(unzipSync(to3MF(printParts))['3D/3dmodel.model']);
    if ((printModel.match(/<mesh>/g) ?? []).length !== res.parts.length || printModel.includes('NaN')) fail('clicker: 3MF di stampa non valido');
    for (const part of res.parts) {
      const ready = printKeycapPart(part);
      if (Math.abs(bounds([ready]).min[2]) > 0.001) fail('clicker: STL separato non sul piano');
      if (Math.abs(volumeOf([ready]) - volumeOf([part])) > 0.01) fail('clicker: orientazione cambia il volume o inverte le facce');
    }
  } finally { solids.forEach((m) => m.delete()); }
}
for (const stemFit of [-0.1, 0.35]) {
  runs++;
  const p = sanitizeKeycap({ ...KEYCAP_DEFAULTS, product: 'keycap', stemFit, switches: 3, size: NaN });
  const result = buildKeycap(M, p);
  if (result.parts.length !== 1 || p.switches !== 1 || volumeOf(result.parts) <= 0) fail('keycap: parametri/export non validi');
}
const fitTiles = buildFitTest(M, 0, KEYCAP_DEFAULTS.capColor);
if (fitTiles.length !== 5 || fitTiles.some((part) => Math.abs(bounds([part]).min[2]) > 0.001) || volumeOf(fitTiles) <= 0) fail('MX: campioni non validi');
// Tracciamento raster: il foro bianco centrale deve sopravvivere alla conversione.
const raster = { width: 3, height: 3, data: new Uint8ClampedArray(36) };
for (let i = 0; i < 9; i++) { raster.data[i * 4 + 3] = 255; if (i === 4) raster.data.fill(255, i * 4, i * 4 + 4); }
const traced = traceRaster(raster, 'ring.png', 180);
const rasterPieces = traced.shapes.map((rings) => M.CrossSection.ofPolygons(rings, 'EvenOdd'));
const ring = M.CrossSection.union(rasterPieces);
if (Math.abs(ring.area() - 8 / 9) > 0.001) fail('clicker: tracciamento raster perde il foro');
ring.delete(); rasterPieces.forEach((piece) => piece.delete());

// Blocchi: forma unica, switch decentrati, occhielli alle quattro direzioni,
// corsa libera e assenza di sovrapposizioni nel piatto esportato.
for (const blockShape of ['square', 'round', 'hex'] as const)
for (const compact of [false, true])
for (const loopAngle of [-90, 0, 90, 180]) {
  runs++;
  const p = sanitizeKeycap({ ...KEYCAP_DEFAULTS, shape: 'blocks', compact, keychain: true, loopAngle, loopHole: 8, switchX: 8, switchY: -3,
    blockData: JSON.stringify([
      { shape: blockShape, width: 44, height: 38, x: 8, y: -3, angle: 15 },
      { shape: 'square', width: 24, height: 18, x: -12, y: 0, angle: -25 },
    ]) });
  const result = buildKeycap(M, p);
  for (const part of result.parts) {
    const mesh = new M.Mesh({ numProp: 3, vertProperties: part.mesh.positions, triVerts: part.mesh.indices }); mesh.merge();
    const m = new M.Manifold(mesh);
    try {
      const pieces = m.decompose();
      if (m.status() !== 'NoError' || m.volume() <= 0 || pieces.length !== 1) fail('blocks: corpo o occhiello non solidale');
      pieces.forEach((piece) => piece.delete());
    } finally { m.delete(); }
  }
  const printed = printKeycapAssembly(result.parts, p.size);
  const base = bounds(printed.filter((part) => part.id === 'base'));
  const cap = bounds(printed.filter((part) => part.id === 'cap'));
  if (cap.min[0] < base.max[0] + 9.9) fail('blocks: base e pulsante si sovrappongono nel 3MF');
  const make = (part: import('@bdl/geometry').Part) => { const mesh = new M.Mesh({ numProp: 3, vertProperties: part.mesh.positions, triVerts: part.mesh.indices }); mesh.merge(); return new M.Manifold(mesh); };
  const baseSolid = make(result.parts.find((part) => part.id === 'base')!);
  const capSolid = make(result.parts.find((part) => part.id === 'cap')!);
  const pressed = capSolid.translate([0, 0, -4]); const hit = baseSolid.intersect(pressed);
  if (hit.volume() > 0.001) fail('blocks: corsa impedita');
  hit.delete(); pressed.delete(); baseSolid.delete(); capSolid.delete();
}
for (const [blocks, switchX] of [
  [[{ shape: 'square', width: 30, height: 30, x: 0, y: 0, angle: 0 }, { shape: 'round', width: 20, height: 20, x: 50, y: 0, angle: 0 }], 0],
  [[{ shape: 'square', width: 30, height: 30, x: 0, y: 0, angle: 0 }], 40],
] as const) {
  try { buildKeycap(M, { ...KEYCAP_DEFAULTS, shape: 'blocks', blockData: JSON.stringify(blocks), switchX }); fail('blocks: configurazione non stampabile accettata'); }
  catch (error) { if (!(error instanceof Error) || !/blocchi|switch/.test(error.message)) fail('blocks: errore inatteso'); }
}

// Tasti indipendenti: conteggio, base continua, corsa e registrazione degli intarsi.
for (const count of [1, 4, 8]) for (const keyLayout of ['horizontal', 'vertical'] as const)
for (const mode of ['inlay', 'relief', 'engrave'] as const) {
  runs++;
  const p = { ...KEYCAP_DEFAULTS, shape: 'keys' as const, size: 22, keyLayout, mode, keychain: true, keyLabels: JSON.stringify(Array(count).fill('A')) };
  const art = { name: 'A', shapes: [[[[ -0.2, -0.3 ], [0.2, -0.3], [0.2, 0.3], [-0.2, 0.3]]]] } as import('../apps/coaster/src/svg.ts').SvgArtwork;
  const result = buildKeycap(M, p, undefined, Array(count).fill(art));
  if (result.parts.filter((p) => p.id.startsWith('cap-')).length !== count) fail('keys: numero pulsanti errato');
  const solids = result.parts.map((part) => { const mesh = new M.Mesh({ numProp: 3, vertProperties: part.mesh.positions, triVerts: part.mesh.indices }); mesh.merge(); return new M.Manifold(mesh); });
  const base = solids[0];
  const components = base.decompose(); if (components.length !== 1) fail('keys: base separata'); components.forEach((m) => m.delete());
  solids.forEach((m, i) => {
    if (m.status() !== 'NoError' || m.volume() <= 0) fail('keys: mesh invalida');
    if (result.parts[i].id.startsWith('cap-')) { const pressed = m.translate([0, 0, -4]); const overlap = pressed.intersect(base); if (overlap.volume() > 0.001) fail('keys: collisione durante corsa'); overlap.delete(); pressed.delete(); }
  });
  const printed = printKeycapAssembly(result.parts, 22);
  if (bounds(printed.filter((p) => p.id !== 'base')).min[0] - bounds([printed[0]]).max[0] < 9.9) fail('keys: export sovrapposto');
  if (to3MF(printed).length < 1000) fail('keys: export vuoto');
  solids.forEach((m) => m.delete());
}

// Scatola scorrevole: mesh, vani, scorrimento e orientamento degli export.
for (const dims of [[40,35,18], [110,75,40], [220,180,130]])
for (const radius of [2,20]) for (const clearance of [0.15,0.5]) for (const ribbed of [false,true]) for (const wall of [2,4]) {
  runs++;
  const { buildBox } = await import('../apps/box/src/geometry.ts');
  const { DEFAULTS, sanitize } = await import('../apps/box/src/params.ts');
  const { printParts } = await import('../apps/box/src/parts.ts');
  const p = sanitize({ ...DEFAULTS, width:dims[0], depth:dims[1], height:dims[2], radius, clearance, ribbed, wall, floor:4, columns:3, rows:3 });
  const result = buildBox(M,p);
  const solids = result.parts.map((part) => { const mesh = new M.Mesh({ numProp:3,vertProperties:part.mesh.positions,triVerts:part.mesh.indices }); mesh.merge(); return new M.Manifold(mesh); });
  solids.forEach((m) => { if (m.status() !== 'NoError' || m.volume() <= 0) fail('box: mesh invalida'); const c=m.decompose(); if(c.length!==1)fail('box: pezzo separato');c.forEach((m)=>m.delete()); });
  for (const shift of [0,1,5,p.width/4,p.width/2,p.width]) { const lid=solids[1].translate([shift,0,0]);const overlap=lid.intersect(solids[0]);if(overlap.volume()>0.001)fail(`box: collisione coperchio ${dims}/${radius}/${clearance}/${shift}: ${overlap.volume()}`);overlap.delete();lid.delete(); }
  const printed = printParts(result.parts);
  for (const part of printed) if(Math.abs(bounds([part]).min[2])>0.001)fail('box: export sospeso');
  const overlapX = Math.min(bounds([printed[0]]).max[0],bounds([printed[1]]).max[0])-Math.max(bounds([printed[0]]).min[0],bounds([printed[1]]).min[0]);
  const overlapY = Math.min(bounds([printed[0]]).max[1],bounds([printed[1]]).max[1])-Math.max(bounds([printed[0]]).min[1],bounds([printed[1]]).min[1]);
  if(overlapX>0 && overlapY>0)fail('box: export sovrapposto');
  if(to3MF(printed).length<1000 || toSTL([printed[0]]).length<1000)fail('box: export vuoto');
  solids.forEach((m)=>m.delete());
}

// Decorazioni su tutte le superfici e distribuzione automatica sui piatti.
{
  const { buildBox } = await import('../apps/box/src/geometry.ts');
  const { DEFAULTS } = await import('../apps/box/src/params.ts');
  const { packPlates } = await import('../apps/box/src/parts.ts');
  const art = {name:'Due isole', shapes:[[[[-0.4,-0.3],[-0.1,-0.3],[-0.1,0.3],[-0.4,0.3]]],[[[0.1,-0.3],[0.4,-0.3],[0.4,0.3],[0.1,0.3]]]]} as import('../apps/coaster/src/svg.ts').SvgArtwork;
  for(const face of ['lid','front','back','left','right'] as const) for(const mode of ['inlay','relief','engrave'] as const) for(const ribbed of [false,true]) {
    runs++;
    const result=buildBox(M,{...DEFAULTS,ribbed,dividers:false,columns:4,rows:4},[{id:1,face,mode,size:15,u:0,v:0,angle:25,depth:0.8,color:'#ffbb00',artwork:art}]);
    if(result.parts.length!==(mode==='engrave'?2:4))fail(`box decor ${face}/${mode}: conteggio pezzi`);
    const solids=result.parts.map(part=>{const mesh=new M.Mesh({numProp:3,vertProperties:part.mesh.positions,triVerts:part.mesh.indices});mesh.merge();return new M.Manifold(mesh);});
    solids.forEach(m=>{if(m.status()!=='NoError'||m.volume()<=0)fail('box decor: mesh invalida');});
    for(let i=2;i<solids.length;i++){const hit=solids[i].intersect(solids[face==='lid'?1:0]);if(hit.volume()>0.001)fail('box decor: intarsio sovrapposto al supporto');hit.delete();}
    for(const size of [100,160,256]) {
      const packed=packPlates(result.parts,size,size);
      const count=packed.plates.reduce((n,parts)=>n+parts.length,0)+packed.oversized.length;
      if(count!==result.parts.length)fail('box piatti: pezzi persi');
      for(const plate of packed.plates){
        const bb=plate.map(part=>bounds([part]));
        bb.forEach(b=>{if(b.min[0]<-size/2+4.99||b.min[1]<-size/2+4.99||b.max[0]>size/2-4.99||b.max[1]>size/2-4.99||Math.abs(b.min[2])>0.001)fail('box piatti: fuori dal piatto');});
        for(let i=0;i<bb.length;i++)for(let j=i+1;j<bb.length;j++)if(Math.min(bb[i].max[0],bb[j].max[0])-Math.max(bb[i].min[0],bb[j].min[0])>0.001&&Math.min(bb[i].max[1],bb[j].max[1])-Math.max(bb[i].min[1],bb[j].min[1])>0.001)fail('box piatti: pezzi sovrapposti');
        if(to3MF(plate,{plateCenter:[size/2,size/2]}).length<1000)fail('box piatti: export vuoto');
      }
      if(size===256&&packed.plates.length!==1)fail('box piatti: modello piccolo non compatto');
      if(size===160&&packed.plates.length<2)fail('box piatti: overflow non distribuito');
    }
    solids.forEach(m=>m.delete());
  }
}

// Posizioni manuali: geometria rigida, permanenza dopo modifiche e avvisi.
{
  const {buildBox}=await import('../apps/box/src/geometry.ts');
  const {DEFAULTS}=await import('../apps/box/src/params.ts');
  const {arrange,placePart,currentPlacement,validatePlacements,center}=await import('../apps/box/src/placement.ts');
  const {packPlates}=await import('../apps/box/src/parts.ts');
  const parts=buildBox(M,DEFAULTS).parts;
  for(const angle of [-180,-45,0,90,135]) {
    runs++;
    const positions={body:{x:25,y:-20,angle,plate:1},lid:{x:-30,y:30,angle:0,plate:0}};
    const layout=arrange(parts,350,350,positions);
    const moved=layout.plates[1].find(p=>p.id==='body')!, c=center(moved);
    if(Math.abs(c.x-25)>0.001||Math.abs(c.y+20)>0.001||Math.abs(bounds([moved]).min[2])>0.001)fail('manual: posizione o appoggio errati');
    const inferred=currentPlacement(moved,parts[0],1), reconstructed=placePart(parts[0],inferred);
    if(reconstructed.mesh.positions.some((v,i)=>Math.abs(v-moved.mesh.positions[i])>0.002))fail('manual: rotazione persa');
    const after=arrange(buildBox(M,{...DEFAULTS,width:120,height:55}).parts,350,350,positions);
    const retained=center(after.plates[1].find(p=>p.id==='body')!);
    if(Math.abs(retained.x-25)>0.001||Math.abs(retained.y+20)>0.001)fail('manual: posizione persa modificando misure');
    if(JSON.stringify(validatePlacements(JSON.parse(JSON.stringify(positions))))!==JSON.stringify(positions))fail('manual: salvataggio posizioni');
    const mesh=new M.Mesh({numProp:3,vertProperties:moved.mesh.positions,triVerts:moved.mesh.indices});mesh.merge();const solid=new M.Manifold(mesh);if(solid.status()!=='NoError'||solid.volume()<=0)fail('manual: trasformazione invalida');solid.delete();
    const xml=strFromU8(unzipSync(to3MF(layout.plates[1]))['3D/3dmodel.model']);if(!xml.includes('Corpo scatola'))fail('manual: export perde il pezzo');
  }
  runs++;
  if(!arrange(parts,256,256,{body:{x:200,y:0,angle:0,plate:0}}).warnings.length)fail('manual: manca avviso fuori piatto');
  if(!arrange(parts,256,256,{body:{x:0,y:0,angle:0,plate:0},lid:{x:0,y:0,angle:0,plate:0}}).warnings.some(w=>w.includes('sovrapposti')))fail('manual: manca avviso sovrapposizione');
  const auto=packPlates(parts,256,256);
  for(const plate of auto.plates)for(const p of plate){const restored=placePart(parts.find(s=>s.id===p.id)!,currentPlacement(p,parts.find(s=>s.id===p.id)!,0));if(restored.mesh.positions.some((v,i)=>Math.abs(v-p.mesh.positions[i])>0.002))fail('manual: primo spostamento altera orientamento automatico');}
  for(const bad of [{body:{x:NaN,y:0,angle:0,plate:0}},{body:{x:0,y:0,angle:0,plate:100}},{invalid:{x:0,y:0,angle:0,plate:0}}]){try{validatePlacements(bad);fail('manual: progetto invalido accettato');}catch{}}
}

// Testo fuori dal centro: cinque superfici, posizioni e conservazione delle coordinate.
{
  const {positionOnFace}=await import('../apps/box/src/decoration.ts');
  const {buildBox}=await import('../apps/box/src/geometry.ts');
  const {DEFAULTS}=await import('../apps/box/src/params.ts');
  const artwork={name:'Testo',shapes:[[[[-0.5,-0.2],[0.5,-0.2],[0.5,0.2],[-0.5,0.2]]]]} as import('../apps/coaster/src/svg.ts').SvgArtwork;
  for(const face of ['lid','front','back','left','right'] as const)for(const position of ['left','right','top','bottom','center'] as const){
    runs++;
    const decoration={id:1,face,mode:'relief' as const,size:20,u:0,v:0,angle:25,depth:0.6,color:'#ddbb00',artwork};
    const uv=positionOnFace(decoration,DEFAULTS,position);
    if((position==='left'&&uv.u>=0)||(position==='right'&&uv.u<=0)||(position==='top'&&uv.v<=0)||(position==='bottom'&&uv.v>=0))fail('box testo: posizione rimasta centrale');
    const result=buildBox(M,DEFAULTS,[{...decoration,...uv}]);
    if(result.parts.length!==3||result.warnings.length)fail('box testo: preset taglia il disegno');
    const b=bounds([result.parts[2]]),x=(b.min[0]+b.max[0])/2,y=(b.min[1]+b.max[1])/2,z=(b.min[2]+b.max[2])/2;
    const actualU=face==='lid'||face==='front'?x:face==='back'?-x:face==='left'?-y:y;
    const actualV=face==='lid'?y:z-DEFAULTS.height/2;
    if(Math.abs(actualU-uv.u)>0.001||Math.abs(actualV-uv.v)>0.001)fail('box testo: coordinate non applicate alla superficie');
    const changed=buildBox(M,DEFAULTS,[{...decoration,...uv,artwork:{...artwork,name:'Nuovo testo'}}]);
    if(changed.parts[2].mesh.positions.some((v,i)=>Math.abs(v-result.parts[2].mesh.positions[i])>0.001))fail('box testo: nuova scritta ricentrata');
  }
}

// Modelli e accoppiamenti nuovi: solidi, collisioni, letti e compatibilità dei piedi.
{
  const {buildBox}=await import('../apps/box/src/geometry.ts');
  const {DEFAULTS,sanitize}=await import('../apps/box/src/params.ts');
  const {gridSegments}=await import('../apps/box/src/gridfinity.ts');
  const {printable,packPlates}=await import('../apps/box/src/parts.ts');
  const solid=(part:import('@bdl/geometry').Part)=>{const mesh=new M.Mesh({numProp:3,vertProperties:part.mesh.positions,triVerts:part.mesh.indices});mesh.merge();return new M.Manifold(mesh);};
  for(const model of ['sliding','stackable','drawer'] as const)for(const radius of [0,6])for(const gridfinity of [false,true])for(const stackLid of [false,true]) {
    runs++;const p=sanitize({...DEFAULTS,model,radius,gridfinity,stackLid,gridColumns:2,gridRows:2});
    const result=buildBox(M,p);const solids=result.parts.map(solid);
    for(const m of solids){const components=m.decompose();if(m.status()!=='NoError'||m.volume()<=0||components.length!==1)fail(`box ${model}: solido o connessione invalida`);components.forEach(c=>c.delete());}
    for(let i=0;i<solids.length;i++)for(let j=i+1;j<solids.length;j++){const hit=solids[i].intersect(solids[j]);if(hit.volume()>0.02)fail(`box ${model}/${radius}/${gridfinity}: collisione ${result.parts[i].id}/${result.parts[j].id} ${hit.volume()}`);hit.delete();}
    for(const part of result.parts){const printed=printable(part);if(Math.abs(bounds([printed]).min[2])>0.001)fail('box nuovo: pezzo sospeso sul piatto');if(part.id==='case'){const back=bounds([part]).max[1];for(let i=0;i<part.mesh.positions.length;i+=3)if(Math.abs(part.mesh.positions[i+1]-back)<0.001&&Math.abs(printed.mesh.positions[i+2])>0.001)fail('cassetto: involucro non appoggiato sul retro');}}
    const packed=packPlates(result.parts,p.plateWidth,p.plateDepth);if(packed.oversized.length)fail('box nuovo: modello piccolo fuori piatto');
    if(to3MF(packed.plates[0]).length<1000)fail('box nuovo: export vuoto');
    solids.forEach(m=>m.delete());
  }
  for(const model of ['stackable','drawer'] as const)for(const face of ['lid','front','back','left','right'] as const)for(const mode of ['relief','inlay','engrave'] as const){
    runs++;const result=buildBox(M,{...DEFAULTS,model,stackLid:true},[{id:1,face,mode,size:8,u:15,v:-5,angle:0,depth:0.4,color:'#d4a429',artwork:{name:'Quadro',shapes:[[[[-0.5,-0.5],[0.5,-0.5],[0.5,0.5],[-0.5,0.5]]]]}}]);
    const solids=result.parts.map(solid);for(const m of solids){if(m.status()!=='NoError'||m.volume()<=0)fail('box nuovi: decorazione invalida');m.delete();}
  }
  runs++;const p=sanitize({...DEFAULTS,model:'stackable',ribbed:false,radius:0});const a=buildBox(M,p);const lower=solid(a.parts[0]),upper=lower.translate([0,0,p.height]);const intersection=lower.intersect(upper);if(intersection.volume()>0.001)fail('box impilabile: collisione tra due scatole');intersection.delete();upper.delete();lower.delete();
  // Due scatole Gridfinity impilate: i piedi entrano nel bordo superiore senza collisioni.
  for(const wall of [2,2.4,4])for(const radius of [0,3.75]) {
    runs++;const p=sanitize({...DEFAULTS,gridfinity:true,gridOutput:'box',model:'stackable',wall,radius,gridColumns:2,gridRows:2});
    const result=buildBox(M,p),lower=solid(result.parts[0]);
    const socketWidth=41.5-2*Math.min(wall,2.4)+1.6;
    const seat=socketWidth>=37.2?2.6+(socketWidth-37.2)/2:(socketWidth-35.6)/2;
    // Mantiene un piccolo gioco verticale rispetto al contatto teorico sugli smussi.
    const upper=lower.translate([0,0,p.height+4.75-seat+0.05]);const hit=lower.intersect(upper);
    if(hit.volume()>0.02)fail(`grid impilabile: collisione ${wall}/${radius}: ${hit.volume()}`);
    hit.delete();upper.delete();lower.delete();
  }
  for(const model of ['sliding','stackable','drawer'] as const)for(const height of [18,130])for(const wall of [2,4]) {
    runs++;const p=sanitize({...DEFAULTS,model,height,wall,floor:4,width:40,depth:35,radius:0,columns:6,rows:6,stackLid:true});
    for(const part of buildBox(M,p).parts){const m=solid(part),c=m.decompose();if(m.status()!=='NoError'||m.volume()<=0||c.length!==1)fail(`box ${model}: misure estreme`);c.forEach(x=>x.delete());m.delete();}
  }
  for(const plateSize of [100,180,256]) {
    runs++;const p=sanitize({...DEFAULTS,gridfinity:true,gridOutput:'grid',gridColumns:8,gridRows:6,plateWidth:plateSize,plateDepth:plateSize});
    const segments=gridSegments(p),result=buildBox(M,p);if(segments.reduce((n,g)=>n+g.columns*g.rows,0)!==48)fail('grid: celle perse');
    const packed=packPlates(result.parts,plateSize,plateSize);if(packed.oversized.length||packed.plates.flat().length!==result.parts.length)fail('grid: segmenti oltre piatto');
    const solids=result.parts.map(solid);
    for(const [i,g] of segments.entries()) {
      const bounds=solids[i].boundingBox();
      if(Math.abs(bounds.max[2]-5)>0.01||Math.abs(bounds.min[2])>0.01)fail('grid: altezza diversa da 5 mm');
      for(let y=0;y<g.rows;y++)for(let x=0;x<g.columns;x++) {
        const probe=M.Manifold.cube([30,30,7]).translate([(g.x+x+0.5-p.gridColumns/2)*42-15,(g.y+y+0.5-p.gridRows/2)*42-15,-1]);
        const hit=solids[i].intersect(probe);
        if(hit.volume()>0.001)fail('grid: fondo pieno nella cella');
        hit.delete();probe.delete();
      }
    }
    for(let i=0;i<solids.length;i++)for(let j=i+1;j<solids.length;j++){const hit=solids[i].intersect(solids[j]);if(hit.volume()>0.01)fail('grid: code di rondine in collisione');hit.delete();}
    for(const m of solids){const c=m.decompose();if(m.status()!=='NoError'||c.length!==1)fail('grid: sezioni scollegate');c.forEach(x=>x.delete());m.delete();}
  }
}


// Portachiavi: forma, tecniche, foro passante, componenti e QR con margine.
const chainArt={name:'Test',shapes:[[[[-.4,-.15],[.4,-.15],[.4,.15],[-.4,.15]]]],filledShapes:[[[[-.4,-.15],[.4,-.15],[.4,.15],[-.4,.15]]]]} as import('../apps/coaster/src/svg.ts').SvgArtwork;
for(const model of ['name','initial','svg','qr','jersey','music'] as const)for(const mode of ['relief','inlay','engrave'] as const)for(const shape of ['square','round','svg'] as const){
 runs++;const q=qrArtwork('https://example.com/è');const p=sanitizeChain({...CHAIN_DEFAULTS,model,mode,shape});
 const result=buildKeychain(M,p,{main:model==='qr'?q.artwork:chainArt,initial:chainArt,number:chainArt,team:chainArt,qrModules:q.modules,cover:chainArt});
 const solids=result.parts.map(part=>{const mesh=new M.Mesh({numProp:3,vertProperties:part.mesh.positions,triVerts:part.mesh.indices});mesh.merge();return new M.Manifold(mesh);});
 for(const solid of solids)if(solid.status()!=='NoError'||solid.volume()<=0)fail(`keychain/${model}/${mode}/${shape}: mesh invalida`);
 const base=solids[0],components=base.decompose();if(components.length!==1)fail(`keychain/${model}: base scollegata`);components.forEach(c=>c.delete());
 if(Math.abs(base.boundingBox().min[2])>.001)fail('keychain: base sollevata');
 for(let i=0;i<solids.length;i++)for(let j=i+1;j<solids.length;j++){const hit=solids[i].intersect(solids[j]);if(hit.volume()>.001)fail(`keychain/${model}: pezzi sovrapposti`);hit.delete();}
 solids.forEach(c=>c.delete());
}
// I campi vuoti escludono davvero gli elementi: nessuna scritta o lettera predefinita.
for(const [text,initial] of [['','B'],['Nome',''],['Nome','B']])for(const shape of ['svg','round'] as const)for(const mode of ['relief','inlay','engrave'] as const){
 runs++;const result=buildKeychain(M,{...CHAIN_DEFAULTS,model:'initial',text,initial,shape,mode},{main:chainArt,initial:chainArt});
 if(!text&&result.parts.some(p=>p.id.startsWith('Decorazione')))fail('iniziale: nome vuoto genera scritte');
 if(!initial&&result.parts.some(p=>p.id.startsWith('Iniziale')))fail('iniziale: lettera vuota genera una lettera');
 if(!text&&shape==='svg'&&result.parts.length!==1)fail('iniziale: la lettera sola deve essere un corpo senza scritte');
 const mounted=assemblySeats(M,result.parts);
 for(const part of mounted){const mesh=new M.Mesh({numProp:3,vertProperties:part.mesh.positions,triVerts:part.mesh.indices});mesh.merge();const solid=new M.Manifold(mesh);if(solid.status()!=='NoError'||solid.volume()<=0)fail('iniziale: corpo non stampabile');solid.delete();}
}
try{buildKeychain(M,{...CHAIN_DEFAULTS,model:'initial',initial:' ',text:' '},{main:chainArt,initial:chainArt});fail('iniziale: campi vuoti accettati');}catch(e){if(!(e instanceof Error)||!e.message.includes('Scrivi una lettera'))throw e;}

const badChain=sanitizeChain({...CHAIN_DEFAULTS,width:NaN,depth:Infinity,relief:100,baseColor:'bad'});
if(badChain.width!==CHAIN_DEFAULTS.width||badChain.depth!==CHAIN_DEFAULTS.depth||badChain.relief>badChain.thickness-.8||badChain.baseColor!=='#ff4b16')fail('keychain: sanitize');


for(const jerseyPattern of ['solid','vertical','horizontal','half','diagonal','broad','sides'])for(const mode of ['relief','inlay','engrave'] as const)for(const loop of [true,false]){
 runs++;const result=buildKeychain(M,{...CHAIN_DEFAULTS,model:'jersey',width:45,depth:60,jerseyPattern,mode,loop,textOutline:true},{main:chainArt,number:chainArt,team:chainArt});
 const solids=result.parts.map(part=>{const mesh=new M.Mesh({numProp:3,vertProperties:part.mesh.positions,triVerts:part.mesh.indices});mesh.merge();return new M.Manifold(mesh);});
 for(const m of solids)if(m.status()!=='NoError'||m.volume()<=0)fail('jersey: geometria non valida');
 for(let i=0;i<solids.length;i++)for(let j=i+1;j<solids.length;j++){const hit=solids[i].intersect(solids[j]);if(hit.volume()>.001)fail('jersey: colori sovrapposti');hit.delete();}
 solids.forEach(m=>m.delete());
}

// Maglia con molte lettere curve: le sedi vengono sottratte tutte insieme.
{
 const circle=M.CrossSection.circle(.025,32),hole=M.CrossSection.circle(.012,32),letter=circle.subtract(hole);
 const contours=Array.from({length:12},(_,i)=>{const c=letter.translate([(i-5.5)*.075,0]);const poly=c.toPolygons();c.delete();return poly;});letter.delete();hole.delete();circle.delete();
 const text={name:'Lettere curve',shapes:contours};
 for(const jerseyPattern of ['vertical','horizontal','sides']){runs++;const original=buildKeychain(M,{...CHAIN_DEFAULTS,model:'jersey',width:45,depth:60,jerseyPattern},{main:text,number:text,team:text}).parts;const mounted=assemblySeats(M,original);for(const p of mounted){const mesh=new M.Mesh({numProp:3,vertProperties:p.mesh.positions,triVerts:p.mesh.indices});mesh.merge();const m=new M.Manifold(mesh);if(m.status()!=='NoError'||m.volume()<=0)fail('maglia: sedi non valide con molte lettere');m.delete();}}
}

// Sedi: sottrazione alla base compensata dall’inserto, senza cambiare la sagoma montata.
for(const mode of ['relief','inlay'] as const){
 const original=buildKeychain(M,{...CHAIN_DEFAULTS,model:'name',mode,loop:false},{main:chainArt,extra:chainArt}).parts;
 const seated=assemblySeats(M,original);runs++;
 const solid=(p:typeof original[number])=>{const mesh=new M.Mesh({numProp:3,vertProperties:p.mesh.positions,triVerts:p.mesh.indices});mesh.merge();return new M.Manifold(mesh);};
 const before=original.map(solid),after=seated.map(solid);
 if(after.some(p=>p.status()!=='NoError'))fail('sedi: mesh non valida');
 if(Math.abs(before.reduce((v,p)=>v+p.volume(),0)-after.reduce((v,p)=>v+p.volume(),0))>.01)fail('sedi: volume montato cambiato');
 if(mode==='relief'&&before[0].volume()-after[0].volume()<1)fail('sedi: solco mancante');
 if(mode==='inlay'&&Math.abs(before[0].volume()-after[0].volume())>.01)fail('sedi: intarsio già incassato modificato');
 for(let i=0;i<after.length;i++)for(let j=i+1;j<after.length;j++){const hit=after[i].intersect(after[j]);if(hit.volume()>.001)fail('sedi: pezzi sovrapposti');hit.delete();}
 [...before,...after].forEach(p=>p.delete());
}
for(const shape of ['square','round','oval','hex','heart'] as const)for(const ringType of ['external','internal'] as const){runs++;const q=qrArtwork('https://example.com');const result=buildKeychain(M,{...CHAIN_DEFAULTS,model:'qr',width:60,depth:60,shape,ringType,qrSize:shape==='heart'?40:60,qrY:shape==='heart'?-4:0},{main:q.artwork,qrModules:q.modules});if(result.parts.length<2)fail('QR: forma senza codice');}
for(const ringType of ['external','internal'] as const){runs++;const q=qrArtwork('https://example.com');buildKeychain(M,{...CHAIN_DEFAULTS,model:'qr',width:45,depth:45,shape:'heart',ringType,qrSize:35,qrY:-2.7},{main:q.artwork,qrModules:q.modules});}
// La base di una lettera con foro deve essere piena, anche con un simbolo vicino.
{runs++;const ring:import('../apps/coaster/src/svg.ts').SvgArtwork={name:'O',shapes:[[[[-.5,-.5],[.5,-.5],[.5,.5],[-.5,.5]],[[-.2,-.2],[-.2,.2],[.2,.2],[.2,-.2]]]]};const result=buildKeychain(M,{...CHAIN_DEFAULTS,model:'name',loop:false,x:12,y:3,angle:25},{main:ring,extra:chainArt});const mesh=new M.Mesh({numProp:3,vertProperties:result.parts[0].mesh.positions,triVerts:result.parts[0].mesh.indices});mesh.merge();const base=new M.Manifold(mesh),probe=M.Manifold.cube([1,1,1],true).translate([12,3,1]);const hit=base.intersect(probe);if(hit.volume()<.99)fail('nome: foro interno alla base');hit.delete();probe.delete();base.delete();}

{
 const solid=(part:import('@bdl/geometry').Part)=>{const mesh=new M.Mesh({numProp:3,vertProperties:part.mesh.positions,triVerts:part.mesh.indices});mesh.merge();return new M.Manifold(mesh);};
 const {buildBox}=await import('../apps/box/src/geometry.ts');const {DEFAULTS:boxDefaults}=await import('../apps/box/src/params.ts');
 const cases=[buildCoaster(M,{...DEFAULTS,svgUse:'decoration',patternMode:'relief'},chainArt).parts,buildKeycap(M,{...KEYCAP_DEFAULTS,mode:'relief'},chainArt).parts,...(['front','back','left','right','lid'] as const).map(face=>buildBox(M,{...boxDefaults,ribbed:false},[{id:1,face,mode:'relief',size:15,u:0,v:0,angle:0,depth:.8,color:'#ffffff',artwork:chainArt}]).parts)];
 for(const original of cases){runs++;const seated=assemblySeats(M,original),a=original.map(solid),b=seated.map(solid);if(!a.some((part,i)=>part.volume()-b[i].volume()>.1))fail('sedi: supporto senza solco');if(b.some(part=>part.status()!=='NoError'||part.volume()<=0))fail('sedi: supporto o inserto invalido');const before=M.Manifold.union(a),after=M.Manifold.union(b);if(Math.abs(before.volume()-after.volume())>.1)fail('sedi: sagoma assemblata differente');before.delete();after.delete();[...a,...b].forEach(p=>p.delete());}
}
console.log(`${runs} combinazioni provate, ${failures} errori`);
process.exit(failures ? 1 : 0);
