/** Catalogo verificato su schede ufficiali il 26/10/2026. Dimensioni X,Y,Z in mm. */
export interface Printer { id:string; brand:string; name:string; volume:readonly[number,number,number]; nozzles:readonly number[]; source:string; }
const bambu=[0.2,0.4,0.6,0.8], anycubic=[0.25,0.4,0.6,0.8];
export const PRINTERS:readonly Printer[]=[
 {id:'bambu-p2s',brand:'Bambu Lab',name:'P2S',volume:[256,256,256],nozzles:bambu,source:'https://blog.bambulab.com/the-icon-redefined-meet-the-p2s-a-completely-reengineered-version-of-the-ultra-productive-p1-series/'},
 {id:'bambu-h2s',brand:'Bambu Lab',name:'H2S',volume:[340,320,340],nozzles:bambu,source:'https://bambulab.com/it/support/buying-guide'},
 {id:'bambu-h2d',brand:'Bambu Lab',name:'H2D · area comune ai due nozzle',volume:[300,320,325],nozzles:bambu,source:'https://eu.store.bambulab.com/products/h2d'},
 {id:'bambu-h2c',brand:'Bambu Lab',name:'H2C · area comune ai due nozzle',volume:[300,320,325],nozzles:bambu,source:'https://store.bblcdn.com/s7/default/d741f5a073c94245885065ff89a0b2da/H2C_Spec.pdf'},
 {id:'bambu-a1',brand:'Bambu Lab',name:'A1',volume:[256,256,256],nozzles:bambu,source:'https://eu.store.bambulab.com/products/a1'},
 {id:'bambu-a1-mini',brand:'Bambu Lab',name:'A1 mini',volume:[180,180,180],nozzles:bambu,source:'https://eu.store.bambulab.com/products/a1-mini'},
 {id:'anycubic-s1-max',brand:'Anycubic',name:'Kobra S1 Max',volume:[350,350,350],nozzles:anycubic,source:'https://wiki.anycubic.com/M02010206-Kobra%20S1%20Max%E7%94%A8%E6%88%B7%E6%89%8B%E5%86%8C-EN-260106.pdf'},
 {id:'anycubic-s1',brand:'Anycubic',name:'Kobra S1',volume:[250,250,250],nozzles:[0.4],source:'https://store.anycubic.com/collections/fdm-printer/products/kobra-s1'},
 {id:'anycubic-kobra3-v2',brand:'Anycubic',name:'Kobra 3 V2',volume:[255,255,260],nozzles:anycubic,source:'https://www.anycubic.com/en/kobra-3-v2-combo'},
 {id:'creality-k2',brand:'Creality',name:'K2',volume:[260,260,260],nozzles:bambu,source:'https://www.creality.com/campaigns/k2-series-buying-guide'},
 {id:'creality-k2-pro',brand:'Creality',name:'K2 Pro',volume:[300,300,300],nozzles:bambu,source:'https://www.creality.com/campaigns/k2-series-buying-guide'},
 {id:'creality-k2-plus',brand:'Creality',name:'K2 Plus',volume:[350,350,350],nozzles:bambu,source:'https://www.creality.com/campaigns/k2-series-buying-guide'},
 {id:'prusa-core-one',brand:'Prusa',name:'CORE One / CORE One+',volume:[250,220,270],nozzles:[0.4],source:'https://help.prusa3d.com/article/faq-frequently-asked-questions_1932'},
 {id:'prusa-core-one-l',brand:'Prusa',name:'CORE One L',volume:[300,300,330],nozzles:[0.4],source:'https://www.prusa3d.com/core-one-l/'},
];
export interface PrinterChoice {id:string; nozzle:number; volume?:[number,number,number];}
export const PRINTER_KEY='bdl-printer-v1';
export function validatePrinterChoice(value:unknown):PrinterChoice|null {
 if(!value||typeof value!=='object')return null;
 const p=value as PrinterChoice;
 if(p.id==='custom'){
  if(!Array.isArray(p.volume)||p.volume.length!==3||!p.volume.every(n=>Number.isFinite(n)&&n>=80&&n<=1000)||![0.2,0.25,0.4,0.6,0.8,1].includes(p.nozzle))return null;
  return {id:p.id,nozzle:p.nozzle,volume:[...p.volume]};
 }
 const printer=PRINTERS.find(q=>q.id===p.id);
 return printer&&printer.nozzles.includes(p.nozzle)?{id:printer.id,nozzle:p.nozzle}:null;
}
export function choiceVolume(choice:PrinterChoice|null):readonly[number,number,number]|null {
 return choice?.id==='custom'?choice.volume??null:PRINTERS.find(p=>p.id===choice?.id)?.volume??null;
}
let memory:PrinterChoice|null=null;
export function getPrinterChoice():PrinterChoice|null {
 try {const raw=localStorage.getItem(PRINTER_KEY);try{memory=raw?validatePrinterChoice(JSON.parse(raw)):null;}catch{memory=null;}}catch{/* storage disabilitato: sessione in memoria */}
 return memory;
}
export function savePrinterChoice(choice:PrinterChoice|null):void{
 memory=validatePrinterChoice(choice);
 try{if(memory)localStorage.setItem(PRINTER_KEY,JSON.stringify(memory));else localStorage.removeItem(PRINTER_KEY);}catch{/* sessione in memoria */}
 if(typeof window!=='undefined')window.dispatchEvent(new Event('bdl-printer-change'));
}
export function printerPlate(width=256,depth=width):[number,number]{
 const v=choiceVolume(getPrinterChoice());return v?[v[0],v[1]]:[width,depth];
}
export function printerCenter(width=256,depth=width):[number,number]{
 const [w,d]=printerPlate(width,depth);return[w/2,d/2];
}
export function onPrinterChange(fn:()=>void):()=>void{
 window.addEventListener('bdl-printer-change',fn);return()=>window.removeEventListener('bdl-printer-change',fn);
}

if(typeof window!=='undefined')window.addEventListener('storage',e=>{
 if(e.key===PRINTER_KEY||e.key===null)window.dispatchEvent(new Event('bdl-printer-change'));
});
