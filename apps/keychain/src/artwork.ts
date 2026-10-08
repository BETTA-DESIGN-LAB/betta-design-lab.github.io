import { traceRaster } from '../../keycap/src/artwork.ts';
import type { SvgArtwork } from '../../coaster/src/svg.ts';
import qrcode from './vendor/qrcode.mjs';
import type { Vec2 } from '@bdl/geometry';
export function lettering(text:string,font:string):SvgArtwork {
 const canvas=document.createElement('canvas');canvas.width=600;
 const ctx=canvas.getContext('2d',{willReadFrequently:true})!;
 const value=text.trim()||'Betta',family=font==='cursive'?'Pacifico, cursive':font==='serif'?'Georgia, serif':'sans-serif';
 const setFont=(size:number)=>{ctx.font=`${font==='cursive'?'':'bold '}${size}px ${family}`;ctx.textAlign='left';ctx.textBaseline='alphabetic';};
 setFont(120);let metrics=ctx.measureText(value);
 const inkWidth=Math.max(metrics.width,metrics.actualBoundingBoxLeft+metrics.actualBoundingBoxRight);
 setFont(120*Math.min(1,570/Math.max(1,inkWidth)));metrics=ctx.measureText(value);
 const ascent=Math.max(1,metrics.actualBoundingBoxAscent),descent=Math.max(0,metrics.actualBoundingBoxDescent);
 canvas.height=Math.ceil(ascent+descent+24);
 // Ridimensionare il canvas azzera il contesto: ripristina font e baseline.
 setFont(120*Math.min(1,570/Math.max(1,inkWidth)));
 ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.fillStyle='#000';
 const left=metrics.actualBoundingBoxLeft,right=metrics.actualBoundingBoxRight;
 ctx.fillText(value,(canvas.width-left-right)/2+left,12+ascent);
 return traceRaster(ctx.getImageData(0,0,canvas.width,canvas.height),text,180);
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
