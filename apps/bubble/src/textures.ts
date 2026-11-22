const tau=2*Math.PI;
const fract=(value:number)=>value-Math.floor(value);
const hash=(x:number,y:number)=>fract(Math.sin(x*127.1+y*311.7)*43758.5453);
function noise(x:number,y:number) {
  const ix=Math.floor(x),iy=Math.floor(y),u=fract(x),v=fract(y);
  const a=u*u*(3-2*u),b=v*v*(3-2*v);
  return (hash(ix,iy)*(1-a)+hash(ix+1,iy)*a)*(1-b)+(hash(ix,iy+1)*(1-a)+hash(ix+1,iy+1)*a)*b;
}
function segment(x:number,y:number,ax:number,ay:number,bx:number,by:number) {
  const dx=bx-ax,dy=by-ay,t=Math.max(0,Math.min(1,((x-ax)*dx+(y-ay)*dy)/(dx*dx+dy*dy)));
  return Math.hypot(x-ax-t*dx,y-ay-t*dy);
}
const stitch=[[-.35,.38],[-.25,.2],[-.12,-.01],[0,-.22],[.12,-.01],[.25,.2],[.35,.38]];
function yarn(distance:number,radius:number) {
  return distance>=radius?0:Math.sqrt(Math.max(0,1-(distance/radius)**2));
}
function knitted(u:number,v:number) {
  let distance=1;
  const col=Math.floor(u),row=Math.floor(v/.64);
  for(let j=-1;j<=1;j++)for(let i=-1;i<=1;i++){
    const x=u-(col+i+.5),y=v-(row+j+.5)*.64;
    // Stagger successive loops by half a stitch, preserving each visible V.
    const offset=(row+j)%2*.04;
    for(let k=1;k<stitch.length;k++)distance=Math.min(distance,segment(x+offset,y,stitch[k-1][0],stitch[k-1][1],stitch[k][0],stitch[k][1]));
  }
  return yarn(distance,.115);
}
export function textureAt(kind:string,x:number,y:number,scale:number):number {
  const u=x/scale,v=y/scale,a=tau*u,b=tau*v;
  switch(kind) {
    case 'felt': return .55*noise(u*3.1,v*3.1)+.3*noise(u*6.7+17,v*6.7)+.15*noise(u*12.3,v*12.3+9);
    case 'knit': return knitted(u,v);
    case 'cable': {
      const phase=Math.sin(b*.32)*.24;
      const strand1=Math.abs(fract(u-phase)-.5),strand2=Math.abs(fract(u+phase+.5)-.5);
      return Math.max(yarn(strand1,.085),yarn(strand2,.085)*(.85+.15*Math.sin(b*.32)));
    }
    case 'boucle': {
      let result=0;
      for(let j=-1;j<=1;j++)for(let i=-1;i<=1;i++){
        const col=Math.floor(u)+i,row=Math.floor(v)+j;
        const dx=u-col-.5-(hash(col,row)-.5)*.25,dy=v-row-.5-(hash(col+4,row)-.5)*.25;
        result=Math.max(result,yarn(Math.abs(Math.hypot(dx,dy*.85)-.28),.075));
      }
      return result;
    }
    case 'ribbed': return .72*yarn(Math.abs(fract(u)-.5),.21)+.28*knitted(u*1.7,v);
    case 'corduroy': return yarn(Math.abs(fract(u)-.5),.25)*(.94+.06*noise(u*5,v*10));
    case 'quilt': return Math.pow(Math.max(0,Math.abs(Math.sin((a+b)/2)*Math.sin((a-b)/2))),.7);
    case 'waffle': return Math.max(yarn(Math.abs(fract(u)-.5),.1),yarn(Math.abs(fract(v)-.5),.1));
    case 'dots': return yarn(Math.hypot(fract(u)-.5,fract(v)-.5),.23);
    case 'pebbled': {
      let nearest=1;
      for(let j=-1;j<=1;j++)for(let i=-1;i<=1;i++){
        const col=Math.floor(u)+i,row=Math.floor(v)+j;
        nearest=Math.min(nearest,Math.hypot(u-col-.2-hash(col,row)*.6,v-row-.2-hash(col+13,row)*.6));
      }
      return Math.max(0,1-Math.pow(nearest/.62,2));
    }
    case 'hammered': return noise(u*1.5,v*1.5)*.65+noise(u*3.3+6,v*3.3)*.35;
    default: return 0;
  }
}
