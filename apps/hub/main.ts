import '@bdl/ui-kit/style.css';
import './hub.css';
import { BRAND } from '@bdl/brand';
import { el, initTheme, themeToggle, brandLogo, usageHelp, printerButton, button } from '@bdl/ui-kit';
import registry from '../../generators.json';

interface Entry { id: string; name: string; status: 'live' | 'beta' | 'planned'; category: string; blurb: string; }

// Icone editoriali piatte: oggetti riconoscibili, senza viste tecniche o quote.
const a = (d: string) => `<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const ART: Record<string, string> = {
  "image-svg": a('<rect x="9" y="9" width="46" height="46" rx="10"/><circle cx="24" cy="24" r="5"/><path d="M13 46l13-13 9 9 9-17 8 21"/>'),
  christmas: a('<circle cx="32" cy="37" r="20"/><rect x="25" y="12" width="14" height="7" rx="2"/><path d="M28 12V8a4 4 0 0 1 8 0v4M32 26v22M23 31l18 12M23 43l18-12"/>'),
  coaster: a('<circle cx="32" cy="32" r="23"/><circle cx="32" cy="32" r="16"/><path d="M25 33c0-9 14-9 14 0M28 40h8"/>'),
  keychain: a('<circle cx="21" cy="21" r="11"/><path d="M29 29l8-8 18 18-16 16-18-18z"/><circle cx="37" cy="35" r="2"/>'),
  keycap: a('<rect x="10" y="10" width="44" height="44" rx="14"/><rect x="19" y="19" width="26" height="26" rx="8"/><path d="M27 32h10M32 27v10"/>'),
  magnet: a('<path d="M14 12h11v22a7 7 0 0 0 14 0V12h11v22a18 18 0 0 1-36 0z"/><path d="M14 22h11M39 22h11"/>'),
  box: a('<rect x="10" y="23" width="44" height="31" rx="8"/><rect x="8" y="12" width="48" height="12" rx="6"/><path d="M26 33h12"/>'),
  lamp: a('<path d="M20 10h24l10 29H10zM32 39v13M22 54h20"/><path d="M24 19l-4 15M32 18v16M40 19l4 15"/>'),
  stamp: a('<path d="M15 42h34v10H15zM12 55h40M23 42l4-14h10l4 14M25 22a7 7 0 1 1 14 0c0 4-4 5-4 9h-6c0-4-4-5-4-9z"/>'),
  thermoform: a('<path d="M10 43h44v10H10zM16 43c0-25 32-25 32 0M12 13h40v8H12zM20 21c0 13 24 13 24 0"/><path d="M28 36h8M32 32v8"/>'),
  vase: a('<path d="M24 10h16l-2 9c-1 7 10 14 10 23 0 9-7 13-16 13s-16-4-16-13c0-9 11-16 10-23z"/><path d="M24 43c5 3 11 3 16 0"/>'),
  tray: a('<rect x="8" y="15" width="48" height="34" rx="12"/><rect x="16" y="23" width="32" height="18" rx="6"/>'),
  kitchen: a('<path d="M16 9v17c0 6 12 6 12 0V9M22 9v46M45 9c-8 0-8 21 0 21V55M45 9v21"/>'),
  'desk-organizer': a('<rect x="10" y="27" width="44" height="27" rx="8"/><path d="M21 27V12h7v15M38 27V17l4-7 4 7v10M32 28v25"/>'),
};


// Immagini illustrative generate: non fotografie di stampe collaudate.
const PHOTO_ALT:Record<string,string>={
 keychain:'Esempio illustrativo di portachiavi Betta arancione e bianco con anello metallico',
 lamp:'Esempio illustrativo di lampada avorio a spirale con base scura',
 box:'Esempio illustrativo di scatola scura con cassetto arancione',
 coaster:'Esempio illustrativo di sottobicchieri arancioni con onde avorio',
 christmas:'Esempio illustrativo di pallina a spirale e fiocco di neve',
 vase:'Esempio illustrativo di vaso avorio con pareti a spirale',
 keycap:'Esempio illustrativo di fidget clicker con switch MX e pulsanti',
 stamp:'Esempio illustrativo di timbro con manico arancione e piastra con foglia',
 'desk-organizer':'Esempio illustrativo di organizer con scomparti indipendenti',
 thermoform:'Esempio illustrativo di kit per termoformatura a forma di fantasma',
 'city-map':'Render del plastico 3D di Firenze con il Duomo in rilievo',
 'image-svg':'Esempio illustrativo di disegno di foglie e decorazione stampata'
};
const product=(id:string,eager=false)=>'<img src="./home-products/'+id+'.webp" alt="'+PHOTO_ALT[id]+'" width="800" height="800" loading="'+(eager?'eager':'lazy')+'" decoding="async">';
initTheme();
const order=['keychain','box','lamp','coaster','christmas','vase','keycap','stamp','desk-organizer','thermoform','image-svg'];
const entries=(registry.generators as Entry[]).filter(g=>g.status!=='planned').sort((x,y)=>order.indexOf(x.id)-order.indexOf(y.id));
const planned=(registry.generators as Entry[]).filter(g=>g.status==='planned');
const filters=el('div',{class:'hub-filters','aria-label':'Filtra i generatori'});
const grid=el('section',{class:'hub-grid','aria-label':'Generatori'});
const count=el('p',{class:'hub-count','aria-live':'polite'});
let selectedCategory='Tutti';
const filterButtons:HTMLButtonElement[]=[];
const card=(g:Entry)=>el('a',{class:'hub-card',href:'./'+g.id+'/'},
 el('div',{class:'hub-art','data-product':g.id},el('span',{class:'hub-badge','data-kind':g.status},g.status==='beta'?'In prova':'Disponibile'),el('span',{class:'hub-object',html:product(g.id)})),
 el('div',{class:'hub-body'},el('span',{class:'hub-cat'},g.category),el('h3',{class:'hub-name'},g.name),el('p',{class:'hub-blurb'},g.blurb),
 el('span',{class:'hub-card-action'},'Personalizza',el('span',{'aria-hidden':'true'},'↗'))));
function filter(category:string){
 selectedCategory=category;
 const visible=entries.filter(g=>category==='Tutti'||g.category===category);
 grid.replaceChildren(...visible.map(card));count.textContent=visible.length+' generatori'+(category==='Tutti'?' da esplorare':' · '+category);
 filterButtons.forEach(b=>b.setAttribute('aria-pressed',String(b.textContent===selectedCategory)));
}
for(const label of ['Tutti',...new Set(entries.map(g=>g.category))]){
 const b=button({label,onClick:()=>filter(label)});b.setAttribute('aria-pressed',String(label==='Tutti'));filterButtons.push(b);filters.append(b);
}
const quick=(id:string,label:string,tag:string)=>el('a',{href:'./'+id+'/',class:'hub-showcase-item','data-product':id},
 el('span',{class:'hub-object',html:product(id,true)}),el('span',{class:'hub-showcase-label'},el('strong',{},label),el('span',{},tag),el('span',{'aria-hidden':'true'},'↗')));
const services=el('section',{class:'hub-services',id:'servizi'},
 el('div',{},el('span',{class:'hub-eyebrow'},'Il tuo prossimo passo'),el('h2',{},'Dall’idea alla stampa.'),el('p',{},'Crea liberamente per te. Se vuoi vendere gli oggetti che realizzi, scopri come funziona l’uso commerciale.')),
 el('div',{class:'hub-service-copy'},el('h3',{},'Uso personale e commerciale'),el('p',{},BRAND.license.free+' '+BRAND.license.commercial),
 el('p',{class:'bdl-hint'},'La licenza riguarda la vendita delle stampe. Il download del modello non include una licenza commerciale.')));
if(BRAND.urls.support)services.append(el('a',{class:'bdl-btn',href:BRAND.urls.support},'Richiedi la licenza via email'));
const contactIcon=(path:string)=>el('span',{class:'hub-contact-icon',html:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+path+'</svg>'});
const contactLink=(label:string,detail:string,href:string,path:string,external=false)=>el('a',{class:'hub-contact-card',href,...(external?{target:'_blank',rel:'noopener noreferrer'}:{})},
 contactIcon(path),el('span',{},el('strong',{},label),el('span',{class:'hub-contact-detail'},detail)),el('span',{'aria-hidden':'true'},external?'↗':'→'));
const contacts=el('section',{class:'hub-contacts',id:'contatti','aria-labelledby':'contact-heading'},
 el('div',{},el('span',{class:'hub-eyebrow'},'Parliamone'),el('h2',{id:'contact-heading'},'Restiamo in contatto.'),el('p',{},'Dubbi sui generatori, richieste di stampa o licenza commerciale? Scrivici. Sui social trovi idee, novità e progetti.')),
 el('div',{class:'hub-contact-links'},
 contactLink('Scrivici',BRAND.email,BRAND.urls.support,'<rect x="3" y="5" width="18" height="14" rx="3"/><path d="m4 7 8 6 8-6"/>'),
 contactLink('Instagram','@betta_design_lab__3d',BRAND.urls.instagram,'<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r=".5" fill="currentColor"/>',true),
 contactLink('TikTok','@filippobettarini10',BRAND.urls.tiktok,'<path d="M14 3v12.5a4.5 4.5 0 1 1-4-4.47M14 3c.6 3.5 2.5 5 6 5"/>',true)));
document.body.append(
 el('header',{class:'bdl-topbar'},brandLogo('./'),el('nav',{class:'hub-nav','aria-label':'Navigazione principale'},el('a',{href:'#generatori'},'Generatori'),el('a',{href:'#come-funziona'},'Come funziona'),el('a',{href:'#servizi'},'Uso e licenza'),el('a',{href:'#contatti'},'Contatti')),el('span',{class:'bdl-spacer'}),printerButton(true),themeToggle()),
 el('main',{class:'hub'},
  el('section',{class:'hub-hero'},
   el('div',{class:'hub-hero-copy'},el('span',{class:'hub-eyebrow'},'Un oggetto. Il tuo stile.'),el('h1',{},'Le tue idee,',el('br'),'in ',el('span',{},'forma.')),
    el('p',{},'Portachiavi, oggetti per la casa e piccoli dettagli da rendere tuoi. Scegli un modello, personalizzalo e scarica il file per la stampa 3D.'),
    el('div',{class:'hub-hero-actions'},el('a',{class:'bdl-btn','data-variant':'primary',href:'#generatori'},'Trova il tuo prossimo progetto',el('span',{'aria-hidden':'true'},'↓')),el('a',{class:'hub-text-link',href:'#come-funziona'},'Come funziona')),
    el('div',{class:'hub-facts'},el('span',{},'Senza account'),el('span',{},'Uso personale gratuito'),el('span',{},'File STL e 3MF'))),
   el('div',{class:'hub-showcase','aria-label':'Esempi di oggetti da personalizzare'},
    quick('lamp','Una luce tutta tua','Lampade'),quick('keychain','Un nome da portare con te','Portachiavi'),quick('box','Ogni cosa al suo posto','Scatole e organizer'),
    el('p',{class:'hub-illustration-note'},'Immagini illustrative generate con IA · il risultato varia con la configurazione'))),
  el('section',{class:'hub-steps',id:'come-funziona','aria-label':'Come funziona'},
   ...[['01','Scegli','Parti dall’oggetto che vuoi creare.'],['02','Personalizza','Misure, forme e dettagli, con anteprima 3D.'],['03','Stampa','Scarica il file e preparalo nel tuo slicer.']].map(([n,title,text])=>el('div',{},el('span',{class:'hub-step-number'},n),el('div',{},el('h2',{},title),el('p',{},text))))),
  el('div',{class:'hub-grid-heading',id:'generatori'},el('div',{},el('span',{class:'hub-eyebrow'},'Esplora la suite'),el('h2',{},'Cosa creiamo oggi?')),count),
  filters,grid,
  el('aside',{class:'hub-svg-callout'},el('span',{class:'hub-small-icon',html:ART['image-svg']}),el('div',{},el('h2',{},'Hai un logo o un disegno?'),el('p',{},'Converti un’immagine in SVG e usala nei generatori compatibili.')),el('a',{class:'bdl-btn',href:'./image-svg/'},'Prepara il tuo SVG')),
  services,contacts,
  el('details',{class:'hub-coming'},el('summary',{},'Stiamo lavorando anche a…'),el('p',{},planned.map(g=>g.name).join(' · '))),
  usageHelp(),
  el('footer',{class:'hub-footer'},el('span',{},'© '+BRAND.year+' '+BRAND.name),el('a',{href:'#generatori'},'Esplora i generatori'),el('a',{href:'#servizi'},'Uso e licenza'),el('a',{href:BRAND.urls.support},BRAND.email),el('a',{href:BRAND.urls.instagram,target:'_blank',rel:'noopener noreferrer'},'Instagram'),el('a',{href:BRAND.urls.tiktok,target:'_blank',rel:'noopener noreferrer'},'TikTok'),el('span',{},BRAND.license.free)))
);
filter('Tutti');
