import '@bdl/ui-kit/style.css';
import {printerPlate,onPrinterChange} from '@bdl/brand';
import {bounds} from '@bdl/geometry';
import {createViewer} from '@bdl/viewer';
import {download,toSTL,to3MF} from '@bdl/export';
import {zipSync,strToU8} from 'fflate';
import {appShell,button,colorPicker,el,iconButton,ICONS,panelFooter,section,slider,toggle,readHashState,writeHashState} from '@bdl/ui-kit';
import {ATTRIBUTION,FLORENCE,extent,areaQuery,fetchArea,parseData,type Area,type Element,type Point} from './data.ts';
import {mapPicker} from './map.ts';
import {modelDefaults,type Settings,type Result} from './geometry.ts';
import {dimensions} from './dimensions.ts';
import {fetchElevation,TERRAIN_SOURCE,type Elevation} from './elevation.ts';
import {FORMS,FONTS,type Form} from './forms.ts';
import {traceText} from './text.ts';
import {MAGNETS,magnetPocket,pins,readGpx} from './accessories.ts';
import {GIFTS,PLACES,PALETTES,PALETTE_LABELS,MAP_COLORS} from './presets.ts';
const defaults={...FLORENCE,...modelDefaults,size:180,base:3,relief:1,fallback:8,roads:true,water:true,green:true,terrain:true};
const saved=readHashState(defaults);
const clamp=(v:number,min:number,max:number,fallback:number)=>Number.isFinite(v)?Math.max(min,Math.min(max,v)):fallback;
let area:Area={lat:clamp(saved.lat,-80,80,FLORENCE.lat),lon:clamp(saved.lon,-180,180,FLORENCE.lon),
  span:clamp(saved.span,250,4000,900),aspect:['square','landscape','portrait'].includes(saved.aspect)?saved.aspect:'square'};
const {lat:_lat,lon:_lon,span:_span,aspect:_aspect,terrain:_terrain,...savedModel}=saved;
const colorKeys=['groundColor','buildingColor','roadColor','pathColor','waterColor','greenColor','frameColor','captionColor'] as const;
let settings:Settings & typeof modelDefaults={...savedModel,size:clamp(saved.size,40,300,180),base:clamp(saved.base,2,10,3),
  trayThickness:clamp(saved.trayThickness,2.4,10,modelDefaults.trayThickness),
  relief:clamp(saved.relief,.5,4,1),fallback:clamp(saved.fallback,3,40,8),
  terrainScale:clamp(saved.terrainScale,.5,5,1),roadHeight:clamp(saved.roadHeight,.2,2,.6),
  waterDepth:clamp(saved.waterDepth,.4,3,1.2),label:saved.label.slice(0,45),subtitle:saved.subtitle.slice(0,65),
  form:FORMS.some(([id])=>id===saved.form)?saved.form:'rect',
  font:FONTS.some(font=>font===saved.font)?saved.font:'Russo One',
  extraPins:saved.extraPins.slice(0,600),markerPosition:saved.markerPosition.slice(0,40),mount:['none','wall','magnet','led'].includes(saved.mount)?saved.mount:'none',
  magnetCode:magnetPocket(saved.magnetCode).sku,
  colorMode:['free','ams4','ams8','height'].includes(saved.colorMode)?saved.colorMode:'free',
  bandCount:Math.round(clamp(saved.bandCount,2,4,2)),cut1:clamp(saved.cut1,0,350,0),cut2:clamp(saved.cut2,0,350,0),cut3:clamp(saved.cut3,0,350,0),
  style:saved.style==='miniature'?'miniature':'precise',waterMode:saved.waterMode==='incised'?'incised':'flat'};
