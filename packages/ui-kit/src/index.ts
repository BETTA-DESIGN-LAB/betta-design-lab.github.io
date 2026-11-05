import { PRINTERS, getPrinterChoice, savePrinterChoice, validatePrinterChoice, onPrinterChange } from '@bdl/brand';
// Componenti UI condivisi. Ogni controllo di ogni generatore viene da qui, così il sito
// resta un prodotto unico e non dieci app che si somigliano.

import { BRAND, FILAMENTS } from '@bdl/brand';

type Child = Node | string | null | undefined | false;

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, unknown> = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') node.className = String(v);
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v as EventListener);
    else if (k === 'html') node.innerHTML = String(v);
    else node.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of children) if (c) node.append(c);
  return node;
}

const svg = (paths: string, vb = '0 0 24 24') =>
  `<svg viewBox="${vb}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;

export const ICONS = {
  sun: svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
  moon: svg('<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>'),
  download: svg('<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>'),
  link: svg('<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>'),
  reset: svg('<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>'),
  iso: svg('<circle cx="12" cy="12" r="4"/><ellipse cx="12" cy="12" rx="10" ry="5" transform="rotate(-35 12 12)"/>'),
  top: svg('<rect x="4" y="4" width="16" height="16" rx="2"/><circle cx="12" cy="12" r="1.5"/>'),
  front: svg('<rect x="3" y="9" width="18" height="8" rx="1.5"/><path d="M3 20h18"/>'),
  fit: svg('<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>'),
} as const;

// ---------- Tema ----------

const THEME_KEY = 'bdl-theme';
export function initTheme(): void {
  let saved: string | null = null;
  try { saved = localStorage.getItem(THEME_KEY); } catch { /* modalità privata */ }
  if (saved === 'light' || saved === 'dark') document.documentElement.dataset.theme = saved;
}
function currentTheme(): 'light' | 'dark' {
  const t = document.documentElement.dataset.theme;
  if (t === 'light' || t === 'dark') return t;
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
export function themeToggle(): HTMLButtonElement {
  const b = el('button', { class: 'bdl-btn bdl-icon-btn', 'data-variant': 'ghost', type: 'button' });
  const paint = () => {
    const dark = currentTheme() === 'dark';
    b.innerHTML = dark ? ICONS.sun : ICONS.moon;
    b.setAttribute('aria-label', dark ? 'Tema chiaro' : 'Tema scuro');
    b.title = b.getAttribute('aria-label')!;
  };
  b.addEventListener('click', () => {
    const next = currentTheme() === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem(THEME_KEY, next); } catch { /* ignora */ }
    paint();
  });
  paint();
  return b;
}

// ---------- Cornice ----------

/** Logo ufficiale originale; il simbolo usa una finestra CSS, senza alterare il file. */
export function brandLogo(href = './'): HTMLAnchorElement {
  return el('a', { class: 'bdl-logo', href, 'aria-label': BRAND.name + ' · Home' },
    el('span', { class: 'bdl-logo-symbol', 'aria-hidden': 'true' },
      el('img', { src: `${href}${BRAND.logo}`, alt: '', width: 1774, height: 887 })),
    el('span', { class: 'bdl-wordmark' }, 'BETTA', el('span', {}, 'DESIGN LAB'), el('small', {}, '3D')));
}

export function topbar(title?: string): HTMLElement {
  return el(
    'header',
    { class: 'bdl-topbar' },
    brandLogo(BRAND.urls.hub.startsWith('./') ? '../' : BRAND.urls.hub),
    title ? el('span', { class: 'bdl-topbar-title' }, title) : null,
    el('span', { class: 'bdl-spacer' }),
    printerButton(),
    themeToggle(),
  );
}

export interface AppShell {
  panel: HTMLElement;
  stage: HTMLElement;
  stageTools: HTMLElement;
  exportBar: HTMLElement;
  setStatus(text: string, kind?: 'ok' | 'busy' | 'warn'): void;
}

/** Layout standard di un generatore: pannello controlli a sinistra, anteprima a destra. */
export function appShell(opts: { title: string; intro: string }): AppShell {
  initTheme();
  const panel = el('aside', { class: 'bdl-panel', 'aria-label': 'Impostazioni' },
    el('div', { class: 'bdl-intro' }, el('h1', {}, opts.title), el('p', {}, opts.intro)));
  const stageTools = el('div', { class: 'bdl-stage-tools' });
  const status = el('div', { class: 'bdl-status', role: 'status', 'aria-live': 'polite' }, 'Caricamento…');
  const exportBar = el('div', { class: 'bdl-export' });
  const stage = el('section', { class: 'bdl-stage', 'aria-label': 'Anteprima 3D' },
    stageTools, el('div', { class: 'bdl-stage-bottom' }, status, el('span', { class: 'bdl-spacer' }), exportBar));
  const help = usageHelp();
  panel.append(help);
  new MutationObserver(() => { if (panel.lastElementChild !== help) panel.append(help); }).observe(panel, { childList: true });
  installStartupRecovery();
  const app = el('div', { class: 'bdl-app' }, topbar(opts.title), el('main', { class: 'bdl-main' }, panel, stage));
  document.body.append(app);
  document.title = `${opts.title} · ${BRAND.name}`;
  return {
    panel, stage, stageTools, exportBar,
    setStatus(text, kind = 'ok') { status.textContent = text; status.dataset.kind = kind; stage.setAttribute('aria-busy', String(kind === 'busy')); },
  };
}

export function section(title: string, ...children: Child[]): HTMLElement {
  const root=el('div', { class: 'bdl-section' }, el('h2', { class: 'bdl-section-title' }, title), ...children);
  if (/^Piatt[oi] di stampa$/.test(title)) {
    const hint=el('p',{class:'bdl-hint'});root.prepend(hint);
    const sync=()=>{
      const chosen=getPrinterChoice();
      hint.hidden=!chosen;hint.textContent='Dimensioni gestite da “La tua stampante”. Cambiala dal pulsante in alto.';
      for(const row of root.querySelectorAll<HTMLElement>('.bdl-row')){
        if(row.querySelector('input[type="range"],.bdl-seg'))row.hidden=!!chosen;
      }
    };
    sync();onPrinterChange(sync);
  }
  return root;
}

export function panelFooter(): HTMLElement {
  return el('div', { class: 'bdl-panel-footer' }, `${BRAND.license.free} ${BRAND.license.commercial}`);
}

// ---------- Controlli ----------

let uid = 0;
const nextId = (p: string) => `${p}-${++uid}`;

export interface SliderOptions {
  editable?: boolean;
  label: string;
  min: number;
  max: number;
  step?: number;
  value: number;
  unit?: string;
  hint?: string;
  onInput: (v: number) => void;
}
export interface SliderRow { root: HTMLElement; set(v: number): void; setRange(min: number, max: number): void; }

export function slider(o: SliderOptions): SliderRow {
  const id = nextId('s');
  const step = o.step ?? 1;
  const decimals = (String(step).split('.')[1] ?? '').length;
  const out = o.editable ? el('input', {type:'number',class:'bdl-slider-number',min:o.min,max:o.max,step,value:o.value,'aria-label':o.label+' · valore numerico'}) : el('span', { class: 'bdl-row-value' });
  const input = el('input', { class: 'bdl-range', type: 'range', id, min: o.min, max: o.max, step, value: o.value });
  const paint = () => {
    const v = Number(input.value);
    if(o.editable)(out as HTMLInputElement).value=v.toFixed(decimals);
    else out.textContent = `${v.toFixed(decimals)}${o.unit ? ` ${o.unit}` : ''}`;
    const p = ((v - Number(input.min)) / (Number(input.max) - Number(input.min) || 1)) * 100;
    input.style.setProperty('--p', `${p}%`);
  };
  input.addEventListener('input', () => { paint(); o.onInput(Number(input.value)); });
  if(o.editable){const commit=()=>{const raw=Number((out as HTMLInputElement).value);if(Number.isFinite(raw)&&((out as HTMLInputElement).value!=='')){input.value=String(Math.max(Number(input.min),Math.min(Number(input.max),raw)));paint();o.onInput(Number(input.value));}else paint();};out.addEventListener('change',commit);out.addEventListener('blur',commit);}
  paint();
  const root = el('div', { class: 'bdl-row' },
    el('div', { class: 'bdl-row-head' }, el('label', { for: id }, o.label+(o.editable&&o.unit?' ('+o.unit+')':'')), out),
    input,
    o.hint ? el('p', { class: 'bdl-hint' }, o.hint) : null);
  return {
    root,
    set(v) { input.value = String(v); paint(); },
    setRange(min, max) { input.min = String(min); input.max = String(max); if(o.editable){(out as HTMLInputElement).min=String(min);(out as HTMLInputElement).max=String(max);} paint(); },
  };
}

export interface SegOption<T extends string> { value: T; label: string; icon?: string; }
export function segmented<T extends string>(o: {
  label?: string; options: SegOption<T>[]; value: T; onChange: (v: T) => void;
}): { root: HTMLElement; set(v: T): void } {
  const buttons = o.options.map((opt) => {
    const b = el('button', { type: 'button', 'aria-pressed': String(opt.value === o.value), title: opt.label });
    if (opt.icon) b.innerHTML = opt.icon;
    b.append(el('span', {}, opt.label));
    b.addEventListener('click', () => { set(opt.value); o.onChange(opt.value); });
    return b;
  });
  const set = (v: T) => buttons.forEach((b, i) => b.setAttribute('aria-pressed', String(o.options[i].value === v)));
  const group = el('div', { class: 'bdl-seg', role: 'group', 'aria-label': o.label ?? '' }, ...buttons);
  const root = o.label
    ? el('div', { class: 'bdl-row' }, el('div', { class: 'bdl-row-head' }, el('span', {}, o.label)), group)
    : el('div', { class: 'bdl-row' }, group);
  return { root, set };
}

export function toggle(o: { label: string; value: boolean; hint?: string; onChange: (v: boolean) => void }): { root: HTMLElement; set(v: boolean): void } {
  const input = el('input', { type: 'checkbox', role: 'switch' });
  input.checked = o.value;
  input.addEventListener('change', () => o.onChange(input.checked));
  const root = el('div', { class: 'bdl-row' },
    el('label', { class: 'bdl-toggle' }, el('span', {}, o.label), input),
    o.hint ? el('p', { class: 'bdl-hint' }, o.hint) : null);
  return { root, set(v) { input.checked = v; } };
}

export function colorPicker(o: { label: string; value: string; onChange: (hex: string) => void }): { root: HTMLElement; set(v: string): void } {
  const name = el('span', { class: 'bdl-row-value' });
  const sw = FILAMENTS.map((f) => {
    const b = el('button', { type: 'button', class: 'bdl-swatch', title: f.name, 'aria-label': f.name, style: `background:${f.hex}` });
    b.addEventListener('click', () => { set(f.hex); o.onChange(f.hex); });
    return b;
  });
  const set = (hex: string) => {
    sw.forEach((b, i) => b.setAttribute('aria-pressed', String(FILAMENTS[i].hex === hex)));
    name.textContent = FILAMENTS.find((f) => f.hex === hex)?.name ?? hex;
  };
  set(o.value);
  return {
    root: el('div', { class: 'bdl-row' }, el('div', { class: 'bdl-row-head' }, el('span', {}, o.label), name), el('div', { class: 'bdl-swatches' }, ...sw)),
    set,
  };
}

export function button(o: { label: string; icon?: string; variant?: 'primary' | 'ghost'; size?: 'sm'; title?: string; onClick: () => void }): HTMLButtonElement {
  const b = el('button', { type: 'button', class: 'bdl-btn', 'data-variant': o.variant, 'data-size': o.size, title: o.title });
  if (o.icon) b.innerHTML = o.icon;
  b.append(o.label);
  b.addEventListener('click', o.onClick);
  return b;
}

export function iconButton(o: { label: string; icon: string; onClick: () => void }): HTMLButtonElement {
  const b = el('button', { type: 'button', class: 'bdl-btn bdl-icon-btn', title: o.label, 'aria-label': o.label, html: o.icon });
  b.addEventListener('click', o.onClick);
  return b;
}

let toastHost: HTMLElement | null = null;
export function toast(text: string, ms = 2600): void {
  if (!toastHost) { toastHost = el('div', { class: 'bdl-toast-host', role: 'status', 'aria-live': 'polite' }); document.body.append(toastHost); }
  const t = el('div', { class: 'bdl-toast' }, text);
  toastHost.append(t);
  setTimeout(() => t.remove(), ms);
}

// ---------- Stato nell'URL (preset condivisibili) ----------

/** Legge i parametri dall'hash dell'URL sopra ai default, solo per chiavi note e dello stesso tipo. */
export function readHashState<T extends Record<string, string | number | boolean>>(defaults: T): T {
  const out = { ...defaults };
  const params = new URLSearchParams(location.hash.slice(1));
  for (const key of Object.keys(defaults) as (keyof T & string)[]) {
    const raw = params.get(key);
    if (raw === null) continue;
    const d = defaults[key];
    if (typeof d === 'number') { const n = Number(raw); if (Number.isFinite(n)) (out[key] as number) = n; }
    else if (typeof d === 'boolean') (out[key] as boolean) = raw === '1';
    else (out[key] as string) = raw;
  }
  return out;
}

/** Scrive nell'hash solo i valori diversi dal default, per link brevi. */
export function writeHashState<T extends Record<string, string | number | boolean>>(state: T, defaults: T): void {
  const params = new URLSearchParams();
  for (const key of Object.keys(state)) {
    const v = state[key];
    if (v === defaults[key]) continue;
    params.set(key, typeof v === 'boolean' ? (v ? '1' : '0') : String(v));
  }
  const hash = params.toString();
  history.replaceState(null, '', hash ? `#${hash}` : location.pathname + location.search);
}

