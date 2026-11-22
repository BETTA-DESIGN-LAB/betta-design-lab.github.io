import '@bdl/ui-kit/style.css';
import {bounds,type Part} from '@bdl/geometry';
import {createViewer} from '@bdl/viewer';
import {printerPlate,PRINTERS,onPrinterChange,choiceVolume,getPrinterChoice} from '@bdl/brand';
import {to3MF,toSTL,download,slug} from '@bdl/export';
import {zipSync,strToU8} from 'fflate';
import {appShell,section,slider,segmented,colorPicker,button,iconButton,el,toggle,panelFooter,readHashState,writeHashState,ICONS,toast} from '@bdl/ui-kit';
import {DEFAULTS,sanitize,STYLES,TEXTURES,MOUNTS,type Params} from './params.ts';
import {lettering} from './lettering.ts';
import type {Result} from './geometry.ts';
import {layout,currentPlacement,type Machine} from './layout.ts';
import type {Placements} from '../../box/src/placement.ts';

const shell=appShell({title:'Bubble Letter',intro:'Lettere soffici, texture da toccare e un colore per ogni carattere. Componi una parola da appoggiare o appendere.'});
let state=sanitize(readHashState(DEFAULTS)),result:Result|undefined,revision=0,busy=false;
let queued:ReturnType<typeof job>|undefined,timer:ReturnType<typeof setTimeout>,view='standing',plate=0,selected=0;
let shown:Part[]=[],pinned:Placements={},machines:Machine[]=[],primary:Machine;
let latestPack:ReturnType<typeof layout>|undefined;
const controls=el('div'),exports:HTMLButtonElement[]=[],plateLabel=el('span');
const worker=new Worker(new URL('./worker.ts',import.meta.url),{type:'module'});
const viewer=createViewer(shell.stage,{smoothView:true,fitPadding:1.12,fitPlate:()=>view==='plate',canMovePart:()=>view==='plate',onSelectPart:id=>{
  if(id?.startsWith('letter-')){selected=Number(id.slice(7));paint();}
},onMovePart:(id,dx,dy)=>{
  const original=result?.parts.find(part=>part.id===id),displayed=shown.find(part=>part.id===id);
  if(!original||!displayed)return;
  const at=currentPlacement(displayed,original,plate);
  pinned[id]={...at,x:at.x+dx,y:at.y+dy};display();
}});
function printerChanged(){
  const [width,depth]=printerPlate();primary={name:'Stampante scelta',width,depth,speed:100};
  pinned={};plate=0;if(result)display(true);
}
printerChanged();onPrinterChange(printerChanged);
let stageWidth=shell.stage.clientWidth;
new ResizeObserver(()=>{
  const width=shell.stage.clientWidth;
  if(result&&Math.abs(width-stageWidth)>12)viewer.fit();
  stageWidth=width;
}).observe(shell.stage);

