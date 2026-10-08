import {sanitize,type Params} from './params.ts';
/** I controlli dipendono da ciò che produce davvero la configurazione. */
export function capabilities(p:Params,hasSymbol:boolean){
 const text=!!p.text.trim(),decoration=text||hasSymbol;
 return {text,decoration,style:p.model==='flat'&&p.shape!=='snowflake',ribs:p.model==='sphere'&&p.profile!=='smooth',twist:p.model==='sphere'&&p.profile==='wave',hole:p.loop,colors:p.mode!=='engrave',depth:decoration&&(p.model==='flat'||p.mode==='relief')};
}
const POSITION_KEYS=['x','y','angle','scale','extraX','extraY','extraSize','extraAngle','relief'] as const;
export type PositionDraft=Pick<Params,typeof POSITION_KEYS[number]>;
export function positionDraft(p:Params):PositionDraft{return Object.fromEntries(POSITION_KEYS.map(k=>[k,p[k]])) as PositionDraft;}
/** Mantiene il contenuto comune e recupera la disposizione specifica del modello. */
export function changeModel(p:Params,model:Params['model'],saved?:PositionDraft):Params{
 const next=sanitize({...p,...saved,model});
 if(model==='sphere'){
  const turn=next.angle*Math.PI/180,w=next.size*.8*next.scale/100,h=next.size*.25*next.scale/100;
  const halfX=(Math.abs(Math.cos(turn))*w+Math.abs(Math.sin(turn))*h)/2;
  const halfY=(Math.abs(Math.sin(turn))*w+Math.abs(Math.cos(turn))*h)/2;
  const fit=Math.min(1,next.size*.76/(2*halfX),next.size*.70/(2*halfY));next.scale*=fit;
  const clamp=(v:number,limit:number)=>Math.max(-Math.max(0,limit),Math.min(Math.max(0,limit),v));
  next.x=clamp(next.x,next.size*.4-halfX*fit-.2);next.y=clamp(next.y,next.size*.375-halfY*fit-.2);
  next.extraSize=Math.min(next.extraSize,next.size*.45);const extent=next.extraSize*Math.SQRT2/2;
  next.extraX=clamp(next.extraX,next.size*.4-extent-.2);next.extraY=clamp(next.extraY,next.size*.375-extent-.2);
 }
 return sanitize(next);
}
