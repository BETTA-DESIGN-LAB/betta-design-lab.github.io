// Usage: node --experimental-strip-types scripts/export-lamp-attachment.ts OUTPUT_DIR
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {loadManifold} from '@bdl/geometry';
import {toSTL,to3MF} from '@bdl/export';
import {zipSync} from 'fflate';
import {build,fitSamples} from '../apps/lamp/src/geometry.ts';
import {DEFAULTS} from '../apps/lamp/src/params.ts';
import {groundPart} from '../apps/coaster/src/parts.ts';
import {arrange} from '../apps/box/src/placement.ts';
const out=process.argv[2];if(!out)throw Error('Indica una cartella di output');
await mkdir(out,{recursive:true});
const M=await loadManifold(),sample=fitSamples(M,DEFAULTS.baseColor);
const parts=build(M,{...DEFAULTS,shape:'cylinder',texture:'smooth',height:70,diameter:80}).parts;
const guide=new Uint8Array(await readFile(new URL('../apps/lamp/guida-montaggio.pdf',import.meta.url)));
const files:Record<string,Uint8Array>={'Guida-montaggio.pdf':guide};
const encoder=new TextEncoder();
files['LEGGIMI.txt']=encoder.encode('ATTACCO INTEGRATO SENZA COLLA\n\nHai già la base con TRE DENTINI? Non ristamparla.\n1. Stampa SOLO fit-shade.stl e provalo sulla tua base: allinea le entrate ai tre dentini, abbassa e gira in senso orario visto dall’alto, circa 25 gradi, fino al finecorsa.\n2. fit-shade è solo una prova del bordo alto 10 mm: NON e un adattatore e NON va aggiunto al vecchio paralume.\n3. Dopo esito positivo, apri il generatore aggiornato, mantieni forma e misure desiderate e scarica Solo paralume + guida. Le guide fanno parte del paralume stampato.\n4. La base allegata serve come riferimento per chi deve stamparla da zero. Il paralume DEMO e cilindrico, diametro 80 mm, altezza 70 mm: non rappresenta necessariamente la tua lampada.\n5. Se il tuo vecchio paralume ha il bordo liscio, va rigenerato con guide integrate; non sono previsti colla o anelli separati.\n\nPrima di montare il LED prova inserimento, rotazione e ritenuta a secco. Non forzare. I controlli geometrici non sostituiscono la prova fisica.\n');
for(const p of sample)files[p.id+'.stl']=toSTL([p]);
files['base-baionetta.stl']=toSTL([groundPart(parts[0])]);
files['DEMO-paralume-cilindrico-80x70-con-guide.stl']=toSTL([groundPart(parts[1])]);
const layout=arrange(sample,180,180,{});if(layout.plates.length!==1||layout.oversized.length)throw Error('Campioni non sullo stesso piatto');
files['campioni-su-un-piatto.3mf']=to3MF(layout.plates[0],{title:'Campioni baionetta lampada',plateCenter:[90,90]});
for(const [name,data] of Object.entries(files))await writeFile(resolve(out,name),data);
await writeFile(resolve(out,'Lampada-attacco-integrato-SENZA-COLLA.zip'),zipSync(files));
// Meshes for a local engineering preview, never uploaded.
await writeFile(resolve(out,'preview-meshes.json'),JSON.stringify([...sample,...parts].map(p=>({...p,mesh:{positions:Array.from(p.mesh.positions),indices:Array.from(p.mesh.indices)}}))));
console.log('Campioni, base di riferimento, paralume DEMO con guide integrate e guida esportati in '+out);
