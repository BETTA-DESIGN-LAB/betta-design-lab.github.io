import type { Params } from './params.ts';

/** Coordinate in mm dall'angolo interno sinistro/posteriore, viste dall'alto. */
export interface Divider { axis: 'vertical' | 'horizontal'; at: number; start: number; end: number }
export function interiorSize(p: Params) {
  const drawer = p.model === 'drawer';
  return {
    width: p.width - (drawer ? 4 * p.wall + 2 * p.clearance : 2 * p.wall),
    depth: p.depth - (drawer ? 3 * p.wall + p.clearance : 2 * p.wall),
    centerY: drawer ? -p.wall / 2 : 0,
    radius: Math.max(0, p.radius - (drawer ? 2 : 1) * p.wall),
  };
}
const mm = (n: number) => Math.round(n * 10) / 10;
export function readDividers(value: string, p: Params): Divider[] {
  let data: unknown;
  try { data = JSON.parse(value); } catch { return []; }
  if (!Array.isArray(data)) return [];
  const { width, depth } = interiorSize(p);
  const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, mm(n)));
  return data.slice(0, 24).flatMap(d => {
    if (!d || !['vertical', 'horizontal'].includes(d.axis) || ![d.at, d.start, d.end].every(v => typeof v === 'number' && Number.isFinite(v))) return [];
    const span = d.axis === 'vertical' ? depth : width, across = d.axis === 'vertical' ? width : depth;
    const start = clamp(Math.min(d.start, d.end), 0, span), end = clamp(Math.max(d.start, d.end), 0, span);
    if (end - start < 1) return [];
    return [{ axis: d.axis, at: clamp(d.at, p.wall / 2, across - p.wall / 2), start, end } as Divider];
  });
}
export function automaticDividers(p: Params): Divider[] {
  const { width, depth } = interiorSize(p), result: Divider[] = [];
  for (let i = 1; i < p.columns; i++) result.push({ axis: 'vertical', at: width * i / p.columns, start: 0, end: depth });
  for (let i = 1; i < p.rows; i++) result.push({ axis: 'horizontal', at: depth * i / p.rows, start: 0, end: width });
  return result;
}
export function activeDividers(p: Params): Divider[] {
  return !p.dividers ? [] : p.interiorMode === 'custom' ? readDividers(p.dividerData, p) : automaticDividers(p);
}
export function dividerRect(d: Divider, thickness: number) {
  return d.axis === 'vertical'
    ? { x: d.at - thickness / 2, y: d.start, width: thickness, depth: d.end - d.start }
    : { x: d.start, y: d.at - thickness / 2, width: d.end - d.start, depth: thickness };
}
/** Flood fill degli spazi liberi: i giunti a T non vengono trattati come una griglia. */
export function interiorRooms(p: Params, items = activeDividers(p)) {
  const { width, depth } = interiorSize(p), rects = items.map(d => dividerRect(d, p.wall));
  const breaks = (limit: number, axis: 'x' | 'y') => [...new Set([0, limit, ...rects.flatMap(r => axis === 'x' ? [r.x, r.x + r.width] : [r.y, r.y + r.depth])].map(n => Math.max(0, Math.min(limit, n))))].sort((a,b) => a-b);
  const xs = breaks(width, 'x'), ys = breaks(depth, 'y'), nx = xs.length - 1, ny = ys.length - 1;
  const visited = new Set<number>(), blocked = new Set<number>();
  for (let j=0;j<ny;j++) for (let i=0;i<nx;i++) {
    const x=(xs[i]+xs[i+1])/2,y=(ys[j]+ys[j+1])/2;
    if(rects.some(r=>x>r.x && x<r.x+r.width && y>r.y && y<r.y+r.depth)) blocked.add(j*nx+i);
  }
  const rooms: { x:number; y:number; width:number; depth:number; rectangular:boolean }[] = [];
  for(let seed=0;seed<nx*ny;seed++) {
    if(visited.has(seed)||blocked.has(seed)) continue;
    let x0=width,y0=depth,x1=0,y1=0,area=0;
    const queue=[seed];visited.add(seed);
    for(let k=0;k<queue.length;k++) {
      const id=queue[k],i=id%nx,j=Math.floor(id/nx);
      x0=Math.min(x0,xs[i]);x1=Math.max(x1,xs[i+1]);y0=Math.min(y0,ys[j]);y1=Math.max(y1,ys[j+1]);area+=(xs[i+1]-xs[i])*(ys[j+1]-ys[j]);
      for(const [di,dj] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        const a=i+di,b=j+dj,n=b*nx+a;
        if(a>=0&&a<nx&&b>=0&&b<ny&&!visited.has(n)&&!blocked.has(n)){visited.add(n);queue.push(n);}
      }
    }
    rooms.push({x:x0,y:y0,width:x1-x0,depth:y1-y0,rectangular:Math.abs(area-(x1-x0)*(y1-y0))<.01});
  }
  return rooms;
}
