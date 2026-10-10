import {receiveSvg} from '../../shared/svg-transfer.ts';
let mountParts: import('@bdl/geometry').Part[] = [];
import '@bdl/ui-kit/style.css';
import wasmUrl from 'manifold-3d/manifold.wasm?url';
import { assemblyConnections, assemblySeats, hasConnectionArtwork, loadManifold, bounds, type Part } from '@bdl/geometry';
import { createViewer } from '@bdl/viewer';
import { toSTL, to3MF, download, slug } from '@bdl/export';
import { zipSync } from 'fflate';
import {
  connectionPicker, appShell, section, slider, segmented, toggle, colorPicker, button, iconButton,
  el, toast, panelFooter, readHashState, writeHashState, rafThrottle, ICONS,
} from '@bdl/ui-kit';
import { separateParts } from '../../coaster/src/parts.ts';
import type { SvgArtwork } from '../../coaster/src/svg.ts';
import { buildKeycap, buildFitTest } from './geometry.ts';
import { importArtwork, textArtwork } from './artwork.ts';
import { printPart, printAssembly } from './parts.ts';
import { DEFAULTS, sanitize, readKeyLabels, type Params } from './params.ts';
import { createKeyEditor } from './key-editor.ts';
import { parseSTL,stlHeight,buildSTLClicker } from './stl.ts';
import type { MeshData } from '@bdl/geometry';
import { createBlockEditor } from './block-editor.ts';

const TITLE = 'Keycap / Fidget Clicker';
const shell = appShell({ title: TITLE, intro: 'Crea un clicker per switch MX reali: personalizza base, pulsante e disegno.' });
let state = sanitize(readHashState(DEFAULTS));
let artwork: SvgArtwork | undefined, sourceFile: File | undefined;
let parts: Part[] = [], shown: Part[] = [], selected = '', view = 'assembled';
let threshold = 180, generation = 0;
let stlMesh:MeshData|undefined,stlName='',pressed=false;
const colors: Record<string, string> = {};
const controls: Array<() => void> = [];
function track<T extends { set(value: any): void }>(key: keyof Params, control: T): T {
  controls.push(() => control.set(state[key])); return control;
}
const viewer = createViewer(shell.stage, { onSelectPart: (id) => select(id ?? '') });
shell.stageTools.append(
  iconButton({ label: 'Vista 3D', icon: ICONS.iso, onClick: () => viewer.setView('iso') }),
  iconButton({ label: 'Vista dall’alto', icon: ICONS.top, onClick: () => viewer.setView('top') }),
  iconButton({ label: 'Vista frontale', icon: ICONS.front, onClick: () => viewer.setView('front') }),
);
const set = <K extends keyof Params>(key: K, value: Params[K]) => {
  if (key === 'product') state.size = value === 'keycap' ? 18 : 35;
  if (key === 'shape' && value === 'blocks') { state.product = 'clicker'; state.keychain = true; }
  if (key === 'shape' && value === 'stl') state.product='clicker';
  if (key === 'shape' && value === 'keys') { state.product = 'clicker'; state.size = 22; state.keychain = true; }
  state = sanitize({ ...state, [key]: value }); renderControls(); schedule();
};
const hint = el('p', { class: 'bdl-hint' }, 'Nessun disegno caricato.');
const file = el('input', { type: 'file', accept: '.svg,.png,.jpg,.jpeg,.webp', id: 'keycap-artwork' });
const inputText = el('input', { class: 'bdl-input', type: 'text', maxlength: '12', id: 'keycap-text', placeholder: 'Nome o iniziali' });
async function loadFile(next: File) {
  const token = ++generation;
  hint.textContent = 'Elaborazione del disegno…';
  try {
    const result = await importArtwork(next, threshold);
    if (token !== generation) return;
    artwork = result; sourceFile = next;
    Object.keys(colors).forEach((key) => delete colors[key]);
    hint.textContent = result.name; rebuild();
  } catch (error) {
    if (token === generation) hint.textContent = error instanceof Error ? error.message : 'Impossibile caricare il file.';
  } finally { file.value = ''; }
}
file.addEventListener('change', () => { const next = file.files?.[0]; if (next) void loadFile(next); });
const list = el('div', { class: 'bdl-choice-grid', role: 'group', 'aria-label': 'Pezzi del clicker' });
const partColor = colorPicker({ label: 'Colore pezzo selezionato', value: state.artColor, onChange: (color) => {
  if (!selected) { toast('Seleziona prima un pezzo'); return; }
  colors[selected] = color; schedule();
} });
const selectedSTL = button({ label: 'STL selezionato', onClick: () => {
  const part = mountParts.find((item) => item.id === selected);
  if (part) download(toSTL([printPart(part)]), `${slug(part.name)}.stl`, 'model/stl');
} });
selectedSTL.disabled = true;
const blockEditor = createBlockEditor(() => state.blockData, (value) => set('blockData', value));
const keyEditor = createKeyEditor(() => state, (value) => set('keyLabels', value), (value) => set('keyLayout', value));
const sizeControl = track('size', slider({ label: 'Dimensione', value: state.size, min: 18, max: 100, unit: 'mm', hint: 'Con più switch la dimensione minima aumenta per ospitarli.', onInput: (v) => set('size', v) }));