for(const key of colorKeys)if(!/^#[0-9a-f]{6}$/i.test(settings[key]))settings[key]=defaults[key];
let terrain=saved.terrain,altitudes:Elevation|undefined,terrainRequest:AbortController|undefined,terrainNotice='';
let previewPart:'map'|'stand'|'mount'|'tray'='map',showDimensions=true;
let route:Point[][]=[];
const shell=appShell({title:'Mappe 3D',intro:'Scegli un quartiere e trasformalo in un plastico da stampare.'});
const quotes=dimensions(shell.stage);
const viewer=createViewer(shell.stage,{smoothView:true,fitPadding:1.12,onProject:quotes.update});
const worker=new Worker(new URL('./worker.ts',import.meta.url),{type:'module'});
let data:Element[]|undefined,result:Result|undefined,request:AbortController|undefined,revision=0;
let timer:ReturnType<typeof setTimeout>|undefined,working=false,pending=false;
const summary=el('p',{class:'bdl-hint'});
const coverage=el('p',{class:'bdl-hint','aria-live':'polite'});
const lat=el('input',{type:'number',class:'bdl-text-input',step:'any','aria-label':'Latitudine'});
const lon=el('input',{type:'number',class:'bdl-text-input',step:'any','aria-label':'Longitudine'});
const picker=mapPicker(point=>move(point),point=>{
  if(!point){pinHint.textContent='Scegli un punto all’interno della sagoma, lontano dal bordo.';return;}
  settings={...settings,marker:true,markerPosition:point.lat.toFixed(6)+','+point.lon.toFixed(6)};
  switches.get('marker')?.set(true);syncControls();
  setPlacement(false);
  syncPin();schedule();
});
const pinHint=el('p',{class:'bdl-hint','aria-live':'polite'});
let placingPin=false;
const locatePin=button({label:'Posiziona segnaposto',onClick:()=>setPlacement(!placingPin)});
function setPlacement(value:boolean){
  placingPin=value;picker.setPlacement(value);
  locatePin.setAttribute('aria-pressed',String(value));
  if(value)pinHint.textContent='Tocca un punto dentro la sagoma. Con la tastiera, usa le frecce e premi Invio.';
  else syncPin();
}
function syncPin(){
  const point=settings.marker?(result?result.primaryMarker:pins(settings.markerPosition)[0]??area):undefined;
  picker.setMarker(point);
  if(placingPin)return;
  locatePin.textContent=settings.marker?'Sposta segnaposto':'Posiziona segnaposto';
  pinHint.textContent=point?(picker.valid(point)?'Segnaposto · '+point.lat.toFixed(6)+', '+point.lon.toFixed(6):
    'Il segnaposto è fuori dalla sagoma. Scegli una nuova posizione.'):'';
}
picker.root.addEventListener('keydown',event=>{if(event.key==='Escape'&&placingPin){setPlacement(false);locatePin.focus();}});
const selectedArea=():Area=>settings.form==='rect'?area:{...area,aspect:'square'};
const attribution=el('a',{href:'https://www.openstreetmap.org/copyright',target:'_blank',rel:'noopener'},'© contributori OpenStreetMap · ODbL');
const osm=el('a',{target:'_blank',rel:'noopener'},'Trova coordinate su OpenStreetMap');
const turbo=el('a',{target:'_blank',rel:'noopener'},'Apri la selezione in Overpass Turbo');
const importFile=el('input',{type:'file',accept:'.json,application/json','aria-label':'Importa dati cartografici JSON'});
const example=button({label:'Esempio di Firenze',onClick:()=>{
  area={...FLORENCE};ratio.value=area.aspect;areaSize.set(area.span);
  if(!settings.label){settings={...settings,label:'Firenze'};caption.value=settings.label;}
  invalidateArea();void generateArea();
}});
const generate=button({label:'Genera modello',variant:'primary',onClick:()=>void generateArea()});
const exports:HTMLButtonElement[]=[];
function syncArea(){
  lat.value=String(area.lat);lon.value=String(area.lon);
  const [w,h]=extent(selectedArea());
  summary.textContent=Math.round(w)+' × '+Math.round(h)+' m · '+(w*h/1e6).toFixed(2)+' km²';
  osm.href='https://www.openstreetmap.org/#map=16/'+area.lat+'/'+area.lon;
  try{turbo.href='https://overpass-turbo.eu/?'+new URLSearchParams({Q:areaQuery(selectedArea()),C:area.lat+';'+area.lon+';16'});}catch{turbo.removeAttribute('href');}
  picker.setArea(selectedArea(),settings.form,settings.size);
  syncPin();
  writeHashState({...area,...settings,terrain},defaults);
}
function invalidateArea(){
  request?.abort();request=undefined;terrainRequest?.abort();terrainRequest=undefined;altitudes=undefined;terrainNotice='';
  revision++;pending=false;clearTimeout(timer);quotes.setBox(undefined);previewPart='map';supportView.hidden=true;supportDownload.hidden=true;trayView.hidden=true;trayDownload.hidden=true;markerDownload.hidden=true;mountView.hidden=true;mountDownload.hidden=true;
  generate.disabled=false;data=undefined;result=undefined;coverage.textContent='';
  exports.forEach(b=>b.disabled=true);viewer.setParts([]);
  syncArea();shell.setStatus('Genera il modello per questa selezione.','ok');
}
function move(p:Point){
  area={...area,lat:Number(clamp(p.lat,-80,80,area.lat).toFixed(6)),lon:Number(clamp(p.lon,-180,180,area.lon).toFixed(6))};
  invalidateArea();
}
const changeCoordinates=()=>move({lat:lat.valueAsNumber,lon:lon.valueAsNumber});
lat.addEventListener('change',changeCoordinates);lon.addEventListener('change',changeCoordinates);
const searchInput=el('input',{type:'search',class:'bdl-text-input','aria-label':'Città o quartiere',placeholder:'Es. Firenze',maxlength:100,required:true});
const searchStatus=el('p',{class:'bdl-hint','aria-live':'polite'});
const searchResults=el('div',{class:'bdl-city-results'});
const searchButton=button({label:'Cerca luogo',onClick:()=>void search()});
searchInput.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();void search();}});
async function search(){
  const q=searchInput.value.trim();
  if(q.length<2||searchButton.disabled)return;
  searchButton.disabled=true;searchResults.replaceChildren();searchStatus.textContent='Ricerca in corso…';
  try {
    const reply=await fetch('https://photon.komoot.io/api/?'+new URLSearchParams({q,limit:'5'}),{signal:AbortSignal.timeout(12000)});
    if(!reply.ok)throw new Error();
    const d=await reply.json() as {features?:{geometry?:{coordinates?:number[]};properties?:Record<string,string>}[]};
    const labels=new Set<string>();
    const choices=(d.features??[]).flatMap(f=>{
      const [lon,lat]=f.geometry?.coordinates??[];
      const p=f.properties??{};
      const label=[...new Set([p.name,p.city,p.state,p.country].filter(Boolean))].join(', ');
      if(!Number.isFinite(lat)||!Number.isFinite(lon)||!label||labels.has(label))return [];
      labels.add(label);
      return [button({label,onClick:()=>{
        searchInput.value=label;searchResults.replaceChildren();searchStatus.textContent='';
        if(!settings.label){settings={...settings,label:(p.name??label).slice(0,45)};caption.value=settings.label;}
        move({lat,lon});
      }})];
    });
    searchResults.append(...choices);
    searchStatus.textContent=choices.length?'':'Nessun luogo trovato.';
  }catch{searchStatus.textContent='Ricerca non disponibile. Puoi spostare la mappa o inserire le coordinate.';}
  finally{searchButton.disabled=false;}
}
const ratio=el('select',{class:'bdl-select','aria-label':'Proporzioni'},
  ...[['square','Quadrato'],['landscape','Orizzontale 3:2'],['portrait','Verticale 2:3']].map(([value,label])=>el('option',{value},label)));