/** Esegue `fn` al massimo una volta per frame, con l'ultimo valore richiesto. */
export function rafThrottle(fn: () => void): () => void {
  let pending = false;
  return () => {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => { pending = false; fn(); });
  };
}

/** Scelta coerente dei collegamenti, visibile solo nella vista di stampa separata. */
export function connectionPicker(opts:{value:()=>string;active:()=>boolean;available:()=>boolean;native?:()=>string;onChange:(value:'auto'|'seat'|'pins')=>void}){
 const root=section('Collegamento');
 const refresh=()=>{root.replaceChildren();root.hidden=!opts.active()||(!opts.available()&&!opts.native?.());if(root.hidden)return;
 root.append(el('h2',{},'Collegamento'));
 if(opts.available())root.append(segmented({label:'Collegamento',value:opts.value(),options:[{value:'auto',label:'Automatico'},{value:'seat',label:'Sedi sagomate'},{value:'pins',label:'Perni'}],onChange:v=>{opts.onChange(v as 'auto'|'seat'|'pins');refresh();}}).root,el('p',{class:'bdl-hint'},'Sedi e perni sono integrati nei pezzi esportati. I dettagli sottili o senza materiale sufficiente usano una sede sagomata. Perni con gioco di 0,15 mm per lato: prova un campione prima della stampa finale.'));
 if(opts.native?.())root.append(el('p',{class:'bdl-hint'},opts.native()));
 };return {root,refresh};
}

