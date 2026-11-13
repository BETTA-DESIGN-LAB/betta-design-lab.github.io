import type {CrossSection,Manifold,ManifoldToplevel,Scope,Vec2} from '@bdl/geometry';
export type TextShape=Vec2[][][];
export interface Captions {title?:TextShape;subtitle?:TextShape;coordinates?:TextShape;lat?:TextShape;lon?:TextShape;scale?:TextShape;marker?:TextShape}
export function makeCaption(M:ManifoldToplevel,s:Scope,outer:CrossSection,ring:CrossSection,top:number,
  captions:Captions,side:boolean,cube:boolean,wallBottom=0,coordinatesLeft=false):Manifold|undefined{
 const C=M.CrossSection,t=<T extends {delete():void}>(obj:T)=>s.t(obj),bounds=outer.bounds();
 const w=bounds.max[0]-bounds.min[0],solids:Manifold[]=[];
 const section=(line:TextShape|undefined)=>line?.length?t(C.union(line.map(p=>t(C.ofPolygons(p,'EvenOdd'))))):undefined;
 function fit(line:CrossSection,width:number,height:number){
   const b=line.bounds(),dx=b.max[0]-b.min[0],dy=b.max[1]-b.min[1];
   const f=Math.min(width/Math.max(dx,.01),height/Math.max(dy,.01));
   return t(t(line.translate([-(b.min[0]+b.max[0])/2,-(b.min[1]+b.max[1])/2])).scale(f));
 }
 const contours=outer.toPolygons();
 function crossings(polygons:Vec2[][],x:number){
   const hits:number[]=[];
   for(const contour of polygons)for(let i=0;i<contour.length;i++){
     const a=contour[i],b=contour[(i+1)%contour.length];
     if((a[0]<=x&&x<b[0])||(b[0]<=x&&x<a[0]))hits.push(a[1]+(x-a[0])*(b[1]-a[1])/(b[0]-a[0]));
   }
   return hits.sort((a,b)=>a-b);
 }
 const front=(x:number)=>crossings(contours,x)[0]??bounds.min[1];
 function wall(line:CrossSection,width:number,height:number,z:number,angle=0){
   const scaled=fit(line,width,height);
   const raw=t(t(scaled.extrude(1.35)).rotate([90,0,0]));
   const mesh=t(raw.refineToLength(.6));
   const raised=t(mesh.warp(v=>{v[1]+=front(v[0])+.72;v[2]+=z;}));
   solids.push(angle?t(raised.rotate([0,0,angle])):raised);
 }
 if(cube){
   ([captions.title,captions.subtitle,captions.lat,captions.lon]).forEach((raw,i)=>{
     const line=section(raw);
     if(line&&!line.isEmpty())wall(line,w*.76,Math.min(top*.22,18),top*.48,i*90);
   });
 }else{
   const title=section(captions.title),coordinates=section(captions.coordinates);
   const subtitle=section(captions.subtitle);
   let heading=title??coordinates;
   if(title&&!title.isEmpty()&&coordinates&&!coordinates.isEmpty()){
     const [left,right]=(coordinatesLeft?[coordinates,title]:[title,coordinates]).map(line=>fit(line,Infinity,1));
     const gap=.85;
     const leftShift=-gap/2-left.bounds().max[0],rightShift=gap/2-right.bounds().min[0];
     heading=t(t(left.translate([leftShift,0])).add(t(right.translate([rightShift,0]))));
   }
   const lines=[heading,subtitle].filter((line):line is CrossSection=>!!line&&!line.isEmpty());
   if(side){
     const h=Math.min(top-wallBottom-1,11)/Math.max(1,lines.length);
     lines.forEach((line,i)=>wall(line,w*.55,h*.74,(top+wallBottom)/2+(lines.length/2-.5-i)*h));
   }else if(lines.length){
     const rimContours=ring.toPolygons();
     const bandAt=(x:number)=>crossings(rimContours,x);
     const [edge,inside]=bandAt(0);
     const band=Math.min(11,inside-edge);
     if(band>.5){
       const row=band/lines.length;
       lines.forEach((line,i)=>{
         const offset=band-(i+.5)*row;
         const glyph=fit(line,w*.55,row*.72);
         const mesh=t(t(glyph.extrude(.69)).refineToLength(.4));
         solids.push(t(mesh.warp(v=>{
           const [outerY,innerY]=bandAt(v[0]);
           v[1]=outerY+(v[1]+offset)*Math.min(1,(innerY-outerY)/band);
           v[2]+=top-.04;
         })));
       });
     }
   }
 }
 return solids.length?t(M.Manifold.union(solids)):undefined;
}
