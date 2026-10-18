import { Scope, type CrossSection, type ManifoldToplevel, type Vec2 } from '@bdl/geometry';
import type { SvgArtwork } from '../coaster/src/svg.ts';

// Cache di soli contorni: nessun oggetto WASM sopravvive allo Scope.
// La tolleranza normalizzata resta sotto 0,04 mm anche a 180 mm.
const cache = new WeakMap<SvgArtwork, { drawing: Vec2[][]; silhouette?: Vec2[][] }>();

export function artworkSection(M: ManifoldToplevel, scope: Scope, artwork: SvgArtwork, silhouette = false): CrossSection {
  let entry = cache.get(artwork);
  if (!entry) {
    const regions = artwork.shapes.map(rings => scope.t(M.CrossSection.ofPolygons(rings, 'EvenOdd')));
    const merged = scope.t(M.CrossSection.union(regions));
    const clean = scope.t(merged.simplify(0.0002));
    if (clean.isEmpty()) throw new Error('Il disegno non contiene contorni utilizzabili.');
    entry = { drawing: clean.toPolygons() };
    cache.set(artwork, entry);
  }
  if (silhouette && !entry.silhouette) {
    // Riempie occhi, bocca e altri fori, anche quando il file contiene solo linee.
    const rings = entry.drawing.map(ring => scope.t(M.CrossSection.ofPolygons([ring], 'EvenOdd')));
    let filled = scope.t(M.CrossSection.union(rings));
    const islands = filled.decompose().map(part => scope.t(part)).sort((a, b) => b.area() - a.area());
    if (islands.length > 1) {
      let joined = islands[0];
      for (const island of islands.slice(1)) {
        let distance = Infinity, from: Vec2 = [0, 0], to: Vec2 = [0, 0];
        for (const a of joined.toPolygons().flat()) for (const b of island.toPolygons().flat()) {
          const d = (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2;
          if (d < distance) { distance = d; from = a; to = b; }
        }
        const ends = [from, to].map(at => scope.t(scope.t(M.CrossSection.circle(0.015, 16)).translate(at)));
        joined = scope.t(scope.t(joined.add(island)).add(scope.t(M.CrossSection.hull(ends))));
      }
      filled = joined;
    }
    entry.silhouette = filled.toPolygons();
  }
  return scope.t(M.CrossSection.ofPolygons(silhouette ? entry.silhouette! : entry.drawing, 'NonZero'));
}
