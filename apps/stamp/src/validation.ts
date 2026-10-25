import type {SvgArtwork} from '../../coaster/src/svg.ts';
/** Anche il testo tracciato contiene molti intervalli di pixel: limite per vertici. */
export function validateArtwork(value:unknown):SvgArtwork|undefined{
 if(value===undefined||value===null)return;
 const a=value as SvgArtwork;let points=0;
 if(!a||!Array.isArray(a.shapes)||!a.shapes.length||a.shapes.length>6000)throw new Error('Disegno non valido o troppo complesso.');
 for(const shape of a.shapes){if(!Array.isArray(shape)||!shape.length)throw new Error('Contorno non valido.');for(const ring of shape){if(!Array.isArray(ring)||ring.length<3)throw new Error('Contorno incompleto.');for(const pt of ring)if(++points>30000||!Array.isArray(pt)||pt.length!==2||pt.some(n=>typeof n!=='number'||!Number.isFinite(n)||Math.abs(n)>2))throw new Error('Coordinate non valide o disegno troppo complesso.');}}
 return {name:String(a.name??'Disegno').slice(0,100),shapes:a.shapes};
}
