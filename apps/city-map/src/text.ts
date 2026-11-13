import {traceRaster} from '../../keycap/src/artwork.ts';
import type {TextShape} from './caption.ts';

export function traceText(value:string,font:string):TextShape|undefined{
 const text=value.trim();
 if(!text)return;
 const canvas=document.createElement('canvas');
 canvas.width=960;canvas.height=210;
 const ctx=canvas.getContext('2d',{willReadFrequently:true})!;
 ctx.fillStyle='#fff';ctx.fillRect(0,0,960,210);
 ctx.fillStyle='#000';ctx.textAlign='center';ctx.textBaseline='alphabetic';
 ctx.font=(font==='Rubik'?'700 ':'')+'128px "'+font+'", sans-serif';
 const width=ctx.measureText(text).width;
 if(width>916)ctx.font=(font==='Rubik'?'700 ':'')+Math.floor(128*916/width)+'px "'+font+'", sans-serif';
 ctx.fillText(text,480,155);
 return traceRaster(ctx.getImageData(0,0,960,210),text,170)?.shapes;
}
