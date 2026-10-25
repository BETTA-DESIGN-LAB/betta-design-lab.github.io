import {traceRaster} from '../../keycap/src/artwork.ts';
import type {SvgArtwork} from '../../coaster/src/svg.ts';
/** Una sola tela mantiene proporzioni delle righe e discendenti, anche in corsivo. */
export function stampLettering(value:string,font:string):SvgArtwork|undefined{
 const lines=value.split(/\r?\n/).slice(0,5);if(!lines.some(v=>v.trim()))return;
 const canvas=document.createElement('canvas');canvas.width=760;
 const ctx=canvas.getContext('2d',{willReadFrequently:true})!;
 const family=font==='cursive'?'Pacifico, cursive':font==='serif'?'Georgia, serif':'sans-serif';
 const apply=(size:number)=>{ctx.font=(font==='cursive'?'':'bold ')+size+'px '+family;ctx.textBaseline='alphabetic';ctx.textAlign='center';};
 apply(110);const width=Math.max(1,...lines.map(v=>{const m=ctx.measureText(v);return Math.max(m.width,m.actualBoundingBoxLeft+m.actualBoundingBoxRight);}));
 const size=110*Math.min(1,720/width);apply(size);
 const ascent=Math.max(size,...lines.map(v=>ctx.measureText(v).actualBoundingBoxAscent)),descent=Math.max(size*.3,...lines.map(v=>ctx.measureText(v).actualBoundingBoxDescent)),step=ascent+descent+size*.2;
 canvas.height=Math.ceil(lines.length*step+24);apply(size);
 ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.fillStyle='#000';
 lines.forEach((line,i)=>ctx.fillText(line,canvas.width/2,12+ascent+i*step));
 return traceRaster(ctx.getImageData(0,0,canvas.width,canvas.height),value,180);
}
