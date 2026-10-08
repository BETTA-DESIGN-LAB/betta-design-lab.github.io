import { Scope,toMeshData,type ManifoldToplevel,type CrossSection,type Manifold,type Part, regularPolygon } from '@bdl/geometry';
import type { SvgArtwork } from '../../coaster/src/svg.ts';
import { sanitize,type Params } from './params.ts';
export interface Design { main?:SvgArtwork; extra?:SvgArtwork; cover?:SvgArtwork; initial?:SvgArtwork; team?:SvgArtwork; number?:SvgArtwork; qrModules?:number }
export function build(M:ManifoldToplevel,input:Params,design:Design={}) {
 const p=sanitize(input),s=new Scope(),warnings:string[]=[],parts:Part[]=[];
 const hasInitial=p.model==='initial'&&Boolean(p.initial.trim());
 const nameOnly=p.model==='name'||(p.model==='initial'&&!hasInitial);
 if(p.model==='initial')design={...design,main:p.text.trim()?design.main:undefined,initial:hasInitial?design.initial:undefined};
 if(p.model==='initial'&&!hasInitial&&!p.text.trim())throw new Error('Scrivi una lettera, un nome oppure entrambi.');
 try {
 const C=M.CrossSection;const decorations:{solid:Manifold;id:string;color:string}[]=[];
 const section=(a:SvgArtwork,filled=false)=>{const shapes=filled?a.filledShapes??[]:a.shapes;if(!shapes.length)throw new Error('Per la sagoma SVG servono aree piene.');return s.t(C.union(shapes.map(r=>s.t(C.ofPolygons(r,'EvenOdd')))));};
 const fit=(a:SvgArtwork,w:number,h:number)=>{const c=section(a),b=c.bounds(),k=Math.min(w/(b.max[0]-b.min[0]),h/(b.max[1]-b.min[1]));return s.t(c.scale([k,k]));};
 const rounded=(w:number,h:number)=>s.t(s.t(C.square([w-6,h-6],true)).offset(3,'Round',2,48));
 const fillHoles=(c:CrossSection)=>s.t(C.union(c.toPolygons().map(r=>s.t(C.ofPolygons([r],'EvenOdd')))));
 const extra=design.extra?s.t(s.t(fit(design.extra,p.extraSize,p.extraSize).rotate(p.extraAngle)).translate([p.extraX,p.extraY])):null;
 let base:CrossSection;
 if(nameOnly) {
 if(!design.main)throw new Error('Scrivi un nome.');
 const text=s.t(fit(design.main,p.width,p.depth-10).scale(p.scale/100).rotate(p.angle).translate([p.x,p.y]));const combined=extra?s.t(text.add(extra)):text;base=fillHoles(s.t(combined.offset(p.border,'Round',2,48)));
 const islands=base.decompose().map(a=>s.t(a)).sort((a,b)=>b.area()-a.area());
 if(islands.length>1){let joined=islands[0];for(const island of islands.slice(1)){
 let aa:[number,number]=[0,0],bb:[number,number]=[0,0],distance=Infinity;
 for(const a of joined.toPolygons().flat())for(const b of island.toPolygons().flat()){const d=Math.hypot(a[0]-b[0],a[1]-b[1]);if(d<distance){distance=d;aa=a;bb=b;}}
 const ends=[aa,bb].map(at=>s.t(s.t(C.circle(1,32)).translate(at)));joined=s.t(s.t(joined.add(island)).add(s.t(C.hull(ends))));}
 base=fillHoles(joined);}
 }else if(p.model==='initial' && p.shape==='svg') {
 if(!design.initial)throw new Error('Inserisci un’iniziale.');
 // La lettera è il corpo stampabile. Le scritte e i simboli mantengono tutto il loro contorno.
 base=fit(design.initial,p.width,p.depth);
 const additions:CrossSection[]=[];
 if(design.main){const name=s.t(s.t(fit(design.main,p.width*.9*p.scale/100,p.depth*.3*p.scale/100).rotate(p.angle)).translate([p.x,p.y]));additions.push(fillHoles(s.t(name.offset(p.border,'Round',2,48))));}
 if(extra)additions.push(fillHoles(s.t(extra.offset(p.border,'Round',2,48))));
 for(const addition of additions){const islands=addition.decompose().map(a=>s.t(a));for(const island of islands){const combined=s.t(base.add(island));if(combined.decompose().map(a=>s.t(a)).length>1){let aa:[number,number]=[0,0],bb:[number,number]=[0,0],distance=Infinity;for(const a of base.toPolygons().flat())for(const b of island.toPolygons().flat()){const d=Math.hypot(a[0]-b[0],a[1]-b[1]);if(d<distance){distance=d;aa=a;bb=b;}}const ends=[aa,bb].map(at=>s.t(s.t(C.circle(1,32)).translate(at)));base=s.t(combined.add(s.t(C.hull(ends))));}else base=combined;}}
 const islands=base.decompose().map(a=>s.t(a));if(islands.length>1)base=s.t(C.hull(islands));
 }
 else if(p.model==='svg' && p.shape==='svg') {if(!design.main)throw new Error('Carica un SVG.');base=fit({...design.main,shapes:design.main.filledShapes??[]},p.width,p.depth);if(base.decompose().map(a=>s.t(a)).length!==1)throw new Error('La sagoma SVG deve essere una sola forma connessa.');}
 else if(p.model==='jersey')base=s.t(s.t(C.ofPolygons([[[-.3,-.5],[.3,-.5],[.3,.1],[.48,0],[.6,.25],[.27,.5],[.12,.5],[.08,.4],[-.08,.4],[-.12,.5],[-.27,.5],[-.6,.25],[-.48,0],[-.3,.1]]])).scale([p.width/1.2,p.depth]));
 else if(p.shape==='heart')base=s.t(C.ofPolygons([Array.from({length:160},(_,i)=>{const t=i*2*Math.PI/160;return [Math.pow(Math.sin(t),3)*p.width/2,(13*Math.cos(t)-5*Math.cos(2*t)-2*Math.cos(3*t)-Math.cos(4*t))*p.depth/32] as [number,number];})],'EvenOdd'));
 else if(p.shape==='hex')base=s.t(C.ofPolygons([regularPolygon(6,Math.min(p.width,p.depth))]));
 else if(p.shape==='oval')base=s.t(s.t(C.circle(1,128)).scale([p.width/2,p.depth/2]));
 else base=p.shape==='round'?s.t(C.circle(Math.min(p.width,p.depth)/2,128)):rounded(p.width,p.depth);
 const shirt=base;
 let bb=base.bounds();
 if(p.model==='jersey'&&p.loop){base=s.t(base.add(s.t(s.t(C.square([p.hole+5,p.depth*.2],true)).translate([0,bb.max[1]-p.depth*.1]))));}
 bb=base.bounds();let cx=nameOnly?bb.min[0]+Math.min(7,(bb.max[0]-bb.min[0])/3):p.shape==='heart'?p.width*.27:(bb.min[0]+bb.max[0])/2;
 let edgeY=-Infinity;
 for(const polygon of base.toPolygons())for(let i=0;i<polygon.length;i++){const a=polygon[i],b=polygon[(i+1)%polygon.length];if(a[0]!==b[0]&&cx>=Math.min(a[0],b[0])&&cx<=Math.max(a[0],b[0]))edgeY=Math.max(edgeY,a[1]+(b[1]-a[1])*(cx-a[0])/(b[0]-a[0]));}
 if(!Number.isFinite(edgeY)){const top=base.toPolygons().flat().sort((a,b)=>b[1]-a[1])[0];cx=top[0];edgeY=top[1];}
 const cy=p.ringType==='internal'?edgeY-p.hole/2-p.ringWall:edgeY+p.hole/2;
 const ring=s.t(s.t(C.circle(p.hole/2+p.ringWall,64)).translate([cx,cy]));if(p.loop&&p.ringType==='external')base=s.t(base.add(ring));
 const bore=s.t(s.t(C.circle(p.hole/2,64)).translate([cx,cy]));if(p.loop)base=s.t(base.subtract(bore));
 let body=s.t(base.extrude(p.thickness));const field=s.t(base.offset(-0.6,'Round',2,32));let extraField=field;
 const decorate=(a:SvgArtwork|undefined,w:number,h:number,x:number,y:number,id:string,mode=p.mode,color=p.artColor,outline=false,rotation=p.angle)=>{
 if(!a)return;let drawing=fit(a,w,h);drawing=s.t(s.t(drawing.rotate(rotation)).translate([x,y]));const clipped=s.t(drawing.intersect(field));
 if(clipped.isEmpty())throw new Error('Decorazione fuori dalla superficie.');if(drawing.area()-clipped.area()>.01)warnings.push('Decorazione ritagliata: riduci la misura o spostala.');
 if(outline&&p.textOutline){const halo=s.t(s.t(clipped.offset(p.outlineWidth,'Round',2,32)).intersect(field));const solid=s.t(s.t(halo.extrude(p.relief)).translate([0,0,mode==='relief'?p.thickness:p.thickness-p.relief]));if(mode!=='relief')body=s.t(body.subtract(solid));for(const old of decorations)old.solid=s.t(old.solid.subtract(solid));decorations.push({solid,id:id+'-contorno',color:p.outlineColor});}
 const z=mode==='relief'?p.thickness:p.thickness-p.relief;
 const solid=s.t(s.t(clipped.extrude(p.relief)).translate([0,0,z]));
 if(mode!=='relief'){const pocket=mode==='inlay'&&p.clearance>0?s.t(s.t(clipped.offset(p.clearance,'Round',2,32)).intersect(field)):clipped;body=s.t(body.subtract(s.t(s.t(pocket.extrude(p.relief+.02)).translate([0,0,z]))));}
 for(const old of decorations)old.solid=s.t(old.solid.subtract(solid));
 if(mode!=='engrave'){decorations.push({solid,id,color});}
 };
 if(p.model==='qr'){
 if(!design.main)throw new Error('Inserisci un QR.');const size=Math.min(p.width,p.depth)*p.qrSize/100;
 // QR conserva le quattro celle bianche di margine, senza rotazione o ritaglio.
 const quiet=s.t(s.t(s.t(C.square([size,size],true)).rotate(p.qrAngle)).translate([p.qrX,p.qrY]));if(s.t(quiet.subtract(field)).area()>.01)throw new Error('Il QR con il margine bianco deve stare interamente sulla base: riduci la misura o spostalo.');extraField=s.t(field.subtract(quiet));
 const code=s.t(s.t(s.t(section(design.main).scale([size,size])).rotate(p.qrAngle)).translate([p.qrX,p.qrY]));const solid=s.t(s.t(code.extrude(p.relief)).translate([0,0,p.thickness-p.relief]));body=s.t(body.subtract(solid));parts.push({id:'qr',name:'QR',color:p.artColor,mesh:toMeshData(solid)});
 if(size/(design.qrModules??29)<.8)warnings.push('QR molto fine: aumenta le dimensioni o accorcia il link.');
 warnings.push('QR: usa base chiara e codice scuro; verifica la scansione dopo la stampa.');
 }else if(p.model==='music'){const hasCover=Boolean(design.cover);decorate(design.main,p.width*(hasCover?.5:.8),p.depth*.5,hasCover?p.width*.16:0,0,'Codice musicale');decorate(design.cover,p.depth*.65,p.depth*.65,-p.width*.32,0,'Copertina');}
 else if(p.model==='jersey') {
 const layer=(drawing:CrossSection,id:string,color:string)=>{const clipped=s.t(drawing.intersect(shirt));if(clipped.isEmpty())return;const solid=s.t(s.t(clipped.extrude(p.relief)).translate([0,0,p.mode==='relief'?p.thickness:p.thickness-p.relief]));if(p.mode!=='relief'){const cutter=s.t(s.t(s.t(clipped.offset(.005,'Round',2,32)).extrude(p.relief+.01)).translate([0,0,p.thickness-p.relief]));body=s.t(body.subtract(cutter));}for(const old of decorations)old.solid=s.t(old.solid.subtract(solid));decorations.push({solid,id,color});};
 const seed=s.t(C.square([1,1],true));let pattern=s.t(seed.subtract(seed));const bars:CrossSection[]=[];
 if(['vertical','horizontal','diagonal'].includes(p.jerseyPattern)){for(let x=-300;x<=300;x+=p.stripeWidth+p.stripeGap)bars.push(s.t(s.t(C.square([p.stripeWidth,600],true)).translate([x+p.stripeOffset,0])));pattern=s.t(C.union(bars));if(p.jerseyPattern!=='vertical')pattern=s.t(pattern.rotate(p.jerseyPattern==='horizontal'?90:35));}
 else if(p.jerseyPattern==='half')pattern=s.t(s.t(C.square([300,600],true)).translate([150,0]));
 else if(p.jerseyPattern==='broad')pattern=s.t(s.t(C.square([p.width*.25,600],true)).translate([p.stripeOffset,0]));
 else if(p.jerseyPattern==='sides')pattern=s.t(C.union([-1,1].map(sign=>s.t(s.t(C.square([p.stripeWidth,600],true)).translate([sign*p.width*.22,0])))));
 if(!p.sleevesPattern)pattern=s.t(pattern.intersect(s.t(C.square([p.width*.49,600],true))));layer(pattern,'Divisa',p.patternColor);
 if(p.shirtBorder)layer(s.t(shirt.subtract(s.t(shirt.offset(-p.edgeWidth,'Round',2,32)))),'Bordo',p.edgeColor);
 if(p.collar){const neck=s.t(s.t(C.circle(p.width*.11,64)).scale([1,.65]).translate([0,p.depth*.49]));const inner=s.t(neck.offset(-p.collarWidth,'Round',2,32));layer(s.t(neck.subtract(inner)),'Colletto',p.collarColor);}
 decorate(design.main,p.width*.44,p.nameSize,0,p.depth*p.nameY/100,'Nome',p.mode,p.artColor,true);
 decorate(design.number,p.width*.4,p.numberSize,0,p.depth*p.numberY/100,'Numero',p.mode,p.artColor,true);
 decorate(design.team,p.width*.44,p.teamSize,0,p.depth*p.teamY/100,'Squadra',p.mode,p.artColor,true);
 }

 else {
 if(hasInitial&&p.shape!=='svg')decorate(design.initial,p.width*.65,p.depth*.72,0,0,'Iniziale',p.mode,p.initialColor);
 const letterBody=hasInitial&&p.shape==='svg';
 decorate(design.main,p.width*(letterBody?.9:1)*p.scale/100,(nameOnly?p.depth-10:letterBody?p.depth*.3:p.depth*.6)*p.scale/100,p.x,p.y,'Decorazione');
 }
 if(extra){if(p.model==='qr'&&s.t(extra.intersect(s.t(field.subtract(extraField)))).area()>.01)throw new Error('SVG o icona invade il margine del QR: spostalo fuori dal codice.');decorate(design.extra,p.extraSize,p.extraSize,p.extraX,p.extraY,'Simbolo',p.mode,p.extraColor,false,p.extraAngle);}
 for(const decoration of decorations)for(const [i,item]of decoration.solid.decompose().map(a=>s.t(a)).entries())if(!item.isEmpty()&&item.volume()>1e-5)parts.push({id:`${decoration.id}-${i}`,name:`${decoration.id} ${i+1}`,color:decoration.color,mesh:toMeshData(item)});

 parts.unshift({id:'base',name:'Base',color:p.baseColor,mesh:toMeshData(body)});return {parts,warnings};
 }finally{s.free();}
}
