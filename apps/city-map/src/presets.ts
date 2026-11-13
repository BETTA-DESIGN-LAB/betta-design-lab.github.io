import type {Form} from './forms.ts';

export const PLACES=[
 {label:'Roma, Colosseo',title:'Roma',lat:41.89021,lon:12.49223},
 {label:'Venezia, San Marco',title:'Venezia',lat:45.43404,lon:12.33808},
 {label:'Firenze, Duomo',title:'Firenze',lat:43.773,lon:11.2568},
 {label:'Milano, Duomo',title:'Milano',lat:45.46417,lon:9.19179},
 {label:'Napoli, Plebiscito',title:'Napoli',lat:40.83585,lon:14.24894},
 {label:'Paris, Tour Eiffel',title:'Parigi',lat:48.85837,lon:2.29448},
 {label:'Cracovia, Piazza del Mercato',title:'Cracovia',lat:50.06172,lon:19.93730},
];
export const GIFTS:{label:string;form:Form;size:number;palette:string;marker?:boolean;keyring?:boolean;mount?:string}[]=[
 {label:'Qui ci siamo conosciuti',form:'heart',size:160,palette:'pastel',marker:true},
 {label:'La nostra prima casa',form:'rect',size:180,palette:'classic',marker:true},
 {label:'Il nostro viaggio',form:'rect',size:200,palette:'retro'},
 {label:'La mia città',form:'rect',size:200,palette:'retro'},
 {label:'Portachiavi',form:'rect',size:50,palette:'ams4',keyring:true},
 {label:'Magnete da frigo',form:'hex',size:90,palette:'classic',mount:'magnet'},
];
export const PALETTE_LABELS=[
 ['classic','Classica'],['ams4','4 colori (AMS)'],['pastel','Pastello'],['night','Notte'],['retro','Retrò'],['mono','Un colore']
] as const;
export const PALETTES:Record<string,readonly string[]>={
 classic:['#c0c0c0','#f2f2f2','#1d1d1f','#a79f90','#2e86de','#27ae60','#252729','#ffffff'],
 ams4:['#f2f2f2','#f2f2f2','#1d1d1f','#1d1d1f','#2e86de','#27ae60','#1d1d1f','#f2f2f2'],
 pastel:['#efe6d8','#fff5e9','#9a9297','#b1a7ae','#98c9d8','#a8bd9b','#c8a4a7','#fff5e9'],
 night:['#223448','#ddd8ce','#171f2d','#64748a','#345682','#536f64','#121b2b','#f8e9ce'],
 retro:['#cfba95','#f3e2c1','#765847','#a5876c','#698b95','#7e8a5e','#594539','#f3e2c1'],
 mono:Array(8).fill('#f2f2f2'),
};

export const MAP_COLORS=[
 ['Bianco','#f2f2f2'],['Nero','#1d1d1f'],['Arancione','#ef7c33'],['Rosso','#d7263d'],['Blu','#2e86de'],
 ['Verde','#27ae60'],['Giallo','#f4c430'],['Viola','#8e44ad'],['Argento','#c0c0c0'],['Beige','#d4a373'],
].map(([name,hex])=>({name,hex}));
