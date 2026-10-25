import {loadManifold} from '@bdl/geometry';
import wasmUrl from 'manifold-3d/manifold.wasm?url';
import {build,type Design} from './geometry.ts';
import type {Params} from './params.ts';
const ready=loadManifold(wasmUrl);
self.onmessage=async(e:MessageEvent<{id:number;params:Params;design:Design}>)=>{
 const {id,params,design}=e.data;try{self.postMessage({id,result:build(await ready,params,design)});}
 catch(e){self.postMessage({id,error:e instanceof Error?e.message:String(e)});}
};
