import type {SvgArtwork} from '../../coaster/src/svg.ts';
import type {Vec2} from '@bdl/geometry';
/** Traccia soltanto il bordo del testo ad alta risoluzione, mantenendo i fori. */
export function traceLetterContours(image:{width:number;height:number;data:Uint8ClampedArray},name:string):SvgArtwork{
 const {width:w,height:h,data}=image,stride=w+1,edges=new Map<number,number[]>();
 const dark=(x:number,y:number)=>{if(x<0||x>=w||y<0||y>=h)return false;const i=(y*w+x)*4;return data[i+3]>=128&&data[i]*.2126+data[i+1]*.7152+data[i+2]*.0722<180;};
 const edge=(x:number,y:number,X:number,Y:number)=>{const a=y*stride+x,b=Y*stride+X;const next=edges.get(a);if(next)next.push(b);else edges.set(a,[b]);};
 let minX=w,maxX=0,minY=h,maxY=0;
 for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(dark(x,y)){
  minX=Math.min(minX,x);maxX=Math.max(maxX,x+1);minY=Math.min(minY,y);maxY=Math.max(maxY,y+1);
  if(!dark(x,y-1))edge(x,y,x+1,y);if(!dark(x+1,y))edge(x+1,y,x+1,y+1);
  if(!dark(x,y+1))edge(x+1,y+1,x,y+1);if(!dark(x-1,y))edge(x,y+1,x,y);
 }
 if(!edges.size)throw new Error('Nessuna lettera visibile.');
 const simplify=(points:Vec2[]):Vec2[]=>{
  if(points.length<=3)return points;
  const a=points[0],b=points.at(-1)!,dx=b[0]-a[0],dy=b[1]-a[1],den=dx*dx+dy*dy;
  let best=.8*.8,at=-1;
  for(let i=1;i<points.length-1;i++){const p=points[i],u=den?Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/den)):0;const d=(p[0]-a[0]-u*dx)**2+(p[1]-a[1]-u*dy)**2;if(d>best){best=d;at=i;}}
  return at<0?[a,b]:[...simplify(points.slice(0,at+1)).slice(0,-1),...simplify(points.slice(at))];
 };
 const rings:Vec2[][]=[];
 while(edges.size){
  const start=edges.keys().next().value!;let current=start;const ring:Vec2[]=[];
  do{ring.push([current%stride,Math.floor(current/stride)]);const next=edges.get(current);if(!next?.length)throw new Error('Contorno del testo incompleto.');const end=next.pop()!;if(!next.length)edges.delete(current);current=end;}while(current!==start);
  if(ring.length>=4){const mid=Math.floor(ring.length/2),clean=[...simplify(ring.slice(0,mid+1)).slice(0,-1),...simplify([...ring.slice(mid),ring[0]]).slice(0,-1)];if(clean.length>=3)rings.push(clean);}
 }
 const size=Math.max(maxX-minX,maxY-minY),cx=(minX+maxX)/2,cy=(minY+maxY)/2;
 const normalized=rings.map(r=>r.map(([x,y]):Vec2=>[(x-cx)/size,(cy-y)/size]));
 return{name,shapes:[normalized],filledShapes:[normalized]};
}
