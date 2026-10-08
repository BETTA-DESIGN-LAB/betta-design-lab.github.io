export interface Params {
  [key: string]: string | number | boolean;
  model: 'name'|'initial'|'svg'|'qr'|'jersey'|'music'; text:string; initial:string; number:string; team:string; qrText:string;
  font:string; width:number; depth:number; thickness:number; relief:number; border:number; hole:number;
  mode:'relief'|'inlay'|'engrave'; shape:'round'|'square'|'svg'|'hex'|'heart'|'oval'; x:number; y:number; angle:number; scale:number; clearance:number;
  extraX:number; extraY:number; extraSize:number; extraAngle:number; extraColor:string; ringType:'external'|'internal'; qrSize:number; qrX:number; qrY:number; qrAngle:number; qrType:string; qrSecret:string;
  jerseyPattern:string; patternColor:string; collarColor:string; edgeColor:string; outlineColor:string;
  collar:boolean; shirtBorder:boolean; textOutline:boolean; sleevesPattern:boolean; loop:boolean;
  stripeWidth:number; stripeGap:number; stripeOffset:number; edgeWidth:number; collarWidth:number; outlineWidth:number;
  nameSize:number; nameY:number; numberSize:number; numberY:number; teamSize:number; teamY:number; ringWall:number;
  baseColor:string; artColor:string; initialColor:string;
}
export const DEFAULTS:Params={model:'name',extraX:42,extraY:0,extraSize:18,extraAngle:0,extraColor:'#ffffff',ringType:'external',qrSize:60,qrX:0,qrY:0,qrAngle:0,qrType:'url',qrSecret:'',jerseyPattern:'vertical',patternColor:'#25355e',collarColor:'#ffffff',edgeColor:'#ffffff',outlineColor:'#111111',collar:true,shirtBorder:true,textOutline:false,sleevesPattern:true,loop:true,stripeWidth:6,stripeGap:6,stripeOffset:0,edgeWidth:1,collarWidth:2,outlineWidth:.5,nameSize:7,nameY:25,numberSize:22,numberY:-3,teamSize:6,teamY:-34,ringWall:2.5,text:'Nicole',initial:'N',number:'10',team:'BETTA',qrText:'https://betta-design-lab.github.io/',font:'cursive',width:70,depth:38,thickness:3,relief:0.8,border:2,hole:4,mode:'relief',shape:'square',x:0,y:0,angle:0,scale:100,clearance:0,baseColor:'#ff4b16',artColor:'#ffffff',initialColor:'#111111'};
export function sanitize(p:Params):Params {
 const out={...DEFAULTS,...p};
 for(const [k,a,b] of [['width',25,180],['depth',25,120],['thickness',2,8],['relief',0.4,2],['border',1,8],['hole',2,8],['x',-90,90],['y',-60,60],['angle',-180,180],['scale',10,100],['clearance',0,.4],['stripeWidth',1,25],['stripeGap',1,25],['stripeOffset',-40,40],['edgeWidth',.4,3],['collarWidth',.5,5],['outlineWidth',.2,2],['nameSize',2,20],['numberSize',5,45],['teamSize',2,20],['nameY',-45,45],['numberY',-45,45],['teamY',-45,45],['ringWall',1,5],['extraX',-180,180],['extraY',-120,120],['extraSize',3,80],['extraAngle',-180,180],['qrSize',20,90],['qrX',-80,80],['qrY',-80,80],['qrAngle',-180,180]] as const)out[k]=Number.isFinite(p[k])?Math.min(b,Math.max(a,p[k])):DEFAULTS[k];
 out.jerseyPattern=['solid','vertical','horizontal','half','diagonal','broad','sides'].includes(p.jerseyPattern)?p.jerseyPattern:'vertical';
 for(const k of ['collar','shirtBorder','textOutline','sleevesPattern','loop'] as const)out[k]=typeof p[k]==='boolean'?p[k]:DEFAULTS[k];
 out.ringType=p.ringType==='internal'?'internal':'external';out.qrType=['url','text','phone','email','wifi'].includes(p.qrType)?p.qrType:'url';out.qrSecret=String(p.qrSecret??'').slice(0,64);
 out.relief=Math.min(out.relief,out.thickness-0.8);
 out.model=['name','initial','svg','qr','jersey','music'].includes(p.model)?p.model:'name';out.mode=['relief','inlay','engrave'].includes(p.mode)?p.mode:'relief';out.shape=['round','square','svg','hex','heart','oval'].includes(p.shape)?p.shape:'square';
 for(const k of ['text','team','qrText','initial','number','font'] as const)out[k]=String(out[k]).slice(0,k==='qrText'?300:k==='initial'?1:k==='number'?3:24);
 for(const k of ['baseColor','artColor','initialColor','patternColor','collarColor','edgeColor','outlineColor','extraColor'] as const)if(!/^#[0-9a-f]{6}$/i.test(out[k]))out[k]=DEFAULTS[k];
 return out;
}