/** Indicazioni comuni, disponibili anche prima che il motore 3D sia pronto. */
export function usageHelp(): HTMLElement {
  return el('details', { class: 'bdl-help' }, el('summary', {}, 'Come usare la suite'),
    el('p', {}, 'Scegli un modello, modifica le misure e aspetta che l’anteprima sia pronta. Gli avvisi spiegano cosa correggere prima del download.'),
    el('p', {}, 'STL conserva la geometria; 3MF conserva parti, colori e assegnazioni ai filamenti. Importalo come modello per mantenere i preset della tua stampante. I file non includono impostazioni di stampa già calibrate.'),
    el('p', {}, 'Apri il file in Bambu Studio, OrcaSlicer o PrusaSlicer e controlla scala, orientamento, supporti e dimensioni del piatto. Per gli incastri stampa prima un campione.'),
    el('p', {}, 'Le immagini, gli SVG e gli STL vengono elaborati sul dispositivo. Per riutilizzare i file dopo una ricarica usa il progetto, dove disponibile, oppure ricaricali.'),
    el('p', {}, 'Usa un browser aggiornato con JavaScript, WebAssembly e WebGL attivi. Nella vista 3D trascina lo sfondo per ruotare e usa la rotella o due dita per lo zoom.'));
}
let recoveryInstalled = false;
function installStartupRecovery(): void {
  if (recoveryInstalled) return;
  recoveryInstalled = true;
  const recover = () => {
    if (document.getElementById('bdl-recovery')) return;
    const notice = el('div', { id: 'bdl-recovery', class: 'bdl-recovery', role: 'alert' },
      el('p', {}, 'La pagina non è riuscita a completare un’operazione. Ricarica per riprovare; i file caricati potrebbero dover essere selezionati di nuovo.'),
      button({ label: 'Ricarica la pagina', onClick: () => location.reload() }),
      el('a', { href: '../', class: 'bdl-btn' }, 'Torna ai generatori'));
    for (const panel of document.querySelectorAll<HTMLElement>('.bdl-panel')) panel.inert = true;
    for (const button of document.querySelectorAll<HTMLButtonElement>('.bdl-export button')) button.disabled = true;
    document.body.append(notice);
  };
  window.addEventListener('error', event => { if (event.error) recover(); });
  window.addEventListener('unhandledrejection', recover);
}

