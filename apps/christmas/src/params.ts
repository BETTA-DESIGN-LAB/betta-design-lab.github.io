export interface Params {
 [key:string]:string|number|boolean;
 model:'flat'|'sphere';shape:'bauble'|'tree'|'star'|'snowflake'|'heart'|'bell'|'gingerbread';
 style:'solid'|'outline'|'snow';profile:'smooth'|'wave'|'spiral';size:number;thickness:number;wall:number;ribs:number;twist:number;
 text:string;font:string;mode:'relief'|'inlay'|'engrave';relief:number;scale:number;x:number;y:number;angle:number;
 extraX:number;extraY:number;extraSize:number;extraAngle:number;loop:boolean;hole:number;clearance:number;
 baseColor:string;artColor:string;extraColor:string;
}
export const DEFAULTS:Params={model:'flat',shape:'bauble',style:'snow',profile:'wave',size:75,thickness:2.4,wall:1.8,ribs:14,twist:180,text:'Natale',font:'cursive',mode:'relief',relief:.8,scale:80,x:0,y:0,angle:0,extraX:0,extraY:-18,extraSize:15,extraAngle:0,loop:true,hole:4,clearance:.15,baseColor:'#ff4b16',artColor:'#ffffff',extraColor:'#ffffff'};
export function sanitize(input:Params):Params{
 const p={...DEFAULTS,...input};
 for(const [k,min,max]of [['size',35,160],['thickness',2,6],['wall',1.2,3],['ribs',6,24],['twist',0,300],['relief',.4,1.6],['scale',20,100],['x',-80,80],['y',-80,80],['angle',-180,180],['extraX',-80,80],['extraY',-80,80],['extraSize',5,60],['extraAngle',-180,180],['hole',2,7],['clearance',.05,.3]] as const)p[k]=Number.isFinite(input[k])?Math.min(max,Math.max(min,input[k])):DEFAULTS[k];
 p.ribs=Math.round(p.ribs/2)*2;
 p.model=p.model==='sphere'?'sphere':'flat';p.shape=['bauble','tree','star','snowflake','heart','bell','gingerbread'].includes(p.shape)?p.shape:'bauble';
 p.style=['solid','outline','snow'].includes(p.style)?p.style:'solid';p.profile=['smooth','wave','spiral'].includes(p.profile)?p.profile:'wave';p.mode=['relief','inlay','engrave'].includes(p.mode)?p.mode:'relief';p.font=['cursive','sans','serif'].includes(p.font)?p.font:'cursive';
 p.text=String(p.text??'').slice(0,32);p.loop=typeof p.loop==='boolean'?p.loop:true;
 p.relief=Math.min(p.relief,p.thickness-.8,p.wall*.6);
 for(const k of ['baseColor','artColor','extraColor'] as const)if(!/^#[0-9a-f]{6}$/i.test(p[k]))p[k]=DEFAULTS[k];
 return p;
}
