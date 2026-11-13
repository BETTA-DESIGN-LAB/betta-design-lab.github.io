import type {CrossSection,ManifoldToplevel,Scope,Vec2} from '@bdl/geometry';
export const FORMS=[
 ['rect','Rettangolo'],['circle','Cerchio'],['hex','Esagono'],['oct','Ottagono'],
 ['rounded','Quadrato arrotondato'],['heart','Cuore'],['star','Stella'],['drop','Goccia'],['cube','Cubo'],
] as const;
export type Form=typeof FORMS[number][0];
export const FONTS=['Russo One','Rubik','Lobster','Black Ops One'] as const;

export function outline(M:ManifoldToplevel,s:Scope,form:Form,w:number,d:number):CrossSection{
 const C=M.CrossSection;
 if(form==='rect'||form==='cube')return s.t(C.square([w,d],true));
 if(form==='rounded'){
   const r=w*.105;
   return s.t(s.t(C.square([w-2*r,d-2*r],true)).offset(r,'Round',2,64));
 }
 if(form==='circle')return s.t(C.circle(w/2,128));
 return s.t(C.ofPolygons([formPoints(form,w,d)],'EvenOdd'));
}
export function formPoints(form:Form,w:number,d:number):Vec2[]{
 if(form==='rect'||form==='cube')return [[-w/2,-d/2],[w/2,-d/2],[w/2,d/2],[-w/2,d/2]];
 if(form==='rounded'){
   const r=w*.105;
   return Array.from({length:68},(_,i)=>{
     const quarter=Math.floor(i/17),angle=(quarter+(i%17)/16)*Math.PI/2;
     return [(quarter===0||quarter===3?1:-1)*(w/2-r)+r*Math.cos(angle),
       (quarter<2?1:-1)*(d/2-r)+r*Math.sin(angle)];
   });
 }
 const count=form==='hex'?6:form==='oct'?8:form==='star'?10:128;
 const points:Vec2[]=Array.from({length:count},(_,i)=>{
   const a=Math.PI/2+i*2*Math.PI/count;
   if(form==='heart')return [16*Math.sin(a)**3,13*Math.cos(a)-5*Math.cos(2*a)-2*Math.cos(3*a)-Math.cos(4*a)];
   if(form==='drop')return [Math.cos(a)*(1-.47*Math.sin(a)),Math.sin(a)];
   const r=form==='star'&&i%2?.49:1;
   return [r*Math.cos(a),r*Math.sin(a)];
 });
 const x=points.map(p=>p[0]),y=points.map(p=>p[1]);
 const l=Math.min(...x),r=Math.max(...x),b=Math.min(...y),t=Math.max(...y);
 return points.map(([x,y]):Vec2=>[(x-(l+r)/2)*w/(r-l),(y-(b+t)/2)*d/(t-b)]);
}
