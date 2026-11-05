import {Scope,toMeshData,type ManifoldToplevel,type Part,type Vec2} from '@bdl/geometry';
import {type VaseParams} from './params.ts';
const TAU=Math.PI*2;
const smooth=(x:number)=>{x=Math.min(1,Math.max(0,x));return x*x*(3-2*x);};
export function silhouetteRadius(p:VaseParams,t:number):number{
 const r=(p.bottomDiameter+(p.topDiameter-p.bottomDiameter)*t)/2,m=Math.min(p.bottomDiameter,p.topDiameter)/2,s=Math.sin(Math.PI*t);
 let c=0;
 switch(p.silhouette){
 case 'sphere':c=.8*s;break;
 case 'teardrop':c=1.1*s*(1-.7*t);break;
 case 'amphora':c=.85*s+.3*Math.sin(TAU*t);break;
 case 'hourglass':c=-.6*s;break;
 case 'bottle':c=.45*s-.9*s*Math.exp(-(((t-.8)/.14)**2));break;
 case 'tulip':c=-.5*s+.9*t*t*s;break;
 case 'barrel':c=.5*Math.sqrt(Math.max(0,s));break;
 case 'bulb':c=1.2*s*(1-t);break;
 case 'custom':{
 const nodes=[[0,p.bottomDiameter/2],[.4,p.bellyDiameter/2],[.78,p.neckDiameter/2],[1,p.topDiameter/2]];
 const k=t<.4?0:t<.78?1:2,a=nodes[k],b=nodes[k+1],u=smooth((t-a[0])/(b[0]-a[0]));
 return Math.max(p.wall*2+4,a[1]+(b[1]-a[1])*u);
 }}
 return Math.max(p.wall*2+4,r+m*p.intensity*c);
}
function profileRadius(p:VaseParams,a:number,minR:number):number{
 if(p.profile==='faceted'){const local=((a%(TAU/p.sides)+TAU/p.sides)%(TAU/p.sides))-Math.PI/p.sides;return Math.cos(Math.PI/p.sides)/Math.cos(local);}
 if(p.profile==='wavy')return 1+p.waveDepth/minR*Math.cos(p.sides*a);
 if(p.profile==='oval')return 1/Math.sqrt(Math.cos(a)**2+(Math.sin(a)/.72)**2);
 if(p.profile==='roundedSquare')return 1/(Math.abs(Math.cos(a))**4+Math.abs(Math.sin(a))**4)**.25;
 if(p.profile==='star')return .82+.18*Math.cos(p.sides*a);
 return 1;
}
export function zoneWeight(p:VaseParams,t:number):number{
 const a=p.patternStart/100,b=p.patternEnd/100;
 if(t<=a||t>=b)return 0;
 const f=Math.min(p.fade/100,(b-a)/2);
 return f>0?smooth((t-a)/f)*smooth((b-t)/f):1;
}
function finishHeight(p:VaseParams,a:number,t:number):number{
 const q=p.ribCount*(a-p.helix*Math.PI/180*t),d=(v:number)=>Math.abs(((v/TAU+.5)%1+1)%1-.5)*2;
 const rib=(v:number)=>{const u=d(v)/p.ribWidth;if(u>=1)return 0;return p.ribShape==='sharp'?1-u:p.ribShape==='flat'?smooth((1-u)*5):Math.cos(u*Math.PI/2)**2;};
 let f=0;
 switch(p.finish){
 case 'ribs':f=rib(p.ribCount*a);break;
 case 'fins':case 'spiral':f=rib(q);break;
 case 'lattice':f=Math.max(rib(q),rib(p.ribCount*(a+p.helix*Math.PI/180*t)));break;
 case 'rings':f=(.5+.5*Math.cos(TAU*p.textureRows*t))**3;break;
 case 'waves':f=(.5+.5*Math.cos(TAU*p.textureRows*t+1.5*Math.sin(p.ribCount*a)))**3;break;
 case 'diamond':f=Math.max(0,1-Math.min(Math.abs(Math.sin(q+TAU*p.textureRows*t)),Math.abs(Math.sin(q-TAU*p.textureRows*t)))/.35);break;
 case 'honeycomb':{
 // Pointy hexagons tile a staggered lattice: no diagonal stripes.
 const x=p.ribCount*a/TAU,y=t*p.textureRows*.8660254037844386;
 const row=Math.round(y/.8660254037844386);let gauge=Infinity;
 for(let j=row-1;j<=row+1;j++){
 const cx=Math.round(x-.5*(j%2))+.5*(j%2),dx=Math.abs(x-cx),dy=Math.abs(y-j*.8660254037844386);
 gauge=Math.min(gauge,Math.max(dx,.5*dx+.8660254037844386*dy));
 }
 f=1-smooth((.5-gauge)/.085);break;}
 case 'dots':{const dx=d(p.ribCount*a)/.75,dy=d(TAU*p.textureRows*t)/.75;f=Math.sqrt(Math.max(0,1-dx*dx-dy*dy));break;}
 }
 return p.ribDepth*zoneWeight(p,t)*f;
}
export function buildDesignVase(M:ManifoldToplevel,p:VaseParams):{parts:Part[];warnings:string[]}{
 const s=new Scope(),t=<T extends {delete():void}>(v:T)=>s.t(v),warnings:string[]=[];
 try{
 const angular=p.finish==='none'?192:Math.max(192,Math.min(768,p.ribCount*(p.finish==='honeycomb'?32:10)));
 const axial=Math.max(48,Math.min(480,Math.max(Math.ceil(p.height/2),p.finish==='none'?0:p.textureRows*(p.finish==='honeycomb'?24:6),['fins','spiral','lattice'].includes(p.finish)?Math.ceil(p.ribCount*Math.abs(p.helix)/360*6):0)));
 const levels=Array.from(new Set([0,p.bottomThickness,...Array.from({length:axial},(_,i)=>(i+1)*p.height/axial),p.height*p.patternStart/100,p.height*p.patternEnd/100].map(z=>Math.round(z*1e5)/1e5))).sort((a,b)=>a-b);
 const minR=Math.min(...levels.map(z=>silhouetteRadius(p,z/p.height)));
 const poly:Vec2[]=Array.from({length:angular},(_,i)=>{const a=TAU*i/angular,r=minR*profileRadius(p,a,minR);return[r*Math.cos(a),r*Math.sin(a)];});
 const outer=t(M.CrossSection.ofPolygons([poly])),inner=t(outer.offset(-p.wall,'Round',2,48));
 if(inner.isEmpty())throw Error('Pareti troppo spesse per questa sezione.');
 const rings=inner.toPolygons();
 const innerR=Array.from({length:angular},(_,i)=>{
 const dx=Math.cos(TAU*i/angular),dy=Math.sin(TAU*i/angular);let hit=Infinity;
 for(const ring of rings)for(let k=0;k<ring.length;k++){
 const a=ring[k],b=ring[(k+1)%ring.length],ex=b[0]-a[0],ey=b[1]-a[1],den=dx*ey-dy*ex;
 if(Math.abs(den)<1e-9)continue;
 const r=(a[0]*ey-a[1]*ex)/den,u=(a[0]*dy-a[1]*dx)/den;
 if(r>0&&u>=-1e-7&&u<=1.0000001)hit=Math.min(hit,r);
 }if(!Number.isFinite(hit))throw Error('Sezione interna non valida.');return hit;
 });
 const v:number[]=[],f:number[]=[];
 const ring=(z:number,inside:boolean)=>{
 const k=v.length/3,ratio=silhouetteRadius(p,z/p.height)/minR,rot=p.twist*Math.PI/180*z/p.height;
 for(let i=0;i<angular;i++){const track=['fins','spiral'].includes(p.finish)?p.helix*Math.PI/180*z/p.height:0,a=TAU*i/angular+track,at=((a/TAU*angular)%angular+angular)%angular,j=Math.floor(at),u=at-j;
 const ri=innerR[j]*(1-u)+innerR[(j+1)%angular]*u;
 const r=inside?ri*ratio:minR*profileRadius(p,a,minR)*ratio+finishHeight(p,a,z/p.height);v.push(r*Math.cos(a+rot),r*Math.sin(a+rot),z);}
 return k;
 };
 const out=levels.map(z=>ring(z,false)),insideLevels=levels.filter(z=>z>=p.bottomThickness),inn=insideLevels.map(z=>ring(z,true));
 const join=(a:number,b:number,invert=false)=>{for(let i=0;i<angular;i++){const j=(i+1)%angular;if(invert)f.push(a+i,b+i,a+j,a+j,b+i,b+j);else f.push(a+i,a+j,b+i,a+j,b+j,b+i);}};
 for(let k=0;k<out.length-1;k++)join(out[k],out[k+1]);
 for(let k=0;k<inn.length-1;k++)join(inn[k],inn[k+1],true);
 const floor=v.length/3;v.push(0,0,0);const bottom=v.length/3;v.push(0,0,p.bottomThickness);
 for(let i=0;i<angular;i++){const j=(i+1)%angular;f.push(floor,out[0]+j,out[0]+i,bottom,inn[0]+i,inn[0]+j);const a=out.at(-1)!,b=inn.at(-1)!;f.push(a+i,a+j,b+i,a+j,b+j,b+i);}
 const mesh=new M.Mesh({numProp:3,vertProperties:new Float32Array(v),triVerts:new Uint32Array(f)});mesh.merge();
 let body=t(new M.Manifold(mesh));
 if(p.drainageHole){const d=Math.min(p.drainageDiameter,Math.min(...innerR)*silhouetteRadius(p,0)/minR*1.8);body=t(body.subtract(t(t(M.Manifold.cylinder(p.bottomThickness+.04,d/2,d/2,48)).translate([0,0,-.02]))));warnings.push('Foro di drenaggio attivo: il vaso non trattiene acqua.');}
 if(body.status()!=='NoError'||body.isEmpty())throw Error('Geometria non valida: prova una finitura meno profonda.');
 if(body.decompose().map(t).length!==1)throw Error('La superficie genera parti separate.');
 const pitch=TAU*minR/p.ribCount;
 if(p.finish!=='none'&&pitch<1.4)warnings.push('Finitura molto fitta: aumenta il diametro o riduci il numero di elementi.');
 let slope=0;for(let k=1;k<levels.length;k++){const dz=levels[k]-levels[k-1];if(dz>0)slope=Math.max(slope,(silhouetteRadius(p,levels[k]/p.height)-silhouetteRadius(p,levels[k-1]/p.height))/dz);}
 if(slope>1.4)warnings.push('La silhouette si allarga rapidamente: controlla gli sbalzi nello slicer.');
 return{parts:[{id:'vase',name:'Vaso',color:p.color,mesh:toMeshData(body)}],warnings};
 }finally{s.free();}
}
