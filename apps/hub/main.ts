import '@bdl/ui-kit/style.css';
import './hub.css';
import { BRAND } from '@bdl/brand';
import { el, initTheme, themeToggle, brandLogo } from '@bdl/ui-kit';
import registry from '../../generators.json';

interface Entry { id: string; name: string; status: 'live' | 'beta' | 'planned'; category: string; blurb: string; }

// Icone editoriali piatte: oggetti riconoscibili, senza viste tecniche o quote.
const a = (d: string) => `<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const ART: Record<string, string> = {
  coaster: a('<circle cx="32" cy="32" r="23"/><circle cx="32" cy="32" r="16"/><path d="M25 33c0-9 14-9 14 0M28 40h8"/>'),
  keychain: a('<circle cx="21" cy="21" r="11"/><path d="M29 29l8-8 18 18-16 16-18-18z"/><circle cx="37" cy="35" r="2"/>'),
  keycap: a('<rect x="10" y="10" width="44" height="44" rx="14"/><rect x="19" y="19" width="26" height="26" rx="8"/><path d="M27 32h10M32 27v10"/>'),
  magnet: a('<path d="M14 12h11v22a7 7 0 0 0 14 0V12h11v22a18 18 0 0 1-36 0z"/><path d="M14 22h11M39 22h11"/>'),
  box: a('<rect x="10" y="23" width="44" height="31" rx="8"/><rect x="8" y="12" width="48" height="12" rx="6"/><path d="M26 33h12"/>'),
  vase: a('<path d="M24 10h16l-2 9c-1 7 10 14 10 23 0 9-7 13-16 13s-16-4-16-13c0-9 11-16 10-23z"/><path d="M24 43c5 3 11 3 16 0"/>'),
  tray: a('<rect x="8" y="15" width="48" height="34" rx="12"/><rect x="16" y="23" width="32" height="18" rx="6"/>'),
  kitchen: a('<path d="M16 9v17c0 6 12 6 12 0V9M22 9v46M45 9c-8 0-8 21 0 21V55M45 9v21"/>'),
  'desk-organizer': a('<rect x="10" y="27" width="44" height="27" rx="8"/><path d="M21 27V12h7v15M38 27V17l4-7 4 7v10M32 28v25"/>'),
};

initTheme();
const entries = (registry.generators as Entry[]).slice().sort((x, y) => Number(x.status === 'planned') - Number(y.status === 'planned'));

const card = (g: Entry) => {
  const live = g.status !== 'planned';
  const body = [
    el('span', { class: 'hub-badge', 'data-kind': live ? 'live' : 'planned' }, g.status === 'beta' ? 'Beta' : live ? 'Disponibile' : 'In arrivo'),
    el('div', { class: 'hub-art' }, el('span', {class:'hub-product-icon', html: ART[g.id] ?? ART.tray})),
    el('div', { class: 'hub-body' },
      el('span', { class: 'hub-cat' }, g.category),
      el('span', { class: 'hub-name' }, g.name),
      el('span', { class: 'hub-blurb' }, g.blurb),
      live ? el('span', {class:'hub-card-action'}, 'Inizia a creare', el('span', {'aria-hidden':'true'}, '↗')) : null),
  ];
  return live
    ? el('a', { class: 'hub-card', href: `./${g.id}/`, 'data-status': g.status }, ...body)
    : el('div', { class: 'hub-card', 'data-status': g.status, 'aria-disabled': 'true' }, ...body);
};

const liveCount = entries.filter((g) => g.status !== 'planned').length;
document.body.append(
  el('header', { class: 'bdl-topbar' },
    brandLogo('./'),
    el('span', { class: 'bdl-spacer' }),
    themeToggle()),
  el('main', { class: 'hub' },
    el('section', { class: 'hub-hero' },
      el('div', {class:'hub-hero-copy'},
        el('span', {class:'hub-eyebrow'}, 'Il tuo spazio creativo'),
        el('h1', {}, 'Dai forma', el('br'), 'alle tue ', el('span', {}, 'idee.')),
        el('p', {}, BRAND.tagline),
        el('a', {class:'bdl-btn', 'data-variant':'primary', href:'#generatori'}, 'Scopri i generatori', el('span', {'aria-hidden':'true'}, '↓')),
        el('div', { class: 'hub-facts' },
          el('span', { class: 'hub-fact' }, 'Senza account'),
          el('span', { class: 'hub-fact' }, 'Gratis per uso personale'),
          el('span', { class: 'hub-fact' }, 'STL e 3MF'))),
      el('div', {class:'hub-brand-card'},
        el('img', {src:`./${BRAND.logo}`, alt:'Betta Design Lab 3D · logo ufficiale', width:1774, height:887}),
        el('span', {class:'hub-brand-caption'}, 'Creatività che prende forma.'))),
    el('div', {class:'hub-grid-heading', id:'generatori'},
      el('div', {}, el('span', {class:'hub-eyebrow'}, 'La suite'), el('h2', {}, 'Cosa vuoi creare oggi?')),
      el('span', {class:'hub-count'}, `${liveCount} generatori disponibili`)),
    el('section', { class: 'hub-grid', 'aria-label': 'Generatori' }, ...entries.map(card)),
    el('footer', { class: 'hub-footer' }, `© ${BRAND.year} ${BRAND.name}. ${BRAND.license.free} ${BRAND.license.commercial}`)),
);