shell.panel.append(controls,panelFooter());
function job(){return {id:revision,params:{...state},glyphs:lettering(state)};}
function rebuild(){
  exports.forEach(b=>b.disabled=true);shell.setStatus('Le lettere prendono forma…','busy');
  try {const next=job();if(busy)queued=next;else{busy=true;worker.postMessage(next);}}
  catch(error){shell.setStatus(error instanceof Error?error.message:String(error),'warn');}
}
function change<K extends keyof Params>(key:K,value:Params[K],geometry=true){
  state=sanitize({...state,[key]:value});
  writeHashState(state,DEFAULTS);
  if(!geometry){display();return;}
  revision++;exports.forEach(b=>b.disabled=true);clearTimeout(timer);timer=setTimeout(rebuild,220);
}
function range(key:keyof Params,label:string,min:number,max:number,step=1,unit='mm',geometry=true){
  const level=el('p',{class:'bdl-hint','aria-live':'polite'});
  const describe=(value:number)=>value<25?'Leggermente gonfio':value<55?'Soffice':value<80?'Molto gonfio':'Palloncino';
  const row=slider({label,min,max,step,value:Number(state[key]),unit,editable:true,onInput:value=>{
    change(key,value,geometry);if(key==='inflate')level.textContent=describe(value);
  }}).root;
  if(key==='inflate'){level.textContent=describe(state.inflate);row.append(level);}
  return row;
}
function select(label:string,value:string,options:readonly (readonly [string,string])[],onChange:(v:string)=>void){
  const input=el('select',{class:'bdl-text-input','aria-label':label},...options.map(([id,name])=>el('option',{value:id,selected:value===id},name)));
  input.addEventListener('change',()=>onChange(input.value));return el('label',{},label,input);
}
function paint(){
  const open=new Set([...controls.querySelectorAll<HTMLDetailsElement>('details[open]')].map(item=>item.dataset.key));
  const scroll=shell.panel.scrollTop;
  const focused=document.activeElement as HTMLInputElement|null;
  const editingText=focused?.getAttribute('aria-label')==='Lettere o numeri';
  const caret=editingText?focused?.selectionStart:null;
  const text=el('input',{class:'bdl-text-input',type:'text',maxlength:32,value:state.text,'aria-label':'Lettere o numeri'});
  text.addEventListener('input',()=>{change('text',text.value);selected=0;});
  const letterColors=el('div',{class:'bdl-key-icon-grid'});
  const chars=Array.from(state.text).filter(char=>char.trim());
  selected=Math.min(selected,Math.max(0,chars.length-1));
  chars.forEach((char,index)=>letterColors.append(button({label:char+' · '+(index+1),variant:index===selected?'primary':'ghost',onClick:()=>{selected=index;paint();}})));
  const colors=state.colors.split(',');
  function recolor(all:boolean,value:string){
    const next=chars.map((_,i)=>all||i===selected?value:colors[i%colors.length]||'#ff4b16');
    change('colors',next.join(','),false);paint();
  }
  const color=colors[selected%colors.length]||'#ff4b16';
  const advanced=el('details',{'data-key':'texture'},el('summary',{},'Scala e profondità della texture'),
    range('textureScale','Passo della texture',1.5,15,.1),
    range('textureDepth','Profondità della texture',0,2,.05),
    el('p',{class:'bdl-hint'},'La texture è modellata nella superficie ed è inclusa negli STL e 3MF.'));
  advanced.hidden=state.texture==='smooth';
  const mount=section('Retro e fissaggio',select('Fissaggio',state.mount,MOUNTS,value=>{change('mount',value);paint();}));
  if(state.mount==='stand')mount.append(el('p',{class:'bdl-hint'},'Supporto separato con linguetta a incastro: si inserisce e si sfila dal retro. Posizione, altezza, profondità e linguetta si adattano ai tratti pieni e alla grandezza di ogni lettera.'),range('lean','Inclinazione all’indietro',0,20,1,'°'),range('standThickness','Spessore massimo del piedistallo',2,6,.2),range('tolerance','Gioco per lato',.1,.6,.05));
  const supportInfo=result?.letters[selected];
  if(state.mount==='stand'&&supportInfo?.standLength&&supportInfo.standHeight)mount.append(
    el('p',{class:'bdl-hint'},supportInfo.char+' · supporto adattato a '+supportInfo.standLength.toFixed(1)+' mm di profondità e '+supportInfo.standHeight.toFixed(1)+' mm di altezza.'));
  if(state.mount==='keyhole')mount.append(select('Asole per lettera',String(state.keyholes),[['0','Automatico'],['1','Una'],['2','Due']],value=>change('keyholes',Number(value))));
  if(state.mount==='magnet')mount.append(range('magnetDiameter','Diametro magnete',3,20,.5),range('magnetThickness','Spessore magnete',1,8,.2),range('magnets','Magneti per lettera',1,4,1,''),range('tolerance','Gioco per lato',.1,.6,.05));
  if(state.mount==='adhesive'){
    mount.append(el('p',{class:'bdl-hint'},'Una o due sedi adattate automaticamente ai tratti pieni sul retro, con dimensioni e orientamento propri per ogni lettera o numero.'));
    const seats=result?.letters[selected]?.adhesiveSeats;
    if(seats?.length)mount.append(el('p',{class:'bdl-hint'},result!.letters[selected].char+' · '+seats.length+(seats.length===1?' sede':' sedi')+' · '+seats.map(seat=>seat.width.toFixed(1)+' × '+seat.height.toFixed(1)+' mm').join(' / ')));
  }
  const printer=el('details',{'data-key':'printer'},el('summary',{},'Margini e orientamento'),
    range('margin','Margine di sicurezza',5,20,1,'mm',false),
    toggle({label:'Ruota i pezzi per farli entrare',value:state.rotate,onChange:value=>{pinned={};change('rotate',value,false);}}).root,
    toggle({label:'Piatto circolare',value:state.roundBed,onChange:value=>{pinned={};change('roundBed',value,false);}}).root,
    el('p',{class:'bdl-hint'},'Il volume si imposta dal pulsante Stampante in alto. I pezzi aggiuntivi passano automaticamente ai piatti successivi.'));
  const farm=el('details',{'data-key':'farm'},el('summary',{},'Distribuisci su più stampanti'));
  machines.forEach((machine,index)=>farm.append(section(machine.name,
    slider({label:'Velocità relativa',min:25,max:200,value:machine.speed,step:5,unit:'%',onInput:value=>{machine.speed=value;display();}}).root,
    button({label:'Rimuovi stampante',onClick:()=>{machines.splice(index,1);pinned={};display(true);paint();}}))));
  farm.append(select('Aggiungi una stampante','', [['','Scegli…'],...PRINTERS.map(printer=>[printer.id,printer.brand+' '+printer.name] as const)],value=>{
    const printer=PRINTERS.find(printer=>printer.id===value);if(!printer||machines.length>=5)return;
    machines.push({name:printer.brand+' '+printer.name+' '+(machines.length+2),width:printer.volume[0],depth:printer.volume[1],speed:100});pinned={};display(true);paint();
  }));
  const restore=el('input',{type:'file',accept:'.json','aria-label':'Apri progetto Bubble Letter'});
  restore.addEventListener('change',async()=>{
    try {
      const file=restore.files?.[0];if(!file)return;
      if(file.size>100000)throw new Error('Progetto troppo grande.');
      const data=JSON.parse(await file.text());
      if(data.version!==1||!data.params||typeof data.params!=='object')throw new Error('Progetto non valido.');
      state=sanitize(data.params);
      machines=Array.isArray(data.machines)?data.machines.filter((item:Machine)=>item&&typeof item.name==='string'&&[item.width,item.depth,item.speed].every(Number.isFinite)&&item.width>=80&&item.width<=1000&&item.depth>=80&&item.depth<=1000&&item.speed>=25&&item.speed<=200).slice(0,5):[];
      pinned={};
      if(data.pinned&&typeof data.pinned==='object')for(const [id,raw]of Object.entries(data.pinned).slice(0,64)){
        const at=raw as {x:number;y:number;angle:number;plate:number};
        if(/^(letter|stand)-([0-9]|[12][0-9]|3[01])$/.test(id)&&at&&[at.x,at.y,at.angle,at.plate].every(Number.isFinite)&&Math.abs(at.x)<=2000&&Math.abs(at.y)<=2000&&Math.abs(at.angle)<=360&&Number.isInteger(at.plate)&&at.plate>=0&&at.plate<64)pinned[id]={...at};
      }
      plate=0;selected=0;revision++;clearTimeout(timer);writeHashState(state,DEFAULTS);paint();rebuild();
    }catch(error){toast(error instanceof Error?error.message:'Progetto non valido.');}
  });
  controls.replaceChildren(
    section('La tua parola',el('label',{},'Lettere o numeri',text),select('Stile della lettera',state.style,STYLES,value=>change('style',value)),range('inflate','Gonfiaggio',0,100,1,'%'),
      el('p',{class:'bdl-hint'},'Ogni carattere è un pezzo. Il retro resta piatto e i fori vengono conservati.')),
    section('Misure',range('height','Altezza maiuscole',15,500),range('thickness','Spessore prima del gonfiaggio',4,60,.5)),
    section('Finitura',select('Texture',state.texture,TEXTURES,value=>{change('texture',value);paint();}),advanced),
    section('Colori delle lettere',letterColors,colorPicker({label:'Lettera selezionata',value:color,onChange:value=>recolor(false,value)}).root,
      button({label:'Usa per tutte',onClick:()=>recolor(true,color)}),
      button({label:'Mescola palette',onClick:()=>{const palette=['#ff4b16','#87bdd0','#f2cc55','#784f36','#738559','#eee8d9'];change('colors',chars.map((_,i)=>palette[(i+selected+1)%palette.length]).join(','),false);selected=(selected+1)%Math.max(1,chars.length);paint();}})),
    mount,printer,farm,button({label:'Disponi automaticamente',onClick:()=>{pinned={};display(true);}}),
    section('Progetto',el('label',{},'Apri progetto',restore),button({label:'Salva progetto',onClick:()=>download(strToU8(JSON.stringify({version:1,params:state,machines,pinned})),filename()+'.json')}),
      button({label:'Copia link',onClick:()=>{writeHashState(state,DEFAULTS);navigator.clipboard.writeText(location.href).then(()=>toast('Link copiato'),()=>toast('Copia il link dalla barra degli indirizzi.'));}}),
      el('p',{class:'bdl-hint'},'Prototipo da collaudare. Prova l’incastro di una lettera prima di stampare la parola completa.'))
  );
  for(const item of controls.querySelectorAll<HTMLDetailsElement>('details'))item.open=open.has(item.dataset.key);
  if(editingText){text.focus({preventScroll:true});if(caret!==null&&caret!==undefined)text.setSelectionRange(caret,caret);}
  shell.panel.scrollTop=scroll;
}
function standingParts():Part[]{
  if(!result)return [];
  const out:Part[]=[];let cursor=0;
  for(const info of result.letters){
    const source=result.parts.find(part=>part.id===info.id)!;
    const center=cursor+info.width/2;
    const angle=state.mount==='stand'?state.lean*Math.PI/180:0;
    const cos=Math.cos(angle),sin=Math.sin(angle);
    const positions=new Float32Array(source.mesh.positions);
    for(let i=0;i<positions.length;i+=3){
      const x=positions[i],y=positions[i+1]-info.bottom,z=positions[i+2];
      positions[i]=x+center;positions[i+1]=y*sin-z*cos;positions[i+2]=y*cos+z*sin;
    }
    out.push({...source,mesh:{positions,indices:source.mesh.indices}});
    if(info.stand&&info.slot){
      const stand=result.parts.find(part=>part.id===info.stand)!;
      const a=new Float32Array(stand.mesh.positions);
      for(let i=0;i<a.length;i+=3){
        const x=a[i],y=a[i+1],z=a[i+2];
        a[i]=z-(info.standThickness??state.standThickness)/2+info.slot[0]+center;
        a[i+1]=x;a[i+2]=y;
      }
      out.push({...stand,mesh:{positions:a,indices:stand.mesh.indices}});
    }
    cursor+=info.width+8;
  }
  for(const part of out)for(let i=0;i<part.mesh.positions.length;i+=3)part.mesh.positions[i]-=cursor/2;
  return out;
}
function display(refit=false){
  if(!result)return;
  const recolored=result.parts.map(part=>{const index=Number(part.id.split('-')[1]),colors=state.colors.split(',');return {...part,color:colors[index%colors.length]||'#ff4b16'};});
  result={...result,parts:recolored};
  latestPack=layout(result.parts,state,[primary,...machines],pinned);
  plate=Math.max(0,Math.min(plate,latestPack.plates.length-1));
  shown=view==='plate'?latestPack.plates[plate]?.parts??[]:standingParts();
  if(view==='rear')for(const part of shown)for(let vertex=0;vertex<part.mesh.positions.length;vertex+=3){
    part.mesh.positions[vertex]*=-1;part.mesh.positions[vertex+1]*=-1;
  }
  const selectedMachine=view==='plate'?([primary,...machines].find(machine=>latestPack!.plates[plate]?.name.startsWith(machine.name+' ·'))??primary):primary;
  viewer.setPlateSize(selectedMachine.width,selectedMachine.depth);viewer.setParts(shown,{refit});viewer.setMoveEnabled(view==='plate');
  plateTools.hidden=view!=='plate';plateLabel.textContent=latestPack.plates[plate]?.name??'Nessun piatto';
  const warnings=[...result.warnings,...latestPack.warnings,...latestPack.oversized.map(name=>name+' supera il piatto: riduci l’altezza.')];
  const zMax=choiceVolume(getPrinterChoice())?.[2];
  if(zMax&&result.parts.some(part=>bounds([part]).max[2]>zMax))warnings.push('Un pezzo supera l’altezza di stampa.');
  const depths=result.letters.map(letter=>letter.depth);
  shell.setStatus(warnings.join(' ')||(result.letters.length?result.letters.length+' lettere · profondità massima '+Math.max(...depths).toFixed(1)+' mm · '+latestPack.plates.length+' piatti':'Scrivi una parola per iniziare.'),warnings.length?'warn':'ok');
  exports.forEach(control=>control.disabled=!result?.parts.length||!!latestPack?.oversized.length||!!latestPack?.warnings.length);
}
const plateTools=el('div',{class:'bdl-plate-controls'},button({label:'‹',onClick:()=>{plate=Math.max(0,plate-1);display(true);}}),plateLabel,button({label:'›',onClick:()=>{plate++;display(true);}}));
shell.stageTools.append(iconButton({label:'Vista 3D',icon:ICONS.iso,onClick:()=>viewer.setView('iso')}),iconButton({label:'Vista frontale',icon:ICONS.front,onClick:()=>viewer.setView('front')}),iconButton({label:'Vista dall’alto',icon:ICONS.top,onClick:()=>viewer.setView('top')}),
  segmented({label:'Anteprima',value:view,options:[{value:'standing',label:'In piedi'},{value:'rear',label:'Retro'},{value:'plate',label:'Sul piatto'}],onChange:value=>{view=value;display(true);viewer.setView(value==='rear'?'front':'iso');}}).root,plateTools);