ratio.value=area.aspect;
ratio.addEventListener('change',()=>{area={...area,aspect:ratio.value as Area['aspect']};invalidateArea();});
const areaSize=slider({label:'Lato lungo dell’area',min:250,max:4000,step:50,unit:'m',editable:true,value:area.span,
  onInput:v=>{area={...area,span:v};invalidateArea();}});
const ranges=new Map<string,ReturnType<typeof slider>>();
const range=(key:'size'|'base'|'trayThickness'|'relief'|'fallback'|'terrainScale'|'roadHeight'|'waterDepth'|'bandCount'|'cut1'|'cut2'|'cut3',label:string,min:number,max:number,step:number,unit:string)=>{
  const row=slider({label,min,max,step,unit,editable:true,value:settings[key],onInput:v=>{
    settings={...settings,[key]:v};syncControls();if(key==='size')syncArea();schedule();
  }});
  ranges.set(key,row);return row.root;
};
type ToggleKey='buildings'|'roads'|'paths'|'water'|'green'|'frame'|'marker'|'stand'|'wallText'|'coordinates'|'north'|'scaleBar'|'keyring'|'simple'|'highlight'|'rail'|'bridges'|'trees';
const switches=new Map<ToggleKey,ReturnType<typeof toggle>>();
const layer=(key:ToggleKey,label:string)=>{
  const control=toggle({label,value:settings[key],onChange:v=>{settings={...settings,[key]:v};syncControls();if(key==='marker')syncPin();schedule();}});
  switches.set(key,control);return control.root;
};
const selections=new Map<string,HTMLSelectElement>();
const choose=(label:string,values:[string,string][],value:string,onChange:(value:string)=>void)=>{
  const input=el('select',{class:'bdl-select','aria-label':label},
    ...values.map(([value,text])=>el('option',{value},text)));
  input.value=value;input.addEventListener('change',()=>onChange(input.value));selections.set(label,input);
  return el('label',{},label,input);
};
const form=choose('Forma della mappa',FORMS.map(([id,name])=>[id,name]),settings.form,v=>{
  const previous=selectedArea().aspect,loaded=!!data;
  settings={...settings,form:v as Form};syncControls();
  if(previous!==selectedArea().aspect){invalidateArea();if(loaded)void generateArea();}
  else{syncArea();schedule();}
});
const style=choose('Stile del modello',[['precise','Preciso 1:1'],['miniature','Miniatura (plastico)']],settings.style,v=>{
  settings={...settings,style:v,relief:v==='miniature'?1.65:1,terrainScale:v==='miniature'?1.8:1};
  ranges.get('relief')?.set(settings.relief);ranges.get('terrainScale')?.set(settings.terrainScale);
  syncControls();schedule();
});
const frameToggle=layer('frame','Base con scritta');
const caption=el('input',{type:'text',class:'bdl-text-input',maxlength:45,'aria-label':'Scritta sulla base',value:settings.label});
caption.addEventListener('input',()=>{settings={...settings,label:caption.value};schedule();});
const captionRow=el('label',{},'Scritta sulla base',caption);
const subtitle=el('input',{type:'text',class:'bdl-text-input',maxlength:65,'aria-label':'Sottotitolo (seconda riga)',value:settings.subtitle});
subtitle.addEventListener('input',()=>{settings={...settings,subtitle:subtitle.value};schedule();});
const captionPositionLabel='Posizione della scritta';
const captionPosition=choose(captionPositionLabel,[['top','Sopra la cornice'],['wall','Sulla parete laterale']],
  'top',v=>{settings={...settings,captionPosition:v};syncControls();schedule();});
const coordinateOrderLabel='Posizione delle coordinate';
const coordinateOrder=choose(coordinateOrderLabel,[['front','A destra del titolo'],['back','A sinistra del titolo']],
  settings.coordinateOrder==='back'?'back':'front',v=>{settings={...settings,coordinateOrder:v};schedule();});
