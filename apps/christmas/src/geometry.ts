import {Scope,toMeshData,type ManifoldToplevel,type CrossSection,type Manifold,type Part,type Vec2} from '@bdl/geometry';
import type {SvgArtwork} from '../../coaster/src/svg.ts';
import {sanitize,type Params} from './params.ts';
export interface Design{text?:SvgArtwork;extra?:SvgArtwork}
/** Geometrie originali: ornamenti piatti e guscio ondulato in due metà. */
export function build(M:ManifoldToplevel,input:Params,design:Design={},seated=false):{parts:Part[];warnings:string[];adjustments:{x?:number;y?:number}}{
 const p=sanitize(input),s=new Scope(),parts:Part[]=[],warnings:string[]=[],adjustments:{x?:number;y?:number}={};
 try{
 const C=M.CrossSection,G=M.Manifold,R=p.size/2;
 const circle=(r:number,x=0,y=0)=>s.t(s.t(C.circle(r,64)).translate([x,y]));
 const polygon=(v:Vec2[])=>s.t(C.ofPolygons([v],'EvenOdd'));
 const rect=(w:number,h:number,x=0,y=0)=>s.t(s.t(C.square([w,h],true)).translate([x,y]));
 const union=(a:CrossSection[])=>s.t(C.union(a));
 const segment=(a:Vec2,b:Vec2,w:number)=>s.t(C.hull([circle(w/2,...a),circle(w/2,...b)]));
 const star=(r:number,n=5,inner=.46)=>polygon(Array.from({length:n*2},(_,i)=>{const a=Math.PI/2+i*Math.PI/n,k=i%2?r*inner:r;return [Math.cos(a)*k,Math.sin(a)*k] as Vec2;}));
 const flake=(r:number,w:number)=>{const arms:CrossSection[]=[];for(let i=0;i<6;i++){const a=i*Math.PI/3;const rot=(x:number,y:number):Vec2=>[x*Math.cos(a)-y*Math.sin(a),x*Math.sin(a)+y*Math.cos(a)];arms.push(segment([0,0],rot(r,0),w));for(const at of [.48,.73])for(const sign of [-1,1])arms.push(segment(rot(r*at,0),rot(r*(at+.16),sign*r*.19),w));}return union(arms);};
 const fit=(a:SvgArtwork,w:number,h:number)=>{if(!a.shapes.length)throw new Error('SVG senza forme utilizzabili.');const c=union(a.shapes.map(v=>s.t(C.ofPolygons(v,'EvenOdd')))),b=c.bounds();const k=Math.min(w/(b.max[0]-b.min[0]),h/(b.max[1]-b.min[1]));return s.t(s.t(c.translate([-(b.max[0]+b.min[0])/2,-(b.max[1]+b.min[1])/2])).scale([k,k]));};
 const drawings:{shape:CrossSection;id:string;color:string}[]=[];
 if(p.text.trim()&&design.text)drawings.push({shape:s.t(s.t(fit(design.text,p.size*.8*p.scale/100,p.size*.25*p.scale/100).rotate(p.angle)).translate([p.x,p.y])),id:'text',color:p.artColor});
 if(design.extra)drawings.push({shape:s.t(s.t(fit(design.extra,p.extraSize,p.extraSize).rotate(p.extraAngle)).translate([p.extraX,p.extraY])),id:'symbol',color:p.extraColor});
 const append=(solid:Manifold,id:string,name:string,color:string)=>{for(const [i,component]of solid.decompose().map(a=>s.t(a)).entries())if(component.volume()>1e-5)parts.push({id:`${id}-${i}`,name:`${name}${i?' '+(i+1):''}`,color,mesh:toMeshData(component)});};
 if(p.model==='flat'){
 let outline:CrossSection;
 switch(p.shape){
 case 'tree':outline=polygon([[-R*.16,-R],[R*.16,-R],[R*.16,-R*.8],[R*.8,-R*.8],[R*.46,-R*.25],[R*.64,-R*.25],[R*.3,R*.3],[R*.46,R*.3],[0,R],[-R*.46,R*.3],[-R*.3,R*.3],[-R*.64,-R*.25],[-R*.46,-R*.25],[-R*.8,-R*.8],[-R*.16,-R*.8]]);break;
 case 'star':outline=star(R);break;
 case 'snowflake':outline=flake(R,Math.max(2.4,p.size*.045));break;
 case 'heart':outline=polygon(Array.from({length:120},(_,i)=>{const t=i*Math.PI/60;return [R*Math.sin(t)**3,R*(13*Math.cos(t)-5*Math.cos(2*t)-2*Math.cos(3*t)-Math.cos(4*t))/16] as Vec2;}));break;
 case 'bell':outline=union([polygon([[-R*.8,-R*.65],[R*.8,-R*.65],[R*.5,-R*.3],[R*.4,R*.55],[0,R*.75],[-R*.4,R*.55],[-R*.5,-R*.3]]),circle(R*.16,0,-R*.72)]);break;
 case 'gingerbread':outline=union([circle(R*.27,0,R*.7),rect(R*.47,R*.8,0,R*.05),segment([-R*.58,R*.32],[R*.58,R*.32],R*.28),segment([-R*.13,-R*.23],[-R*.38,-R*.8],R*.31),segment([R*.13,-R*.23],[R*.38,-R*.8],R*.31)]);break;
 default:outline=union([circle(R),rect(R*.38,R*.22,0,R*.98)]);
 }
 // Adatta il nome intero, senza ritagliare i tratti delle lettere.
 if(p.containText){const text=drawings.find(d=>d.id==='text');if(text){
 const envelope=p.shape==='snowflake'?s.t(C.hull([outline])):outline;
 const safe=s.t(envelope.offset(-1.4,'Round',2,32));
 const relative=s.t(text.shape.translate([-p.x,-p.y]));let x=p.x,y=p.y;
 const candidate=(k:number)=>s.t(s.t(relative.scale([k,k])).translate([x,y]));
 const fits=(c:CrossSection)=>s.t(c.subtract(safe)).area()<1e-7;
 if(!fits(text.shape)){if(!fits(candidate(.2))){x=0;y=0;if(!fits(candidate(.02)))throw new Error('La sagoma è troppo piccola per questa scritta.');let low=0,high=1;for(let i=0;i<18;i++){const mid=(low+high)/2;x=p.x*mid;y=p.y*mid;if(fits(candidate(.2)))low=mid;else high=mid;}x=p.x*low*.97;y=p.y*low*.97;adjustments.x=x;adjustments.y=y;}
 let lo=.02,hi=1;for(let i=0;i<18;i++){const mid=(lo+hi)/2;if(fits(candidate(mid)))lo=mid;else hi=mid;}text.shape=candidate(lo*.995);
 }
 }}
 let base=outline;
 if(p.style==='outline'&&p.shape!=='snowflake')base=s.t(outline.subtract(s.t(outline.offset(-Math.max(2.5,p.size*.045),'Round',2,32))));
 if(p.style==='snow'&&p.shape!=='snowflake'){
 const cuts:CrossSection[]=[];for(const [x,y,k]of [[-.45,.38,.15],[.45,.38,.15],[-.48,-.4,.15],[.48,-.4,.15],[0,.64,.12],[0,-.66,.12]])cuts.push(s.t(flake(R*k,Math.max(.9,p.size*.014)).translate([R*x,R*y])));
 base=s.t(base.subtract(s.t(union(cuts).intersect(s.t(outline.offset(-3,'Round',2,32))))));
 }
 // Appoggi e collegamenti automatici per scritte/icone, anche sui modelli traforati.
 for(const d of drawings){const backing=s.t(d.shape.offset(1.4,'Round',2,32));base=s.t(base.add(backing));}
 let islands=base.decompose().map(a=>s.t(a));if(islands.length>1){let joined=islands[0];for(const island of islands.slice(1)){let a:Vec2=[0,0],b:Vec2=[0,0],distance=Infinity;for(const x of joined.toPolygons().flat())for(const y of island.toPolygons().flat()){const v=Math.hypot(x[0]-y[0],x[1]-y[1]);if(v<distance){distance=v;a=x;b=y;}}joined=s.t(s.t(joined.add(island)).add(segment(a,b,2.4)));}base=joined;}
 const top=base.toPolygons().flat().sort((a,b)=>b[1]-a[1])[0];if(p.shape==='bauble'&&Math.abs(top[0])<R*.2&&top[1]<R*1.2)top[0]=0;if(p.loop){const center:Vec2=[top[0],top[1]+p.hole/2];base=s.t(base.add(circle(p.hole/2+2,...center)));base=s.t(base.subtract(circle(p.hole/2,...center)));}
 let body=s.t(base.extrude(p.thickness));const solids:{solid:Manifold;id:string;color:string}[]=[];
 for(const d of drawings){const z=p.mode==='relief'?p.thickness-(seated?.25:0):p.thickness-p.relief;const h=p.mode==='relief'?p.relief+(seated?.25:0):p.relief;const solid=s.t(s.t(d.shape.extrude(h)).translate([0,0,z]));if(p.mode!=='relief'||seated)body=s.t(body.subtract(solid));for(const old of solids)old.solid=s.t(old.solid.subtract(solid));if(p.mode!=='engrave')solids.push({...d,solid});}
 parts.push({id:'base',name:'Ornamento',color:p.baseColor,mesh:toMeshData(body)});for(const d of solids)append(d.solid,d.id,d.id==='text'?'Nome':'Simbolo',d.color);
 }else{
 const amp=p.profile==='smooth'?0:Math.min(p.size*.02,p.wall*.8),twist=(p.profile==='spiral'?240:p.twist)*Math.PI/180;
 const wave=(radius:number)=>s.t(s.t(G.sphere(radius,Math.max(96,Math.min(128,p.ribs*6)))).warp(v=>{const z=v[2],t=Math.acos(Math.max(-1,Math.min(1,z/radius))),phi=Math.atan2(v[1],v[0]);const distance=Math.hypot(v[0],v[1]);if(distance>1e-6){const k=(distance+amp*Math.sin(t)*Math.cos(p.ribs*phi+twist*Math.cos(t)))/distance;v[0]*=k;v[1]*=k;}v[2]+=R-1;}));
 // Materializza la deformazione prima delle booleane: elimina le relazioni
 // planari della sfera originaria e usa la stessa precisione dei file esportati.
 const warped=toMeshData(wave(R)),resetMesh=new M.Mesh({numProp:3,vertProperties:warped.positions,triVerts:warped.indices});resetMesh.merge();const outer=s.t(new G(resetMesh)),inner=s.t(s.t(s.t(outer.translate([0,0,-(R-1)])).scale(1-p.wall/R)).translate([0,0,R-1]));
 const slab=s.t(s.t(G.cube([p.size*3,p.size*3,p.size-2],true)).translate([0,0,R-1]));let body=s.t(s.t(outer.subtract(inner)).intersect(slab));
 const seam=R-1;const lowerClip=s.t(s.t(G.cube([p.size*4,p.size*4,p.size*2],true)).translate([0,0,seam-p.size]));const upperClip=s.t(s.t(G.cube([p.size*4,p.size*4,p.size*2],true)).translate([0,0,seam+p.size]));
 const eq=body.slice(seam);s.t(eq);const edge=s.t(eq.offset(-p.wall*.28,'Round',2,64));const lip=s.t(s.t(edge.extrude(2.2)).translate([0,0,seam-.2]));const male=lip;
 const female=s.t(s.t(s.t(edge.offset(p.clearance,'Round',2,64)).extrude(2.25)).translate([0,0,seam]));
 let lower=s.t(s.t(body.intersect(lowerClip)).add(male)),upper=s.t(s.t(body.intersect(upperClip)).subtract(female));
 if(p.loop){const loop=s.t(s.t(s.t(s.t(circle(p.hole/2+2).subtract(circle(p.hole/2))).extrude(4)).rotate([90,0,0])).translate([0,2,p.size-2+p.hole/2]));upper=s.t(upper.add(loop));}
 const additions:{solid:Manifold;id:string;color:string}[]=[];
 const centered=(solid:Manifold,factor:number)=>s.t(s.t(s.t(solid.translate([0,0,-(R-1)])).scale(factor)).translate([0,0,R-1]));
 const outside=centered(outer,1+p.relief/R),inside=centered(outer,1-(p.mode==='relief'?seated?.25:0:p.relief)/R);
 const surface0=s.t((p.mode==='relief'?outside:outer).subtract(inside));
 const guard=centered(outer,1-Math.min(.25,p.wall*.2)/R);
 let surface=s.t(s.t((p.mode==='inlay'?s.t(surface0.intersect(centered(outer,1-.02/R))):surface0).subtract(guard)).subtract(s.t(male.add(female))));
 if(p.mode==='relief'&&!seated)surface=s.t(surface.subtract(s.t(lower.add(upper))));
 for(const d of drawings){const b=d.shape.bounds();if(Math.max(Math.abs(b.min[0]),Math.abs(b.max[0]))>R*.8||Math.max(Math.abs(b.min[1]),Math.abs(b.max[1]))>R*.75)throw new Error('Sulla pallina la decorazione deve restare nel fronte: riduci la misura o avvicinala al centro.');const prism=s.t(s.t(s.t(d.shape.extrude(p.size*2)).rotate([90,0,0])).translate([0,0,R-1]));const solid=s.t(prism.intersect(surface));if(solid.isEmpty())throw new Error('Decorazione fuori dalla pallina.');if(p.mode!=='relief'||seated){const cutShape=s.t(d.shape.offset(.04,'Round',2,32)),cutPrism=s.t(s.t(s.t(cutShape.extrude(p.size*2)).rotate([90,0,0])).translate([0,0,R-1]));const cutLayer=s.t(s.t(surface0.subtract(centered(outer,1-.32/R))).subtract(s.t(male.add(female))));const cut=s.t(cutPrism.intersect(cutLayer));lower=s.t(lower.subtract(cut));upper=s.t(upper.subtract(cut));}for(const old of additions)old.solid=s.t(old.solid.subtract(solid));if(p.mode!=='engrave')additions.push({...d,solid});}
 const clean=(m:Manifold)=>{const chunks=m.decompose().map(a=>s.t(a)).sort((a,b)=>b.volume()-a.volume());if(chunks.slice(1).some(c=>c.volume()>.01))throw new Error('Decorazione troppo vicina al bordo dell’incastro: spostala verso il centro.');return chunks[0];};lower=clean(lower);upper=clean(upper);
 parts.push({id:'lower',name:'Semisfera inferiore',color:p.baseColor,mesh:toMeshData(lower)},{id:'upper',name:'Semisfera superiore',color:p.baseColor,mesh:toMeshData(upper)});
 for(const d of additions){append(s.t(s.t(d.solid.intersect(lowerClip)).subtract(lower)),d.id+'-lower',d.id==='text'?'Nome inferiore':'Simbolo inferiore',d.color);append(s.t(s.t(d.solid.intersect(upperClip)).subtract(upper)),d.id+'-upper',d.id==='text'?'Nome superiore':'Simbolo superiore',d.color);}
 warnings.push('Pallina cava in due metà con incastro. Controlla i supporti nello slicer; prova l’incastro prima della stampa finale.');
 }
 return {parts,warnings,adjustments};
 }finally{s.free();}
}
/** Le semisfere si stampano con il bordo di unione sul piatto. */
export function printParts(parts:readonly Part[]):Part[]{return parts.map(part=>{if(part.id!=='lower')return part;const positions=new Float32Array(part.mesh.positions);for(let i=0;i<positions.length;i+=3){positions[i+1]=-positions[i+1];positions[i+2]=-positions[i+2];}return {...part,mesh:{positions,indices:part.mesh.indices}};});}
