import '@bdl/ui-kit/style.css';
import {printerPlate,printerCenter,onPrinterChange,choiceVolume,getPrinterChoice} from '@bdl/brand';
import {bounds,type Part} from '@bdl/geometry';
import {createViewer} from '@bdl/viewer';
import {download,slug,to3MF,toSTL} from '@bdl/export';
import {appShell,button,colorPicker,el,ICONS,iconButton,panelFooter,section,slider,toggle,readHashState,writeHashState,toast,type SliderRow} from '@bdl/ui-kit';
import {arrange} from '../../box/src/placement.ts';
import {DEFAULTS,PRESETS,SILHOUETTES,FINISHES,sanitize,type VaseParams} from './params.ts';
const shell=appShell({title:'Vasi d’arredo',intro:'Forme morbide, lame, canneté e texture. Modella la silhouette e scegli dove lasciare la superficie liscia.'});
const initial=location.hash?readHashState(DEFAULTS):{...DEFAULTS,...PRESETS[0].params};
const volume=choiceVolume(getPrinterChoice());
let state=sanitize({...initial,height:!location.hash&&volume?Math.min(initial.height,volume[2]-5):initial.height}),parts:Part[]=[],warnings:string[]=[],revision=0,busy=false,queued:{id:number;params:VaseParams}|undefined,timer:ReturnType<typeof setTimeout>,fitNext=true;
const controls=el('div',{class:'bdl-vase-controls'}),actions:HTMLButtonElement[]=[],ranges=new Map<string,SliderRow>(),selects=new Map<string,HTMLSelectElement>();
const viewer=createViewer(shell.stage,{smoothView:true});
const worker=new Worker(new URL('./worker.ts',import.meta.url),{type:'module'});
shell.panel.append(controls,panelFooter());
const set=(key:keyof VaseParams,value:VaseParams[typeof key])=>{state=sanitize({...state,[key]:value});sync();if(key==='color'&&parts.length&&!busy){parts=parts.map(p=>({...p,color:state.color}));viewer.setParts(parts,{refit:false});writeHashState(state,DEFAULTS);status();}else schedule();};
const range=(key:keyof VaseParams,label:string,min:number,max:number,step=1,unit='')=>{
 const r=slider({label,min,max,step,unit,editable:true,value:state[key] as number,onInput:v=>set(key,v)});ranges.set(key as string,r);return r.root;
};
const select=(key:keyof VaseParams,label:string,options:Record<string,string>)=>{
 const input=el('select',{class:'bdl-select','aria-label':label,onChange:()=>set(key,input.value)},...Object.entries(options).map(([value,text])=>el('option',{value},text)));
 input.value=String(state[key]);selects.set(key as string,input);return el('div',{class:'bdl-row'},el('label',{},label,input));
};
function preset(index:number){state=sanitize({...state,...PRESETS[index].params});const v=choiceVolume(getPrinterChoice());if(v)state.height=Math.min(state.height,v[2]-5);fitNext=true;sync();schedule();}
const presets=el('div',{class:'bdl-vase-presets'},...PRESETS.map((p,i)=>button({label:p.name,onClick:()=>preset(i)})));
PRESETS.forEach((p,i)=>presets.children[i].append(el('small',{},p.hint)));
const shape=section('La forma',
 select('silhouette','Silhouette',SILHOUETTES),
 range('intensity','Carattere della forma',0,1.5,.05),
 range('bellyDiameter','Diametro del corpo',30,260,1,'mm'),range('neckDiameter','Diametro del collo',20,220,1,'mm'));
const finish=section('La superficie',
 select('finish','Finitura',FINISHES),
 el('p',{class:'bdl-hint'},'Reticolo, diamanti e nido d’ape sono rilievi su una parete continua. Le zone esterne alla fascia rimangono lisce.'),
 range('ribCount','Numero di elementi',8,96),
 range('ribDepth','Profondità della finitura',.4,12,.2,'mm'),
 range('ribWidth','Larghezza degli elementi',.12,.85,.01),
 select('ribShape','Profilo del rilievo',{round:'Morbido',sharp:'A lama',flat:'Piatto'}),
 range('helix','Avvolgimento della finitura',-360,360,5,'°'),
 range('textureRows','Ripetizioni in altezza',4,40));
const band=section('Dove applicarla',
 el('div',{class:'bdl-vase-presets'},button({label:'Metà alta',onClick:()=>{state=sanitize({...state,patternStart:50,patternEnd:100,fade:4});sync();schedule();}}),button({label:'Metà bassa',onClick:()=>{state=sanitize({...state,patternStart:0,patternEnd:50,fade:4});sync();schedule();}}),button({label:'Tutta altezza',onClick:()=>{state=sanitize({...state,patternStart:0,patternEnd:100});sync();schedule();}}),button({label:'Piede e collo lisci',onClick:()=>{state=sanitize({...state,patternStart:12,patternEnd:88,fade:4});sync();schedule();}})),
 range('patternStart','Inizio della finitura',0,95,1,'%'),range('patternEnd','Fine della finitura',5,100,1,'%'),range('fade','Transizione morbida',0,25,1,'%'));
const sectionShape=section('Sezione e torsione',
 select('profile','Sezione',{smooth:'Circolare',oval:'Ovale',roundedSquare:'Quadrata morbida',faceted:'Sfaccettata',wavy:'Fiore',star:'Stella morbida'}),
 range('sides','Lati o petali',3,32),range('waveDepth','Profondità petali',.5,14,.5,'mm'),
 range('twist','Torsione del corpo',-180,180,5,'°'));
