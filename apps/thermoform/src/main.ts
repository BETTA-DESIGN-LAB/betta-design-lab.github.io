import '@bdl/ui-kit/style.css';
import {type Part} from '@bdl/geometry';
import {createViewer} from '@bdl/viewer';
import {toSTL,to3MF,download} from '@bdl/export';
import {zipSync,strToU8} from 'fflate';
import {appShell,section,slider,colorPicker,button,iconButton,toast,panelFooter,readHashState,writeHashState,ICONS,el,segmented,toggle} from '@bdl/ui-kit';
import {parseSvg,type SvgArtwork} from '../../coaster/src/svg.ts';
import {receiveSvg} from '../../shared/svg-transfer.ts';
import {parseSTL} from '../../keycap/src/stl.ts';
import {arrange,currentPlacement,type Placements} from '../../box/src/placement.ts';
import {sanitize,DEFAULTS,type Params} from './params.ts';
import type {Result} from './geometry.ts';
import {validateArtwork,readPlacements} from './profile.ts';
const shell=appShell({title:'Thermoform',intro:'Da una sagoma piatta a un piccolo contenitore: due metà, stampi abbinati e chiusura con occhiello.'});
let state=sanitize(readHashState(DEFAULTS)),artwork:SvgArtwork|undefined,result:Result|undefined,view='kit',plateSize=256,plate=0,pinned:Placements={},shown:Part[]=[],request=0,timer:ReturnType<typeof setTimeout>,selected:string|null=null;
const worker=new Worker(new URL('./worker.ts',import.meta.url),{type:'module'});
const viewer=createViewer(shell.stage,{onSelectPart:id=>{selected=id;},canMovePart:()=>view==='kit',onMovePart:(id,dx,dy)=>{const original=result?.parts.find(p=>p.id===id),placed=shown.find(p=>p.id===id);if(!original||!placed)return;const at=currentPlacement(placed,original,plate);pinned[id]={...at,x:at.x+dx,y:at.y+dy};display();}});
const controls=el('div'),plateLabel=el('span');shell.panel.append(controls,panelFooter());
const exports:HTMLButtonElement[]=[];
function invalidate(){exports.forEach(b=>b.disabled=true);clearTimeout(timer);request++;}
function set<K extends keyof Params>(key:K,value:Params[K]){state=sanitize({...state,[key]:value});invalidate();timer=setTimeout(rebuild,220);}
async function loadSvg(file:File){
 if(file.size>5_000_000)throw new Error('SVG troppo grande: massimo 5 MB.');
 const id=++request;
 const next=validateArtwork(parseSvg(await file.text(),file.name));
 if(id!==request)return;
 invalidate();state=sanitize({...state,shape:'svg'});artwork=next;files.svg=next;
 pinned={};plate=0;paint();rebuild();
}
function paint(){controls.replaceChildren();
 const choice=el('select',{class:'bdl-text-input','aria-label':'Sagoma',onChange:()=>{set('shape',choice.value as Params['shape']);artwork=files[state.shape];pinned={};paint();}},...([['ghost','Fantasmino'],['pumpkin','Zucca'],['heart','Cuore'],['star','Stella'],['round','Tonda'],['svg','Il tuo SVG'],['stl','Il tuo STL']] as const).map(([value,label])=>el('option',{value,selected:state.shape===value},label)));
 const svgUpload=el('input',{type:'file',accept:'.svg,image/svg+xml','aria-label':'Carica la tua sagoma SVG',onChange:async()=>{const file=svgUpload.files?.[0];if(!file)return;try{await loadSvg(file);}catch(e){toast(e instanceof Error?e.message:String(e));}finally{svgUpload.value='';}}});
 const shape=section('La tua forma',el('label',{},'Sagoma',choice),el('label',{},'Usa una sagoma SVG',svgUpload),el('p',{class:'bdl-hint'},'Carica il tuo disegno: sagome, stampi e chiusure si adattano automaticamente.'),el('a',{href:'../image-svg/'},'Converti prima un’immagine in SVG'));

 if(state.shape==='svg'||state.shape==='stl'){
  const input=el('input',{type:'file',accept:state.shape==='svg'?'.svg':'.stl','aria-label':'Carica '+state.shape.toUpperCase(),onChange:async()=>{invalidate();try{const file=input.files?.[0];if(!file)return;const id=++request;
   if(state.shape==='svg'){await loadSvg(file);}
   else{shell.setStatus('Leggo il profilo STL…');worker.postMessage({id,kind:'stl',mesh:parseSTL(await file.arrayBuffer())});}
  }catch(e){result=undefined;viewer.setParts([]);shell.setStatus(String(e),'warn');}}});
  if(state.shape==='stl')shape.append(input);
  shape.append(el('p',{class:'bdl-hint'},artwork?.name??'Nessun file caricato'),el('p',{class:'bdl-hint'},state.shape==='stl'?'Orienta lo STL prima del caricamento: usiamo il profilo visto dall’alto (Z), con bombatura regolabile. Non riproduciamo la superficie originale.':'Un solo contorno esterno unito. I vuoti del disegno vengono riempiti; la trama viene creata qui.'));
 }
 if(['ghost','pumpkin'].includes(state.shape))shape.append(toggle({label:'Viso sul fronte',value:state.face,onChange:v=>set('face',v)}).root);
 const restore=el('input',{type:'file',accept:'.json','aria-label':'Apri progetto Thermoform',onChange:async()=>{try{const f=restore.files?.[0];if(!f)return;if(f.size>5_000_000)throw new Error('Progetto troppo grande.');const data=JSON.parse(await f.text());if(data.version!==1||!data.params)throw new Error('Progetto non valido.');const next=sanitize(data.params),main=validateArtwork(data.artwork),svg=validateArtwork(data.files?.svg),stl=validateArtwork(data.files?.stl),positions=readPlacements(data.pinned);invalidate();state=next;artwork=main;files.svg=svg;files.stl=stl;plateSize=[180,220,256].includes(data.plateSize)?data.plateSize:256;pinned=positions;plate=0;paint();rebuild();}catch(e){toast(String(e));}}});
 controls.append(shape,section('Il tuo progetto',button({label:'Salva configurazione',onClick:()=>download(strToU8(JSON.stringify({version:1,params:state,artwork,files,pinned,plateSize})),base()+'-progetto.json')}),el('label',{},'Apri progetto',restore),el('p',{class:'bdl-hint'},'Il progetto include il disegno caricato. Il link conserva soltanto le impostazioni.')));
 controls.append(section('Misure e bombatura',...([['width','Larghezza',55,160,1],['height','Altezza',60,180,1],['dome','Bombatura per metà',5,35,1],['sheet','Spessore sagome',.6,1.6,.2]] as const).map(([key,label,min,max,step])=>slider({label,min,max,step,value:state[key],unit:'mm',onInput:v=>set(key,v)}).root)));
 const pattern=section('La superficie',segmented({label:'Trama',value:state.pattern,options:[{value:'grid',label:'Griglia'},{value:'diagonal',label:'Diagonale'},{value:'solid',label:'Piena'}],onChange:v=>{set('pattern',v);paint();}}).root,slider({label:'Bordo continuo',min:1.6,max:5,step:.2,value:state.rim,unit:'mm',onInput:v=>set('rim',v)}).root);
 if(state.pattern!=='solid')pattern.append(slider({label:'Passo della trama',min:3,max:8,step:.5,value:state.spacing,unit:'mm',onInput:v=>set('spacing',v)}).root,slider({label:'Spessore fili',min:.7,max:2,step:.1,value:state.strand,unit:'mm',onInput:v=>set('strand',v)}).root);
 controls.append(pattern,section('Chiusura e stampi',el('p',{class:'bdl-hint'},'Raccordo filettato e tappo con occhiello inclusi. Le linguette delle due metà entrano nelle feritoie del raccordo; il tappo le trattiene.'),slider({label:'Gioco di montaggio',min:.2,max:.6,step:.05,value:state.clearance,unit:'mm',onInput:v=>set('clearance',v)}).root),section('Colori',colorPicker({label:'Sagome',value:state.color,onChange:v=>set('color',v)}).root,colorPicker({label:'Stampi e chiusure',value:state.moldColor,onChange:v=>set('moldColor',v)}).root),section('Piatto di stampa',segmented({label:'Dimensioni piatto',value:String(plateSize),options:[{value:'180',label:'180 mm'},{value:'220',label:'220 mm'},{value:'256',label:'256 mm'}],onChange:v=>{plateSize=Number(v);plate=0;pinned={};display();}}).root,button({label:'Disponi automaticamente',onClick:()=>{pinned={};display();}}),el('p',{class:'bdl-hint'},'Trascina i pezzi nella vista Kit da stampare. Se non entrano, vengono usati altri piatti.')),section('Prima della stampa',el('p',{class:'bdl-hint'},'Versione sperimentale. Prima prova su un pezzo piccolo: comportamento al calore, accoppiamenti e durata dipendono dai materiali. Gli stampi devono resistere al calore più delle sagome. La guida è inclusa nello ZIP.')));
}
const files:Partial<Record<Params['shape'],SvgArtwork>>={};
function display(refit=false){if(!result)return;const packed=arrange(result.parts,plateSize,plateSize,pinned);plate=Math.min(plate,Math.max(0,packed.plates.length-1));shown=view==='formed'?result.formed:packed.plates[plate]??[];viewer.setParts(shown,{refit});viewer.setPlateSize(plateSize,plateSize);plateLabel.textContent=view==='kit'?`Piatto ${plate+1} / ${packed.plates.length}`:'Anteprima indicativa';if(packed.oversized.length||packed.warnings.length)shell.setStatus(packed.warnings[0]??'Un pezzo supera il piatto: riduci le misure.','warn');exports.forEach(b=>b.disabled=Boolean(packed.oversized.length||packed.warnings.length));}
shell.stageTools.append(iconButton({label:'Vista 3D',icon:ICONS.iso,onClick:()=>viewer.setView('iso')}),iconButton({label:'Vista dall’alto',icon:ICONS.top,onClick:()=>viewer.setView('top')}),segmented({value:view,options:[{value:'kit',label:'Kit da stampare'},{value:'formed',label:'Oggetto formato'}],onChange:v=>{view=v;display(true);}}).root,button({label:'‹',title:'Piatto precedente',onClick:()=>{plate=Math.max(0,plate-1);display();}}),plateLabel,button({label:'›',title:'Piatto successivo',onClick:()=>{plate++;display();}}));
function rebuild(){const id=++request;exports.forEach(b=>b.disabled=true);shell.setStatus('Preparo sagome, stampi e chiusure…');worker.postMessage({id,kind:'build',params:state,artwork});writeHashState(state,DEFAULTS);}
worker.onmessage=event=>{const data=event.data;if(data.id!==request)return;if(data.error){result=undefined;viewer.setParts([]);exports.forEach(b=>b.disabled=true);shell.setStatus(data.error,'warn');return;}if(data.kind==='stl'){artwork=data.artwork;files.stl=artwork;paint();rebuild();return;}result=data.result;shell.setStatus(result?.warnings.find(w=>w.startsWith('Profilo asimmetrico'))??'6 pezzi coordinati · Prototipo da collaudare con una stampa.','warn');display(true);};
worker.onerror=()=>{result=undefined;exports.forEach(b=>b.disabled=true);shell.setStatus('Il motore non risponde: ricarica la pagina.','warn');};
const guide=`BETTA DESIGN LAB · THERMOFORM — PROTOTIPO\n\n1. Stampa fronte e retro piatti: la trama è già geometria, non serve un infill speciale.\n2. Stampa matrice concava, stampo convesso, raccordo e tappo. Controlla il verso di stampa e gli eventuali supporti nello slicer.\n3. Collauda la filettatura senza forzare. Il gioco è regolabile nel generatore.\n4. Sperimenta prima una piccola sagoma: usa stampi resistenti al calore e riscalda la sagoma gradualmente, seguendo le indicazioni del materiale.\n5. Metti la sagoma sulla matrice, proteggi le mani e premi con il convesso. Lascia raffreddare prima di estrarre. Ripeti per la seconda metà. Con un profilo asimmetrico usa le due impronte speculari: fronte e retro devono corrispondere alle rispettive impronte, mai forzare un pezzo nella sagoma sbagliata.\n6. Accosta le due metà, inserisci insieme le linguette nelle feritoie del raccordo e avvita il tappo con occhiello. Verifica che non scivolino.\n\nNon esiste una temperatura universale. Non usare fiamme; evita ustioni e deformazione degli stampi. Il pezzo non è certificato per alimenti o giocattoli.\nL’anteprima non simula lo stiramento del materiale. Gli STL importati forniscono solo il profilo XY.\n`;
const base=()=>`thermoform-${state.shape}-${state.width}x${state.height}`;
const zip=()=>{if(!result)return;const packed=arrange(result.parts,plateSize,plateSize,pinned);if(packed.oversized.length||packed.warnings.length){toast('Sistema i pezzi sul piatto prima di esportare.');return;}const entries:Record<string,Uint8Array>={'LEGGIMI-montaggio.txt':strToU8(guide),'progetto.json':strToU8(JSON.stringify({version:1,params:state,artwork,files,pinned,plateSize}))};for(const [i,parts]of packed.plates.entries())entries[`piatto-${i+1}.3mf`]=to3MF(parts,{title:base(),plateCenter:[plateSize/2,plateSize/2]});for(const part of result.parts)entries[`${part.id}.stl`]=toSTL([part]);download(zipSync(entries),base()+'.zip');};
for(const options of [{label:'Scarica kit completo',variant:'primary' as const,onClick:zip},{label:'3MF del piatto',onClick:()=>{if(!result)return;const packed=arrange(result.parts,plateSize,plateSize,pinned);download(to3MF(packed.plates[plate]??[],{title:base()}),base()+'.3mf');}},{label:'Pezzo selezionato',onClick:()=>{const part=result?.parts.find(p=>p.id===selected);if(!part){toast('Seleziona un pezzo nella vista Kit da stampare.');return;}download(toSTL([part]),part.id+'.stl');}}]){const b=button(options);b.disabled=true;exports.push(b);shell.exportBar.append(b);}
await receiveSvg(loadSvg);
paint();rebuild();
