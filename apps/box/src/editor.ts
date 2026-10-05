import { el, section, slider, segmented, button, toast } from '@bdl/ui-kit';
import { importArtwork, textArtwork } from '../../keycap/src/artwork.ts';
import { KEY_ICONS, keyIconSvg } from '../../keycap/src/icons.ts';
import { FACES, positionOnFace, type Decoration, type Face } from './decoration.ts';
export function decorationEditor(get: () => Decoration[], change: (items: Decoration[]) => void, dimensions: () => Parameters<typeof positionOnFace>[1]) {
  let active=0, generation=0;
  const list=el('select', {class:'bdl-select','aria-label':'Decorazione selezionata'});
  const fields=el('div',{class:'bdl-control-stack'}), text=el('input', {class:'bdl-input',type:'text', placeholder:'Testo (massimo 12 caratteri)', maxlength:'12', 'aria-label':'Testo della decorazione'});
  const upload=el('input',{class:'bdl-input',type:'file',accept:'.svg','aria-label':'Carica SVG'});
  const root=section('Decorazioni · SVG, testo e icone', list, button({label:'Aggiungi decorazione',onClick:()=>{
    if (get().length>=12) {toast('Massimo 12 decorazioni');return;}
    change([...get(),{id:get().length+1,face:'lid',mode:'inlay',size:20,u:0,v:0,angle:0,depth:0.6,color:'#d4a429',artwork:textArtwork('A')}]);active=get().length-1;sync();
  }}),fields);
  const updates: (()=>void)[]=[];
  function update(patch: Partial<Decoration>) { const items=get().map((d,i)=>i===active?{...d,...patch}:d);change(items);sync(); }
  const face=segmented({label:'Superficie',value:'lid',options:Object.entries(FACES).map(([value,label])=>({value,label})),onChange:v=>update({face:v as Face})});
  face.root.classList.add('bdl-seg-wrap');
  const mode=segmented({label:'Tecnica',value:'inlay',options:[{value:'inlay',label:'Intarsio'},{value:'relief',label:'Rilievo'},{value:'engrave',label:'Incisione'}],onChange:v=>update({mode:v as Decoration['mode']})});
  const name=el('p',{class:'bdl-hint'});
  const color=el('input',{type:'color','aria-label':'Colore della decorazione'}); color.addEventListener('input',()=>update({color:color.value}));
  const library=el('div',{class:'bdl-icon-library'});
  const dialog=el('dialog',{class:'bdl-dialog','aria-label':'Scegli icona'},el('h2',{},'Scegli un’icona'),library);
  for (const [id,label,,path] of KEY_ICONS) { const b=button({label,onClick:()=>{try{update({artwork:textArtwork(`@icon:${id}`)});dialog.close();}catch(e){toast(String(e));}}});b.prepend(el('span',{html:keyIconSvg(path)}));library.append(b); }
  dialog.append(button({label:'Chiudi',onClick:()=>dialog.close()}));root.append(dialog);
  fields.append(name,upload,text,button({label:'Applica testo',onClick:()=>{try{if(!text.value.trim())throw new Error('Scrivi un testo');update({artwork:textArtwork(text.value.trim())});}catch(e){toast(String(e));}}}),button({label:'Scegli icona',onClick:()=>dialog.showModal()}),face.root,mode.root);
  const positions=el('div',{class:'bdl-choice-grid'});
  for(const [position,label] of [['left','Sinistra'],['center','Centro'],['right','Destra'],['top','Alto'],['bottom','Basso']] as const) positions.append(button({label,onClick:()=>{const d=get()[active];if(d)update(positionOnFace(d,dimensions(),position));}}));
  fields.append(el('p',{class:'bdl-hint'},'Posizione del disegno sulla superficie della scatola. Seleziona una posizione oppure regola le due coordinate qui sotto.'),positions);
  for (const [key,label,min,max,step] of [['size','Dimensione',3,150,1],['u','Testo / SVG · posizione orizzontale sul lato',-110,110,1],['v','Testo / SVG · posizione verticale sul lato',-110,110,1],['angle','Rotazione',-180,180,5],['depth','Profondità / altezza',0.2,1,0.1]] as const) {
    const c=slider({label,min,max,step,unit:key==='angle'?'°':'mm',value:20,onInput:v=>update({[key]:v})});fields.append(c.root);updates.push(()=>c.set(get()[active]?.[key]??min));
  }
  fields.append(color,button({label:'Rimuovi decorazione',onClick:()=>{++generation;change(get().filter((_,i)=>i!==active));active=Math.max(0,active-1);sync();}}),el('p',{class:'bdl-hint'},'I disegni restano entro la zona piana del lato scelto. Intarsi e rilievi sono pezzi selezionabili separati; l’incisione scava la superficie. Gli intarsi hanno 0,1 mm di gioco per lato e vanno fissati con colla dopo la stampa.'));
  list.addEventListener('change',()=>{++generation;active=Number(list.value);sync();});
  upload.addEventListener('change',async()=>{const file=upload.files?.[0];if(!file)return;const token=++generation,index=active;try{const art=await importArtwork(file,180);if(token===generation && index===active)update({artwork:art});}catch(e){toast(e instanceof Error?e.message:String(e));}upload.value='';});
  function sync() { const items=get();active=Math.min(active,Math.max(0,items.length-1));list.replaceChildren(...items.map((d,i)=>el('option',{value:String(i)},`${i+1} · ${FACES[d.face]} · ${d.artwork.name.slice(0,30)}`)));list.value=String(active);fields.hidden=!items.length;list.hidden=!items.length;const d=items[active];if(d){name.textContent=d.artwork.name;face.set(d.face);mode.set(d.mode);color.value=d.color;updates.forEach(f=>f());} }
  sync();return {root,sync,select:(id:number)=>{active=id;sync();}};
}