const stlFile=el('input',{type:'file',accept:'.stl',id:'clicker-stl'});
const stlHint=el('p',{class:'bdl-hint'},'Carica uno STL chiuso, in millimetri. Il file resta sul dispositivo.');
stlFile.addEventListener('change',async()=>{const next=stlFile.files?.[0];if(!next)return;try{if(next.size>20_000_000)throw new Error('STL troppo grande: massimo 20 MB.');const mesh=parseSTL(await next.arrayBuffer());stlMesh=mesh;stlName=next.name;state=sanitize({...state,shape:'stl',product:'clicker',stlScale:1,cutHeight:stlHeight(mesh)/2,switchX:0,switchY:0});stlHint.textContent=stlName;renderControls();rebuild();}catch(e){toast(e instanceof Error?e.message:'STL non valido');}finally{stlFile.value='';}});
const stlSection=section('STL personalizzato',el('label',{for:'clicker-stl'},'Carica STL'),stlFile,stlHint,
 track('stlScale',slider({label:'Scala STL',value:state.stlScale,min:.1,max:10,step:.1,onInput:v=>set('stlScale',v)})).root,
 track('cutHeight',slider({label:'Altezza taglio',value:state.cutHeight,min:1,max:300,step:.1,unit:'mm',hint:'La parte inferiore ospita lo switch; quella superiore diventa il pulsante.',onInput:v=>set('cutHeight',v)})).root,
 toggle({label:'Mostra premuto',value:false,hint:'Premuto: la sagoma torna alla forma originale. Rilasciato: il pulsante sale della corsa dello switch.',onChange:v=>{pressed=v;show();}}).root,
 track('mxTravel',slider({label:'Corsa switch',value:state.mxTravel,min:2,max:5,step:.1,unit:'mm',hint:'Riferimento MX blu: 4 mm. Il venditore Fllyvly non pubblica quote complete.',onInput:v=>set('mxTravel',v)})).root,
 track('mxCalibration',slider({label:'Calibrazione altezza switch',value:state.mxCalibration,min:-1,max:1,step:.1,unit:'mm',hint:'Regola dopo una prova se i due bordi non combaciano a fondo corsa.',onInput:v=>set('mxCalibration',v)})).root);
