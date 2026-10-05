import { Scope, toMeshData, type ManifoldToplevel, type Part, type CrossSection } from '@bdl/geometry';
import { FACE_ROTATION, FACES, validateDecorations, type Decoration } from './decoration.ts';
import { sanitize, type Params } from './params.ts';
/** Scatola con guide e coperchio scorrevole indipendente; tutto in millimetri. */
export function buildBox(M: ManifoldToplevel, input: Params, decorationInput: readonly Decoration[] = []): { parts: Part[]; warnings: string[] } {
  const p = sanitize(input), s = new Scope();
  try {
    const C = M.CrossSection;
    const rect = (w: number, d: number) => s.t(C.square([w, d], true));
    const extrude = (cs: CrossSection, h: number, z = 0) => s.t(s.t(cs.extrude(h)).translate([0, 0, z]));
    const outer = s.t(rect(p.width - 2 * p.radius, p.depth - 2 * p.radius).offset(p.radius, 'Round', 2, 64));
    const inner = s.t(outer.offset(-p.wall, 'Round', 2, 64));
    const track = s.t(outer.offset(-p.wall + 0.8, 'Round', 2, 64));
    const trackZ = p.height - 3.8;
    let body = s.t(extrude(outer, p.height).subtract(extrude(inner, p.height, p.floor)));
    // Guide profonde 0.8 mm, alte 2.4 mm; il tetto resta spesso 1.4 mm.
    body = s.t(body.subtract(extrude(track, 2.4, trackZ)));
    const entry = s.t(rect(2 * (p.radius + p.wall + 2), p.depth - 2 * p.wall + 1.6).translate([p.width / 2, 0]));
    body = s.t(body.subtract(extrude(entry, 5, trackZ)));
    if (p.ribbed) {
      const ribs = [];
      for (let x = -p.width / 2 + p.radius + 3; x <= p.width / 2 - p.radius - 3; x += 7) {
        for (const sign of [-1, 1]) ribs.push(extrude(s.t(rect(2, 1.2).translate([x, sign * (p.depth / 2 + 0.3)])), p.height - 4, 0));
      }
      if (ribs.length) body = s.t(body.add(s.t(M.Manifold.union(ribs))));
    }
    const dividerHeight = trackZ - p.floor - 0.8;
    for (let i = 1; i < (p.dividers ? p.columns : 1); i++) {
      const x = -p.width / 2 + p.wall + i * (p.width - 2 * p.wall) / p.columns;
      const section = s.t(s.t(rect(p.wall, p.depth).translate([x, 0])).intersect(inner));
      body = s.t(body.add(extrude(section, dividerHeight + 0.2, p.floor - 0.2)));
    }
    for (let i = 1; i < (p.dividers ? p.rows : 1); i++) {
      const y = -p.depth / 2 + p.wall + i * (p.depth - 2 * p.wall) / p.rows;
      const section = s.t(s.t(rect(p.width, p.wall).translate([0, y])).intersect(inner));
      body = s.t(body.add(extrude(section, dividerHeight + 0.2, p.floor - 0.2)));
    }
    const lidZ = trackZ + p.clearance;
    const lidOutline = s.t(track.offset(-p.clearance, 'Round', 2, 64));
    let lid = extrude(lidOutline, 1.8, lidZ);
    // Linguetta piatta collegata al coperchio; esce dal lato d'inserimento.
    const tab = s.t(rect(p.wall + 6, 18).translate([p.width / 2 + 0.5, 0]));
    lid = s.t(lid.add(extrude(tab, 1.8, lidZ)));
    const artworkParts: Part[] = [], warnings: string[] = [];
    for (const d of validateDecorations(decorationInput)) {
      const onLid = d.face === 'lid';
      const faceWidth = onLid || d.face === 'front' || d.face === 'back' ? p.width : p.depth;
      const marginX = onLid ? p.radius + p.wall : p.radius + 1;
      const loY = onLid ? -p.depth / 2 + p.radius + p.wall : -p.height / 2 + p.floor + 1;
      const hiY = onLid ? p.depth / 2 - p.radius - p.wall : p.height / 2 - 5;
      const cs = s.t(C.union(d.artwork.shapes.map((rings) => s.t(C.ofPolygons(rings, 'EvenOdd')))));
      const positioned = s.t(s.t(s.t(cs.scale(d.size)).rotate(d.angle)).translate([d.u, d.v]));
      const safe = s.t(rect(faceWidth - 2 * marginX, hiY - loY).translate([0, (hiY + loY) / 2]));
      const clipped = s.t(positioned.intersect(safe));
      if (clipped.isEmpty()) throw new Error(`Decorazione fuori dalla superficie: ${FACES[d.face]}.`);
      if (positioned.area() - clipped.area() > 0.05) warnings.push(`${FACES[d.face]}: disegno ritagliato entro i bordi.`);
      const at: [number,number,number] = onLid ? [0,0,lidZ + 1.8] : d.face === 'front' ? [0,-p.depth/2,p.height/2] : d.face === 'back' ? [0,p.depth/2,p.height/2] : d.face === 'left' ? [-p.width/2,0,p.height/2] : [p.width/2,0,p.height/2];
      const place = (solid: import('@bdl/geometry').Manifold) => s.t(s.t(solid.rotate(FACE_ROTATION[d.face])).translate(at));
      // Una zona piana locale evita che le nervature coprano il disegno.
      if (p.ribbed && (d.face === 'front' || d.face === 'back')) {
        const patch = s.t(clipped.offset(1, 'Round', 2, 32));
        body = s.t(body.subtract(place(extrude(patch, 2, 0))));
      }
      const ink = place(extrude(clipped, d.depth, d.mode === 'relief' ? 0 : -d.depth));
      const target = onLid ? lid : body;
      if (d.mode !== 'relief') {
        const cavity = d.mode === 'inlay' ? place(extrude(s.t(clipped.offset(0.1, 'Round', 2, 32)), d.depth + 0.05, -d.depth - 0.05)) : ink;
        const cut = s.t(target.subtract(cavity));
        if (onLid) lid = cut; else body = cut;
      }
      if (d.mode !== 'engrave') {
        let visible = d.mode === 'inlay' ? s.t(ink.intersect(target)) : ink;
        // Decorazioni precedenti sullo stesso lato hanno la precedenza.
        for (const part of artworkParts) {
          if (!part.id.startsWith(`art-${d.face}-`)) continue;
          const mesh = new M.Mesh({ numProp: 3, vertProperties: part.mesh.positions, triVerts: part.mesh.indices }); mesh.merge();
          visible = s.t(visible.subtract(s.t(new M.Manifold(mesh))));
        }
        const pieces = visible.decompose(); pieces.forEach((m) => s.t(m));
        pieces.forEach((m,i) => { if (!m.isEmpty()) artworkParts.push({ id: `art-${d.face}-${d.id}-${i+1}`, name: `${FACES[d.face]} · ${d.artwork.name.slice(0,40)} · ${d.id}.${i+1}`, color: d.color, mesh: toMeshData(m) }); });
      }
    }
    const parts = [
      { id: 'body', name: 'Corpo scatola', color: p.bodyColor, mesh: toMeshData(body) },
      { id: 'lid', name: 'Coperchio scorrevole', color: p.lidColor, mesh: toMeshData(lid) }, ...artworkParts,
    ];
    for (const solid of [body, lid]) if (solid.status() !== 'NoError' || solid.isEmpty()) throw new Error('Geometria non valida: modifica le misure.');
    return { parts, warnings };
  } finally { s.free(); }
}
