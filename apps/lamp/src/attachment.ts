import {Scope,toMeshData,type ManifoldToplevel,type Manifold,type Part} from '@bdl/geometry';

// Original bayonet, following the assembly principle in the Kit-001 guide.
// These are our dimensions, not a dimensionally identical copy of Bambu CAD.
export const ATTACH={shoulder:11.4,rotation:-25,maleRadius:32.3,innerRadius:30.2,femaleRadius:32.6,outerRadius:35.35,height:8.2};
export function attachment(M:ManifoldToplevel,s:Scope){
 const cyl=(h:number,r:number,z=0)=>s.t(s.t(M.Manifold.cylinder(h,r,r,192)).translate([0,0,z]));
 const ring=(h:number,outer:number,inner:number,z=0)=>s.t(cyl(h,outer,z).subtract(cyl(h+.2,inner,z-.1)));
 const sector=(inner:number,outer:number,from:number,to:number,z:number,h:number)=>{
  const points:[number,number][]=[];
  for(let i=0;i<=48;i++){const a=(from+(to-from)*i/48)*Math.PI/180;points.push([outer*Math.cos(a),outer*Math.sin(a)]);}
  for(let i=48;i>=0;i--){const a=(from+(to-from)*i/48)*Math.PI/180;points.push([inner*Math.cos(a),inner*Math.sin(a)]);}
  return s.t(s.t(s.t(M.CrossSection.ofPolygons([points])).extrude(h)).translate([0,0,z]));
 };
 const cable=(solid:Manifold,bottom:number,top:number)=>s.t(solid.subtract(s.t(s.t(M.Manifold.cube([8,45,top-bottom],true)).translate([0,-32,(bottom+top)/2]))));
 function male(){let m=ring(6,ATTACH.maleRadius,ATTACH.innerRadius);for(const a of [0,120,240])m=s.t(m.add(sector(32,33.5,a-5,a+5,2,2)));return cable(m,-.1,6.1);}
 function female(){
  let m=ring(ATTACH.height,ATTACH.outerRadius,ATTACH.femaleRadius);
  for(const a of [0,120,240]){
   m=s.t(m.subtract(sector(32.4,33.85,a-5.8,a+5.8,-.1,4.45)));
   m=s.t(m.subtract(sector(32.4,33.85,a-5.8,a+30.8,1.65,2.7)));
  }return m;
 }
 const shadeNeck=()=>s.t(ring(10,37.2,35.2).add(female()));
 return{male,female,ring,cable,shadeNeck};
}
export function fitSamples(M:ManifoldToplevel,color:string):Part[]{const s=new Scope();try{
 const a=attachment(M,s),foot=a.cable(a.ring(2.4,38,30.2),-.1,2.5);
 const male=s.t(foot.add(s.t(a.male().translate([0,0,2.4]))));
 return[{id:'fit-base',name:'Campione base · baionetta',color,mesh:toMeshData(male)},{id:'fit-shade',name:'Campione bordo paralume · guide integrate',color,mesh:toMeshData(a.shadeNeck())}];
}finally{s.free();}}
