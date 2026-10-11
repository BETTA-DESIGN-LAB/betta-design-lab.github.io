import {readFileSync, existsSync, readdirSync} from 'node:fs';
import {resolve, dirname} from 'node:path';
import assert from 'node:assert/strict';
const root=resolve(import.meta.dirname,'..');
const dist=resolve(root,'dist');
const registry=JSON.parse(readFileSync(resolve(root,'generators.json'),'utf8'));
const live=registry.generators.filter(g=>g.status!=='planned');
assert.equal(new Set(registry.generators.map(g=>g.id)).size,registry.generators.length,'ID duplicato');
for(const page of ['index.html',...live.map(g=>g.id+'/index.html')]){
 const path=resolve(dist,page), html=readFileSync(path,'utf8');
 assert.match(html,/<html lang="it"/,'Lingua della pagina mancante: '+page);
 assert.match(html,/<noscript>/,'Indicazioni senza JavaScript mancanti: '+page);
 for(const match of html.matchAll(/(?:src|href)="([^"#]+)"/g)){
  const link=match[1];if(/^(https?:|data:)/.test(link))continue;
  assert.ok(existsSync(resolve(dirname(path),link.split('?')[0])),'Risorsa mancante: '+page+' → '+link);
 }
}
const assets=readdirSync(resolve(dist,'assets'));
assert.ok(assets.some(f=>f.endsWith('.wasm')),'Motore 3D non incluso');
assert.ok(assets.filter(f=>/^worker-.*\.js$/.test(f)).length>=3,'Worker non inclusi');
assert.ok(assets.some(f=>/^guida-montaggio-.*\.pdf$/.test(f)),'Guida lampade non inclusa');
for(const asset of assets.filter(f=>f.endsWith('.js'))){
 const content=readFileSync(resolve(dist,'assets',asset),'utf8');
 for(const match of content.matchAll(/["'](\.\.?\/[^"']+\.(?:wasm|pdf|js))["']/g))
  assert.ok(existsSync(resolve(dist,'assets',match[1])),'Risorsa dinamica mancante: '+asset+' → '+match[1]);
}
console.log(`Release: home e ${live.length} generatori, collegamenti locali, worker, WASM e guida lampade verificati.`);