let connectionWarnings:string[]=[];
const connections=connectionPicker({value:()=>state.connection,active:()=>view==='separate'&&state.product!=='clicker',available:()=>hasConnectionArtwork(parts),onChange:v=>set('connection',v)});
shell.panel.append(
  section('Modello',
    track('compact', toggle({ label: 'Profilo compatto con scavo', value: state.compact, hint: 'Pulsante scavato sotto, bordo che copre lo switch e base più bassa. Disattiva per il profilo originale.', onChange: (v) => set('compact', v) })).root,
    track('product', segmented<Params['product']>({ label: 'Prodotto', value: state.product, options: [{ value: 'clicker', label: 'Fidget clicker' }, { value: 'keycap', label: 'Solo keycap' }], onChange: (v) => set('product', v) })).root,
    el('p', { class: 'bdl-hint' }, 'Per switch MX standard con stelo a croce. Il meccanismo è uno switch reale, da acquistare separatamente.'),
    el('div', { class: 'bdl-seg-wrap' }, track('shape', segmented<Params['shape']>({ label: 'Forma', value: state.shape, options: [{ value: 'square', label: 'Quadra' }, { value: 'round', label: 'Tonda' }, { value: 'hex', label: 'Esagono' }, { value: 'artwork', label: 'Sagoma disegno' }, { value: 'blocks', label: 'Forme composte' }, { value: 'keys', label: 'Tasti con testo' }, {value:'stl',label:'STL personalizzato'}], onChange: (v) => set('shape', v) })).root),
    sizeControl.root,
    track('topThickness', slider({ label: 'Spessore pulsante', value: state.topThickness, min: 1.2, max: 4, step: 0.2, unit: 'mm', onInput: (v) => set('topThickness', v) })).root,
    track('keychain', toggle({ label: 'Occhiello portachiavi', value: state.keychain, onChange: (v) => set('keychain', v) })).root,
    track('loopAngle', slider({ label: 'Posizione occhiello', value: state.loopAngle, min: -180, max: 180, unit: '°', onInput: (v) => set('loopAngle', v) })).root,
    track('loopHole', slider({ label: 'Diametro foro occhiello', value: state.loopHole, min: 3, max: 8, step: 0.5, unit: 'mm', onInput: (v) => set('loopHole', v) })).root,
  ),
  stlSection, blockEditor.root, keyEditor.root,
  section('Disegno', el('div', { id: 'keycap-general-art' }, el('label', { for: 'keycap-artwork', class: 'bdl-hint' }, 'Carica SVG o immagine'), file, hint,
    el('p', { class: 'bdl-hint' }, 'SVG: contorni e fori. PNG/JPG/WebP: tracciamento a un colore, sfondo bianco o trasparente. Nessun file viene inviato online.'),
    slider({ label: 'Soglia immagine', value: threshold, min: 10, max: 255, onInput: (v) => { threshold = v; if (sourceFile && !/\.svg$/i.test(sourceFile.name)) void loadFile(sourceFile); } }).root,
    el('label', { for: 'keycap-text', class: 'bdl-hint' }, 'Oppure scrivi un testo'), inputText,
    button({ label: 'Usa testo', onClick: () => {
      try { const next = textArtwork(inputText.value.trim()); ++generation; artwork = next; sourceFile = undefined; hint.textContent = next.name; rebuild(); }
      catch (error) { toast(error instanceof Error ? error.message : 'Testo non valido'); }
    } }),
    button({ label: 'Rimuovi disegno', onClick: () => { ++generation; artwork = undefined; sourceFile = undefined; hint.textContent = 'Nessun disegno caricato.'; if (state.shape === 'artwork') state.shape = 'square'; renderControls(); rebuild(); } }),
    ),
    track('designScale', slider({ label: 'Dimensione disegno', value: state.designScale, min: 10, max: 100, unit: '%', onInput: (v) => set('designScale', v) })).root,
    track('mode', segmented<Params['mode']>({ label: 'Tecnica', value: state.mode, options: [{ value: 'inlay', label: 'Intarsio' }, { value: 'relief', label: 'Rilievo' }, { value: 'engrave', label: 'Incisione' }], onChange: (v) => set('mode', v) })).root,
    track('decorationDepth', slider({ label: 'Profondità / rilievo', value: state.decorationDepth, min: 0.2, max: 2, step: 0.2, unit: 'mm', onInput: (v) => set('decorationDepth', v) })).root,
  ),
  section('Switch e incastri',
    track('switchX', slider({ label: 'Posizione X switch', value: state.switchX, min: -60, max: 60, unit: 'mm', onInput: (v) => set('switchX', v) })).root,
    track('switchY', slider({ label: 'Posizione Y switch', value: state.switchY, min: -60, max: 60, unit: 'mm', hint: 'Con più switch si sposta l’intera fila.', onInput: (v) => set('switchY', v) })).root,
    track('switches', slider({ label: 'Numero switch', value: state.switches, min: 1, max: 3, hint: 'Solo keycap usa sempre un attacco; il clicker può averne fino a tre.', onInput: (v) => set('switches', v) })).root,
    track('spacing', slider({ label: 'Distanza switch', value: state.spacing, min: 19, max: 30, unit: 'mm', onInput: (v) => set('spacing', v) })).root,
    track('stemFit', slider({ label: 'Gioco attacco a croce', value: state.stemFit, min: -0.1, max: 0.35, step: 0.05, unit: 'mm', hint: 'Aumenta se il pulsante è troppo stretto. Prova prima i campioni.', onInput: (v) => set('stemFit', v) })).root,
    track('socketFit', slider({ label: 'Gioco sede switch', value: state.socketFit, min: 0, max: 0.5, step: 0.05, unit: 'mm', onInput: (v) => set('socketFit', v) })).root,
    track('gap', slider({ label: 'Gioco pulsante / base', value: state.gap, min: 0.15, max: 0.8, step: 0.05, unit: 'mm', onInput: (v) => set('gap', v) })).root,
    track('rim', slider({ label: 'Altezza bordo', value: state.rim, min: 0, max: 3, step: 0.2, unit: 'mm', onInput: (v) => set('rim', v) })).root,
    button({ label: 'Scarica prova attacco MX', onClick: () => {
      download(to3MF(buildFitTest(M, 0, state.capColor), { title: 'Prova MX: -0.10, 0.00, +0.10, +0.20, +0.30 mm, da sinistra' }), 'prova-attacco-mx.3mf', 'model/3mf');
      toast('5 campioni: da sinistra −0,10 / 0 / +0,10 / +0,20 / +0,30 mm');
    } }),
    el('p', { class: 'bdl-hint' }, 'Prototipo: verifica incastro e corsa sul tuo switch. Stampa il pulsante con faccia decorata sul piatto e il socket verso l’alto; il 3MF di stampa applica questa orientazione.'),
  ),
  section('Pezzi',
    segmented({ label: 'Vista', value: view, options: [{ value: 'assembled', label: 'Assemblata' }, { value: 'separate', label: 'Separata' }], onChange: (v) => { view = v; show(); } }).root,
    connections.root, list, selectedSTL, partColor.root,
  ),
  section('Colori',
    track('baseColor', colorPicker({ label: 'Base', value: state.baseColor, onChange: (v) => set('baseColor', v) })).root,
    track('capColor', colorPicker({ label: 'Pulsante', value: state.capColor, onChange: (v) => set('capColor', v) })).root,
    track('artColor', colorPicker({ label: 'Disegno', value: state.artColor, onChange: (v) => set('artColor', v) })).root,
  ),
  section('Progetto',
    button({ label: 'Salva progetto', onClick: () => download(new TextEncoder().encode(JSON.stringify({ version: 1, params: state, artwork, colors, stl:stlMesh?{name:stlName,positions:Array.from(stlMesh.positions),indices:Array.from(stlMesh.indices)}:undefined })), 'clicker-progetto.json', 'application/json') }),
    (() => {
      const projectInput = el('input', { type: 'file', accept: '.json', id: 'keycap-project' });
      projectInput.addEventListener('change', async () => {
        const next = projectInput.files?.[0]; if (!next) return;
        try {
          if (next.size > 30_000_000) throw new Error('Progetto troppo grande.');
          const data = JSON.parse(await next.text());
          if (data.version !== 1 || !data.params) throw new Error('Progetto non valido.');
          const art = data.artwork;
          if (art) validateArtwork(art);
          let imported:MeshData|undefined;if(data.stl){const v=data.stl;if(!Array.isArray(v.positions)||!Array.isArray(v.indices)||v.positions.length>1350000||v.positions.length%3||v.indices.length%3||v.positions.some((n:unknown)=>typeof n!=='number'||!Number.isFinite(n)||Math.abs(n)>100000)||v.indices.some((n:unknown)=>typeof n!=='number'||!Number.isInteger(n)||n<0||n>=v.positions.length/3))throw new Error('STL nel progetto non valido.');imported={positions:new Float32Array(v.positions),indices:new Uint32Array(v.indices)};}stlMesh=imported;stlName=imported?String(data.stl.name).slice(0,200):'';state = sanitize(data.params); artwork = art; sourceFile = undefined; ++generation;
          Object.keys(colors).forEach((key) => delete colors[key]);
          if (data.colors && typeof data.colors === 'object') for (const [key, color] of Object.entries(data.colors)) if (/^(base|cap(?:-\d+)?|art-\d+(?:-\d+)?)$/.test(key) && /^#[a-f\d]{6}$/i.test(String(color))) colors[key] = String(color);
          hint.textContent = artwork?.name ?? 'Nessun disegno caricato.';
          renderControls(); rebuild();
        } catch (error) { toast(error instanceof Error ? error.message : 'Progetto non valido'); }
        projectInput.value = '';
      });
      return el('div', { class: 'bdl-row' }, el('label', { for: 'keycap-project' }, 'Riapri progetto JSON'), projectInput);
    })(),
    el('p', { class: 'bdl-hint' }, 'Il progetto JSON conserva il disegno e lo STL. Dopo un refresh o in un link il file va ricaricato.'),
  ), panelFooter(),
);

function validateArtwork(art: SvgArtwork) {
  let count = 0;
  if (!art || typeof art.name !== 'string' || art.name.length > 200 || !Array.isArray(art.shapes) || !art.shapes.length) throw new Error('Disegno nel progetto non valido.');
  for (const shapes of [art.shapes, art.filledShapes ?? []]) {
    if (!Array.isArray(shapes)) throw new Error('Contorni non validi.');
    for (const shape of shapes) {
      if (!Array.isArray(shape) || !shape.length) throw new Error('Contorni non validi.');
      for (const ring of shape) {
        if (!Array.isArray(ring) || ring.length < 3) throw new Error('Contorni non validi.');
        for (const point of ring) {
          if (++count > 50000 || !Array.isArray(point) || point.length !== 2 || point.some((n) => typeof n !== 'number' || !Number.isFinite(n) || Math.abs(n) > 2)) throw new Error('Coordinate del progetto non valide.');
        }
      }
    }
  }
}
// Sincronizza i controlli dopo il caricamento di un progetto senza ricreare il viewer.
function renderControls() {
  for (const control of controls) control();
  stlSection.hidden=state.shape!=='stl';connections.refresh();
  for(const sec of shell.panel.querySelectorAll<HTMLElement>('.bdl-section')){const title=sec.querySelector('h2')?.textContent;if(title==='Disegno')sec.hidden=state.shape==='stl';}
  stlHint.textContent=stlName||'Carica uno STL chiuso, in millimetri. Il file resta sul dispositivo.';
  blockEditor.root.hidden = state.shape !== 'blocks';
  sizeControl.root.hidden = state.shape === 'blocks'||state.shape==='stl';
  const generalArt = document.getElementById('keycap-general-art'); if (generalArt) generalArt.hidden = state.shape === 'keys';
  blockEditor.sync(); keyEditor.root.hidden = state.shape !== 'keys'; keyEditor.sync();
  for (const root of shell.panel.querySelectorAll<HTMLElement>('.bdl-row')) {
    const label = root.textContent ?? '';
    if (/^(Posizione [XY] switch|Numero switch|Distanza switch)/.test(label)) root.hidden = state.shape === 'keys'||(state.shape==='stl'&&/^(Numero switch|Distanza switch)/.test(label));
    if(/^(Profilo compatto|Prodotto|Spessore pulsante|Occhiello portachiavi|Posizione occhiello|Diametro foro occhiello|Altezza bordo)/.test(label))root.hidden=state.shape==='stl';
  }
}
function select(id: string) {
  selected = parts.some((part) => part.id === id) ? id : '';
  const key = /^(?:cap|art-\d+)-(\d+)$/.exec(selected);
  if (state.shape === 'keys' && key) keyEditor.select(Number(key[1]) - 1);
  viewer.selectPart(selected || null); selectedSTL.disabled = !selected;
  const part = parts.find((item) => item.id === selected); if (part) partColor.set(part.color);
  for (const node of list.querySelectorAll('button')) node.setAttribute('aria-pressed', String(node.dataset.part === selected));
}
function show() {
  connections.refresh();if(view==='separate'&&connectionWarnings.length)shell.setStatus(connectionWarnings.join(' '),'warn');
  shown = view === 'assembled' ? parts.map(p=>{if(state.shape!=='stl'||!pressed||p.id==='base')return p;const positions=new Float32Array(p.mesh.positions);for(let i=2;i<positions.length;i+=3)positions[i]-=state.mxTravel;return {...p,mesh:{...p.mesh,positions}};}) : separateParts(mountParts.map(printPart));
  viewer.setParts(shown); select(selected);
}
shell.panel.inert = true;
const M = await loadManifold(wasmUrl);
shell.panel.inert = false;
const textCache = new Map<string, SvgArtwork>();
function rebuild() {
  try {
    state = sanitize(state);
    const labels = state.shape === 'keys' ? readKeyLabels(state.keyLabels) : [];
    const lettering = labels.map((label) => {
      if (!label.trim()) return undefined;
      let art = textCache.get(label);
      if (!art) { art = textArtwork(label); if (textCache.size > 100) textCache.clear(); textCache.set(label, art); }
      return art;
    });
    const result = state.shape==='stl'?(stlMesh?buildSTLClicker(M,state,stlMesh):(()=>{throw new Error('Carica uno STL per scegliere il taglio.');})()):buildKeycap(M, state, artwork, lettering);
    if (state.mode === 'relief' && (artwork || lettering.some(Boolean))) result.warnings.push('Rilievo: valuta i supporti nel programma di stampa. Per stampare a faccia in giù senza dislivelli scegli intarsio.');
    parts = result.parts.map((part) => ({ ...part, color: colors[part.id] ?? part.color })); const connected=state.product==='clicker'?{parts:assemblySeats(M,parts),warnings:[]}:assemblyConnections(M,parts,state.connection);mountParts=connected.parts;connectionWarnings=connected.warnings;
    list.replaceChildren(...parts.map((part) => {
      const b = button({ label: part.name, size: 'sm', onClick: () => select(part.id) }); b.dataset.part = part.id; return b;
    }));
    show(); writeHashState(state, DEFAULTS); exports.forEach((b) => b.disabled = false);
    const b = bounds(parts);if(view==='separate')result.warnings.push(...connectionWarnings);
    shell.setStatus(result.warnings[0] ?? `${(b.max[0] - b.min[0]).toFixed(1)} × ${(b.max[1] - b.min[1]).toFixed(1)} mm · ${parts.length} pezzi`, result.warnings.length ? 'warn' : 'ok');
  } catch (error) {
    parts = []; viewer.setParts([]); list.replaceChildren(); select(''); exports.forEach((b) => b.disabled = true);
    shell.setStatus(error instanceof Error ? error.message : 'Geometria non valida.', 'warn');
  }
}
const exports = [
  button({ label: 'STL separati (ZIP)', onClick: () => {
    const files: Record<string, Uint8Array> = {}; for (const part of mountParts) files[`${slug(part.name)}.stl`] = toSTL([printPart(part)]);
    download(zipSync(files), 'clicker-stl.zip', 'application/zip');
  } }),
  button({ label: '3MF di stampa', variant: 'primary', onClick: () => download(to3MF(view==='separate'?separateParts(mountParts.map(printPart)):printAssembly(mountParts, state.size), { title: TITLE }), 'clicker.3mf', 'model/3mf') }),
];
shell.exportBar.append(...exports);
const schedule = rafThrottle(rebuild);
await receiveSvg(async incoming=>{artwork=await importArtwork(incoming,threshold);sourceFile=undefined;hint.textContent=incoming.name;state=sanitize({...state,shape:'square'});});
renderControls();
rebuild();
