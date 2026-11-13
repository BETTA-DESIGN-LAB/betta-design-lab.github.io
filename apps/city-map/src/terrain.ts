import type {ManifoldToplevel} from '@bdl/geometry';
import type {Elevation} from './elevation.ts';

export function groundSurface(elevation:Elevation|undefined,width:number,depth:number,base:number,scale:number){
  const n=elevation?.steps??1;
  const raw=elevation?.metres??[0,0,0,0];
  const min=Math.min(...raw),levels=raw.map(v=>(v-min)*scale);
  const grid=n+1;
  const at=(x:number,y:number)=>{
    const px=Math.min(n,Math.max(0,(x/width+.5)*n)),py=Math.min(n,Math.max(0,(y/depth+.5)*n));
    const i=Math.min(n-1,Math.floor(px)),j=Math.min(n-1,Math.floor(py)),u=px-i,v=py-j,a=j*grid+i;
    return levels[a]+(u+v<=1?
      u*(levels[a+1]-levels[a])+v*(levels[a+grid]-levels[a]):
      (1-v)*(levels[a+1]-levels[a])+(1-u)*(levels[a+grid]-levels[a])+(u+v-1)*(levels[a+grid+1]-levels[a]));
  };
  function solid(M:ManifoldToplevel){
    const positions:number[]=[],indices:number[]=[];
    const count=grid*grid;
    for(const top of [true,false])for(let y=0;y<=n;y++)for(let x=0;x<=n;x++){
      positions.push((x/n-.5)*width,(y/n-.5)*depth,top?base+levels[y*grid+x]:0);
    }
    for(let y=0;y<n;y++)for(let x=0;x<n;x++){
      const a=y*grid+x,b=a+1,c=a+grid,d=c+1;
      indices.push(a,b,c,b,d,c,count+a,count+c,count+b,count+b,count+c,count+d);
    }
    const boundary:number[]=[];
    for(let x=0;x<n;x++)boundary.push(x);
    for(let y=0;y<n;y++)boundary.push(y*grid+n);
    for(let x=n;x>0;x--)boundary.push(n*grid+x);
    for(let y=n;y>0;y--)boundary.push(y*grid);
    boundary.forEach((a,i)=>{
      const b=boundary[(i+1)%boundary.length];
      indices.push(a,a+count,b,b,a+count,b+count);
    });
    return new M.Manifold(new M.Mesh({numProp:3,vertProperties:new Float32Array(positions),triVerts:new Uint32Array(indices)}));
  }
  return {at,solid,max:Math.max(...levels)};
}
