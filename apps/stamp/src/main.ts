import '@bdl/ui-kit/style.css';
import {type Part} from '@bdl/geometry';
import {createViewer} from '@bdl/viewer';
import {toSTL,to3MF,download,slug} from '@bdl/export';
import {zipSync,strToU8} from 'fflate';
import {appShell,section,slider,colorPicker,button,iconButton,panelFooter,readHashState,writeHashState,ICONS,el,segmented,toast,toggle} from '@bdl/ui-kit';
import {parseSvg,type SvgArtwork} from '../../coaster/src/svg.ts';
import {KEY_ICONS,keyIconSvg} from '../../keycap/src/icons.ts';
import {receiveSvg} from '../../shared/svg-transfer.ts';
import {arrange,currentPlacement,type Placements} from '../../box/src/placement.ts';
import {validateArtwork} from './validation.ts';
import {DEFAULTS,sanitize,handleKind,type Params} from './params.ts';
import {stampLettering} from './lettering.ts';
import type {Design,Result} from './geometry.ts';
const shell=appShell({title:'Timbri',intro:'La tua firma, un piccolo logo o un messaggio: componi l’impronta e scegli il tuo manico.'});
let state=sanitize(readHashState(DEFAULTS)),extra:SvgArtwork|undefined,result:Result|undefined,view='imprint',revision=0,busy=false,queued:{id:number;params:Params;design:Design}|undefined,timer:ReturnType<typeof setTimeout>,selected:string|null=null,plate=0,plateSize=256,pinned:Placements={},shown:Part[]=[];
let cachedText='',cachedFont='',cachedArtwork:SvgArtwork|undefined,dragging=false,held:{id:number;result?:Result;error?:string}|undefined;
const worker=new Worker(new URL('./worker.ts',import.meta.url),{type:'module'});
const controls=el('div'),exports:HTMLButtonElement[]=[],plateLabel=el('span');
shell.panel.append(controls,panelFooter());
const viewer=createViewer(shell.stage,{smoothView:true,fitPlate:()=>view==='kit',dragGroup:id=>id,canMovePart:id=>view==='kit'||view==='imprint'&&['text','extra'].includes(id),onSelectPart:id=>{selected=id;refresh();},onDragState:v=>{dragging=v;if(!v&&held){const r=held;held=undefined;receive(r);}},onMovePart:(id,dx,dy)=>{
 if(view==='imprint'){const symbol=id==='extra';state=sanitize({...state,[symbol?'extraX':'x']:state[symbol?'extraX':'x']+dx,[symbol?'extraY':'y']:state[symbol?'extraY':'y']+dy});invalidate();rebuild();paint();}
 else{const original=result?.parts.find(p=>p.id===id),placed=shown.find(p=>p.id===id);if(!original||!placed)return;const at=currentPlacement(placed,original,plate);pinned[id]={...at,x:at.x+dx,y:at.y+dy};display();}
}});
function invalidate(){revision++;exports.forEach(b=>b.disabled=true);clearTimeout(timer);}
function set<K extends keyof Params>(key:K,value:Params[K]){state=sanitize({...state,[key]:value});invalidate();timer=setTimeout(rebuild,140);}
function range(key:keyof Params,label:string,min:number,max:number,step=1,unit='mm'){return slider({label,min,max,step,value:state[key] as number,unit,onInput:v=>set(key,v)}).root;}
async function loadSvg(file:File){if(file.size>500_000)throw new Error('SVG troppo grande: massimo 500 KB.');const next=validateArtwork(parseSvg(await file.text(),file.name));if(!next)throw new Error('SVG vuoto.');extra=next;invalidate();paint();rebuild();}
function paint(){
 const active=document.activeElement as HTMLTextAreaElement|null,label=active?.getAttribute('aria-label'),caret=active?.selectionStart;
 const scroll=shell.panel.scrollTop,opened=new Set([...controls.querySelectorAll<HTMLDetailsElement>('details[open]')].map(d=>d.dataset.section));
 controls.replaceChildren();
 const text=el('textarea',{class:'bdl-text-input',rows:3,maxlength:160,'aria-label':'Testo del timbro',placeholder:'Scrivi qui, anche su più righe…',value:state.text,onInput:()=>{const had=!!state.text.trim();set('text',text.value);if(had!==!!state.text.trim())paint();}});
 text.value=state.text;
 const personal=section('Componi l’impronta',el('label',{},'Testo',text),segmented({label:'Carattere',value:state.font,options:[{value:'sans',label:'Moderno'},{value:'serif',label:'Classico'},{value:'cursive',label:'Corsivo'}],onChange:v=>set('font',v)}).root,
 el('p',{class:'bdl-hint'},'Testo, SVG e icona possono stare insieme. Trascinali nell’anteprima dell’impronta; il timbro viene specchiato automaticamente.'));
 const file=el('input',{type:'file',accept:'.svg,image/svg+xml','aria-label':'Aggiungi SVG al timbro',onChange:async()=>{try{const f=file.files?.[0];if(f)await loadSvg(f);}catch(e){toast(String(e));}finally{file.value='';}}});
 const icons=el('div',{class:'bdl-key-icon-grid'});
 for(const icon of KEY_ICONS)icons.append(button({label:icon[1],icon:keyIconSvg(icon[3]),onClick:()=>{extra=parseSvg(keyIconSvg(icon[3]).replace('currentColor','#000'),icon[1]);controls.querySelector('details[data-section="icons"]')?.removeAttribute('open');invalidate();paint();rebuild();}}));
 if(state.text.trim())personal.append(range('textSize','Dimensione testo',10,150,1,'%'));
 personal.append(file);
 if(extra)personal.append(el('p',{},extra.name),range('extraSize','Dimensione SVG / icona',4,90),range('extraThicken','Ispessimento tratti SVG / icona',0,2,.05),el('p',{class:'bdl-hint'},'0 mantiene il disegno originale. +0,20 mm aggiunge circa 0,20 mm alla larghezza dei tratti, senza scalare il disegno. Anche i vuoti si restringono: controlla l’anteprima.'),button({label:'Rimuovi SVG / icona',onClick:()=>{extra=undefined;invalidate();paint();rebuild();}}));
 personal.append(el('details',{'data-section':'icons'},el('summary',{},'Scegli un’icona'),icons),el('a',{href:'../image-svg/'},'Converti un’immagine in SVG'));
 controls.append(personal);
 const shape=el('select',{class:'bdl-text-input','aria-label':'Forma della piastra',onChange:()=>{set('shape',shape.value as Params['shape']);paint();}},...([['rect','Rettangolare'],['round','Tonda'],['oval','Ovale'],['contour','Sagomata sul disegno']] as const).map(([value,label])=>el('option',{value,selected:state.shape===value},label)));
 controls.append(section('La piastra',el('label',{},'Forma',shape),range('base','Spessore piastra',2.4,8,.2),el('p',{class:'bdl-hint'},'Piastra sottile con rinforzo solo al centro per mantenere l’attacco avvitabile.'),range('width',state.shape==='round'?'Diametro':'Larghezza',28,140),state.shape!=='round'&&state.shape!=='contour'?range('height','Altezza',28,100):null,state.shape==='rect'?range('radius','Angoli arrotondati',0,Math.min(15,Math.min(state.width,state.height)/2-.5),.5):null,toggle({label:'Cornice nell’impronta',value:state.frame,onChange:v=>{set('frame',v);paint();}}).root,state.frame?range('frameWidth','Spessore cornice',.6,2.5,.1):null));
 const handle=el('select',{class:'bdl-text-input','aria-label':'Tipo di manico',onChange:()=>{set('handle',handle.value as Params['handle']);paint();}},...([['auto','Consigliato per queste misure'],['round','Pomello tondo'],['ergonomic','Ergonomico'],['bridge','A ponte'],['palm','Da palmo']] as const).map(([value,label])=>el('option',{value,selected:state.handle===value},label)));
 controls.append(section('Il manico',handle,el('p',{class:'bdl-hint'},'Stesso attacco avvitabile per tutti: puoi ristampare soltanto la piastra e riutilizzare il manico.'),el('p',{class:'bdl-hint'},'Selezione attuale: '+({round:'pomello tondo',ergonomic:'ergonomico',bridge:'a ponte',palm:'da palmo'}[handleKind(state)]))));
 const advanced=el('details',{'data-section':'advanced'},el('summary',{},'Regola i dettagli'),range('relief','Altezza del rilievo',.6,3,.1),range('clearance','Gioco della filettatura',.2,.6,.05));
 if(state.text.trim())advanced.append(section('Posizione scritta',range('x','Testo: destra / sinistra',-100,100),range('y','Testo: alto / basso',-100,100),range('angle','Rotazione testo',-180,180,1,'°')));
 if(extra)advanced.append(section('Posizione SVG / icona',range('extraX','Simbolo: destra / sinistra',-100,100),range('extraY','Simbolo: alto / basso',-100,100),range('extraAngle','Rotazione simbolo',-180,180,1,'°')));
 controls.append(advanced,section('Colore di anteprima',colorPicker({label:'Timbro',value:state.color,onChange:v=>set('color',v)}).root),section('Piatto di stampa',segmented({label:'Dimensione piatto',value:String(plateSize),options:[{value:'180',label:'180 mm'},{value:'220',label:'220 mm'},{value:'256',label:'256 mm'}],onChange:v=>{plateSize=Number(v);plate=0;pinned={};display(true);}}).root,button({label:'Disponi automaticamente',onClick:()=>{pinned={};display();}})));
 const restore=el('input',{type:'file',accept:'.json','aria-label':'Apri progetto timbro',onChange:async()=>{try{const f=restore.files?.[0];if(!f)return;if(f.size>1_000_000)throw new Error('Progetto troppo grande.');const d=JSON.parse(await f.text());if(d.version!==1||!d.params)throw new Error('Progetto non valido.');const a=validateArtwork(d.extra);state=sanitize(d.params);extra=a;pinned={};plate=0;invalidate();paint();rebuild();}catch(e){toast(String(e));}}});
 controls.append(section('Conserva il progetto',button({label:'Salva configurazione',onClick:()=>download(strToU8(JSON.stringify({version:1,params:state,extra})),filename()+'.json')}),el('label',{},'Apri progetto',restore),el('p',{class:'bdl-hint'},'Il progetto include l’SVG. Il link conserva testo e impostazioni, ma non il file caricato.')),section('Prima dell’uso',el('p',{class:'bdl-hint'},'Prototipo da collaudare. La qualità dell’impronta dipende da materiale, superficie e inchiostro. Parti da un disegno semplice e verifica il filetto senza forzare. Con l’orientamento fornito, la piastra sottile richiede supporti sotto le zone attorno al rinforzo centrale. Anche il manico a ponte può richiedere supporti.')));
 for(const d of controls.querySelectorAll<HTMLDetailsElement>('details'))d.open=opened.has(d.dataset.section);
 if(label==='Testo del timbro'){const next=controls.querySelector<HTMLTextAreaElement>('textarea');next?.focus({preventScroll:true});if(caret!==undefined&&caret!==null)next?.setSelectionRange(caret,caret);}
 shell.panel.scrollTop=scroll;
}
const tools=segmented({label:'Vista',value:view,options:[{value:'imprint',label:'Impronta'},{value:'assembled',label:'Timbro montato'},{value:'kit',label:'Sul piatto'}],onChange:v=>{view=v;selected=null;display(true);viewer.setView(v==='imprint'?'top':'iso');}});
shell.stageTools.append(iconButton({label:'Vista 3D',icon:ICONS.iso,onClick:()=>viewer.setView('iso')}),iconButton({label:'Vista dall’alto',icon:ICONS.top,onClick:()=>viewer.setView('top')}),tools.root);
const plateTools=el('div',{class:'bdl-plate-controls'},button({label:'‹',title:'Piatto precedente',onClick:()=>{plate=Math.max(0,plate-1);display(true);}}),plateLabel,button({label:'›',title:'Piatto successivo',onClick:()=>{plate++;display(true);}}));shell.stageTools.append(plateTools);
function display(refit=false){
 if(!result)return;const packed=arrange(result.parts,plateSize,plateSize,pinned);
 plate=Math.max(0,Math.min(plate,packed.plates.length-1));shown=view==='imprint'?result.imprint:view==='assembled'?result.assembled:packed.plates[plate]??[];
 viewer.setParts(shown,{refit});viewer.setPlateSize(plateSize,plateSize);viewer.setMoveEnabled(view!=='assembled');plateTools.hidden=view!=='kit';plateLabel.textContent=`Piatto ${plate+1} / ${packed.plates.length}`;
 const warnings=[...result.warnings,...packed.warnings,...(packed.oversized.length?['Un pezzo supera il piatto.']:[])];
 shell.setStatus(warnings.join(' ')||'Impronta leggibile · Piastra specchiata · Manico intercambiabile',warnings.length?'warn':'ok');
 exports.forEach(b=>b.disabled=!!(packed.oversized.length||packed.warnings.length));refresh();
}
function refresh(){if(exports[3])exports[3].hidden=!selected||!result?.parts.some(p=>p.id===selected);}
const filename=()=>slug('timbro-'+state.text);
function packed(){if(!result)return;const r=arrange(result.parts,plateSize,plateSize,pinned);if(r.oversized.length||r.warnings.length){toast('Sistema i pezzi sul piatto prima di scaricare.');return;}return r;}
const guide='BETTA DESIGN LAB · TIMBRI — PROTOTIPO\n\nLa piastra contiene già l’impronta specchiata: non specchiarla di nuovo nello slicer.\nStampa piastra e manico come pezzi distinti. La piastra è sottile con un rinforzo centrale per il filetto. Nell’orientamento fornito il rinforzo poggia sul piatto: prevedi supporti sotto le zone circostanti della piastra e controllane la rimozione. Il filetto della piastra si apre sul retro: controlla i ponti della sede e i supporti nello slicer; evita supporti difficili da rimuovere nel filetto. Il manico a ponte richiede particolare attenzione sotto la traversa.\nControlla la filettatura con una piccola prova. Tutti i manici usano lo stesso attacco. Non forzare: aumenta il gioco e ristampa la piastra se necessario.\nLa superficie del rilievo deve essere uniforme. Prova su carta con poco inchiostro e pressione omogenea. Materiale e inchiostro vanno collaudati insieme; un timbro FDM non garantisce la stessa resa di uno in gomma.\n';
for(const options of [
 {label:'Scarica kit completo',variant:'primary' as const,onClick:()=>{const r=packed();if(!r||!result)return;const entries:Record<string,Uint8Array>={'LEGGIMI.txt':strToU8(guide),'progetto.json':strToU8(JSON.stringify({version:1,params:state,extra}))};for(const p of result.parts)entries[p.id+'.stl']=toSTL([p]);for(const [i,parts]of r.plates.entries())entries['piatto-'+(i+1)+'.3mf']=to3MF(parts,{title:filename(),plateCenter:[plateSize/2,plateSize/2]});download(zipSync(entries),filename()+'.zip');}},
 {label:'Solo piastra STL',onClick:()=>{if(result)download(toSTL([result.parts[0]]),filename()+'-piastra.stl');}},
 {label:'3MF del piatto',onClick:()=>{const r=packed();if(r)download(to3MF(r.plates[plate]??[],{title:filename(),plateCenter:[plateSize/2,plateSize/2]}),filename()+'.3mf');}},
 {label:'Pezzo selezionato',onClick:()=>{const p=result?.parts.find(p=>p.id===selected);if(p)download(toSTL([p]),p.id+'.stl');}}
]){const b=button(options);b.disabled=true;exports.push(b);shell.exportBar.append(b);}
function send(r:NonNullable<typeof queued>){busy=true;worker.postMessage(r);}
function rebuild(){
 exports.forEach(b=>b.disabled=true);shell.stage.setAttribute('aria-busy','true');shell.setStatus('Il tuo timbro prende forma…','busy');
 try{if(cachedText!==state.text||cachedFont!==state.font){cachedArtwork=stampLettering(state.text,state.font);cachedText=state.text;cachedFont=state.font;}const r={id:revision,params:{...state},design:{text:cachedArtwork,extra}};if(busy)queued=r;else send(r);}
 catch(e){shell.stage.setAttribute('aria-busy','false');shell.setStatus(String(e),'warn');}
}
function receive(r:{id:number;result?:Result;error?:string}){
 if(r.id!==revision)return;if(dragging){held=r;return;}shell.stage.setAttribute('aria-busy','false');
 if(r.error||!r.result){shell.setStatus(r.error??'Anteprima non disponibile.','warn');return;}
 const first=!result;result=r.result;writeHashState(state,DEFAULTS);display(first);if(first)viewer.setView('top');
}
worker.onmessage=e=>{busy=false;receive(e.data);if(queued){const r=queued;queued=undefined;if(r.id===revision)send(r);}};
worker.onerror=()=>{busy=false;queued=undefined;exports.forEach(b=>b.disabled=true);shell.setStatus('Ricarica la pagina per riavviare l’anteprima.','warn');};
try{await document.fonts.load('120px Pacifico');}catch{/* carattere di riserva */}
await receiveSvg(loadSvg);plateTools.hidden=true;paint();rebuild();