const filename=()=>slug('bubble-'+state.text);
function threeMF(parts:Part[],name:string){
  const machine=[primary,...machines].find(machine=>name.startsWith(machine.name+' ·'))??primary;
  return to3MF(parts,{title:filename(),printProfile:false,plateCenter:[machine.width/2,machine.depth/2],objectGroups:parts.map(part=>({name:part.name,partIds:[part.id]}))});
}
const guide='BETTA DESIGN LAB · BUBBLE LETTER\n\nLe lettere sono orientate con il retro piatto sul piatto. Le texture sono geometrie reali. Controlla l’anteprima dello slicer, soprattutto le sedi posteriori. I piedistalli sono pezzi separati da stampare piatti. La linguetta si inserisce e si sfila dalla fessura sul retro: il supporto è rimovibile. Il gioco è per lato. Prova un solo incastro prima del set completo. Le asole per vite hanno ingresso da 9 mm e gola da 4,4 mm. Incolla i magneti nelle sedi se il gioco lo richiede. Le sedi adesive sono una o due per carattere e si adattano alla sagoma. Taglia l’adesivo alle dimensioni effettive mostrate nel generatore. Il fissaggio deve essere verificato sul supporto scelto.\nI 3MF mantengono i preset di stampante e processo dello slicer.\n';
for(const config of [
  {label:'3MF a colori',variant:'primary' as const,onClick:()=>{const page=latestPack?.plates[plate];if(page)download(threeMF(page.parts,page.name),filename()+'-piatto-'+(plate+1)+'.3mf');}},
  {label:'Kit ZIP · tutti i piatti',onClick:()=>{
    if(!result||!latestPack)return;
    const entries:Record<string,Uint8Array>={'LEGGIMI.txt':strToU8(guide),'progetto.json':strToU8(JSON.stringify({version:1,params:state,machines,pinned}))};
    for(const part of result.parts)entries[part.id+'.stl']=toSTL([part]);
    latestPack.plates.forEach((page,i)=>entries['piatto-'+(i+1)+'.3mf']=threeMF(page.parts,page.name));
    entries['piano-stampa.txt']=strToU8(latestPack.plates.map((page,i)=>(i+1)+'. '+page.name+' — '+page.parts.map(p=>p.name).join(', ')).join('\n'));
    download(zipSync(entries),filename()+'.zip');
  }},
]){const control=button(config);control.disabled=true;exports.push(control);shell.exportBar.append(control);}
worker.onmessage=event=>{
  busy=false;
  const response=event.data as {id:number;result?:Result;error?:string};
  if(response.id===revision){
    if(response.error)shell.setStatus(response.error,'warn');
    else if(response.result){const first=!result;result=response.result;display(first);paint();}
  }
  if(queued){const next=queued;queued=undefined;if(next.id===revision){busy=true;worker.postMessage(next);}}
};
worker.onerror=()=>{busy=false;queued=undefined;shell.setStatus('Ricarica la pagina per riavviare il generatore.','warn');};
paint();
try {
  await Promise.all(['700 360px Fredoka','400 360px Coiny','400 360px "Lilita One"','800 360px "Baloo 2"','700 360px DynaPuff'].map(font=>document.fonts.load(font)));
} catch {
  shell.setStatus('Caricamento caratteri non riuscito. Ricarica la pagina.','warn');
}
rebuild();
