export type VaseProfile='smooth'|'faceted'|'wavy'|'oval'|'roundedSquare'|'star';
export type Silhouette='straight'|'sphere'|'teardrop'|'amphora'|'hourglass'|'bottle'|'tulip'|'barrel'|'bulb'|'custom';
export type Finish='none'|'ribs'|'fins'|'spiral'|'lattice'|'rings'|'waves'|'diamond'|'honeycomb'|'dots';
export interface VaseParams {
 [key:string]:string|number|boolean;
 topDiameter:number;bottomDiameter:number;height:number;wall:number;bottomThickness:number;
 profile:VaseProfile;sides:number;waveDepth:number;twist:number;drainageHole:boolean;drainageDiameter:number;color:string;
 silhouette:Silhouette;intensity:number;bellyDiameter:number;neckDiameter:number;
 finish:Finish;ribCount:number;ribDepth:number;ribWidth:number;ribShape:'round'|'sharp'|'flat';helix:number;
 patternStart:number;patternEnd:number;fade:number;textureRows:number;
}
export const SILHOUETTES:Record<Silhouette,string>={straight:'Essenziale',sphere:'Sfera',teardrop:'Goccia',amphora:'Anfora',hourglass:'Clessidra',bottle:'Bottiglia',tulip:'Tulipano',barrel:'Barile',bulb:'Bulbo',custom:'Su misura'};
export const FINISHES:Record<Finish,string>={none:'Liscio',ribs:'Canneté',fins:'Lame',spiral:'Spirale',lattice:'Reticolo',rings:'Anelli',waves:'Onde',diamond:'Diamanti',honeycomb:'Nido d’ape',dots:'Pois'};
export const DEFAULTS:VaseParams={topDiameter:120,bottomDiameter:95,height:180,wall:2.4,bottomThickness:3,profile:'smooth',sides:8,waveDepth:5,twist:0,drainageHole:false,drainageDiameter:8,color:'#1f6f78',silhouette:'straight',intensity:1,bellyDiameter:135,neckDiameter:70,finish:'none',ribCount:36,ribDepth:4,ribWidth:.45,ribShape:'round',helix:90,patternStart:0,patternEnd:100,fade:5,textureRows:16};
const clamp=(v:number,a:number,b:number)=>Math.min(b,Math.max(a,v));
export function sanitize(input:Partial<VaseParams>):VaseParams{
 const p={...DEFAULTS,...input} as VaseParams;
 const number=(k:keyof VaseParams,a:number,b:number)=>clamp(typeof p[k]==='number'&&Number.isFinite(p[k])?p[k] as number:DEFAULTS[k] as number,a,b);
 for(const [k,a,b]of [['topDiameter',20,240],['bottomDiameter',20,220],['height',60,300],['wall',.8,5],['bottomThickness',1.6,10],['sides',3,32],['waveDepth',.5,14],['twist',-180,180],['intensity',0,1.5],['bellyDiameter',30,260],['neckDiameter',20,220],['ribCount',8,96],['ribDepth',.4,12],['ribWidth',.12,.85],['helix',-360,360],['patternStart',0,95],['patternEnd',5,100],['fade',0,25],['textureRows',4,40]] as const)p[k]=number(k,a,b);
 p.sides=Math.round(p.sides);p.ribCount=Math.round(p.ribCount);p.textureRows=Math.round(p.textureRows);
 p.profile=['smooth','faceted','wavy','oval','roundedSquare','star'].includes(p.profile)?p.profile:'smooth';
 p.silhouette=Object.hasOwn(SILHOUETTES,p.silhouette)?p.silhouette:'straight';
 p.finish=Object.hasOwn(FINISHES,p.finish)?p.finish:'none';
 p.ribShape=['round','sharp','flat'].includes(p.ribShape)?p.ribShape:'round';
 p.waveDepth=Math.min(p.waveDepth,14,p.bottomDiameter/5);
 p.patternEnd=Math.max(p.patternStart+5,p.patternEnd);
 p.drainageHole=p.drainageHole===true;
 const inset=p.wall/Math.min(1,p.topDiameter/p.bottomDiameter);
 const inradius=p.bottomDiameter/2*(p.profile==='faceted'?Math.cos(Math.PI/p.sides):p.profile==='oval'?.72:p.profile==='star'?.64:1)-(p.profile==='wavy'?p.waveDepth:0);
 p.drainageDiameter=number('drainageDiameter',3,Math.max(3,2*(inradius-inset)-2));
 p.color=typeof p.color==='string'&&/^#[0-9a-f]{6}$/i.test(p.color)?p.color:DEFAULTS.color;
 return p;
}
export interface Preset {name:string;hint:string;params:Partial<VaseParams>;}
export const PRESETS:Preset[]=[
 {name:'Mezza lama',hint:'Base liscia, lame nella metà alta',params:{silhouette:'amphora',bottomDiameter:78,topDiameter:60,height:190,finish:'fins',ribCount:48,ribDepth:5,ribWidth:.35,ribShape:'sharp',patternStart:48,patternEnd:98,fade:4,helix:25,profile:'smooth',intensity:.85,twist:0}},
 {name:'Onda',hint:'Goccia con nervature avvolgenti',params:{silhouette:'teardrop',bottomDiameter:72,topDiameter:40,height:205,finish:'spiral',ribCount:40,ribDepth:4,ribShape:'round',ribWidth:.5,helix:160,patternStart:8,patternEnd:94,fade:6,profile:'smooth',intensity:1,twist:0}},
 {name:'Colonna',hint:'Lame dritte, piede e collo lisci',params:{silhouette:'straight',bottomDiameter:84,topDiameter:84,height:200,finish:'fins',ribCount:60,ribDepth:5,ribShape:'flat',ribWidth:.3,helix:0,patternStart:12,patternEnd:90,fade:3,profile:'smooth',twist:0}},
 {name:'Goccia',hint:'Volume morbido e superficie essenziale',params:{silhouette:'teardrop',bottomDiameter:65,topDiameter:35,height:180,finish:'none',profile:'smooth',intensity:1.3,twist:0}},
 {name:'Nido',hint:'Celle esagonali ampie, bordo pulito',params:{silhouette:'barrel',bottomDiameter:85,topDiameter:90,height:145,finish:'honeycomb',ribCount:12,ribDepth:2.5,ribWidth:.3,ribShape:'flat',helix:0,textureRows:8,patternStart:10,patternEnd:90,fade:4,profile:'smooth',intensity:.6,twist:0}},
 {name:'Incrocio',hint:'Nervature diagonali, rombi aperti',params:{silhouette:'sphere',bottomDiameter:65,topDiameter:55,height:165,finish:'lattice',ribCount:12,ribDepth:4,ribWidth:.2,ribShape:'round',helix:100,textureRows:12,patternStart:10,patternEnd:93,fade:4,profile:'smooth',intensity:1,twist:0}}
];
