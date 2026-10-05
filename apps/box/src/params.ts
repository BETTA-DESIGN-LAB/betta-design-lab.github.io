import { FILAMENTS } from '@bdl/brand';
export interface Params {
  [key: string]: string | number | boolean;
  width: number; depth: number; height: number; wall: number; floor: number;
  radius: number; clearance: number; columns: number; rows: number;
  dividers: boolean; plateWidth: number; plateDepth: number;
  ribbed: boolean; bodyColor: string; lidColor: string;
}
export const DEFAULTS: Params = { width: 110, depth: 75, height: 40, wall: 2.4, floor: 2, radius: 6, clearance: 0.25, columns: 1, rows: 1, dividers: true, plateWidth: 256, plateDepth: 256, ribbed: true, bodyColor: '#25355e', lidColor: '#f2f0eb' };
export function sanitize(input: Params): Params {
  const p = { ...DEFAULTS };
  const limits: Record<string, [number, number]> = { width: [40, 220], depth: [35, 180], height: [18, 130], wall: [2, 4], floor: [1.6, 4], radius: [2, 20], clearance: [0.15, 0.5], columns: [1, 6], rows: [1, 6], plateWidth: [100, 350], plateDepth: [100, 350] };
  for (const [key, [lo, hi]] of Object.entries(limits)) { const v = Number(input[key]); p[key] = Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : DEFAULTS[key]; }
  p.radius = Math.min(p.radius, p.width / 4, p.depth / 4);
  p.columns = Math.min(Math.round(p.columns), Math.max(1, Math.floor((p.width - 2 * p.wall) / 12)));
  p.rows = Math.min(Math.round(p.rows), Math.max(1, Math.floor((p.depth - 2 * p.wall) / 12)));
  p.dividers = input.dividers === undefined ? DEFAULTS.dividers : input.dividers === true;
  p.ribbed = input.ribbed === undefined ? DEFAULTS.ribbed : input.ribbed === true;
  for (const key of ['bodyColor', 'lidColor'] as const) if (FILAMENTS.some((f) => f.hex === input[key])) p[key] = input[key];
  return p;
}
