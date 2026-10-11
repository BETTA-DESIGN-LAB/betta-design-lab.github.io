import {FILAMENTS} from '@bdl/brand';
export interface Params{[key:string]:string|number|boolean;source:'parametric'|'stl';shape:'cylinder'|'bulb'|'waist';texture:'smooth'|'wave'|'spiral';height:number;diameter:number;wall:number;amplitude:number;waves:number;twist:number;cut:number;orientation:'z'|'x'|'y'|'flip';holeX:number;holeY:number;shadeColor:string;baseColor:string;plateSize:number;}
export const DEFAULTS:Params={source:'parametric',shape:'bulb',texture:'wave',height:150,diameter:110,wall:.8,amplitude:3,waves:24,twist:90,cut:20,orientation:'z',holeX:0,holeY:0,shadeColor:'#f2f0eb',baseColor:'#25355e',plateSize:256};
export function sanitize(input:Params):Params{
 const p={...DEFAULTS};for(const [k,a,b] of [['height',50,240],['diameter',80,200],['wall',.6,2],['amplitude',0,6],['waves',6,40],['twist',-180,180],['cut',1,75],['holeX',-100,100],['holeY',-100,100],['plateSize',100,350]] as const){const v=Number(input[k]);p[k]=Number.isFinite(v)?Math.max(a,Math.min(b,v)):DEFAULTS[k];}
 p.waves=Math.round(p.waves);
 for(const [k,values] of [['source',['parametric','stl']],['shape',['cylinder','bulb','waist']],['texture',['smooth','wave','spiral']],['orientation',['z','x','y','flip']]] as const)if((values as readonly string[]).includes(String(input[k])))(p as Record<string,string|number|boolean>)[k]=input[k];
 for(const k of ['shadeColor','baseColor'] as const)if(FILAMENTS.some(f=>f.hex===input[k]))p[k]=input[k];return p;
}
