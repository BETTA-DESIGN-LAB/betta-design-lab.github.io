import {Scope,toMeshData,type ManifoldToplevel,type CrossSection,type Manifold,type Part,type Vec2} from '@bdl/geometry';
import type {SvgArtwork} from '../../coaster/src/svg.ts';
import {sanitize,type Params} from './params.ts';
export interface Result {parts:Part[];formed:Part[];warnings:string[];}
function edgeDistance(x:number,y:number,rings:Vec2[][]){let d=Infinity;for(const ring of rings)for(let i=0;i<ring.length;i++){const a=ring[i],b=ring[(i+1)%ring.length],dx=b[0]-a[0],dy=b[1]-a[1],u=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy||1)));d=Math.min(d,Math.hypot(x-a[0]-u*dx,y-a[1]-u*dy));}return d;}
export function build(M:ManifoldToplevel,input:Params,artwork?:SvgArtwork):Result{
 const p=sanitize(input),s=new Scope(),C=M.CrossSection,parts:Part[]=[],formed:Part[]=[];
 const warnings=['Prototipo: collaudare accoppiamenti e formatura con una stampa di prova.','Anteprima formata indicativa: il materiale caldo si deforma e si assottiglia.'];
 try{
 const t=<T extends {delete():void}>(a:T)=>s.t(a);
 const circle=(r:number,x=0,y=0)=>t(t(C.circle(r,64)).translate([x,y]));
 const rect=(w:number,h:number,x=0,y=0)=>t(t(C.square([w,h],true)).translate([x,y]));
 let outline:CrossSection;
 if(p.shape==='svg'||p.shape==='stl'){
  if(!artwork)throw new Error(p.shape==='svg'?'Carica un SVG con un contorno chiuso.':'Carica uno STL chiuso: verrà usato il profilo visto dall’alto.');
  outline=t(C.union(artwork.shapes.flatMap(rings=>rings.map(r=>t(C.ofPolygons([r],'EvenOdd'))))));
  if(outline.isEmpty())throw new Error('Nessun contorno utilizzabile.');
  if(outline.decompose().map(t).length!==1)throw new Error('La sagoma deve essere unita: collega gli elementi separati nel file.');
  outline=t(outline.simplify(.0006));
  warnings.push(p.shape==='stl'?'STL: profilo proiettato lungo Z; la superficie originale non viene riprodotta.':'SVG: contorno esterno pieno; i vuoti interni vengono riempiti per la formatura.');
 }else if(p.shape==='ghost'){
  // Testa tonda, braccia e lenzuolo ondulato: contorno disegnato, non un'ovale perturbata.
  const half:Vec2[]=[[0,.5]];
  const curve=(c1:Vec2,c2:Vec2,end:Vec2)=>{const start=half[half.length-1];for(let i=1;i<=16;i++){const u=i/16,v=1-u;half.push([v*v*v*start[0]+3*v*v*u*c1[0]+3*v*u*u*c2[0]+u*u*u*end[0],v*v*v*start[1]+3*v*v*u*c1[1]+3*v*u*u*c2[1]+u*u*u*end[1]]);}};
  curve([.22,.5],[.29,.36],[.29,.2]);
  curve([.30,.10],[.49,.12],[.5,-.02]);
  curve([.5,-.12],[.39,-.15],[.33,-.1]);
  curve([.33,-.25],[.38,-.37],[.43,-.45]);
  curve([.32,-.48],[.28,-.33],[.21,-.39]);
  curve([.13,-.52],[.08,-.47],[0,-.4]);
  outline=t(C.ofPolygons([[...half,...half.slice(1,-1).reverse().map(([x,y]):Vec2=>[-x,y])]],'EvenOdd'));
 }else if(p.shape==='pumpkin'){
  // Lobi sovrapposti e picciolo distinto, compresi nel contorno degli stampi.
  const lobes=[-.24,-.12,0,.12,.24].map(x=>t(t(C.circle(1,64)).scale([.27,.38-Math.abs(x)*.20]).translate([x,-.05])));
  const stem=t(t(C.square([.14,.12],true)).translate([0,.35]));
  outline=t(C.union([...lobes,stem]));
 }else{
  const points:Vec2[]=Array.from({length:128},(_,i)=>{const a=i*Math.PI*2/128;let x=Math.cos(a),y=Math.sin(a);
   if(p.shape==='heart'){x=Math.pow(Math.sin(a),3);y=(13*Math.cos(a)-5*Math.cos(2*a)-2*Math.cos(3*a)-Math.cos(4*a))/17;}
   if(p.shape==='star'){const r=.77+.23*Math.cos(5*(a-Math.PI/2));x*=r;y*=r;}
   return [x,y];});outline=t(C.ofPolygons([points],'EvenOdd'));
 }
 const b=outline.bounds();outline=t(t(outline.translate([-(b.min[0]+b.max[0])/2,-(b.min[1]+b.max[1])/2])).scale([p.width/(b.max[0]-b.min[0]),p.height/(b.max[1]-b.min[1])]));
 const inner=t(outline.offset(-p.rim,'Round',2,32));if(inner.isEmpty())throw new Error('Bordo troppo grande per la sagoma.');
 const neckX=p.shape==='heart'?-p.width*.25:0;
 const mirrored=t(outline.scale([-1,1]));const dual=neckX!==0||t(outline.subtract(mirrored)).area()>outline.area()*.001;
 if(dual)warnings.unshift('Profilo asimmetrico: stampi a due impronte speculari, una per il fronte e una per il retro.');
 const rings=outline.toPolygons(),bb=outline.bounds();
 // Sul cuore la chiusura va sul lobo: il raccordo centrale riempirebbe la V.
 let neckY=bb.max[1];for(let y=bb.max[1];y>bb.min[1];y-=.5)if(t(rect(12,1,neckX,y-.5).subtract(outline)).area()<.001){neckY=y;break;}
 const tab=rect(10,10,neckX,neckY+3);let fill=outline;
 if(p.pattern!=='solid'){
  const bars:CrossSection[]=[];for(let x=-240;x<=240;x+=p.spacing)bars.push(rect(p.strand,500,x,0),rect(500,p.strand,0,x));
  let lattice=t(C.union(bars));if(p.pattern==='diagonal')lattice=t(lattice.rotate(45));
  fill=t(t(outline.subtract(inner)).add(t(lattice.intersect(inner))));
 }
 fill=t(t(fill.add(tab)).subtract(rect(4,2,neckX,neckY+5)));let front=fill;
 if(p.face&&['ghost','pumpkin'].includes(p.shape)){
  const eyes=p.shape==='pumpkin'?t(C.union([-1,1].map(sign=>t(C.ofPolygons([[[sign*p.width*.15-p.width*.06,p.height*.04],[sign*p.width*.15+p.width*.06,p.height*.04],[sign*p.width*.15,p.height*.15]]],'EvenOdd'))))):t(circle(p.width*.045,-p.width*.15,p.height*.08).add(circle(p.width*.045,p.width*.15,p.height*.08)));
  const smile=p.shape==='pumpkin'?t(C.ofPolygons([[[-.20,-.05],[-.10,-.09],[-.06,-.05],[.02,-.10],[.08,-.05],[.20,-.05],[.12,-.16],[-.12,-.16]].map(([x,y]):Vec2=>[x*p.width,y*p.height])],'EvenOdd')):t(t(circle(p.width*.12,0,-p.height*.04).subtract(circle(p.width*.12,0,-p.height*.005))).intersect(rect(p.width*.3,p.height*.12,0,-p.height*.09)));
  const panel=t(rect(p.width*.5,p.height*.34,0,0).intersect(outline));
  front=t(t(front.add(panel)).subtract(t(eyes.add(smile))));
 }
 const put=(id:string,name:string,color:string,solid:Manifold)=>{if(solid.status()!=='NoError'||solid.isEmpty())throw new Error('Geometria non valida: '+name);const bodies=solid.decompose().map(t).filter(m=>m.volume()>1e-6);if(bodies.length!==1)throw new Error('La sagoma genera parti scollegate: '+name+'. Usa un contorno più semplice.');parts.push({id,name,color,mesh:toMeshData(bodies[0])});};
 put('front','01 · Sagoma piatta fronte',p.color,t(front.extrude(p.sheet)));
 put('back','02 · Sagoma piatta retro',p.color,t(t(fill.scale([-1,1])).extrude(p.sheet)));
 let maxDistance=1;for(let x=bb.min[0];x<=bb.max[0];x+=p.width/18)for(let y=bb.min[1];y<=bb.max[1];y+=p.height/18)if(t(circle(.01,x,y).intersect(outline)).area()>0)maxDistance=Math.max(maxDistance,edgeDistance(x,y,rings));
 const dome=(x:number,y:number)=>p.dome*Math.sin(Math.min(1,edgeDistance(x,y,rings)/maxDistance)*Math.PI/2);
 const floor=3,gap=p.sheet+p.clearance;
 const dense=(section:CrossSection)=>t(t(section.extrude(1)).refineToLength(Math.max(2.5,Math.min(p.width,p.height)/32)));
 const flange=t(t(outline.offset(5,'Round',2,40)).add(rect(20,16,neckX,neckY+3)));
 const cavity=t(dense(outline).warp(v=>{const z=v[2],low=floor+p.dome-dome(v[0],v[1]);v[2]=low+z*(p.dome+floor+gap+1-low);}));
 const tabChannel=t(t(t(tab.offset(p.clearance,'Round',2,24)).extrude(p.sheet+p.clearance*2)).translate([0,0,floor+p.dome-p.clearance]));
 let female=t(t(t(flange.extrude(floor+p.dome+gap)).subtract(cavity)).subtract(tabChannel));
 const maleOutline=t(outline.offset(-p.clearance,'Round',2,32));if(maleOutline.isEmpty())throw new Error('Sagoma troppo sottile per lo stampo.');
 const bump=t(dense(maleOutline).warp(v=>{v[2]=floor+v[2]*dome(v[0],v[1]);}));
 const male=t(t(flange.extrude(floor)).add(bump));
 // Libera anche la mesh reale dello stampo accoppiato: triangolazioni differenti
 // su profili concavi non devono creare piccole interferenze fra le superfici.
 const envelope=t(t(male.scale([1,1,-1])).translate([0,0,2*floor+p.dome+gap-.2]));
 female=t(female.subtract(envelope));let printableMale=male;
 if(dual){
  // Due impronte sullo stesso pezzo permettono sagome asimmetriche senza
  // perdere la corrispondenza quando il retro viene capovolto per il montaggio.
  const dx=(p.width+14)/2,bridge=t(t(M.Manifold.cube([p.width+20,6,floor],true)).translate([0,0,floor/2]));
  const pair=(solid:Manifold)=>t(t(t(solid.translate([-dx,0,0])).add(t(t(solid.scale([-1,1,1])).translate([dx,0,0])))).add(bridge));
  female=pair(female);printableMale=pair(male);
 }
 // Capovolgendo fisicamente il convesso attorno a Y, XY e Z devono coincidere.
 printableMale=t(printableMale.scale([-1,1,1]));
 put('female','03 · Stampo concavo',p.moldColor,female);put('male','04 · Stampo convesso',p.moldColor,printableMale);
 for(const [index,section]of [front,fill].entries()){
  const solid=t(dense(section).warp(v=>{v[2]=(v[1]>neckY?0:dome(v[0],v[1]))+v[2]*p.sheet;}));
  const mesh=toMeshData(solid);if(index===1){for(let i=2;i<mesh.positions.length;i+=3)mesh.positions[i]=-mesh.positions[i];for(let i=0;i<mesh.indices.length;i+=3)[mesh.indices[i+1],mesh.indices[i+2]]=[mesh.indices[i+2],mesh.indices[i+1]];}
  formed.push({id:index?'formed-back':'formed-front',name:index?'Retro formato':'Fronte formato',color:p.color,mesh});
 }
 // Filetto elicoidale triangolare, passo 2 mm e tre giri: stesso profilo maschio/femmina.
 const thread=(radius:number,clearance=0)=>{
  const vertices:number[]=[],faces:number[]=[],steps=144;
  for(let i=0;i<=steps;i++){const a=i/steps*6*Math.PI,z=1+i/steps*6;for(const [r,dz]of [[radius-.12,-.65-clearance*.4],[radius+.75+clearance,0],[radius-.12,.65+clearance*.4]])vertices.push(r*Math.cos(a),r*Math.sin(a),z+dz);}
  for(let i=0;i<steps;i++)for(let k=0;k<3;k++){const a=i*3+k,b=i*3+(k+1)%3,c=(i+1)*3+k,d=(i+1)*3+(k+1)%3;faces.push(a,b,c,b,d,c);}faces.push(0,2,1,steps*3,steps*3+1,steps*3+2);
  let volume=0;for(let i=0;i<faces.length;i+=3){const a=faces[i]*3,b=faces[i+1]*3,c=faces[i+2]*3;volume+=vertices[a]*(vertices[b+1]*vertices[c+2]-vertices[b+2]*vertices[c+1])+vertices[a+1]*(vertices[b+2]*vertices[c]-vertices[b]*vertices[c+2])+vertices[a+2]*(vertices[b]*vertices[c+1]-vertices[b+1]*vertices[c]);}
  if(volume<0)for(let i=0;i<faces.length;i+=3)[faces[i+1],faces[i+2]]=[faces[i+2],faces[i+1]];
  return t(new M.Manifold(new M.Mesh({numProp:3,vertProperties:new Float32Array(vertices),triVerts:new Uint32Array(faces)})));
 };
 const cyl=(h:number,r:number)=>t(M.Manifold.cylinder(h,r,r,72));
 const shaft=t(cyl(8,6).add(thread(6))),bore=cyl(9,3.6);
 const slots=t(t(rect(12,p.sheet*2+p.clearance*2).extrude(6.1)).translate([0,0,-.1]));
 const connector=t(t(shaft.subtract(bore)).subtract(slots));put('connector','05 · Raccordo filettato',p.moldColor,connector);
 const lead=t(M.Manifold.cylinder(2,6.85+p.clearance,6+p.clearance,72));
 const socket=t(t(cyl(8.2,6+p.clearance).add(thread(6,p.clearance))).add(lead));
 let cap=t(cyl(10,8).subtract(socket));const eye=t(t(circle(5).subtract(circle(2.5))).extrude(3));
 cap=t(cap.add(t(t(eye.rotate([90,0,0])).translate([0,1.5,12.5]))));put('cap','06 · Tappo con occhiello',p.moldColor,cap);
 for(const [id,solid]of [['formed-connector',connector],['formed-cap',cap]] as const)formed.push({id,name:id==='formed-cap'?'Tappo con occhiello':'Raccordo',color:p.moldColor,mesh:toMeshData(t(t(solid.rotate([-90,0,0])).translate([neckX,neckY+2,0])))});
 return {parts,formed,warnings};
 }finally{s.free();}
}
