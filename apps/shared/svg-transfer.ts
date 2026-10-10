import {toast} from '@bdl/ui-kit';
export const SVG_TARGETS=[['coaster','Sottobicchieri'],['keychain','Portachiavi'],['keycap','Keycap / Fidget Clicker'],['box','Scatole e organizer'],['christmas','Natale']] as const;
const PREFIX='bdl-svg-transfer-';
export function sendSvg(svg:string,name:string,target:string):void {
 if(!SVG_TARGETS.some(([id])=>id===target)||svg.length>500000)throw new Error('Destinazione o SVG non valido.');
 // La stessa scheda conserva i file localmente anche durante la navigazione.
 const key=crypto.randomUUID();const keys=Object.keys(sessionStorage).filter(k=>k.startsWith(PREFIX));for(const k of keys.slice(0,Math.max(0,keys.length-4)))sessionStorage.removeItem(k);
 sessionStorage.setItem(PREFIX+key,JSON.stringify({svg,name:name.slice(0,120),created:Date.now()}));
 location.assign(`../${target}/?svgTransfer=${key}`);
}
export async function receiveSvg(apply:(file:File)=>void|Promise<void>):Promise<void>{
 const key=new URL(location.href).searchParams.get('svgTransfer');if(!key)return;
 try{if(!/^[a-f0-9-]{36}$/.test(key))throw new Error('Trasferimento SVG non valido.');const raw=sessionStorage.getItem(PREFIX+key);if(!raw)throw new Error('SVG non disponibile in questa scheda: torna al convertitore e usa “Usa in un generatore”.');const d=JSON.parse(raw);if(typeof d.svg!=='string'||d.svg.length>500000||typeof d.name!=='string'||!Number.isFinite(d.created)||Date.now()-d.created>86400000)throw new Error('Trasferimento SVG scaduto: ripeti dal convertitore.');await apply(new File([d.svg],d.name,{type:'image/svg+xml'}));toast('SVG caricato dal convertitore');}catch(e){toast(e instanceof Error?e.message:String(e),6000);}
}