/** Scelta locale della stampante: non carica preset macchina nello slicer. */
export function printerButton(firstVisit=false):HTMLButtonElement {
 const b=button({label:'La tua stampante',onClick:()=>openPrinterDialog(b)});
 const paint=()=>{
  const c=getPrinterChoice(),p=PRINTERS.find(p=>p.id===c?.id);
  b.textContent=c?`${p?p.brand+' '+p.name:'Stampante personalizzata'} · ${String(c.nozzle).replace('.',',')} mm`:'La tua stampante';
  b.classList.add('bdl-printer-button');
 };
 paint();onPrinterChange(paint);
 if(firstVisit&&!getPrinterChoice()){
  let dismissed=false;try{dismissed=sessionStorage.getItem('bdl-printer-skipped')==='1';}catch{}
  if(!dismissed)queueMicrotask(()=>openPrinterDialog(b));
 }
 return b;
}
function openPrinterDialog(trigger:HTMLElement):void{
 if(document.querySelector('.bdl-printer-dialog'))return;
 const current=getPrinterChoice(),selected=PRINTERS.find(p=>p.id===current?.id);
 const d=el('dialog',{class:'bdl-printer-dialog','aria-labelledby':'printer-heading'});
 const brand=el('select',{'aria-label':'Marca'}),model=el('select',{'aria-label':'Modello'}),nozzle=el('select',{'aria-label':'Nozzle montato'});
 brand.append(el('option',{value:''},'Scegli la marca'),...([...new Set(PRINTERS.map(p=>p.brand)),'Altra stampante'].map(v=>el('option',{value:v},v))));
 const dims=el('div',{class:'bdl-printer-dimensions'});
 const volume=current?.volume??[256,256,256];
 const inputs=['Larghezza X','Profondità Y','Altezza Z'].map((name,i)=>{
  const input=el('input',{type:'number',min:80,max:1000,step:1,value:volume[i],required:true,'aria-label':name+' in mm'});
  dims.append(el('label',{},name+' (mm)',input));return input;
 });
 const info=el('p',{class:'bdl-hint',role:'status'}),error=el('p',{class:'bdl-hint',role:'alert'});
 const close=()=>{d.close();d.remove();trigger.focus();};
 const updateNozzles=()=>{
  const p=PRINTERS.find(p=>p.id===model.value),custom=brand.value==='Altra stampante';
  const values=custom?[0.2,0.25,0.4,0.6,0.8,1]:p?.nozzles??[0.4];
  nozzle.replaceChildren(...values.map(n=>el('option',{value:n},String(n).replace('.',',')+' mm')));
  nozzle.value=String(current&&current.id===model.value?current.nozzle:0.4);
  dims.hidden=!custom;model.disabled=custom||!brand.value;
  info.textContent=custom?'Inserisci il volume utile della tua stampante.':p?`Volume: ${p.volume.join(' × ')} mm. Dimensioni del piatto applicate ai generatori.`:'Puoi continuare anche senza scegliere.';
 };
 const updateModels=()=>{
  model.replaceChildren(el('option',{value:''},'Scegli il modello'),...PRINTERS.filter(p=>p.brand===brand.value).map(p=>el('option',{value:p.id},p.name)));
  if(selected?.brand===brand.value)model.value=selected.id;
  updateNozzles();
 };
 brand.value=current?.id==='custom'?'Altra stampante':selected?.brand??'';
 brand.addEventListener('change',updateModels);model.addEventListener('change',updateNozzles);updateModels();
 if(current?.id==='custom')nozzle.value=String(current.nozzle);
 const form=el('form',{},el('h2',{id:'printer-heading'},'Creiamo sul tuo piatto'),
  el('p',{},'Scegli la stampante una volta. Puoi cambiarla quando vuoi, senza perdere il progetto.'),
  el('label',{},'Marca',brand),el('label',{},'Modello',model),dims,el('label',{},'Nozzle montato',nozzle),info,
  el('p',{class:'bdl-hint'},'La scelta adatta il piatto della suite. Nello slicer conserva la tua stampante e verifica il nozzle effettivamente montato.'),error,
  el('div',{class:'bdl-printer-actions'},
   button({label:'Continua senza scegliere',onClick:()=>{try{sessionStorage.setItem('bdl-printer-skipped','1');}catch{}savePrinterChoice(null);close();}}),
   button({label:'Usa questa stampante',variant:'primary',onClick:()=>{
    const custom=brand.value==='Altra stampante';
    const choice=validatePrinterChoice({id:custom?'custom':model.value,nozzle:Number(nozzle.value),...(custom?{volume:inputs.map(i=>Number(i.value))}:{})});
    if(!choice){error.textContent='Scegli un modello oppure inserisci tre misure valide, da 80 a 1000 mm.';return;}
    savePrinterChoice(choice);close();
   }})));
 form.addEventListener('submit',e=>e.preventDefault());d.append(form);document.body.append(d);
 d.addEventListener('cancel',e=>{e.preventDefault();try{sessionStorage.setItem('bdl-printer-skipped','1');}catch{}close();});
 d.showModal();
}
