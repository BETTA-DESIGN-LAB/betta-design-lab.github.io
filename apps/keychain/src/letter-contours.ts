import type {SvgArtwork} from '../../coaster/src/svg.ts';
import type {Vec2} from '@bdl/geometry';
/** Marching squares on antialias coverage: interpolate the edge between pixels. */
export function traceLetterContours(image:{width:number;height:number;data:Uint8ClampedArray},name:string):SvgArtwork{
 const {width:w,height:h,data}=image,threshold=180;
 const values=new Float32Array(w*h);
 for(let i=0;i<values.length;i++){const k=i*4,a=data[k+3]/255;values[i]=255*(1-a)+a*(data[k]*.2126+data[k+1]*.7152+data[k+2]*.0722);}
 const sample=(x:number,y:number)=>x<0||y<0||x>=w||y>=h?255:values[y*w+x];
 const points=new Map<number,Vec2>(),edges=new Map<number,number[]>(),stride=w+1;
 const point=(side:number,x:number,y:number,v:number[])=>{
  const endpoints=[[0,1],[1,2],[3,2],[0,3]],coords=[[x+.5,y+.5],[x+1.5,y+.5],[x+1.5,y+1.5],[x+.5,y+1.5]];
  const [a,b]=endpoints[side],u=(threshold-v[a])/(v[b]-v[a]);
  const id=side===0?2*((y+1)*stride+x+1):side===2?2*((y+2)*stride+x+1):side===1?2*((y+1)*stride+x+2)+1:2*((y+1)*stride+x+1)+1;
  if(!points.has(id))points.set(id,[coords[a][0]+u*(coords[b][0]-coords[a][0]),coords[a][1]+u*(coords[b][1]-coords[a][1])]);
  return id;
 };
 const table:Record<number,number[][]>={1:[[0,3]],2:[[0,1]],3:[[3,1]],4:[[1,2]],6:[[0,2]],7:[[3,2]],8:[[2,3]],9:[[0,2]],11:[[1,2]],12:[[3,1]],13:[[0,1]],14:[[0,3]]};
 for(let y=-1;y<h;y++)for(let x=-1;x<w;x++){
  const a=sample(x,y),b=sample(x+1,y),c=sample(x+1,y+1),d=sample(x,y+1),mask=(a<threshold?1:0)|(b<threshold?2:0)|(c<threshold?4:0)|(d<threshold?8:0);
  if(mask===0||mask===15)continue;
  const v=[a,b,c,d],inside=(a+b+c+d)/4<threshold;
  const pairs=mask===5?(inside?[[0,1],[2,3]]:[[0,3],[1,2]]):mask===10?(inside?[[0,3],[1,2]]:[[0,1],[2,3]]):table[mask];
  for(const [a,b]of pairs){const A=point(a,x,y,v),B=point(b,x,y,v);for(const [i,j]of [[A,B],[B,A]]){const row=edges.get(i);if(row)row.push(j);else edges.set(i,[j]);}}
 }
 if(!edges.size)throw new Error('Nessuna lettera visibile.');
 const simplify=(p:Vec2[]):Vec2[]=>{
  if(p.length<=3)return p;const a=p[0],b=p.at(-1)!,dx=b[0]-a[0],dy=b[1]-a[1],den=dx*dx+dy*dy;let best=.45**2,at=-1;
  for(let i=1;i<p.length-1;i++){const u=den?Math.max(0,Math.min(1,((p[i][0]-a[0])*dx+(p[i][1]-a[1])*dy)/den)):0,d=(p[i][0]-a[0]-u*dx)**2+(p[i][1]-a[1]-u*dy)**2;if(d>best){best=d;at=i;}}
  return at<0?[a,b]:[...simplify(p.slice(0,at+1)).slice(0,-1),...simplify(p.slice(at))];
 };
 const rings:Vec2[][]=[];
 while(edges.size){
  const start=edges.keys().next().value!;let current=start,previous=-1;const ring:Vec2[]=[];
  do{ring.push(points.get(current)!);const next=edges.get(current);if(!next)throw new Error('Contorno del testo incompleto.');const end=next.find(n=>n!==previous)??next[0];edges.delete(current);previous=current;current=end;}while(current!==start);
  if(ring.length>=3){const mid=Math.floor(ring.length/2),clean=[...simplify(ring.slice(0,mid+1)).slice(0,-1),...simplify([...ring.slice(mid),ring[0]]).slice(0,-1)];if(clean.length>=3)rings.push(clean);}
 }
 const all=rings.flat(),minX=Math.min(...all.map(p=>p[0])),maxX=Math.max(...all.map(p=>p[0])),minY=Math.min(...all.map(p=>p[1])),maxY=Math.max(...all.map(p=>p[1])),size=Math.max(maxX-minX,maxY-minY),cx=(minX+maxX)/2,cy=(minY+maxY)/2;
 const normalized=rings.map(r=>r.map(([x,y]):Vec2=>[(x-cx)/size,(cy-y)/size]));
 return {name,shapes:[normalized],filledShapes:[normalized]};
}
