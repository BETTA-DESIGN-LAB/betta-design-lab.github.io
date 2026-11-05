import {loadManifold} from '@bdl/geometry';
import wasmUrl from 'manifold-3d/manifold.wasm?url';
import {buildVase} from './geometry.ts';
import type {VaseParams} from './params.ts';
const ready=loadManifold(wasmUrl);
self.onmessage=async(e:MessageEvent<{id:number;params:VaseParams}>)=>{
 const {id,params}=e.data;
 try{const result=buildVase(await ready,params);self.postMessage({id,result});}
 catch(error){self.postMessage({id,error:error instanceof Error?error.message:String(error)});}
};
