import {importArtwork} from '../../keycap/src/artwork.ts';
import {receiveSvg} from '../../shared/svg-transfer.ts';
let mountParts: import('@bdl/geometry').Part[] = [];
import '@bdl/ui-kit/style.css';
import wasmUrl from 'manifold-3d/manifold.wasm?url';
import { assemblyConnections, hasConnectionArtwork, loadManifold, type Part } from '@bdl/geometry';
import { createViewer } from '@bdl/viewer';
import { toSTL, to3MF, download } from '@bdl/export';
import { zipSync } from 'fflate';
import { connectionPicker, appShell, section, slider, segmented, toggle, colorPicker, button, iconButton, el, toast, panelFooter, readHashState, writeHashState, rafThrottle, ICONS } from '@bdl/ui-kit';
import { decorationEditor } from './editor.ts';
import { validateDecorations, type Decoration } from './decoration.ts';
import { buildBox } from './geometry.ts';
import { printable, openParts } from './parts.ts';
import { arrange, currentPlacement, validatePlacements, type Placements, type Placement } from './placement.ts';
import { DEFAULTS, sanitize, type Params } from './params.ts';

const shell = appShell({ title: 'Scatole e organizer', intro: 'Scorrevole, impilabile o con cassetto. Griglia Gridfinity opzionale, senza ferramenta.' });
let state = sanitize(readHashState(DEFAULTS)), parts: Part[] = [], selected = '', view = 'open';
let decorations: Decoration[] = [], plate = 0;
let pinned: Placements = {}, moving = true;
let layout: ReturnType<typeof arrange> = {plates: [], oversized: [], warnings: []};
let geometryWarnings: string[] = [];
const controls: (() => void)[] = [];
const editor = decorationEditor(() => decorations, items => { decorations = validateDecorations(items); schedule(); }, () => state);
const plateSelect = el('select', {class: 'bdl-select', 'aria-label': 'Piatto visualizzato'});
plateSelect.addEventListener('change', () => { plate = Number(plateSelect.value); show(); });
const viewer = createViewer(shell.stage, { onSelectPart: (id) => select(id ?? ''), onMovePart: (id,dx,dy) => { const p=placement(id); if(p) { pinned[id]={...p,x:Math.round((p.x+dx)*10)/10,y:Math.round((p.y+dy)*10)/10}; refreshLayout(false); } } });
for (const [label, icon, direction] of [['Vista 3D', ICONS.iso, 'iso'], ['Vista dall’alto', ICONS.top, 'top'], ['Vista frontale', ICONS.front, 'front']] as const) shell.stageTools.append(iconButton({ label, icon, onClick: () => viewer.setView(direction) }));
function set<K extends keyof Params>(key: K, value: Params[K]) { state = sanitize({ ...state, [key]: value }); controls.forEach((c) => c()); editor.sync(); schedule(); }
function range(key: keyof Params, label: string, min: number, max: number, step = 1, unit = 'mm') {
  const c = slider({ label, min, max, step, unit, value: Number(state[key]), onInput: (v) => set(key, v) }); controls.push(() => c.set(Number(state[key]))); return c.root;
}
const pieceList = el('div', { class: 'bdl-row', role: 'group', 'aria-label': 'Pezzi della scatola' });
const singleSTL = button({ label: 'STL del pezzo selezionato', onClick: () => { const part = mountParts.find((p) => p.id === selected); if (part) download(toSTL([printable(part)]), `scatola-${part.id}.stl`, 'model/stl'); } });
singleSTL.disabled = true;
function placement(id = selected): Placement | undefined {
  if(pinned[id]) return pinned[id];
  const index=layout.plates.findIndex(items=>items.some(p=>p.id===id)), part=layout.plates[index]?.find(p=>p.id===id);
  const source=mountParts.find(p=>p.id===id);
  return part && source ? currentPlacement(part,source,index) : undefined;
}
function move(patch: Partial<Placement>) { const p=placement();if(p && selected){pinned[selected]={...p,...patch}; refreshLayout(false);} }
const moveControls: (()=>void)[]=[];
const manualFields=el('div',{class:'bdl-control-stack'});
for(const [key,label,min,max,step,unit] of [['x','Posizione X dal centro del piatto',-175,175,0.5,'mm'],['y','Posizione Y dal centro del piatto',-175,175,0.5,'mm'],['angle','Rotazione sul piatto',-180,180,1,'°'],['plate','Numero del piatto',1,20,1,'']] as const) {
  const c=slider({label,min,max,step,unit,value:key==='plate'?1:0,onInput:v=>move({[key]:key==='plate'?v-1:v})});
  manualFields.append(c.root);moveControls.push(()=>{const p=placement();c.set(p ? key==='plate'?p.plate+1:p[key] : key==='plate'?1:0);});
}
const dragToggle=toggle({label:'Trascina i pezzi sul piatto',value:moving,onChange:v=>{moving=v;viewer.setMoveEnabled(view==='print'&&moving);}});
const connections=connectionPicker({value:()=>state.connection,active:()=>view==='print',available:()=>hasConnectionArtwork(parts),onChange:v=>set('connection',v)});
const manualSection=section('Posiziona i pezzi',dragToggle.root,el('p',{class:'bdl-hint'},'Nella vista Stampa trascina un pezzo con il mouse oppure selezionalo e regola posizione, rotazione e piatto. Puoi continuare a cambiare misure e decorazioni: le posizioni manuali restano. Trascina una zona vuota per ruotare la vista.'),manualFields,
  button({label:'Ripristina questo pezzo in automatico',onClick:()=>{delete pinned[selected];refreshLayout(false);}}),
  button({label:'Disponi tutti automaticamente',onClick:()=>{pinned={};refreshLayout(true);}}));