const captions=el('div',{},captionRow,el('label',{},'Sottotitolo (seconda riga)',subtitle),captionPosition,
  choose('Font della scritta',FONTS.map(font=>[font,font]),settings.font,v=>{settings={...settings,font:v};schedule();}));
const markerInitial=el('input',{type:'text',class:'bdl-text-input',maxlength:4,'aria-label':'Iniziale del segnaposto',value:settings.markerInitial});
markerInitial.addEventListener('input',()=>{
  settings={...settings,markerInitial:[...markerInitial.value.trim().toUpperCase()][0]??''};schedule();
});
markerInitial.addEventListener('change',()=>{markerInitial.value=settings.markerInitial;});
const markerInitialRow=el('label',{},'Iniziale del segnaposto',markerInitial);
const markerShape=choose('Forma del segnaposto',[['star','Stella'],['heart','Cuore'],['initial','Iniziale']],
  ['star','heart','initial'].includes(settings.markerShape)?settings.markerShape:'star',
  v=>{settings={...settings,markerShape:v};syncControls();schedule();});
const markerOptions=el('div',{},markerShape,markerInitialRow);
const standToggle=layer('stand','Supporto da scrivania');
const keyring=layer('keyring','Occhiello per portachiavi');
const frameActive=()=>settings.frame||settings.style==='miniature'||settings.form==='cube'||
  settings.coordinates||settings.north||settings.scaleBar||settings.stand||settings.keyring;
const terrainRow=range('terrainScale','Esagerazione del terreno',.5,5,.1,'×');
const terrainToggle=toggle({label:'Terreno reale',value:terrain,onChange:v=>{
  terrain=v;syncControls();
  if(v&&data&&!altitudes)void loadTerrain();
  schedule();
}}).root;
const buildingControls=el('div',{},range('relief','Scala altezza edifici',.5,4,.1,'×'),range('fallback','Altezza dove mancano dati',3,40,1,'m'));
const roadControl=range('roadHeight','Altezza delle strade',.2,2,.1,'mm');
const waterDepth=range('waterDepth','Profondità dell’alveo',.4,3,.1,'mm');
const waterControls=el('div',{},choose('Superficie dell’acqua',[['incised','Incisa'],['flat','Piatta']],settings.waterMode,v=>{
  settings={...settings,waterMode:v};syncControls();schedule();
}),waterDepth);
const colors=colorKeys.map((key,i)=>colorPicker({
  label:['Terreno','Edifici','Strade','Sentieri','Acqua','Verde','Base','Scritta'][i],value:settings[key],palette:MAP_COLORS,
  onChange:v=>{settings={...settings,[key]:v,palette:'custom'};schedule();}
}));
const swatches=colors.map(color=>color.root);
const pinInput=el('textarea',{class:'bdl-text-input',rows:3,maxlength:600,'aria-label':'Altri segnaposto (latitudine, longitudine)'});
pinInput.value=settings.extraPins;
pinInput.addEventListener('input',()=>{settings={...settings,extraPins:pinInput.value};syncControls();schedule();});
const routeFile=el('input',{type:'file',accept:'.gpx,application/gpx+xml','aria-label':'Percorso da file GPX'});
const routeStatus=el('p',{class:'bdl-hint','aria-live':'polite'});
const clearRoute=button({label:'Rimuovi percorso',onClick:()=>{route=[];routeFile.value='';routeStatus.textContent='';clearRoute.hidden=true;schedule();}});
clearRoute.hidden=true;
routeFile.addEventListener('change',async()=>{
  const file=routeFile.files?.[0];if(!file)return;
  try{
    if(file.size>5_000_000)throw new Error('Il GPX supera 5 MB.');
    const loaded=readGpx(await file.text());
    if(routeFile.files?.[0]!==file)return;
    route=loaded;routeStatus.textContent=file.name;clearRoute.hidden=false;schedule();
  }catch(e){routeStatus.textContent=e instanceof Error?e.message:'GPX non disponibile.';routeFile.value='';}
});
const mountControl=choose('Fissaggio posteriore',[['none','Nessuno'],['wall','Da appendere'],['magnet','Magnete'],['led','LED']],settings.mount,v=>{
  settings={...settings,mount:v};syncControls();schedule();
});
const magnetHint=el('p',{class:'bdl-hint','aria-live':'polite'});
const magnetControl=el('div',{},choose('Magnete tondo Bambu Lab',
  MAGNETS.map(([code,d,h])=>[code,'Ø '+d+' × '+h+' mm · '+code]),settings.magnetCode,v=>{
    settings={...settings,magnetCode:v};syncControls();schedule();
  }),magnetHint);
const simple=layer('simple','Edifici a forme semplici');
const highlight=layer('highlight','Evidenzia l’edificio al centro');
const trees=layer('trees','Alberi 3D in boschi e parchi');
const changes=el('p',{class:'bdl-hint','aria-live':'polite'});
const cutRows=(['cut1','cut2','cut3'] as const).map((key,i)=>range(key,'Cambio '+(i+1)+': altezza',0,150,.1,'mm'));
const bands=el('div',{},range('bandCount','Numero di colori',2,4,1,''),...cutRows,
  el('p',{class:'bdl-hint'},'Usa 0 mm per scegliere la quota in automatico. Imposta la pausa alla quota mostrata nello slicer.'),changes);
