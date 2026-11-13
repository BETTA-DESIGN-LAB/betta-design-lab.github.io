import {bbox,type Area} from './data.ts';
export interface Elevation {steps:number;metres:number[]}
export const TERRAIN_SOURCE='Terrain Tiles · https://registry.opendata.aws/terrain-tiles/';
const worldSize=256*2**14;
const pixel=(lat:number,lon:number)=>[(lon+180)/360*worldSize,
  (1-Math.asinh(Math.tan(lat*Math.PI/180))/Math.PI)*worldSize/2];
export async function fetchElevation(area:Area,signal:AbortSignal):Promise<Elevation>{
  const [south,west,north,east]=bbox(area),steps=32;
  const [left,top]=pixel(north,west),[right,bottom]=pixel(south,east);
  const tiles=new Map<string,ImageData>();
  const jobs:Promise<void>[]=[];
  for(let x=Math.floor(left/256);x<=Math.floor((right+1)/256);x++)for(let y=Math.floor(top/256);y<=Math.floor((bottom+1)/256);y++){
    jobs.push((async()=>{
      const tx=(x+2**14)%2**14;
      const reply=await fetch('https://s3.amazonaws.com/elevation-tiles-prod/terrarium/14/'+tx+'/'+y+'.png',{signal});
      if(!reply.ok)throw new Error('Altitudini non disponibili.');
      const image=await createImageBitmap(await reply.blob(),{colorSpaceConversion:'none'});
      try{
        const canvas=new OffscreenCanvas(256,256),ctx=canvas.getContext('2d')!;
        ctx.drawImage(image,0,0);tiles.set(x+','+y,ctx.getImageData(0,0,256,256));
      }finally{image.close();}
    })());
  }
  await Promise.all(jobs);
  const height=(x:number,y:number)=>{
    const a=tiles.get(Math.floor(x/256)+','+Math.floor(y/256));
    if(!a)throw new Error('Tessera altimetrica mancante.');
    const i=((y%256)*256+(x%256+256)%256)*4;
    return a.data[i]*256+a.data[i+1]+a.data[i+2]/256-32768;
  };
  const metres:number[]=[];
  for(let row=0;row<=steps;row++)for(let col=0;col<=steps;col++){
    const [x,y]=pixel(south+(north-south)*row/steps,west+(east-west)*col/steps);
    const x0=Math.floor(x),y0=Math.floor(y),u=x-x0,v=y-y0;
    metres.push((1-v)*((1-u)*height(x0,y0)+u*height(x0+1,y0))+
      v*((1-u)*height(x0,y0+1)+u*height(x0+1,y0+1)));
  }
  return {steps,metres};
}