function syncMoveControls() {manualSection.hidden=view!=='print';manualFields.hidden=!selected || !placement();moveControls.forEach(f=>f());}
const ribs = toggle({ label: 'Nervature · pareti / frontale cassetto', value: state.ribbed, onChange: (v) => set('ribbed', v) }); controls.push(() => ribs.set(state.ribbed));
const dividers = toggle({label: 'Attiva scomparti', value: state.dividers, onChange: v => set('dividers', v)});
controls.push(() => dividers.set(state.dividers));
const bodyColor = colorPicker({ label: 'Corpo', value: state.bodyColor, onChange: (v) => set('bodyColor', v) }); controls.push(() => bodyColor.set(state.bodyColor));
const lidColor = colorPicker({ label: 'Coperchio / involucro', value: state.lidColor, onChange: (v) => set('lidColor', v) }); controls.push(() => lidColor.set(state.lidColor));
const gridToggle=toggle({label:'Usa Gridfinity',value:state.gridfinity,onChange:v=>set('gridfinity',v)});
controls.push(()=>gridToggle.set(state.gridfinity));
const models=segmented({label:'Tipo di scatola',value:state.model,options:[{value:'sliding',label:'Coperchio scorrevole'},{value:'stackable',label:'Aperta impilabile'},{value:'drawer',label:'Cassetto'}],onChange:v=>set('model',v as Params['model'])});
models.root.classList.add('bdl-seg-wrap');controls.push(()=>models.set(state.model));
const stackLid=toggle({label:'Aggiungi coperchio impilabile',value:state.stackLid,onChange:v=>set('stackLid',v)});controls.push(()=>stackLid.set(state.stackLid));
const gridOutput=segmented({label:'Cosa generare',value:state.gridOutput,options:[{value:'grid',label:'Solo griglia'},{value:'box',label:'Solo scatola'},{value:'both',label:'Entrambe'}],onChange:v=>set('gridOutput',v as Params['gridOutput'])});controls.push(()=>gridOutput.set(state.gridOutput));
const corners=segmented({label:'Angoli della scatola',value:state.radius===0?'square':'round',options:[{value:'square',label:'Squadrati'},{value:'round',label:'Arrotondati'}],onChange:v=>set('radius',v==='square'?0:6)});controls.push(()=>corners.set(state.radius===0?'square':'round'));
const gridDimensions=el('p',{class:'bdl-hint'});
const gridFields=el('div',{class:'bdl-control-stack'},range('gridColumns','Colonne Gridfinity',1,16,1,''),range('gridRows','Righe Gridfinity',1,16,1,''),gridDimensions,gridOutput.root,range('connectorClearance','Gioco code di rondine',0.1,0.4,0.05),el('p',{class:'bdl-hint'},'Griglia aperta alta 5 mm, senza fondo pieno. Celle da 42 mm. La scatola occupa la griglia scelta, con 0,5 mm di gioco complessivo. Griglie grandi vengono divise in sezioni numerate con code di rondine integrate: si assemblano verticalmente, senza viti, perni o magneti. I piedi Gridfinity mantengono gli angoli standard anche quando il corpo è squadrato.'));
const customSize=el('div',{},range('width','Larghezza',40,220),range('depth','Profondità',35,180));
const radiusControl=range('radius','Raggio angoli',0,20,0.25);
const boxFields=section('Modello',models.root,stackLid.root,ribs.root);
const measureFields=section('Misure esterne del corpo',customSize,range('height','Altezza del corpo',18,130),corners.root,radiusControl,el('p',{class:'bdl-hint'},'Piedi, coperchio e nervature possono aumentare l’ingombro. Le scatole che superano il piatto non vengono tagliate: riduci le celle o usa un piatto più grande.'));
controls.push(()=>{gridDimensions.textContent=`Griglia ${state.gridColumns*42} × ${state.gridRows*42} mm · corpo scatola ${state.width} × ${state.depth} mm`;gridFields.hidden=!state.gridfinity;customSize.hidden=state.gridfinity;stackLid.root.hidden=state.model!=='stackable';radiusControl.hidden=state.radius===0;ribs.root.hidden=state.gridfinity;const gridOnly=state.gridfinity&&state.gridOutput==='grid';boxFields.hidden=gridOnly;measureFields.hidden=gridOnly;editor.root.hidden=gridOnly;});
const fitSection=section('Spessori e incastro',range('wall','Spessore pareti',2,4,0.2),range('floor','Spessore fondo',1.6,4,0.2),range('clearance','Gioco degli incastri per lato',0.15,0.5,0.05),el('p',{class:'bdl-hint'},'Prima prova una scatola piccola. Aumenta il gioco se cassetto o coperchio scorrono troppo stretti.'));
const dividerSection=section('Divisori interni',dividers.root,range('columns','Colonne',1,6,1,''),range('rows','Righe',1,6,1,''),el('p',{class:'bdl-hint'},'1 × 1 lascia un unico vano. I divisori fanno parte del corpo o del cassetto.'));
controls.push(()=>{const gridOnly=state.gridfinity&&state.gridOutput==='grid';fitSection.hidden=gridOnly;dividerSection.hidden=gridOnly;});
shell.panel.append(
  section('Gridfinity',gridToggle.root,gridFields),boxFields,measureFields,
  fitSection,dividerSection,
  editor.root,
  section('Piatti di stampa', range('plateWidth', 'Larghezza piatto', 100, 350), range('plateDepth', 'Profondità piatto', 100, 350), plateSelect, el('p', {class:'bdl-hint'}, 'Disposizione automatica: distanza e margine di 5 mm, con passaggio ai piatti successivi. Le posizioni manuali restano dove le scegli; controlla gli avvisi dopo aver modificato le misure.')),
  section('Anteprima e pezzi', segmented({ label: 'Vista', value: view, options: [{ value: 'closed', label: 'Chiusa' }, { value: 'open', label: 'Aperta' }, { value: 'print', label: 'Stampa' }], onChange: (v) => { view = v; show(); } }).root, pieceList, singleSTL),
  connections.root, manualSection,
  section('Colori', bodyColor.root, lidColor.root),
  section('Stampa', el('p', { class: 'bdl-hint' }, 'Corpo col fondo sul piatto, coperchio separato e involucro del cassetto appoggiato sul retro (apertura in alto). Le guide hanno un piccolo sbalzo di 0,8 mm: controlla l’anteprima del programma di stampa. Il 3MF dispone i pezzi sul piano. Se servono più piatti, scarichi uno ZIP con un file 3MF numerato per ciascun piatto.'), button({label:'Salva progetto completo', onClick:()=>download(new TextEncoder().encode(JSON.stringify({version:1,params:state,decorations,placements:pinned})), 'scatola-progetto.json', 'application/json')}), button({ label: 'Copia link delle misure', onClick: async () => { try { await navigator.clipboard.writeText(location.href); toast('Link copiato: per conservare le decorazioni usa Salva progetto completo'); } catch { toast('Copia l’indirizzo dalla barra del browser'); } } })), panelFooter(),
);
const loadProject = el('input', {class:'bdl-input',type:'file',accept:'.json','aria-label':'Apri progetto completo'});
loadProject.addEventListener('change', async()=>{const file=loadProject.files?.[0];if(!file)return;try{if(file.size>10000000)throw new Error('Progetto troppo grande');const data=JSON.parse(await file.text());if(data.version!==1)throw new Error('Progetto non compatibile');const next=validateDecorations(data.decorations), positions=validatePlacements(data.placements);state=sanitize(data.params);decorations=next;pinned=positions;controls.forEach(c=>c());editor.sync();schedule();}catch(e){toast(e instanceof Error?e.message:String(e));}loadProject.value='';});
shell.panel.append(section('Apri progetto salvato',loadProject));
const exports = [
  button({ label: 'STL separati (ZIP)', onClick: () => { const files: Record<string, Uint8Array> = {}; for (const p of mountParts) files[`scatola-${p.id}.stl`] = toSTL([printable(p)]); download(zipSync(files), 'scatola-stl.zip', 'application/zip'); } }),
  button({ label: '3MF · tutti i piatti', variant: 'primary', onClick: () => {
    if (layout.oversized.length || layout.warnings.length) {toast('Controlla i pezzi fuori dal piatto o gli ingombri sovrapposti prima di esportare.');return;}
    const files: Record<string, Uint8Array> = {};
    layout.plates.forEach((items,i)=>{if(items.length)files[`piatto-${i+1}.3mf`]=to3MF(items,{title:`Scatola · piatto ${i+1}`,plateCenter:[state.plateWidth/2,state.plateDepth/2]});});
    if(layout.plates.length===1) download(files['piatto-1.3mf'],'scatola-piatto-1.3mf','model/3mf');
    else download(zipSync(files),'scatola-piatti-3mf.zip','application/zip');
  } }),
];
shell.exportBar.append(...exports);
function select(id: string, reveal = true) { if(reveal){const match=/^art-(?:lid|front|back|left|right)-(\d+)-/.exec(id);if(match)editor.select(Number(match[1])-1);} selected = parts.some((p) => p.id === id) ? id : ''; if (reveal && view==='print' && selected) { const index=layout.plates.findIndex(items=>items.some(p=>p.id===selected)); if(index>=0 && index!==plate) {plate=index;plateSelect.value=String(plate);viewer.setParts(layout.plates[plate], {refit:true});} } viewer.selectPart(selected || null); singleSTL.disabled = !selected; for (const b of pieceList.querySelectorAll('button')) b.setAttribute('aria-pressed', String(b.dataset.part === selected)); syncMoveControls(); }
function show(refit = true) { connections.refresh(); viewer.setMoveEnabled(view==='print' && moving); viewer.setPlateSize(state.plateWidth, state.plateDepth); plateSelect.hidden = view !== 'print'; viewer.setParts(view === 'print' ? layout.plates[plate] ?? [] : view === 'open' ? openParts(parts, state.width, state.model) : parts, {refit}); select(selected, false); }
shell.panel.inert = true;
const M = await loadManifold(wasmUrl); shell.panel.inert = false;
function refreshLayout(refit = false) {
  layout=arrange(mountParts,state.plateWidth,state.plateDepth,pinned);
  plate=Math.min(plate,Math.max(0,layout.plates.length-1));
  if(selected && pinned[selected] && parts.some(p=>p.id===selected))plate=pinned[selected].plate;
  plateSelect.replaceChildren(...layout.plates.map((_,i)=>el('option',{value:String(i)},`Piatto ${i+1} di ${layout.plates.length}`)));plateSelect.value=String(plate);
  show(refit);
  const warnings=[...geometryWarnings,...layout.warnings,...layout.oversized.map(name=>`${name}: supera il piatto scelto`)];
  if(warnings.length)shell.setStatus(warnings.join(' · '),'warn');
  else shell.setStatus(`${parts.length} pezzi · ${layout.plates.length} ${layout.plates.length===1?'piatto':'piatti'} · ${Object.keys(pinned).filter(id=>parts.some(p=>p.id===id)).length} ${Object.keys(pinned).filter(id=>parts.some(p=>p.id===id)).length===1?'posizione manuale':'posizioni manuali'}`, 'ok');
  exports[1].disabled=!!(layout.oversized.length || layout.warnings.length);
}
function rebuild() {
  try {
    const result=buildBox(M,state,decorations);parts=result.parts;const connected=assemblyConnections(M,parts,state.connection);mountParts=connected.parts;geometryWarnings=[...result.warnings,...connected.warnings];
    pieceList.replaceChildren(...parts.map(p=>{const b=button({label:p.name,size:'sm',onClick:()=>select(p.id)});b.dataset.part=p.id;return b;}));
    exports.forEach(b=>b.disabled=false); refreshLayout(true);writeHashState(state,DEFAULTS);
  }catch(error){parts=[];viewer.setParts([]);pieceList.replaceChildren();select('');exports.forEach(b=>b.disabled=true);shell.setStatus(error instanceof Error?error.message:'Geometria non valida','warn');}
}
const schedule = rafThrottle(rebuild);
await receiveSvg(async file=>{const artwork=await importArtwork(file,180);decorations=validateDecorations([{id:1,face:state.model==='stackable'&&!state.stackLid?'front':'lid',mode:'inlay',size:20,u:0,v:0,angle:0,depth:.6,color:'#d4a429',artwork}]);editor.sync();});
controls.forEach(c=>c()); rebuild();