const filaments=el('p',{class:'bdl-hint','aria-live':'polite'});
const mode=choose('Modalità colore',[['free','Libera'],['ams4','AMS 4 colori'],['ams8','AMS 8 colori'],['height','Per altezza (1 ugello)']],settings.colorMode,v=>{
  settings={...settings,colorMode:v};syncControls();schedule();
});
function setPalette(key:string){
  const palette=PALETTES[key];
  if(!palette)return;
  settings={...settings,palette:key};
  colorKeys.forEach((name,i)=>{settings[name]=palette[i];colors[i].set(palette[i]);});
}
const paletteControls=el('div',{class:'bdl-city-presets'},...PALETTE_LABELS.map(([key,name])=>button({
  label:name,onClick:()=>{setPalette(key);schedule();}
})));
const placeControls=el('div',{class:'bdl-city-presets'},...PLACES.map(place=>button({
  label:place.label,onClick:()=>{
    settings={...settings,label:place.title};caption.value=place.title;
    move(place);
  }
})));
const giftControls=el('div',{class:'bdl-city-presets'},...GIFTS.map(gift=>button({
  label:gift.label,onClick:()=>{
    const previous=selectedArea().aspect,loaded=!!data;
    settings={...settings,form:gift.form,size:gift.size,frame:true,label:gift.label,subtitle:'',
      marker:!!gift.marker,keyring:!!gift.keyring,mount:gift.mount??'none'};
    setPalette(gift.palette);
    caption.value=settings.label;subtitle.value=settings.subtitle;
    for(const key of ['frame','marker','keyring'] as const)switches.get(key)?.set(settings[key]);
    selections.get('Forma della mappa')!.value=settings.form;
    selections.get('Fissaggio posteriore')!.value=settings.mount;
    ranges.get('size')?.set(settings.size);
    syncControls();
    if(previous!==selectedArea().aspect){invalidateArea();if(loaded)void generateArea();}
    else{syncArea();schedule();}
  }
})));
const copy=button({label:'Copia link al progetto',onClick:async()=>{
  try{const url=new URL(location.href);url.searchParams.set('progetto','1');await navigator.clipboard.writeText(url.href);copy.textContent='Link copiato';}
  catch{copy.textContent='Copia l’indirizzo dalla barra del browser';}
}});
const trayColorHint=el('p',{class:'bdl-hint'},'Il colore della scritta sul vassoio serve a distinguerla in anteprima. Nel Base STL è un rilievo da stampare insieme al vassoio.');
function syncControls(){
  const framed=frameActive();
  markerOptions.hidden=!settings.marker&&!settings.extraPins.trim();
  markerInitialRow.hidden=settings.markerShape!=='initial';
  trayColorHint.hidden=!framed||settings.form==='cube';
  magnetControl.hidden=settings.mount!=='magnet';
  const pocket=magnetPocket(settings.magnetCode);
  magnetHint.textContent='Sede nel fissaggio: Ø '+pocket.diameter.toFixed(1).replace('.',',')+' mm · profondità '+pocket.depth.toFixed(1).replace('.',',')+' mm.';
  frameToggle.hidden=settings.style==='miniature'||settings.form==='cube';
  captions.hidden=!framed;captionPosition.hidden=settings.form==='cube';
  selections.get(captionPositionLabel)!.value=['top','wall'].includes(settings.captionPosition)?settings.captionPosition:
    settings.wallText||settings.form!=='rect'?'wall':'top';
  coordinateOrder.hidden=!settings.coordinates||settings.form==='cube';
  keyring.hidden=settings.form==='cube';standToggle.hidden=settings.form==='cube';
  ratios.hidden=settings.form!=='rect';baseControl.hidden=settings.form==='cube';trayThickness.hidden=!framed||settings.form==='cube';
  for(const key of ['coordinates','north','scaleBar'] as const)switches.get(key)!.root.hidden=settings.form==='cube';
  terrainRow.hidden=!terrain;buildingControls.hidden=!settings.buildings;roadControl.hidden=!(settings.roads||settings.paths);
  waterControls.hidden=!settings.water;waterDepth.hidden=settings.waterMode!=='incised';
  simple.hidden=!settings.buildings;highlight.hidden=!settings.buildings;trees.hidden=!settings.green;
  bands.hidden=settings.colorMode!=='height';cutRows.forEach((row,i)=>{row.hidden=i>=settings.bandCount-1;});
  [true,settings.buildings,settings.roads,settings.paths,settings.water,settings.green,framed,framed||(settings.colorMode==='height'&&settings.bandCount===4)].forEach((visible,i)=>{swatches[i].hidden=!visible;});
}
const ratios=el('label',{},'Proporzioni',ratio);
const baseControl=range('base','Spessore sotto il terreno',2,10,.2,'mm');
const trayThickness=range('trayThickness','Spessore del fondo del vassoio',2.4,10,.2,'mm');
shell.panel.append(
  section('Area',el('label',{},'Città o quartiere',searchInput),searchButton,searchStatus,searchResults,picker.root,locatePin,pinHint,
    el('p',{class:'bdl-hint'},'Trascina la mappa sotto la cornice per spostare la selezione.'),
    el('div',{class:'bdl-city-coordinates'},el('label',{},'Latitudine',lat),el('label',{},'Longitudine',lon)),
    osm,el('p',{},'Luoghi da cui partire'),placeControls,el('p',{},'Regalo in un clic'),giftControls,
    el('div',{class:'bdl-city-presets'},...[500,1000,2000,3000].map(span=>button({
      label:span<1000?span+' m':span/1000+' km',onClick:()=>{area={...area,span};areaSize.set(span);invalidateArea();}
    }))),areaSize.root,ratios,summary,generate,example,
    el('details',{},el('summary',{},'Importa dati cartografici'),turbo,
      el('p',{class:'bdl-hint'},'Esegui la query, esporta i dati grezzi in JSON e apri il file qui. Il modello usa la cornice corrente.'),importFile)),
  section('Forma della mappa',form),
  section('Stile',style,frameToggle,captions,layer('coordinates','Mostra coordinate'),coordinateOrder,
    layer('north','Freccia del nord sulla cornice'),layer('scaleBar','Barra della scala sulla cornice'),
    layer('marker','Segnaposto “abito qui”'),markerOptions,
    el('label',{},'Altri segnaposto (latitudine, longitudine)',pinInput),
    el('p',{class:'bdl-hint'},'Un punto per riga, fino a 12. I segnaposti usano la forma selezionata.'),
    el('label',{},'Percorso da file GPX',routeFile),routeStatus,clearRoute,standToggle,keyring,mountControl,magnetControl),
  section('Modello',range('size','Lato lungo della mappa',40,300,5,'mm'),trayThickness,baseControl,
    terrainToggle,terrainRow,buildingControls,roadControl,coverage),
  section('Livelli',layer('buildings','Edifici'),simple,highlight,layer('roads','Strade'),layer('paths','Marciapiedi e sentieri'),
    layer('rail','Ferrovie'),layer('bridges','Ponti'),layer('water','Acqua'),waterControls,layer('green','Parchi e aree verdi'),trees),
  section('Colori dei livelli',mode,filaments,bands,el('p',{},'Palette pronte'),paletteControls,...swatches,trayColorHint),
  section('Progetto',copy,el('p',{class:'bdl-hint'},'Il link conserva area e impostazioni. Gli estratti importati si aprono dal file JSON.')),
  section('Stampa',el('p',{class:'bdl-hint'},'Usa il 3MF per assegnare i filamenti ai livelli o lo STL per un modello monocolore. Verifica i dettagli fini nell’anteprima dello slicer. Con la cornice, stampa base-mappa.stl a parte e appoggia il plastico nel vassoio.')),
  section('Fonte dei dati',attribution,el('a',{href:'https://registry.opendata.aws/terrain-tiles/',target:'_blank',rel:'noopener'},'Altitudini · Terrain Tiles')),panelFooter());
