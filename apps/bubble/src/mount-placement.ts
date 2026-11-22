import type {CrossSection,ManifoldToplevel,Scope,Vec2} from '@bdl/geometry';

export function balancedMagnets(M:ManifoldToplevel,scope:Scope,outline:CrossSection,radius:number,count:number):Vec2[] {
  const t=<T extends {delete():void}>(object:T)=>scope.t(object);
  if(outline.isEmpty())return [];
  const box=outline.bounds(),width=box.max[0]-box.min[0],height=box.max[1]-box.min[1];
  const circle=t(M.CrossSection.circle(radius+.8,40));
  const points:Vec2[]=[];
  for(let row=0;row<=28;row++)for(let col=0;col<=24;col++){
    const point:Vec2=[box.min[0]+width*col/24,box.min[1]+height*row/28];
    if(t(t(circle.translate(point)).subtract(outline)).area()<.001)points.push(point);
  }
  if(!points.length)return [];
  const center=points.reduce((sum,p)=>[sum[0]+p[0]/points.length,sum[1]+p[1]/points.length] as Vec2,[0,0] as Vec2);
  const distance=(a:Vec2,b:Vec2)=>(a[0]-b[0])**2+(a[1]-b[1])**2;
  if(count===1)return [[...points.reduce((best,p)=>distance(p,center)<distance(best,center)?p:best,points[0])]];
  const first=points.reduce((best,p)=>distance(p,center)>distance(best,center)?p:best,points[0]);
  const selected:Vec2[]=[first];
  while(selected.length<count){
    let best:Vec2|undefined,bestScore=-Infinity;
    for(const point of points){
      const nearest=Math.min(...selected.map(p=>distance(point,p)));
      if(nearest<(radius*2+1.2)**2)continue;
      const centroid=selected.reduce((sum,p)=>[sum[0]+p[0],sum[1]+p[1]] as Vec2,[point[0],point[1]] as Vec2).map(v=>v/(selected.length+1)) as Vec2;
      const score=nearest-.35*distance(centroid,center);
      if(score>bestScore){bestScore=score;best=point;}
    }
    if(!best)break;
    selected.push(best);
  }
  return selected;
}

export interface StandPlacement {at:Vec2;height:number;depth:number}
export function hiddenStand(M:ManifoldToplevel,scope:Scope,outline:CrossSection,thickness:number,tolerance:number,lean:number,slotRegion=outline,baseline=outline.bounds().min[1],tongueHeight=12):StandPlacement|undefined {
  const t=<T extends {delete():void}>(object:T)=>scope.t(object);
  if(outline.isEmpty()||slotRegion.isEmpty())return;
  const box=outline.bounds(),width=box.max[0]-box.min[0],height=box.max[1]-box.min[1];
  const slotWidth=thickness+2*tolerance,slotHeight=tongueHeight+2*tolerance;
  const rectangle=(w:number,h:number,at:Vec2)=>t(t(M.CrossSection.square([w,h],true)).translate(at));
  const clearance=Math.max(2,Math.min(5,height*.04));
  const signedArea=(ring:Vec2[])=>ring.reduce((sum,p,i)=>{
    const next=ring[(i+1)%ring.length];return sum+p[0]*next[1]-next[0]*p[1];
  },0)/2;
  const apertureMargins=outline.toPolygons().filter(ring=>signedArea(ring)<0).map(ring=>
    t(t(M.CrossSection.ofPolygons([ring],'EvenOdd')).offset(clearance,'Round',2,64)));
  const opaque=apertureMargins.length?t(outline.subtract(t(M.CrossSection.union(apertureMargins)))):outline;
  const fits=(shape:CrossSection)=>t(shape.subtract(opaque)).area()<.001;
  const sine=Math.sin(lean*Math.PI/180),cosine=Math.cos(lean*Math.PI/180),center=(box.min[0]+box.max[0])/2;
  let best:StandPlacement|undefined,bestScore=-Infinity;
  for(let row=0;row<12;row++)for(let col=0;col<25;col++){
    const x=center+(col===0?0:(col%2?1:-1)*Math.ceil(col/2)*width/26);
    const relativeY=slotHeight/2+1.5+row*Math.max(1,height/55);
    const y=baseline+relativeY;
    if(t(rectangle(slotWidth+1.6,slotHeight+1.6,[x,y]).subtract(slotRegion)).area()>=.001)continue;
    const minimum=(relativeY+slotHeight/2+1)*cosine;
    const maximum=Math.max(minimum,height*.46),step=Math.max(1,height/45);
    const levels=Math.ceil((maximum-minimum)/step);
    for(let level=0;level<=levels;level++){
      const top=Math.max(minimum,maximum-level*step);
      // Test the complete front projection, including the support's upper edge,
      // against opaque material. This excludes the aperture of O, A, B, etc.
      const projectedHeight=top/cosine;
      const strip=rectangle(thickness+1.6,projectedHeight-1,[x,baseline+(projectedHeight+1)/2]);
      if(!fits(strip))continue;
      const minimumDepth=Math.max(thickness*1.8,height*Math.tan(lean*Math.PI/180)*.65+thickness);
      const depth=Math.max(minimumDepth,top*.75);
      const projected:Vec2[]=[];
      for(const [rear,z]of [[0,0],[depth,0],[Math.tan(lean*Math.PI/180)*top,top]])for(const side of [-1,1]){
        const travel=(rear*cosine-z*sine)/(cosine+.85*sine);
        const originalY=(rear-travel)*sine+(z+.85*travel)*cosine+baseline;
        projected.push([x+side*thickness/2+.55*travel,originalY]);
      }
      const iso=t(M.CrossSection.hull([projected]));
      const upper=t(t(M.CrossSection.square([width*4,height*4],true)).translate([center,baseline+height*2+1]));
      if(t(t(iso.intersect(upper)).subtract(opaque)).area()>.04)continue;
      const score=top/height-.45*Math.abs(x-center)/width-.08*relativeY/height-.08*depth/height;
      if(score>bestScore){bestScore=score;best={at:[x,y],height:top,depth};}
      break;
    }
  }
  return best;
}
