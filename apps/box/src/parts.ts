import { bounds, type Part } from '@bdl/geometry';
import { groundPart, separateParts } from '../../coaster/src/parts.ts';
export function printable(part: Part): Part {
  const face = part.id.split('-')[1];
  if (!part.id.startsWith('art-') || face === 'lid') return groundPart(part);
  const positions = new Float32Array(part.mesh.positions);
  for (let i=0;i<positions.length;i+=3) {
    const [x,y,z] = positions.slice(i,i+3);
    positions.set(face === 'front' ? [x,z,-y] : face === 'back' ? [-x,z,y] : face === 'left' ? [-y,z,-x] : [y,z,x], i);
  }
  return groundPart({...part, mesh:{positions, indices:part.mesh.indices}});
}
export function printParts(parts: readonly Part[]): Part[] { return separateParts(parts.map(printable)); }
export function packPlates(parts: readonly Part[], width: number, depth: number) {
  const plates: Part[][] = [], oversized: string[] = [];
  const rows: {y:number;height:number;x:number}[][] = [];
  const items = parts.map(printable).sort((a,b) => { const A=bounds([a]),B=bounds([b]); return (B.max[0]-B.min[0])*(B.max[1]-B.min[1])-(A.max[0]-A.min[0])*(A.max[1]-A.min[1]); });
  for (const item of items) {
    const b=bounds([item]), w=b.max[0]-b.min[0], h=b.max[1]-b.min[1];
    if (!((w<=width-10 && h<=depth-10)||(h<=width-10 && w<=depth-10))) { oversized.push(item.name); continue; }
    let placed=false;
    for (let plate=0; !placed; plate++) {
      if (!plates[plate]) { plates.push([]); rows.push([]); }
      for (const rotate of [false,true]) {
        const iw=rotate?h:w, ih=rotate?w:h;
        if (iw>width-10 || ih>depth-10) continue;
        let row=rows[plate].find(r => ih<=r.height+0.0001 && r.x+iw<=width-5);
        if (!row) {
          const y=rows[plate].length ? Math.max(...rows[plate].map(r=>r.y+r.height))+5 : 5;
          if (y+ih>depth-5) continue;
          row={y,height:ih,x:5}; rows[plate].push(row);
        }
        const positions=new Float32Array(item.mesh.positions);
        for (let i=0;i<positions.length;i+=3) {
          const x=positions[i]-b.min[0], y=positions[i+1]-b.min[1];
          positions[i]=(rotate?h-y:x)+row.x-width/2;
          positions[i+1]=(rotate?x:y)+row.y-depth/2;
        }
        plates[plate].push({...item,mesh:{positions,indices:item.mesh.indices}}); row.x+=iw+5; placed=true; break;
      }
    }
  }
  return {plates,oversized};
}
export function openParts(parts: readonly Part[], width: number): Part[] {
  return parts.map(part => {
    if (part.id !== 'lid' && !part.id.startsWith('art-lid-')) return part;
    const positions = new Float32Array(part.mesh.positions);
    for (let i=0;i<positions.length;i+=3) positions[i]+=width*0.65;
    return {...part,mesh:{positions,indices:part.mesh.indices}};
  });
}
