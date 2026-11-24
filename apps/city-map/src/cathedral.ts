import type {CrossSection,ManifoldToplevel,Scope} from '@bdl/geometry';
import type {Element} from './data.ts';
import {pitchedRoof} from './roofs.ts';

export const PISA_CATHEDRAL_HEIGHT=54;
export function pisaCathedral(e:Element):boolean {
  return e.tags?.wikidata==='Q1754247'||(e.type==='way'&&e.id===22945163);
}

/** Printable architectural approximation, fitted to the original, uncut OSM
 * footprint. Latin cross, stepped aisles, pitched nave/transept, elliptical
 * crossing dome. Not a surveyed replica of the facade decoration.
 * Sources: Comune di Pisa tourism, cathedral entry; NANOCATHEDRAL D1.1 Part D.
 * Height 54 m; intermediate heights/proportions are silhouette approximations.
 */
export function cathedralMesh(M:ManifoldToplevel,scope:Scope,footprint:CrossSection,
  base:number,height:number){
  const t=<T extends {delete():void}>(o:T)=>scope.t(o),C=M.CrossSection;
  // Longest wall establishes the nave axis. The Pisa apse is at the eastern end.
  let longest=0,angle=0;
  for(const ring of footprint.toPolygons())for(let i=0;i<ring.length;i++){
    const a=ring[i],b=ring[(i+1)%ring.length],length=Math.hypot(b[0]-a[0],b[1]-a[1]);
    if(length>longest){longest=length;angle=Math.atan2(b[1]-a[1],b[0]-a[0])*180/Math.PI;}
  }
  if(Math.cos(angle*Math.PI/180)<0)angle+=180;
  const local=t(footprint.rotate(-angle)),bounds=local.bounds();
  const w=bounds.max[0]-bounds.min[0],d=bounds.max[1]-bounds.min[1];
  const cx=(bounds.max[0]+bounds.min[0])/2,cy=(bounds.max[1]+bounds.min[1])/2;
  const shape=t(local.translate([-cx,-cy])),crossX=w*.155,z=(metres:number)=>height*metres/54;
  const rectangle=(width:number,depth:number,x=0,y=0)=>t(t(C.square([width,depth],true)).translate([x,y]));
  const roof=(section:CrossSection,top:number,rise:number)=>pitchedRoof(M,scope,section,
    {'roof:shape':'gabled'},z(top),z(rise),0);
  const solids=[t(shape.extrude(z(17)))];
  // Lower roofs remain lower than the central clerestory, with a separate
  // transverse ridge instead of a single roof stretched over the whole cross.
  solids.push(roof(rectangle(w,d*.51),23,6));
  solids.push(roof(rectangle(w*.25,d*.89,crossX),25,7));
  solids.push(roof(rectangle(w*.94,d*.225,-w*.03),34,6));
  solids.push(roof(rectangle(w*.155,d*.87,crossX),31,6));
  // Curved apse at the east end, under the central nave ridge.
  const apse=t(t(C.circle(1,64)).scale([w*.105,d*.115]));
  solids.push(t(t(apse.extrude(z(24))).translate([w*.385,0,0])));
  const rx=w*.098,ry=d*.112;
  const drum=t(t(C.circle(1,16)).scale([rx,ry]));
  solids.push(t(t(drum.extrude(z(9))).translate([crossX,0,z(30)])));
  // Upper half-ellipsoid, with a continuous, printable underside in the drum.
  const sphere=t(t(M.Manifold.sphere(1,64)).scale([rx*.98,ry*.98,z(12)]));
  const cap=t(sphere.intersect(t(t(M.Manifold.cube([rx*2.1,ry*2.1,z(12.1)])).translate([-rx*1.05,-ry*1.05,-.02]))));
  solids.push(t(cap.translate([crossX,0,z(39)])));
  const lantern=t(M.Manifold.cylinder(z(2),w*.014,w*.014,16));
  solids.push(t(lantern.translate([crossX,0,z(50.5)])));
  solids.push(t(t(M.Manifold.cylinder(z(1.6),w*.019,0,16)).translate([crossX,0,z(52.4)])));
  const clipping=t(shape.extrude(height+.02));
  const building=t(t(M.Manifold.union(solids)).intersect(clipping));
  return t(t(t(building.translate([cx,cy,0])).rotate([0,0,angle])).translate([0,0,base]));
}