const drain=toggle({label:'Foro di drenaggio',value:state.drainageHole,hint:'Per piante. Senza foro, la tenuta all’acqua dipende dalla stampa.',onChange:v=>set('drainageHole',v)});
const color=colorPicker({label:'Filamento',value:state.color,onChange:v=>set('color',v)});
controls.append(section('Parti da un’idea',presets),shape,section('Dimensioni',
 range('height','Altezza',60,300,1,'mm'),range('bottomDiameter','Diametro del piede',20,220,1,'mm'),range('topDiameter','Diametro della bocca',20,240,1,'mm')),
 finish,band,sectionShape,section('Pareti e fondo',
 range('wall','Spessore minimo parete',.8,5,.2,'mm'),range('bottomThickness','Spessore fondo',1.6,10,.2,'mm'),drain.root,range('drainageDiameter','Diametro foro',3,220,1,'mm')),
 section('Colore',color.root),
 section('Il tuo modello',button({label:'Copia link della configurazione',onClick:async()=>{try{await navigator.clipboard.writeText(location.href);toast('Link copiato.');}catch{toast('Copia il link dalla barra degli indirizzi.');}}})));
function sync(){
 ranges.forEach((r,k)=>r.set(state[k] as number));selects.forEach((s,k)=>s.value=String(state[k]));
 const show=(k:string,on:boolean)=>{const r=ranges.get(k);if(r)r.root.hidden=!on;};
 show('intensity',!['straight','custom'].includes(state.silhouette));show('bellyDiameter',state.silhouette==='custom');show('neckDiameter',state.silhouette==='custom');
 const active=state.finish!=='none',rib=['ribs','fins','spiral','lattice'].includes(state.finish);
 ['ribCount','ribDepth','ribWidth','helix','textureRows'].forEach(k=>show(k,active));
 show('ribCount',active&&state.finish!=='rings');show('ribWidth',active&&rib);
 show('helix',active&&['fins','spiral','lattice','diamond'].includes(state.finish));
 show('textureRows',active&&['rings','waves','diamond','honeycomb','dots'].includes(state.finish));
 selects.get('ribShape')!.parentElement!.parentElement!.hidden=!(active&&rib);
 show('sides',['faceted','wavy','star'].includes(state.profile));show('waveDepth',state.profile==='wavy');
 presets.querySelectorAll('button').forEach((b,i)=>b.setAttribute('aria-pressed',String(Object.entries(PRESETS[i].params).every(([k,v])=>state[k]===v))));
 band.hidden=!active;show('drainageDiameter',state.drainageHole);ranges.get('drainageDiameter')!.setRange(3,sanitize({...state,drainageDiameter:999}).drainageDiameter);drain.set(state.drainageHole);color.set(state.color);
}
function packed(){return arrange(parts,...printerPlate(),{});}
function fits(){
 if(!parts.length)return false;
 const b=bounds(parts),v=choiceVolume(getPrinterChoice()),layout=packed();
 return !layout.oversized.length&&!layout.warnings.length&&(!v||b.max[2]-b.min[2]<=v[2]);
}
function status(){
 if(!parts.length)return;
 const b=bounds(parts),size=b.max.map((x,i)=>(x-b.min[i]).toFixed(0)).join(' × ');
 const okay=fits();actions.forEach(b=>b.disabled=!okay);viewer.setPlateSize(...printerPlate());
 shell.setStatus(!okay?'Supera il volume della stampante scelta: riduci le dimensioni.':warnings[0]??size+' mm · Il tuo vaso è pronto',!okay||warnings.length?'warn':'ok');
}
function send(job:{id:number;params:VaseParams}){busy=true;worker.postMessage(job);}
function schedule(){
 const id=++revision;actions.forEach(b=>b.disabled=true);writeHashState(state,DEFAULTS);shell.setStatus('Aggiorno la forma…','busy');
 clearTimeout(timer);timer=setTimeout(()=>{const job={id,params:{...state}};if(busy)queued=job;else send(job);},70);
}
worker.onmessage=e=>{
 busy=false;const d=e.data;
 if(d.id===revision){
 if(d.error){actions.forEach(b=>b.disabled=true);shell.setStatus(d.error,'warn');}
 else{parts=d.result.parts;warnings=d.result.warnings;viewer.setParts(parts,{refit:fitNext});fitNext=false;status();}
 }
 if(queued){const next=queued;queued=undefined;if(next.id===revision)send(next);}
};
worker.onerror=()=>{busy=false;actions.forEach(b=>b.disabled=true);shell.setStatus('Il motore 3D non risponde: ricarica la pagina.','warn');};
shell.stageTools.append(iconButton({label:'Vista 3D',icon:ICONS.iso,onClick:()=>viewer.setView('iso')}),iconButton({label:'Vista frontale',icon:ICONS.front,onClick:()=>viewer.setView('front')}),iconButton({label:'Vista dall’alto',icon:ICONS.top,onClick:()=>viewer.setView('top')}),button({label:'Inquadra vaso',onClick:()=>viewer.setParts(parts,{refit:true})}));
const filename=()=>slug('vaso-'+SILHOUETTES[state.silhouette]+'-'+FINISHES[state.finish]+'-'+state.height+'mm');
for(const o of [
 {label:'STL',onClick:()=>{if(fits())download(toSTL(parts),filename()+'.stl','model/stl');}},
 {label:'3MF',variant:'primary' as const,onClick:()=>{if(fits())download(to3MF(packed().plates[0],{title:filename(),printProfile:'standard',plateCenter:printerCenter()}),filename()+'.3mf','model/3mf');}}
]){const b=button(o);b.disabled=true;actions.push(b);shell.exportBar.append(b);}
onPrinterChange(status);sync();schedule();
