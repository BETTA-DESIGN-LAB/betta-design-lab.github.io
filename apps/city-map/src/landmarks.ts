import type {Element} from './data.ts';
import type {ManifoldToplevel,Scope,Vec2} from '@bdl/geometry';

export function pisaBaptistery(element:Element):boolean {
  return element.tags?.wikidata==='Q1278477'||(element.type==='way'&&element.id===22945162);
}

// Approximate printable silhouette, from the documented 55 m height and
// 107.24 m circumference. Intermediate levels follow the exterior profile.
export function baptisteryMesh(M:ManifoldToplevel,scope:Scope,center:Vec2,base:number,
  horizontal:number,height:number){
  const t=<T extends {delete():void}>(object:T)=>scope.t(object);
  const radius=107.24/(2*Math.PI);
  const profile:Vec2[]=[
    [0,0],[radius,0],[radius,2],[16.6,2.8],[16.6,15.8],[17.2,16.6],
    [17.2,18],[16.4,18.5],[16.4,27.4],[17.1,28.3],[17.1,29.7],
    [15.8,30.2],[15.6,33.8],[14.8,37.5],[13.3,41.2],[11.2,44.5],
    [8.7,47.3],[6.1,49.5],[3.8,50.7],[2.4,51.1],[2.4,52.2],
    [1.3,52.4],[.85,53.1],[.85,54.6],[.4,55],[0,55],
  ].map(([r,z])=>[r*horizontal,z*height/55]);
  const body=t(t(M.CrossSection.ofPolygons([profile])).revolve(96));
  const details=[body];
  if(horizontal>=.22){
    const columns=24;
    for(let i=0;i<columns;i++){
      const angle=i*2*Math.PI/columns;
      const x=Math.cos(angle)*16.15*horizontal,y=Math.sin(angle)*16.15*horizontal;
      const column=t(M.Manifold.cylinder(height*10/55,horizontal*1.05,horizontal*.82,10));
      details.push(t(column.translate([x,y,height*18/55])));
      if(i%2===0){
        const pinnacle=t(M.Manifold.cylinder(height*5.2/55,horizontal*1.4,horizontal*.34,8));
        const dx=Math.cos(angle)*15.4*horizontal,dy=Math.sin(angle)*15.4*horizontal;
        details.push(t(pinnacle.translate([dx,dy,height*26.8/55])));
      }
    }
  }
  return t(t(M.Manifold.union(details)).translate([center[0],center[1],base]));
}
