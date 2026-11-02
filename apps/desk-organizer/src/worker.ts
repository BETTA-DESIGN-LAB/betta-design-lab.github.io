import {loadManifold} from '@bdl/geometry';
import wasmUrl from 'manifold-3d/manifold.wasm?url';
import {build,type BuildOptions} from './geometry.ts';
import type {Params} from './params.ts';
const ready=loadManifold(wasmUrl);
self.onmessage=async(e:MessageEvent<{id:number;params:Params;options:BuildOptions;sample?:boolean}>)=>{
 const {id,params,options}=e.data;
 try{const M=await ready;self.postMessage({id,result:build(M,params,options)});}
 catch(error){self.postMessage({id,error:error instanceof Error?error.message:String(error)});}
};
