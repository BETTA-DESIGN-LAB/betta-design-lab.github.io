import { Scope, toMeshData, type ManifoldToplevel, type Manifold, type Part } from '@bdl/geometry';
import type { Params } from './params.ts';
export const GRID_PITCH = 42;
export const FOOT_HEIGHT = 4.75;
export const GRID_FLOOR = 3;
/** Profilo standard: smusso 0.8, tratto verticale 1.8, smusso 2.15 mm.
 * Quote verificate in gridfinity-unofficial/specification e Gridfinity Rebuilt.
 * Implementazione originale; nessuna vite, magnete o clip elastica. */
export function gridFoot(M: ManifoldToplevel, s: Scope, socket = false): Manifold {
  const extra = socket ? 0.5 : 0;
  const section = (size:number,r:number,z:number) => {
    const cs=s.t(s.t(M.CrossSection.square([size-2*r,size-2*r],true)).offset(r,'Round',2,32));
    return s.t(s.t(cs.extrude(0.002)).translate([0,0,z]));
  };
  const stages = [[35.6+extra,0.8,0],[37.2+extra,1.6,0.8],[37.2+extra,1.6,2.6],[41.5+extra,3.75,4.75]];
  const solids=[];
  for(let i=0;i<stages.length-1;i++) {
    const a=stages[i],b=stages[i+1];
    solids.push(s.t(M.Manifold.hull([section(a[0],a[1]+extra/2,a[2]),section(b[0],b[1]+extra/2,b[2])])));
  }
  return s.t(M.Manifold.union(solids));
}
/** Divisioni su celle intere; i 5 mm dei denti e 5 mm di margine per lato sono riservati. */
export function gridSegments(p: Params) {
  const nx=Math.floor((p.plateWidth-15)/42),ny=Math.floor((p.plateDepth-15)/42);
  if(nx<1||ny<1)throw new Error('Il piatto non contiene una cella Gridfinity con gli incastri.');
  const segments=[];
  for(let y=0;y<p.gridRows;y+=ny)for(let x=0;x<p.gridColumns;x+=nx)
    segments.push({x,y,columns:Math.min(nx,p.gridColumns-x),rows:Math.min(ny,p.gridRows-y)});
  return segments;
}
export function buildGrid(M: ManifoldToplevel,p:Params): Part[] {
  const s=new Scope();
  try {
    const socket=gridFoot(M,s,true),parts:Part[]=[];
    const joint=s.t(M.CrossSection.ofPolygons([[[ -0.05,-2.5],[5,-4],[5,4],[-0.05,2.5]]],'NonZero'));
    const male=s.t(joint.extrude(2.8));
    const female=s.t(s.t(s.t(joint.offset(p.connectorClearance,'Round',2,16)).extrude(3.2)).translate([0,0,-0.1]));
    for(const [i,g] of gridSegments(p).entries()) {
      const w=g.columns*42,d=g.rows*42;
      let plate=s.t(M.Manifold.cube([w,d,7.75]).translate([-w/2,-d/2,0]));
      const cavities=[];
      for(let y=0;y<g.rows;y++)for(let x=0;x<g.columns;x++)
        cavities.push(s.t(socket.translate([(x+0.5)*42-w/2,(y+0.5)*42-d/2,3])));
      plate=s.t(plate.subtract(s.t(M.Manifold.union(cavities))));
      for(let y=0;y<g.rows;y++) {
        const at=(y+0.5)*42-d/2;
        if(g.x+g.columns<p.gridColumns)plate=s.t(plate.add(s.t(male.translate([w/2,at,0]))));
        if(g.x>0)plate=s.t(plate.subtract(s.t(female.translate([-w/2,at,0]))));
      }
      for(let x=0;x<g.columns;x++) {
        const at=(x+0.5)*42-w/2;
        if(g.y+g.rows<p.gridRows)plate=s.t(plate.add(s.t(s.t(male.rotate([0,0,90])).translate([at,d/2,0]))));
        if(g.y>0)plate=s.t(plate.subtract(s.t(s.t(female.rotate([0,0,90])).translate([at,-d/2,0]))));
      }
      plate=s.t(plate.translate([(g.x+g.columns/2-p.gridColumns/2)*42,(g.y+g.rows/2-p.gridRows/2)*42,0]));
      if(plate.status()!=='NoError'||plate.isEmpty())throw new Error('Griglia non valida');
      parts.push({id:`grid-${i+1}`,name:`Griglia ${i+1} · ${g.columns}×${g.rows} · riga ${g.y+1}, colonna ${g.x+1}`,color:p.bodyColor,mesh:toMeshData(plate)});
    }
    return parts;
  } finally {s.free();}
}
