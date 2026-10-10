import { FILAMENTS } from '@bdl/brand';
export interface Params {
  [key: string]: string | number | boolean;
  connection: 'auto'|'seat'|'pins';
  width: number; depth: number; height: number; wall: number; floor: number;
  radius: number; clearance: number; columns: number; rows: number;
  dividers: boolean; plateWidth: number; plateDepth: number;
  model: 'sliding' | 'stackable' | 'drawer'; stackLid: boolean;
  gridfinity: boolean; gridColumns: number; gridRows: number; gridOutput: 'box' | 'grid' | 'both'; connectorClearance: number;
  labelText: string; labelWidth: number; labelHeight: number; ribbed: boolean; bodyColor: string; lidColor: string;
}
export const DEFAULTS: Params = { labelText: '', labelWidth: 70, labelHeight: 14, connection: 'auto', model: 'sliding', stackLid: false, gridfinity: false, gridColumns: 3, gridRows: 2, gridOutput: 'both', connectorClearance: 0.2, width: 110, depth: 75, height: 40, wall: 2.4, floor: 2, radius: 6, clearance: 0.25, columns: 1, rows: 1, dividers: true, plateWidth: 256, plateDepth: 256, ribbed: true, bodyColor: '#25355e', lidColor: '#f2f0eb' };
export function sanitize(input: Params): Params {
  const p = { ...DEFAULTS };p.connection=['auto','seat','pins'].includes(input.connection)?input.connection:'auto';
  const limits: Record<string, [number, number]> = { labelWidth: [12, 210], labelHeight: [5, 110], width: [40, 220], depth: [35, 180], height: [18, 130], wall: [2, 4], floor: [1.6, 4], radius: [0, 20], clearance: [0.15, 0.5], columns: [1, 6], rows: [1, 6], gridColumns: [1, 16], gridRows: [1, 16], connectorClearance: [0.1, 0.4], plateWidth: [100, 350], plateDepth: [100, 350] };
  for (const [key, [lo, hi]] of Object.entries(limits)) { const v = Number(input[key]); p[key] = Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : DEFAULTS[key]; }
  p.model = ['sliding','stackable','drawer'].includes(String(input.model)) ? input.model : DEFAULTS.model;
  p.stackLid = input.stackLid === true; p.gridfinity = input.gridfinity === true;
  p.gridOutput = ['box','grid','both'].includes(String(input.gridOutput)) ? input.gridOutput : DEFAULTS.gridOutput;
  p.gridColumns = Math.round(p.gridColumns); p.gridRows = Math.round(p.gridRows);
  if (p.gridfinity) { p.width = p.gridColumns * 42 - 0.5; p.depth = p.gridRows * 42 - 0.5; p.ribbed = false; }
  if(p.gridfinity) p.radius=Math.min(p.radius,3.75);
  p.radius = Math.min(p.radius, p.width / 4, p.depth / 4);
  p.columns = Math.min(Math.round(p.columns), Math.max(1, Math.floor((p.width - 2 * p.wall) / 12)));
  p.rows = Math.min(Math.round(p.rows), Math.max(1, Math.floor((p.depth - 2 * p.wall) / 12)));
  p.dividers = input.dividers === undefined ? DEFAULTS.dividers : input.dividers === true;
  p.labelText=typeof input.labelText==='string'?input.labelText.slice(0,32):'';
  p.ribbed = input.ribbed === undefined ? DEFAULTS.ribbed : input.ribbed === true;
  if (p.gridfinity) p.ribbed = false;
  for (const key of ['bodyColor', 'lidColor'] as const) if (FILAMENTS.some((f) => f.hex === input[key])) p[key] = input[key];
  return p;
}
