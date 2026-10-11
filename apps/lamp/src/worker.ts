import wasmUrl from 'manifold-3d/manifold.wasm?url';
import {loadManifold,type MeshData} from '@bdl/geometry';
import {build,fitSample} from './geometry.ts';
import type {Params} from './params.ts';
const ready=loadManifold(wasmUrl);
self.onmessage=async(e:MessageEvent<{id:number;params:Params;mesh?:MeshData}>)=>{const {id,params,mesh}=e.data;try{const M=await ready;const result=build(M,params,mesh);self.postMessage({id,...result,sample:fitSample(M,params.baseColor)});}catch(error){self.postMessage({id,error:error instanceof Error?error.message:String(error)});}};
