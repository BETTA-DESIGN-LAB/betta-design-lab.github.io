export interface Raster { width:number; height:number; data:Uint8ClampedArray; }
export interface Options { mode:'mono'|'color'; threshold:number; colors:number; cleanup:number; invert:boolean; background:boolean; }
type Point=[number,number];
/** Contorni dei pixel, inclusi fori: nessuna immagine incorporata nell'SVG. */
export function trace(image:Raster, raw:Options):{svg:string;points:number;paths:number} {
 const {width:w,height:h,data}=image;
 if(!Number.isInteger(w)||!Number.isInteger(h)||w<1||h<1||w>320||h>320||data.length!==w*h*4)throw new Error('Immagine non valida.');
 const threshold=Math.max(1,Math.min(254,raw.threshold)),cleanup=Math.max(0,Math.min(40,raw.cleanup));
 const pixels:Array<number[]|null>=[];
 for(let i=0;i<w*h;i++){const a=data[i*4+3]/255;pixels.push(a<.5?null:[0,1,2].map(k=>Math.round(data[i*4+k]*a+255*(1-a))));}
 const corner=pixels[0]??pixels[w-1]??pixels[(h-1)*w]??[255,255,255];
 const distance=(a:number[],b:number[])=>a.reduce((s,n,k)=>s+(n-b[k])**2,0);
 const eligible=(p:number[]|null)=>p!==null&&(!raw.background||distance(p,corner)>40**2);
 let palette:number[][]=[[17,17,17]];
 if(raw.mode==='color'){
  const bins=new Map<string,{count:number;sum:number[]}>();
  for(const p of pixels)if(eligible(p)){const key=p!.map(n=>Math.floor(n/32)).join(',');const b=bins.get(key)??{count:0,sum:[0,0,0]};b.count++;b.sum=b.sum.map((n,k)=>n+p![k]);bins.set(key,b);}
  const ordered=[...bins.values()].sort((a,b)=>b.count-a.count);
  palette=[];for(const b of ordered){const color=b.sum.map(n=>Math.round(n/b.count));if(palette.every(p=>distance(p,color)>48**2))palette.push(color);if(palette.length>=Math.max(2,Math.min(8,raw.colors)))break;}
  // Alcune immagini hanno un solo colore utile.
 }
 const labels=new Int16Array(w*h).fill(-1);
 for(let i=0;i<labels.length;i++){const p=pixels[i];if(!eligible(p))continue;if(raw.mode==='mono'){const dark=p![0]*.2126+p![1]*.7152+p![2]*.0722<threshold;if(dark!==raw.invert)labels[i]=0;}else if(palette.length){let best=0;for(let k=1;k<palette.length;k++)if(distance(p!,palette[k])<distance(p!,palette[best]))best=k;labels[i]=best;}}
 // Elimina soltanto isole piccole, senza chiudere i fori del disegno.
 const seen=new Uint8Array(w*h);for(let i=0;i<labels.length;i++)if(labels[i]>=0&&!seen[i]){const queue=[i],label=labels[i];seen[i]=1;for(let at=0;at<queue.length;at++){const v=queue[at],x=v%w,y=Math.floor(v/w);for(const n of [x>0?v-1:-1,x<w-1?v+1:-1,y>0?v-w:-1,y<h-1?v+w:-1])if(n>=0&&!seen[n]&&labels[n]===label){seen[n]=1;queue.push(n);}}if(queue.length<=cleanup)for(const n of queue)labels[n]=-1;}
 let points=0,paths=0;const output:string[]=[];
 for(let label=0;label<palette.length;label++){
  const edges=new Map<number,number[]>(),stride=w+1;const edge=(x:number,y:number,X:number,Y:number)=>{const a=y*stride+x,b=Y*stride+X;edges.set(a,[...(edges.get(a)??[]),b]);};
  for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(labels[y*w+x]===label){if(y===0||labels[(y-1)*w+x]!==label)edge(x,y,x+1,y);if(x===w-1||labels[y*w+x+1]!==label)edge(x+1,y,x+1,y+1);if(y===h-1||labels[(y+1)*w+x]!==label)edge(x+1,y+1,x,y+1);if(x===0||labels[y*w+x-1]!==label)edge(x,y+1,x,y);}
  const rings:string[]=[];
  while(edges.size){const start=edges.keys().next().value!;let current=start,previous=-1;const ring:Point[]=[];
   do{ring.push([current%stride,Math.floor(current/stride)]);const candidates=edges.get(current);if(!candidates?.length)throw new Error('Contorno non chiuso.');let at=0;if(candidates.length>1&&previous>=0){const dx=current%stride-previous%stride,dy=Math.floor(current/stride)-Math.floor(previous/stride);let score=-Infinity;for(let k=0;k<candidates.length;k++){const next=candidates[k],nx=next%stride-current%stride,ny=Math.floor(next/stride)-Math.floor(current/stride);const turn=dx*ny-dy*nx,rank=turn>0?3:dx*nx+dy*ny>0?2:turn<0?1:0;if(rank>score){score=rank;at=k;}}}const next=candidates.splice(at,1)[0];if(!candidates.length)edges.delete(current);previous=current;current=next;}while(current!==start);
   const simple=ring.filter((b,i)=>{const a=ring[(i+ring.length-1)%ring.length],c=ring[(i+1)%ring.length];return (b[0]-a[0])*(c[1]-b[1])!==(b[1]-a[1])*(c[0]-b[0]);});
   if(simple.length>=3){points+=simple.length;if(points>18000)throw new Error('Troppi dettagli: riduci Dettagli o aumenta Pulizia.');rings.push('M'+simple.map(p=>p.join(' ')).join('L')+'Z');paths++;}
  }
  if(rings.length)output.push(`<path fill="${'#'+palette[label].map(n=>n.toString(16).padStart(2,'0')).join('')}" fill-rule="evenodd" d="${rings.join('')}"/>`);
 }
 if(!output.length)throw new Error('Nessun contorno trovato: regola la soglia o disattiva Rimuovi sfondo.');
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}">${output.join('')}</svg>`;
 if(svg.length>480000)throw new Error('SVG troppo grande: riduci i dettagli.');return {svg,points,paths};
}
