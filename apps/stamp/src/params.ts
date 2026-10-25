export interface Params {
 [key:string]:string|number|boolean;
 text:string;font:'sans'|'serif'|'cursive';shape:'rect'|'round'|'oval'|'contour';
 width:number;height:number;radius:number;base:number;relief:number;
 textSize:number;x:number;y:number;angle:number;
 extraSize:number;extraX:number;extraY:number;extraAngle:number;
 frame:boolean;frameWidth:number;handle:'auto'|'round'|'ergonomic'|'bridge'|'palm';clearance:number;
 color:string;
}
export const DEFAULTS:Params={text:'Fatto con amore',font:'sans',shape:'rect',width:65,height:35,radius:4,base:11,relief:1.6,textSize:80,x:0,y:0,angle:0,extraSize:18,extraX:0,extraY:-8,extraAngle:0,frame:false,frameWidth:1,handle:'auto',clearance:.3,color:'#ff4b16'};
export function sanitize(input:Partial<Params>):Params{
 const p={...DEFAULTS,...input} as Params;
 for(const [k,min,max]of [['width',28,140],['height',28,100],['radius',0,15],['base',10,16],['relief',.6,3],['textSize',10,150],['x',-100,100],['y',-100,100],['angle',-180,180],['extraSize',4,90],['extraX',-100,100],['extraY',-100,100],['extraAngle',-180,180],['frameWidth',.6,2.5],['clearance',.2,.6]] as const)p[k]=Number.isFinite(input[k])?Math.max(min,Math.min(max,input[k] as number)):DEFAULTS[k];
 p.text=typeof p.text==='string'?p.text.slice(0,160):DEFAULTS.text;
 p.font=['sans','serif','cursive'].includes(p.font)?p.font:'sans';
 p.shape=['rect','round','oval','contour'].includes(p.shape)?p.shape:'rect';
 p.handle=['auto','round','ergonomic','bridge','palm'].includes(p.handle)?p.handle:'auto';
 p.frame=typeof p.frame==='boolean'?p.frame:false;p.radius=Math.min(p.radius,Math.min(p.width,p.height)/2-.5);
 if(!/^#[0-9a-f]{6}$/i.test(p.color))p.color=DEFAULTS.color;
 return p;
}
export function handleKind(p:Params):Exclude<Params['handle'],'auto'>{return p.handle==='auto'?(p.width>=80?'bridge':p.width<=38?'round':'ergonomic'):p.handle;}
