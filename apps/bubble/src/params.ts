export const STYLES = [['round','Tondo'],['chunky','Massiccio'],['soft','Morbido'],['wide','Largo'],['balloon','Palloncino']] as const;
export const TEXTURES = [['felt','Feltro'],['knit','Maglia'],['cable','Trecce'],['boucle','Bouclé'],['ribbed','Maglia a coste'],['corduroy','Velluto a coste'],['quilt','Trapuntato'],['waffle','Nido a quadretti'],['dots','Pois'],['pebbled','Ciottoli'],['hammered','Martellato'],['smooth','Liscio']] as const;
export const MOUNTS = [['stand','Piedistallo rimovibile'],['keyhole','Asola per vite'],['sawtooth','Dentellato'],['adhesive','Sede adesiva'],['magnet','Magneti'],['none','Nessuno']] as const;
export interface Params {
  [key:string]: string|number|boolean;
  text:string; style:string; height:number; thickness:number; inflate:number;
  texture:string; textureScale:number; textureDepth:number; colors:string;
  mount:string; lean:number; standThickness:number; tolerance:number; keyholes:number;
  magnetDiameter:number; magnetThickness:number; magnets:number;
  margin:number; rotate:boolean; roundBed:boolean;
}
export const DEFAULTS:Params = {
  text:'JOY',style:'round',height:80,thickness:14,inflate:55,
  texture:'knit',textureScale:4.2,textureDepth:.55,colors:'#ff4b16,#87bdd0,#f2cc55',
  mount:'stand',lean:10,standThickness:3.2,tolerance:.2,keyholes:0,
  magnetDiameter:8,magnetThickness:3,magnets:2,
  margin:6,rotate:true,roundBed:false,
};
export function sanitize(input:Partial<Params>):Params {
  const p={...DEFAULTS,...input};
  const number=(key:keyof Params,min:number,max:number)=> {
    const value=Number(p[key]); return Math.max(min,Math.min(max,Number.isFinite(value)?value:Number(DEFAULTS[key])));
  };
  const choice=(value:string,options:readonly (readonly [string,string])[],fallback:string)=>options.some(([id])=>id===value)?value:fallback;
  return {...DEFAULTS,
    text:String(p.text).normalize('NFC').replace(/[\p{C}]/gu,'').slice(0,32),
    style:choice(p.style,STYLES,'round'),height:number('height',15,500),thickness:number('thickness',4,60),inflate:number('inflate',0,100),
    texture:choice(p.texture,TEXTURES,'smooth'),textureScale:number('textureScale',1.5,15),textureDepth:number('textureDepth',0,2),
    colors:String(p.colors).split(',').slice(0,32).map(color=>/^#[\da-f]{6}$/i.test(color)?color:'#ff4b16').join(','),
    mount:choice(p.mount,MOUNTS,'none'),lean:number('lean',0,20),standThickness:number('standThickness',2,6),
    tolerance:number('tolerance',.1,.6),keyholes:Math.round(number('keyholes',0,2)),
    magnetDiameter:number('magnetDiameter',3,20),magnetThickness:number('magnetThickness',1,8),magnets:Math.round(number('magnets',1,4)),
    margin:number('margin',5,20),rotate:p.rotate===true,roundBed:p.roundBed===true,
  };
}
