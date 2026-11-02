import assert from 'node:assert/strict';
import {PRINTERS,validatePrinterChoice,choiceVolume,savePrinterChoice,printerPlate,printerCenter,PRINTER_KEY} from '@bdl/brand';
import {to3MF} from '@bdl/export';
import {unzipSync,strFromU8} from 'fflate';
import {arrange} from '../apps/box/src/placement.ts';
import type {Part} from '@bdl/geometry';
assert.equal(new Set(PRINTERS.map(p=>p.id)).size,PRINTERS.length);
for(const p of PRINTERS){
 assert.ok(p.source.startsWith('https://'));
 assert.ok(p.volume.every(n=>n>0&&n<=1000));
 assert.ok(p.nozzles.includes(0.4));
 assert.deepEqual(choiceVolume(validatePrinterChoice({id:p.id,nozzle:0.4})),p.volume);
}
for(const bad of [null,{}, {id:'missing',nozzle:0.4},{id:'bambu-p2s',nozzle:9},{id:'custom',nozzle:0.4,volume:[NaN,200,200]},{id:'custom',nozzle:0.4,volume:[200,200]},{id:'custom',nozzle:0.4,volume:[200,0,200]}])assert.equal(validatePrinterChoice(bad),null);
const saved=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
const store=new Map<string,string>();
Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(k:string)=>store.get(k)??null,setItem:(k:string,v:string)=>store.set(k,v),removeItem:(k:string)=>store.delete(k)}});
try{
 const parameters={width:90,depth:70,text:'Prova',svg:'disegno',x:12,y:-7};
 const before=JSON.stringify(parameters);
 savePrinterChoice({id:'bambu-h2s',nozzle:0.4});
 assert.deepEqual(printerPlate(),[340,320]);assert.deepEqual(printerCenter(),[170,160]);
 savePrinterChoice({id:'prusa-core-one',nozzle:0.4});
 assert.deepEqual(printerPlate(),[250,220]);assert.equal(JSON.stringify(parameters),before);
 const part={id:'sample',name:'Provino',color:'#ffffff',mesh:{positions:new Float32Array([-115,-40,0,115,-40,0,115,40,0,-115,40,0]),indices:new Uint32Array([0,1,2,0,2,3])}} as Part;
 assert.equal(arrange([part],...printerPlate(),{}).oversized.length,0);
 savePrinterChoice({id:'bambu-a1-mini',nozzle:0.4});
 assert.equal(arrange([part],...printerPlate(),{}).oversized.length,1);
 let archive=unzipSync(to3MF([part]));
 assert.ok(strFromU8(archive['3D/3dmodel.model']).includes('90 90 0'));
 assert.equal(archive['Metadata/project_settings.config'],undefined);
 savePrinterChoice({id:'bambu-p2s',nozzle:0.6});
 archive=unzipSync(to3MF([part]));
 assert.ok(!strFromU8(archive['Metadata/model_settings.config']).includes('layer_height'));
 savePrinterChoice({id:'custom',nozzle:0.4,volume:[400,280,450]});
 assert.deepEqual(printerCenter(),[200,140]);
 store.set(PRINTER_KEY,'broken');
 assert.deepEqual(printerPlate(220,210),[220,210]);
 savePrinterChoice(null);assert.deepEqual(printerPlate(220,210),[220,210]);
}finally{
 savePrinterChoice(null);
 if(saved)Object.defineProperty(globalThis,'localStorage',saved);else Reflect.deleteProperty(globalThis,'localStorage');
}
console.log('Stampanti: catalogo, nozzle, persistenza, dati invalidi, piatti rettangolari, limiti e 3MF verificati.');
