import type {CrossSection, ManifoldToplevel, Scope, Vec2} from '@bdl/geometry';

export const PITCHED_ROOFS = new Set(['gabled', 'hipped']);

export function pitchedRoof(M: ManifoldToplevel, scope: Scope, shape: CrossSection,
  tags: Record<string, string>, height: number, roofHeight: number, base: number) {
  const t = <T extends {delete(): void}>(value: T) => scope.t(value);
  let longest = 0;
  let ridgeAngle = 0;
  for (const polygon of shape.toPolygons()) {
    for (let i = 0; i < polygon.length; i++) {
      const a = polygon[i], b = polygon[(i + 1) % polygon.length];
      const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (length > longest) {
        longest = length;
        ridgeAngle = Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI;
      }
    }
  }
  const compass: Record<string, number> = {N:0, NNE:22.5, NE:45, ENE:67.5, E:90, ESE:112.5, SE:135, SSE:157.5, S:180, SSW:202.5, SW:225, WSW:247.5, W:270, WNW:292.5, NW:315, NNW:337.5};
  const direction = tags['roof:direction'];
  const bearing = direction?.trim() ? (compass[direction.toUpperCase()] ?? Number(direction)) : NaN;
  const angle = Number.isFinite(bearing) ? 90 - bearing
    : ridgeAngle + (tags['roof:orientation'] === 'across' ? 0 : 90);
  const local = t(shape.rotate(-angle));
  const bounds = local.bounds();
  const width = bounds.max[0] - bounds.min[0];
  const depth = bounds.max[1] - bounds.min[1];
  const center: Vec2 = [(bounds.max[0] + bounds.min[0]) / 2, (bounds.max[1] + bounds.min[1]) / 2];
  const outline = t(M.CrossSection.square([width, depth], true));
  const hipScale = tags['roof:shape'] === 'hipped' ? Math.max(0, 1 - width / depth) : 1;
  const roof = t(t(outline.extrude(roofHeight, 0, 0, [0, hipScale])).translate([center[0], center[1], base + height - roofHeight]));
  const rotated = t(roof.rotate([0, 0, angle]));
  const clip = t(t(shape.extrude(height + .01)).translate([0, 0, base]));
  const body = t(t(shape.extrude(height - roofHeight + .01)).translate([0, 0, base]));
  return t(body.add(t(rotated.intersect(clip))));
}
