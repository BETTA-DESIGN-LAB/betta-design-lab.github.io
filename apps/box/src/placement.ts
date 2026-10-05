import { bounds, type Part } from '@bdl/geometry';
import { packPlates, printable } from './parts.ts';
export interface Placement { x: number; y: number; angle: number; plate: number; }
export type Placements = Record<string, Placement>;
export function validatePlacements(input: unknown): Placements {
  if (input === undefined) return {};
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).length > 1000) throw new Error('Posizioni del piatto non valide.');
  const result: Placements = {};
  for (const [id,p] of Object.entries(input)) {
    if (!/^(body|lid|art-(lid|front|back|left|right)-\d+-\d+)$/.test(id) || !p || ![p.x,p.y,p.angle,p.plate].every(Number.isFinite) || Math.abs(p.x)>1000 || Math.abs(p.y)>1000 || Math.abs(p.angle)>360 || !Number.isInteger(p.plate) || p.plate<0 || p.plate>19) throw new Error('Posizioni del piatto non valide.');
    result[id]={x:p.x,y:p.y,angle:p.angle,plate:p.plate};
  }
  return result;
}
export function center(part: Part) { const b=bounds([part]);return {x:(b.min[0]+b.max[0])/2,y:(b.min[1]+b.max[1])/2}; }
export function currentPlacement(placed: Part, source: Part, plate: number): Placement {
  const a=printable(source).mesh.positions,b=placed.mesh.positions;
  let angle=0;
  for(let i=3;i<a.length;i+=3){
    const ax=a[i]-a[0],ay=a[i+1]-a[1],bx=b[i]-b[0],by=b[i+1]-b[1];
    if(Math.hypot(ax,ay)>0.001){angle=Math.atan2(ax*by-ay*bx,ax*bx+ay*by)*180/Math.PI;break;}
  }
  return {...center(placed),angle:Math.round(angle*100)/100,plate};
}
export function placePart(part: Part, p: Placement): Part {
  const flat=printable(part), c=center(flat), a=p.angle*Math.PI/180, cos=Math.cos(a),sin=Math.sin(a);
  const positions=new Float32Array(flat.mesh.positions);
  for(let i=0;i<positions.length;i+=3){const x=positions[i]-c.x,y=positions[i+1]-c.y;positions[i]=x*cos-y*sin+p.x;positions[i+1]=x*sin+y*cos+p.y;}
  return {...flat,mesh:{positions,indices:flat.mesh.indices}};
}
export function arrange(parts: readonly Part[], width: number, depth: number, pinned: Placements) {
  const automatic=packPlates(parts,width,depth), plates=automatic.plates.map(items=>items.filter(p=>!pinned[p.id]));
  for(const part of parts){const p=pinned[part.id];if(!p)continue;while(plates.length<=p.plate)plates.push([]);plates[p.plate].push(placePart(part,p));}
  while(plates.length && !plates.at(-1)!.length)plates.pop();
  const warnings:string[]=[];
  const oversized=automatic.oversized.filter(name=>!parts.some(p=>p.name===name && pinned[p.id]));
  for(let plate=0;plate<plates.length;plate++) {
    const items=plates[plate], boxes=items.map(p=>bounds([p]));
    boxes.forEach((b,i)=>{if(b.min[0]<-width/2+4.99||b.max[0]>width/2-4.99||b.min[1]<-depth/2+4.99||b.max[1]>depth/2-4.99)warnings.push(`Piatto ${plate+1}: ${items[i].name} fuori dai margini.`);});
    for(let i=0;i<items.length;i++)for(let j=i+1;j<items.length;j++)if(Math.min(boxes[i].max[0],boxes[j].max[0])-Math.max(boxes[i].min[0],boxes[j].min[0])>0.01&&Math.min(boxes[i].max[1],boxes[j].max[1])-Math.max(boxes[i].min[1],boxes[j].min[1])>0.01)warnings.push(`Piatto ${plate+1}: ingombri sovrapposti (${items[i].name} / ${items[j].name}).`);
  }
  return {plates,oversized,warnings};
}
