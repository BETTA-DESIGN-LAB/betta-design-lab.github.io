import {traceLetterContours} from '../../keychain/src/letter-contours.ts';
import type {SvgArtwork} from '../../coaster/src/svg.ts';
import type {Params} from './params.ts';
export interface Glyph {char:string; artwork:SvgArtwork; heightRatio:number}
const cache=new Map<string,Glyph>();
export function lettering(p:Params):Glyph[] {
  const families:Record<string,string>={round:'400 360px Coiny',chunky:'400 360px "Lilita One"',soft:'800 360px "Baloo 2"',wide:'700 360px Fredoka',balloon:'700 360px DynaPuff'};
  return Array.from(p.text).filter(char=>!char.trim()?false:true).map(char=>{
    const key=p.style+char;
    if(cache.has(key))return cache.get(key)!;
    const canvas=document.createElement('canvas');canvas.width=640;canvas.height=600;
    const ctx=canvas.getContext('2d',{willReadFrequently:true})!;
    ctx.fillStyle='#fff';ctx.fillRect(0,0,640,600);
    ctx.font=families[p.style];ctx.textBaseline='alphabetic';ctx.fillStyle='#000';
    const metrics=ctx.measureText(char),cap=ctx.measureText('H').actualBoundingBoxAscent;
    if(metrics.actualBoundingBoxAscent+metrics.actualBoundingBoxDescent<=0)throw new Error('Il carattere '+char+' non contiene una forma stampabile.');
    ctx.fillText(char,80+Math.max(0,metrics.actualBoundingBoxLeft),420);
    const glyph={char,artwork:traceLetterContours(ctx.getImageData(0,0,640,600),char),heightRatio:(metrics.actualBoundingBoxAscent+metrics.actualBoundingBoxDescent)/Math.max(1,cap)};
    if(cache.size>160)cache.clear();cache.set(key,glyph);return glyph;
  });
}
