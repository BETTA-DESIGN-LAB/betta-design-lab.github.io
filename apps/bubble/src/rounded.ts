import type {CrossSection,Manifold,ManifoldToplevel,Scope,Vec2} from '@bdl/geometry';
import type {Params} from './params.ts';
import {textureAt} from './textures.ts';

function signedDistance(x:number,y:number,rings:Vec2[][]):number {
  let inside=false,squared=Infinity;
  for(const ring of rings)for(let i=0,j=ring.length-1;i<ring.length;j=i++){
    const a=ring[j],b=ring[i],dx=b[0]-a[0],dy=b[1]-a[1];
    if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])inside=!inside;
    const u=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy||1)));
    squared=Math.min(squared,(x-a[0]-u*dx)**2+(y-a[1]-u*dy)**2);
  }
  const distance=Math.sqrt(squared);
  return inside?distance:-distance;
}
// Fill enclosed depressions up to their escape saddle. This keeps every
// horizontal contour counterless, including where rounding closes a tiny gap.
function fillPockets(field:Float32Array,nx:number,ny:number){
  const seen=new Uint8Array(field.length),heap:{i:number;v:number}[]=[];
  const push=(i:number,v:number)=>{let at=heap.length;heap.push({i,v});while(at){const parent=(at-1)>>1;if(heap[parent].v<=v)break;heap[at]=heap[parent];at=parent;}heap[at]={i,v};};
  const add=(i:number,v:number)=>{if(seen[i])return;seen[i]=1;field[i]=Math.max(field[i],v);push(i,field[i]);};
  for(let x=0;x<nx;x++){add(x,-Infinity);add((ny-1)*nx+x,-Infinity);}
  for(let y=1;y<ny-1;y++){add(y*nx,-Infinity);add(y*nx+nx-1,-Infinity);}
  while(heap.length){
    const first=heap[0],last=heap.pop()!;
    if(heap.length){let at=0;while(at*2+1<heap.length){let child=at*2+1;if(child+1<heap.length&&heap[child+1].v<heap[child].v)child++;if(heap[child].v>=last.v)break;heap[at]=heap[child];at=child;}heap[at]=last;}
    const x=first.i%nx,y=Math.floor(first.i/nx);
    if(x)add(first.i-1,first.v);if(x+1<nx)add(first.i+1,first.v);
    if(y)add(first.i-nx,first.v);if(y+1<ny)add(first.i+nx,first.v);
  }
}
export function roundedLetter(M:ManifoldToplevel,scope:Scope,outline:CrossSection,holes:CrossSection[],p:Params,counterless=false):Manifold {
  const t=<T extends {delete():void}>(object:T)=>scope.t(object);
  const box=outline.bounds(),width=box.max[0]-box.min[0],height=box.max[1]-box.min[1];
  const depth=p.thickness+p.height*.14*p.inflate/100;
  const resolution=Math.max(.18,Math.min(Math.max(.28,Math.max(width,height)/280),p.texture==='smooth'?1:p.textureScale/12));
  const pad=3+resolution*3+p.textureDepth*2;
  const left=box.min[0]-pad,bottom=box.min[1]-pad;
  const nx=Math.ceil((width+pad*2)/resolution)+1,ny=Math.ceil((height+pad*2)/resolution)+1;
  const raw=new Float32Array(nx*ny),voidField=new Float32Array(nx*ny),rings=outline.toPolygons();
  const holeRings=holes.map(hole=>hole.toPolygons());
  for(let row=0;row<ny;row++)for(let col=0;col<nx;col++){
    const x=left+col*resolution,y=bottom+row*resolution;
    raw[row*nx+col]=signedDistance(x,y,rings);
    voidField[row*nx+col]=holeRings.reduce((distance,hole)=>Math.min(distance,-signedDistance(x,y,hole)),100000);
  }
  const sigma=Math.min(2,p.height*.009+.18)/resolution;
  const radius=Math.ceil(sigma*2.5),weights=Array.from({length:radius*2+1},(_,i)=>Math.exp(-Math.pow((i-radius)/sigma,2)/2));
  const total=weights.reduce((sum,w)=>sum+w,0);
  const horizontal=new Float32Array(raw.length),field=new Float32Array(raw.length);
  for(let row=0;row<ny;row++)for(let col=0;col<nx;col++){
    let value=0;for(let i=-radius;i<=radius;i++)value+=raw[row*nx+Math.max(0,Math.min(nx-1,col+i))]*weights[i+radius];
    horizontal[row*nx+col]=value/total;
  }
  let maximum=0;
  for(let row=0;row<ny;row++)for(let col=0;col<nx;col++){
    let value=0;for(let i=-radius;i<=radius;i++)value+=horizontal[Math.max(0,Math.min(ny-1,row+i))*nx+col]*weights[i+radius];
    field[row*nx+col]=value/total;maximum=Math.max(maximum,value/total);
  }
  if(counterless)fillPockets(field,nx,ny);
  if(maximum<.3)throw new Error('Tratti troppo sottili. Aumenta l’altezza o scegli uno stile più pieno.');
  const sample=(x:number,y:number,values=field)=>{
    const gx=(x-left)/resolution,gy=(y-bottom)/resolution;
    const col=Math.max(0,Math.min(nx-2,Math.floor(gx))),row=Math.max(0,Math.min(ny-2,Math.floor(gy)));
    const u=Math.max(0,Math.min(1,gx-col)),v=Math.max(0,Math.min(1,gy-row));
    return (values[row*nx+col]*(1-u)+values[row*nx+col+1]*u)*(1-v)+(values[(row+1)*nx+col]*(1-u)+values[(row+1)*nx+col+1]*u)*v;
  };
  const textureField=new Float32Array(nx*ny);
  if(p.texture!=='smooth'&&p.textureDepth>0)for(let row=0;row<ny;row++)for(let col=0;col<nx;col++)
    textureField[row*nx+col]=textureAt(p.texture,left+col*resolution,bottom+row*resolution,p.textureScale);
  const rounding=maximum*1.04,center=depth*.3,verticalRadius=depth*.7;
  const edge=Math.max(.28,Math.max(width,height)/250,Math.cbrt(width*height*depth/2500000),p.texture==='smooth'?.55:Math.min(.48,p.textureScale/8));
  const sampled=t(M.Manifold.levelSet(([x,y,z])=>{
    const d=sample(x,y);
    const side=Math.max(0,1-d/rounding);
    let value=rounding*(1-Math.hypot(side,(z-center)/verticalRadius));
    if(p.texture!=='smooth'&&p.textureDepth>0) {
      const texture=sample(x,y,textureField);
      // Keep a continuous rear skin. Texture valleys must not puncture the
      // printable back at narrow rounded joins.
      value+=texture*p.textureDepth*Math.min(1,Math.max(0,(z-1.2)/1.5))*Math.max(0,Math.min(1,d/(p.textureDepth+.5)));
    }
    if(holes.length)value=Math.min(value,sample(x,y,voidField));
    return Math.min(value,z);
  },{min:[left,bottom,-pad],max:[left+(nx-1)*resolution,bottom+(ny-1)*resolution,depth+p.textureDepth*4+pad]},edge));
  const surface=t(sampled.simplify(.008));
  if(surface.isEmpty()||surface.status()!=='NoError')throw new Error('Bombatura non valida. Prova un carattere più grande.');
  // The sampled surface can contain sub-resolution enclosed bubbles at a
  // texture saddle. Keep printable positive shells, preserving real glyph islands.
  const minimum=Math.max(.03,surface.volume()*.000005);
  const shells=surface.decompose().map(piece=>t(piece)).filter(piece=>piece.volume()>minimum);
  if(!shells.length)throw new Error('La lettera è troppo piccola per questa finitura.');
  return shells.length===1?shells[0]:t(M.Manifold.union(shells));
}