shell.stage.classList.add('bdl-city-stage');
const supportView=button({label:'Supporto',onClick:()=>{if(result?.stand){previewPart=previewPart==='stand'?'map':'stand';showModel();}}});
const trayView=button({label:'Base',onClick:()=>{if(result?.tray){previewPart=previewPart==='tray'?'map':'tray';showModel();}}});
trayView.hidden=true;
const mountView=button({label:'Fissaggio',onClick:()=>{if(result?.mount){previewPart=previewPart==='mount'?'map':'mount';showModel();}}});
supportView.hidden=true;mountView.hidden=true;
shell.stageTools.append(iconButton({label:'Vista 3D',icon:ICONS.iso,onClick:()=>viewer.setView('iso')}),
  iconButton({label:'Vista dall’alto',icon:ICONS.top,onClick:()=>viewer.setView('top')}),
  button({label:'Quote',onClick:()=>{showDimensions=!showDimensions;quotes.setEnabled(showDimensions);quoteButton.setAttribute('aria-pressed',String(showDimensions));}}),supportView,mountView,trayView);
const quoteButton=supportView.previousElementSibling!;
quoteButton.setAttribute('aria-pressed','true');
function assembledParts(model:Result){
  const mapParts=model.placedMarkers?[...model.parts,model.placedMarkers]:model.parts;
  if(!model.tray)return mapParts;
  return [...(model.trayPreview??[model.tray]),...mapParts.map(part=>{
    const positions=part.mesh.positions.slice();
    for(let i=2;i<positions.length;i+=3)positions[i]+=model.trayFloor;
    return {...part,mesh:{...part.mesh,positions}};
  })];
}
function showModel(){
  if(!result)return;
  const accessory=previewPart==='stand'?result.stand:previewPart==='mount'?result.mount:previewPart==='tray'?result.tray:undefined;
  const shown=accessory?(previewPart==='tray'?result.trayPreview??[accessory]:[accessory]):assembledParts(result);
  viewer.setParts(shown,{refit:true});quotes.setBox(bounds(shown));
  supportView.textContent=previewPart==='stand'?'Mappa':'Supporto';
  mountView.textContent=previewPart==='mount'?'Mappa':'Fissaggio';
  trayView.textContent=previewPart==='tray'?'Mappa':'Base';
}
syncControls();
function schedule(){
  writeHashState({...area,...settings,terrain},defaults);
  if(!data)return;
  revision++;result=undefined;exports.forEach(b=>b.disabled=true);
  shell.setStatus('Calcolo il modello…','busy');
  clearTimeout(timer);timer=setTimeout(build,160);
}
function build(){
  if(!data)return;
  if(working){pending=true;return;}
  pending=false;working=true;
  const id=revision,design={...settings},region=selectedArea(),source=data,dem=terrain?altitudes:undefined;
  void sendBuild(id,design,region,source,dem);
}
async function sendBuild(id:number,design:typeof settings,region:Area,source:Element[],dem?:Elevation){
  const font=design.font;
  const lat=region.lat.toFixed(5)+'°',lon=region.lon.toFixed(5)+'°';
  const needsText=frameActive();
  const needsInitial=design.markerShape==='initial'&&(design.marker||!!design.extraPins.trim());
  if(needsText||needsInitial)try{await document.fonts.load((font==='Rubik'?'700 ':'')+'128px "'+font+'"');}catch{/* font di riserva */}
  if(id!==revision){working=false;if(pending)build();return;}
  try{
  const label=needsText||needsInitial?{
    title:traceText(design.label,font),subtitle:traceText(design.subtitle,font),
    coordinates:design.coordinates?traceText(lat+' / '+lon,font):undefined,
    lat:design.form==='cube'?traceText(lat,font):undefined,lon:design.form==='cube'?traceText(lon,font):undefined,
    scale:design.scaleBar?traceText((region.span<600?50:100)+' m',font):undefined,
    marker:needsInitial?traceText([...design.markerInitial.trim().toUpperCase()][0]||'A',font):undefined
  }:undefined;
  worker.postMessage({id,area:region,data:source,settings:design,elevation:dem,label,route});
  }catch(e){
    working=false;shell.setStatus(e instanceof Error?e.message:'La scritta non è disponibile.','warn');
    if(pending)build();
  }
}
worker.onmessage=(e:MessageEvent<{id:number;result?:Result;error?:string}>)=>{
  working=false;
  if(e.data.id===revision){
    if(e.data.result){
      result=e.data.result;
      if((previewPart==='stand'&&!result.stand)||(previewPart==='mount'&&!result.mount)||(previewPart==='tray'&&!result.tray))previewPart='map';
      supportView.hidden=!result.stand;supportDownload.hidden=!result.stand;
      mountView.hidden=!result.mount;mountDownload.hidden=!result.mount;
      trayView.hidden=!result.tray;trayDownload.hidden=!result.tray;markerDownload.hidden=!result.markers;
      const height=bounds(result.parts).max[2];
      for(const key of ['cut1','cut2','cut3'])ranges.get(key)?.setRange(0,Math.max(1,Math.ceil(height)));
      changes.textContent=result.changes.map(z=>'Pausa a '+z.toFixed(1)+' mm').join(' · ');
      filaments.textContent='Filamenti nel file: '+new Set(result.parts.map(part=>part.color)).size;
      showModel();
      const c=result.counts;
      coverage.textContent=c.height+' volumi con altezza registrata · '+c.levels+' da numero di piani · '+c.estimate+' stimati'+(c.omitted?' · '+c.omitted+' sotto la soglia di stampa':'')+
        (c.detached?' · '+c.detached+' frammenti isolati esclusi':'');
      syncPin();
      if(result.markerAdjusted||result.markerSkipped){
        const notes=[result.markerAdjusted?'Segnaposto spostato sul terreno libero più vicino.':'',
          result.markerSkipped?'Alcuni segnaposti non hanno una sede utilizzabile.':''].filter(Boolean);
        pinHint.textContent=[pinHint.textContent,...notes].filter(Boolean).join(' ');
      }
      refreshStatus();
    }else shell.setStatus(e.data.error??'Il modello non è disponibile.','warn');
  }
  if(pending)build();
};
worker.onerror=()=>{working=false;pending=false;shell.setStatus('Ricarica la pagina per riavviare il generatore.','warn');};
function refreshStatus(){
  if(!result)return;
  const [w,d]=printerPlate(),b=bounds(assembledParts(result));
  const fits=result.width<=w+.01&&result.depth<=d+.01||result.width<=d+.01&&result.depth<=w+.01;
  shell.setStatus(result.width.toFixed(0)+' × '+result.depth.toFixed(0)+' × '+b.max[2].toFixed(1)+' mm'+
    (fits?'':' · Supera il piatto selezionato.')+(result.counts.detached?' · Frammenti isolati esclusi.':'')+(terrain&&terrainNotice?' · '+terrainNotice:''),fits&&!result.counts.detached&&(!terrain||!terrainNotice)?'ok':'warn');
  exports.forEach(b=>b.disabled=false);
}
async function loadTerrain(){
  terrainRequest?.abort();
  const current=new AbortController();terrainRequest=current;terrainNotice='';
  const timeout=setTimeout(()=>current.abort(),10000);
  shell.setStatus('Carico le altitudini…','busy');
  try{
    const next=await fetchElevation(selectedArea(),current.signal);
    if(terrainRequest===current)altitudes=next;
  }catch{
    if(terrainRequest===current)terrainNotice='Altitudini indisponibili. Base piana.';
  }finally{
    clearTimeout(timeout);
    if(terrainRequest===current){terrainRequest=undefined;schedule();}
  }
}
async function generateArea(){
  request?.abort();const current=new AbortController();request=current;const selected=selectedArea();
  const timeout=setTimeout(()=>current.abort(),35000);
  revision++;result=undefined;data=undefined;coverage.textContent='';
  exports.forEach(b=>b.disabled=true);generate.disabled=true;shell.setStatus('Scarico i dati della mappa…','busy');
  try {
    const isExample=selected.lat===FLORENCE.lat&&selected.lon===FLORENCE.lon&&selected.span<=900;
    let next:Element[]|undefined;
    if(isExample){
      const local=await fetch('../city-data/florence.json',{signal:current.signal});
      if(local.ok)next=parseData(await local.json());
    }
    next??=await fetchArea(selected,current.signal,()=>{
      if(request===current)shell.setStatus('Provo una fonte cartografica alternativa…','busy');
    });
    if(request!==current)return;
    if(!next.length)throw new Error('Nessun elemento mappato in questa area. Sposta o amplia la selezione.');
    data=next;
    if(terrain&&!altitudes)await loadTerrain();else schedule();
  }catch(error){
    if(request===current)shell.setStatus(current.signal.aborted?'Il servizio cartografico ha impiegato troppo tempo. Riprova.':
      error instanceof Error?error.message:'Dati cartografici non disponibili.','warn');
  }finally{
    clearTimeout(timeout);
    if(request===current){request=undefined;generate.disabled=false;}
  }
}
importFile.addEventListener('change',async()=>{
  const file=importFile.files?.[0];if(!file)return;
  const version=revision;
  try{
    if(file.size>24_000_000)throw new Error('Il file supera 24 MB. Riduci l’area.');
    const next=parseData(JSON.parse(await file.text()));
    if(version!==revision)return;
    if(!next.length)throw new Error('Il file non contiene elementi cartografici.');
    request?.abort();request=undefined;generate.disabled=false;
    data=next;
    if(terrain&&!altitudes)await loadTerrain();else schedule();
  }catch(error){
    if(version===revision)shell.setStatus(error instanceof Error?error.message:'File cartografico non valido.','warn');
  }finally{importFile.value='';}
});
const stl=()=>{
  const bytes=toSTL([result!.solid]);
  bytes.set(strToU8('OpenStreetMap contributors | https://www.openstreetmap.org/copyright'));
  return bytes;
};
const threeMF=()=>to3MF(result!.parts,{title:'Mappa urbana · '+ATTRIBUTION+(terrain&&altitudes?' · '+TERRAIN_SOURCE:''),printProfile:false});
const supportDownload=button({label:'Supporto STL',onClick:()=>{
  if(result?.stand)download(toSTL([result.stand]),'supporto-mappa.stl');
}});
supportDownload.hidden=true;
const markerDownload=button({label:'Segnaposti STL',onClick:()=>{
  if(result?.markers)download(toSTL([result.markers]),'segnaposti-mappa.stl');
}});
markerDownload.hidden=true;
const trayDownload=button({label:'Base STL',onClick:()=>{
  if(result?.tray)download(toSTL([result.tray]),'base-mappa.stl');
}});
trayDownload.hidden=true;
const mountDownload=button({label:'Fissaggio STL',onClick:()=>{
  if(result?.mount)download(toSTL([result.mount]),'fissaggio-mappa.stl');
}});
mountDownload.hidden=true;
for(const [label,run]of [
  ['STL',()=>download(stl(),'mappa-urbana.stl')],
  ['3MF a colori',()=>download(threeMF(),'mappa-urbana.3mf')],
  ['Scarica kit',()=>{
    const entries:Record<string,Uint8Array>={'mappa-urbana.stl':stl(),'mappa-urbana.3mf':threeMF(),
      'FONTE.txt':strToU8(ATTRIBUTION+'\n'+(terrain&&altitudes?TERRAIN_SOURCE:'Base piana')+
        '\nCentro: '+area.lat+', '+area.lon+'\nArea: '+extent(area).join(' × ')+' m\nLe altezze senza dati sono stime.\n')};
    if(result?.markers)entries['segnaposti-mappa.stl']=toSTL([result.markers]);
    if(result?.tray)entries['base-mappa.stl']=toSTL([result.tray]);
    if(result?.stand)entries['supporto-mappa.stl']=toSTL([result.stand]);
    if(result?.mount)entries['fissaggio-mappa.stl']=toSTL([result.mount]);
    if(result?.changes.length)entries['CAMBI-FILAMENTO.txt']=strToU8(result.changes.map((z,i)=>
      'Cambio '+(i+1)+' a '+z.toFixed(2)+' mm').join('\n'));
    download(zipSync(entries),'mappa-urbana.zip');
  }],
] as const){
  const b=button({label,onClick:()=>{if(result)run();}});b.disabled=true;exports.push(b);shell.exportBar.append(b);
}
shell.exportBar.append(trayDownload,markerDownload,supportDownload,mountDownload);
syncArea();
shell.setStatus('Genera il modello per questa selezione.','ok');
onPrinterChange(refreshStatus);
if(new URLSearchParams(location.search).get('progetto')==='1')void generateArea();
