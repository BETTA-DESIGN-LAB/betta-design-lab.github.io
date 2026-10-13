import {parseSvg,type SvgArtwork} from '../../coaster/src/svg.ts';
import {importArtwork} from '../../keycap/src/artwork.ts';

/** Gli SVG Spotify includono una tinta di fondo: il portachiavi fornisce già la base. */
export async function importMusicArtwork(file:File):Promise<SvgArtwork>{
 if(!/\.svg$/i.test(file.name))return importArtwork(file,180);
 const text=await file.text();
 const original=parseSvg(text,file.name); // Mantiene i controlli su riferimenti e contenuti non supportati.
 const doc=new DOMParser().parseFromString(text,'image/svg+xml'),root=doc.documentElement;
 const box=(root.getAttribute('viewBox')??'').trim().split(/[\s,]+/).map(Number);
 const first=root.firstElementChild;
 if(box.length!==4||!box.every(Number.isFinite)||box[2]<=0||box[3]<=0||first?.localName!=='rect'||first.hasAttribute('transform')||!first.nextElementSibling)return original;
 const values=['x','y','width','height'].map((key,i)=>Number(first.getAttribute(key)??(i<2?'0':'NaN')));
 if(!values.every((value,i)=>Math.abs(value-box[i])<0.001))return original;
 first.remove();
 return parseSvg(new XMLSerializer().serializeToString(root),file.name);
}
