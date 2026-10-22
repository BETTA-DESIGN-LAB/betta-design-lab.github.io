export interface Params {
 [key:string]:string|number|boolean;
 shape:'ghost'|'pumpkin'|'heart'|'star'|'round'|'svg'|'stl';
 width:number; height:number; dome:number; sheet:number; rim:number; spacing:number; strand:number;
 pattern:'solid'|'grid'|'diagonal'; clearance:number; color:string; moldColor:string; face:boolean;
}
export const DEFAULTS:Params={shape:'ghost',width:90,height:100,dome:18,sheet:.8,rim:2.4,spacing:4,strand:1,pattern:'grid',clearance:.3,color:'#ffffff',moldColor:'#467484',face:true};
export function sanitize(input:Partial<Params>):Params{
 const p={...DEFAULTS,...input} as Params;
 for(const [key,min,max]of [['width',55,160],['height',60,180],['dome',5,35],['sheet',.6,1.6],['rim',1.6,5],['spacing',3,8],['strand',.7,2],['clearance',.2,.6]] as const)p[key]=Number.isFinite(p[key])?Math.min(max,Math.max(min,p[key])):DEFAULTS[key];
 p.dome=Math.min(p.dome,Math.min(p.width,p.height)*.3);p.strand=Math.min(p.strand,p.spacing*.5);
 p.shape=['ghost','pumpkin','heart','star','round','svg','stl'].includes(p.shape)?p.shape:'ghost';
 p.pattern=['solid','grid','diagonal'].includes(p.pattern)?p.pattern:'grid';p.face=typeof p.face==='boolean'?p.face:true;
 for(const key of ['color','moldColor'] as const)if(!/^#[0-9a-f]{6}$/i.test(p[key]))p[key]=DEFAULTS[key];
 return p;
}
