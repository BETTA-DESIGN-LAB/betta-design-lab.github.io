import { traceRaster } from '../../keycap/src/artwork.ts';
import type { SvgArtwork } from '../../coaster/src/svg.ts';
import qrcode from './vendor/qrcode.mjs';
import type { Vec2 } from '@bdl/geometry';
export function lettering(text:string,font:string):SvgArtwork {
 const canvas=document.createElement('canvas');canvas.width=600;canvas.height=180;
 const ctx=canvas.getContext('2d',{willReadFrequently:true})!;ctx.fillStyle='#fff';ctx.fillRect(0,0,600,180);
 ctx.fillStyle='#000';ctx.font=`${font==='cursive'?'':'bold '}120px ${font==='cursive'?'Pacifico, cursive':font==='serif'?'Georgia, serif':'sans-serif'}`;
 ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text.trim()||'Betta',300,85,570);
 return traceRaster(ctx.getImageData(0,0,600,180),text,180);
}
export function qrArtwork(text:string):{artwork:SvgArtwork;modules:number} {
 if(!text.trim())throw new Error('Inserisci il testo o il link del QR.');
 qrcode.stringToBytes=(value)=>Array.from(new TextEncoder().encode(value));
 const qr=qrcode(0,'M');qr.addData(text,'Byte');qr.make();const n=qr.getModuleCount(),total=n+8;
 const shapes:Vec2[][][]=[];
 for(let y=0;y<n;y++)for(let x=0;x<n;x++)if(qr.isDark(y,x)){
 const a=(x+4)/total-.5,b=.5-(y+4)/total,w=1/total;
 shapes.push([[[a,b],[a+w,b],[a+w,b-w],[a,b-w]]]);
 }
 return {artwork:{name:'QR',shapes,filledShapes:shapes},modules:total};
}
