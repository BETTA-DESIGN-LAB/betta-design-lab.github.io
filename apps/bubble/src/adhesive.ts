import type {CrossSection,ManifoldToplevel,Scope,Vec2} from '@bdl/geometry';

export interface AdhesiveSeat {at:Vec2;width:number;height:number}
function distanceInside(x:number,y:number,rings:Vec2[][]):number {
  let inside=false,distance=Infinity;
  for(const ring of rings)for(let i=0,j=ring.length-1;i<ring.length;j=i++){
    const a=ring[j],b=ring[i],dx=b[0]-a[0],dy=b[1]-a[1];
    if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])inside=!inside;
    const u=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy||1)));
    distance=Math.min(distance,Math.hypot(x-a[0]-u*dx,y-a[1]-u*dy));
  }
  return inside?distance:-distance;
}
export function adhesiveSeats(region:CrossSection):AdhesiveSeat[] {
  if(region.isEmpty())return [];
  const box=region.bounds(),width=box.max[0]-box.min[0],height=box.max[1]-box.min[1];
  const step=Math.max(.5,Math.max(width,height)/95);
  const cols=Math.floor(width/step),rows=Math.floor(height/step);
  const mask=new Uint8Array(cols*rows),rings=region.toPolygons();
  const margin=.65+step/Math.SQRT2;
  for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){
    const x=box.min[0]+(col+.5)*step,y=box.min[1]+(row+.5)*step;
    if(distanceInside(x,y,rings)>=margin)mask[row*cols+col]=1;
  }
  const long=Math.min(46,Math.max(8,Math.max(width,height)*.55));
  const short=Math.min(16,Math.max(4,Math.max(width,height)*.2));
  const limits=[[Math.floor(long/step),Math.floor(short/step)],[Math.floor(short/step),Math.floor(long/step)]];
  const middle:Vec2=[(box.min[0]+box.max[0])/2,(box.min[1]+box.max[1])/2];
  function largest():AdhesiveSeat|undefined {
    const histogram=new Uint16Array(cols);
    let best:AdhesiveSeat|undefined,bestScore=-Infinity;
    for(let row=0;row<rows;row++){
      for(let col=0;col<cols;col++)histogram[col]=mask[row*cols+col]?histogram[col]+1:0;
      for(let right=0;right<cols;right++){
        let high=rows;
        for(let left=right;left>=0&&right-left+1<=Math.ceil(long/step);left--){
          high=Math.min(high,histogram[left]);if(!high)break;
          const w=right-left+1;
          for(const [maxWidth,maxHeight]of limits){
            const h=Math.min(high,maxHeight);
            if(w>maxWidth||w*step<3||h*step<3||Math.max(w,h)*step<6)continue;
            const at:Vec2=[box.min[0]+(left+w/2)*step,box.min[1]+(row+1-h/2)*step];
            const area=w*h*step*step;
            const score=area*(1-.03*Math.hypot((at[0]-middle[0])/Math.max(1,width),(at[1]-middle[1])/Math.max(1,height)));
            if(score>bestScore){bestScore=score;best={at,width:w*step,height:h*step};}
          }
        }
      }
    }
    return best;
  }
  const first=largest();if(!first)return [];
  const result=[first],area=first.width*first.height;
  if(area>=region.area()*.32)return result;
  for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){
    const x=box.min[0]+(col+.5)*step,y=box.min[1]+(row+.5)*step;
    if(Math.abs(x-first.at[0])<=first.width/2+2&&Math.abs(y-first.at[1])<=first.height/2+2)mask[row*cols+col]=0;
  }
  const second=largest();
  if(second&&second.width*second.height>=Math.max(24,area*.4)&&Math.hypot(second.at[0]-first.at[0],second.at[1]-first.at[1])>=Math.max(first.width,first.height)*.55)result.push(second);
  return result;
}
export function adhesiveSection(M:ManifoldToplevel,scope:Scope,seat:AdhesiveSeat):CrossSection {
  const radius=Math.min(.8,seat.width/5,seat.height/5);
  const core=scope.t(M.CrossSection.square([seat.width-2*radius,seat.height-2*radius],true));
  return scope.t(scope.t(core.offset(radius,'Round',2,32)).translate(seat.at));
}
