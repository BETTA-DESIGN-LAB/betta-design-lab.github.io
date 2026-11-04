import {el,button} from '@bdl/ui-kit';
import {type Part} from '@bdl/geometry';
import type {Params} from './params.ts';
import content from './guide-content.json';
import pdfUrl from '../guida-thermoform.pdf?url';
export {pdfUrl};
const esc=(s:string)=>s.replace(/[<>&"']/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;'}[c]!));
const shapeNames:Record<string,string>={ghost:'Fantasmino',pumpkin:'Zucca',heart:'Cuore',star:'Stella',round:'Tonda',svg:'SVG personalizzato',stl:'Profilo STL'};
export function configuration(p:Params){return `${shapeNames[p.shape]} · ${p.width} × ${p.height} mm · bombatura ${p.dome} mm per metà · spessore ${p.sheet} mm · trama ${p.pattern==='solid'?'Piena':p.pattern==='grid'?'Griglia':'Diagonale'} · gioco ${p.clearance} mm`;}
/** Vista dall'alto della sagoma realmente generata, inclusi trama e linguetta. */
export function sheetIllustration(part?:Part):string{
 if(!part)return '';
 const {positions:v,indices:idx}=part.mesh;
 let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity,maxZ=-Infinity;
 for(let i=0;i<v.length;i+=3){minX=Math.min(minX,v[i]);maxX=Math.max(maxX,v[i]);minY=Math.min(minY,v[i+1]);maxY=Math.max(maxY,v[i+1]);maxZ=Math.max(maxZ,v[i+2]);}
 const paths:string[]=[];
 for(let i=0;i<idx.length;i+=3){const a=idx[i]*3,b=idx[i+1]*3,c=idx[i+2]*3;
  if([a,b,c].every(j=>Math.abs(v[j+2]-maxZ)<.0001))paths.push(`M${v[a].toFixed(3)} ${(-v[a+1]).toFixed(3)}L${v[b].toFixed(3)} ${(-v[b+1]).toFixed(3)}L${v[c].toFixed(3)} ${(-v[c+1]).toFixed(3)}Z`);
 }
 return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX-3} ${-maxY-3} ${maxX-minX+6} ${maxY-minY+6}" width="200" height="160" role="img" aria-label="La sagoma fronte scelta, vista dall’alto"><path d="${paths.join('')}" fill="#ff4b16"/></svg>`;
}
export function guideText(p:Params){return `BETTA DESIGN LAB · THERMOFORM\nGUIDA DI FORMATURA E MONTAGGIO\n\n${configuration(p)}\n\nGLI OTTO PEZZI\n${content.parts.map(a=>a.join(' · ')).join('\n')}\n\n${content.steps.map(([title,text],i)=>`${i+1}. ${title}\n${text}`).join('\n\n')}\n\nPRIMA DI INIZIARE\n${content.notes.join('\n\n')}\n\nFonti consultate il 3 novembre 2026; sequenza adattata al kit Betta Design Lab.\n${content.sources.map(a=>a.join(': ')).join('\n')}`;}
export function guideHtml(p:Params,front?:Part){return `<!doctype html><html lang="it"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Guida Thermoform · Betta Design Lab</title><style>body{font:17px/1.6 system-ui,sans-serif;max-width:820px;margin:auto;padding:32px;color:#222}h1,h2{line-height:1.15}h1{color:#df3c0c}section{border-top:1px solid #ddd;padding:16px 0}aside{background:#fff3e8;padding:20px}svg{display:block;margin:auto}@media print{section{break-inside:avoid}}</style><h1>Thermoform</h1><p>Guida alla tua configurazione · Betta Design Lab</p><p>${esc(configuration(p))}</p>${sheetIllustration(front)}<h2>Gli otto pezzi</h2>${content.parts.map(([n,t,d])=>`<p><strong>${n} · ${esc(t)}</strong><br>${esc(d)}</p>`).join('')}<h2>Passo dopo passo</h2>${content.steps.map(([t,d],i)=>`<section><h3>${i+1}. ${esc(t)}</h3><p>${esc(d)}</p></section>`).join('')}<aside>${content.notes.map(t=>`<p>${esc(t)}</p>`).join('')}</aside><h2>Fonti del procedimento</h2>${content.sources.map(([t,u])=>`<p><a href="${esc(u)}">${esc(t)}</a></p>`).join('')}<p>Sequenza adattata al nostro kit. Schemi generali illustrati nel PDF incluso.</p></html>`;}
export function guidePanel(p:Params,onPdf:()=>void,front?:Part){
 return el('details',{},el('summary',{},'Come si usa · guida illustrata'),el('p',{class:'bdl-hint'},configuration(p)),el('div',{html:sheetIllustration(front)}),button({label:'Apri guida PDF illustrata',onClick:onPdf}),...content.parts.map(([n,t,d])=>el('p',{},el('strong',{},`${n} · ${t}`),el('br'),d)),...content.steps.map(([t,d],i)=>el('div',{},el('h3',{},`${i+1}. ${t}`),el('p',{class:'bdl-hint'},d))),...content.notes.map(t=>el('p',{class:'bdl-hint'},t)));
}
