import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const code=readFileSync(new URL('../public/analytics.js',import.meta.url),'utf8');
async function trial(overrides={}) {
 const scripts=[]; let fetches=0;
 const document={currentScript:{src:'https://betta-design-lab.github.io/analytics.js'},title:'Portachiavi',referrer:'https://example.com/private?email=test@example.com',querySelector:()=>null,createElement:()=>({attributes:{},setAttribute(k,v){this.attributes[k]=v;}}),head:{appendChild:s=>scripts.push(s)}};
 const config={enabled:true,endpoint:'https://test.goatcounter.com/count',hostname:'betta-design-lab.github.io',...overrides.config};
 await runInNewContext(code,{URL,document,location:{hostname:overrides.hostname??'betta-design-lab.github.io',pathname:'/keychain/',search:'?email=private',hash:'#text=private'},fetch:async()=>{fetches++;if(overrides.error)throw Error('offline');return{ok:true,json:async()=>config};}});
 return {scripts,fetches};
}
let r=await trial(); assert.equal(r.scripts.length,1);
const settings=JSON.parse(r.scripts[0].attributes['data-goatcounter-settings']);
assert.equal(settings.path,'/keychain/');assert.equal(settings.referrer,'https://example.com');assert.equal(settings.no_events,true);
assert.equal(JSON.stringify(settings).includes('private'),false);
r=await trial({hostname:'localhost'});assert.equal(r.fetches,0);
for (const config of [{enabled:false},{endpoint:''},{endpoint:'https://evil.example/count'},{hostname:'different.example'}]) assert.equal((await trial({config})).scripts.length,0);
assert.equal((await trial({error:true})).scripts.length,0);
const saved=JSON.parse(readFileSync(new URL('../public/analytics-config.json',import.meta.url),'utf8'));assert.equal(saved.enabled,true);assert.equal(saved.endpoint,'https://bettadesignlab.goatcounter.com/count');
console.log('Statistiche: attivazione, esclusione localhost, dati ridotti e guasti verificati.');
