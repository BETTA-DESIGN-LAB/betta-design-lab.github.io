import {parseSvg,type SvgArtwork} from '../../coaster/src/svg.ts';
import {trace} from '../../image-svg/src/trace.ts';
/** Contorni delle lettere, invece di migliaia di rettangoli di pixel da unire. */
export function labelArtwork(text:string):SvgArtwork{
 const value=text.trim().slice(0,32),canvas=document.createElement('canvas');canvas.width=256;canvas.height=80;
 const ctx=canvas.getContext('2d',{willReadFrequently:true})!;
 ctx.fillStyle='#fff';ctx.fillRect(0,0,256,80);ctx.fillStyle='#000';ctx.font='bold 60px sans-serif';
 const width=ctx.measureText(value).width;ctx.font=`bold ${60*Math.min(1,240/Math.max(1,width))}px sans-serif`;
 const metrics=ctx.measureText(value),ascent=metrics.actualBoundingBoxAscent,descent=metrics.actualBoundingBoxDescent;
 ctx.textAlign='center';ctx.textBaseline='alphabetic';ctx.fillText(value,128,(80+ascent-descent)/2);
 const result=trace(ctx.getImageData(0,0,256,80),{mode:'mono',threshold:180,colors:2,cleanup:0,invert:false,background:false});
 return parseSvg(result.svg,value);
}
