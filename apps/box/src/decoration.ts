import type { SvgArtwork } from '../../coaster/src/svg.ts';
export type Face = 'lid' | 'front' | 'back' | 'left' | 'right';
export const FACES: Record<Face, string> = { lid: 'Coperchio / tetto', front: 'Parete davanti', back: 'Parete dietro', left: 'Parete sinistra', right: 'Parete destra' };
export interface Decoration { id: number; face: Face; mode: 'inlay' | 'relief' | 'engrave'; size: number; u: number; v: number; angle: number; depth: number; color: string; artwork: SvgArtwork; }
export function validateDecorations(raw: unknown): Decoration[] {
  if (!Array.isArray(raw) || raw.length > 12) throw new Error('Massimo 12 decorazioni per progetto.');
  let points = 0;
  return raw.map((d, i) => {
    if (!d || !Object.hasOwn(FACES, d.face) || !['inlay','relief','engrave'].includes(d.mode) || !/^#[a-f\d]{6}$/i.test(d.color) || !d.artwork || typeof d.artwork.name !== 'string' || !Array.isArray(d.artwork.shapes) || !d.artwork.shapes.length) throw new Error('Decorazione non valida.');
    for (const shape of d.artwork.shapes) {
      if (!Array.isArray(shape) || !shape.length) throw new Error('Contorno non valido.');
      for (const ring of shape) {
        if (!Array.isArray(ring) || ring.length < 3) throw new Error('Contorno non valido.');
        for (const point of ring) if (++points > 100000 || !Array.isArray(point) || point.length !== 2 || point.some((n: unknown) => typeof n !== 'number' || !Number.isFinite(n) || Math.abs(n) > 2)) throw new Error('Coordinate non valide.');
      }
    }
    const bounded = (key: string, lo: number, hi: number) => { if (typeof d[key] !== 'number' || !Number.isFinite(d[key])) throw new Error('Misure della decorazione non valide.'); return Math.max(lo, Math.min(hi, d[key])); };
    return { ...d, id: i + 1, size: bounded('size', 3, 150), u: bounded('u', -110, 110), v: bounded('v', -110, 110), angle: bounded('angle', -180, 180), depth: bounded('depth', 0.2, 1) };
  });
}
/** Rotazioni locali XY: Z punta verso l'esterno della superficie. */
export const FACE_ROTATION: Record<Face, [number, number, number]> = { lid: [0,0,0], front: [90,0,0], back: [90,0,180], left: [90,0,-90], right: [90,0,90] };

/** Posiziona il disegno entro la zona piana, tenendo conto di misura e rotazione. */
export function positionOnFace(d: Decoration, p: {width:number;depth:number;height:number;radius:number;wall:number;floor:number;model?:string;clearance?:number}, position: 'left'|'right'|'top'|'bottom'|'center') {
  const lid=d.face==='lid', width=lid||d.face==='front'||d.face==='back'?p.width:p.depth;
  const margin=lid?p.radius+p.wall:p.radius+1;
  const loY=lid?-p.depth/2+p.radius+p.wall:-p.height/2+p.floor+1+(p.model==='drawer'&&d.face==='front'?p.wall+(p.clearance??0):0);
  const hiY=lid?p.depth/2-p.radius-p.wall:p.height/2-5;
  const a=d.angle*Math.PI/180, cos=Math.cos(a),sin=Math.sin(a);
  let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
  for(const shape of d.artwork.shapes)for(const ring of shape)for(const [x,y] of ring){
    const rx=(x*cos-y*sin)*d.size,ry=(x*sin+y*cos)*d.size;
    minX=Math.min(minX,rx);maxX=Math.max(maxX,rx);minY=Math.min(minY,ry);maxY=Math.max(maxY,ry);
  }
  const left=-width/2+margin-minX+0.5,right=width/2-margin-maxX-0.5;
  const bottom=loY-minY+0.5,top=hiY-maxY-0.5;
  const middle=(lo:number,hi:number,value:number)=>lo<=hi?Math.max(lo,Math.min(hi,value)):(lo+hi)/2;
  const u=position==='left'?left:position==='right'?right:position==='center'?0:d.u;
  const v=position==='bottom'?bottom:position==='top'?top:position==='center'?0:d.v;
  return {u:middle(left,right,u),v:middle(bottom,top,v)};
}
