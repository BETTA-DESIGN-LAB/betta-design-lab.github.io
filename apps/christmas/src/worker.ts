import wasmUrl from 'manifold-3d/manifold.wasm?url';
import {loadManifold} from '@bdl/geometry';
import {build,printParts,type Design} from './geometry.ts';
import type {Params} from './params.ts';
const ready=loadManifold(wasmUrl);
self.onmessage=async(event:MessageEvent<{id:number;state:Params;design:Design}>)=>{
 const {id,state,design}=event.data;
 try{const M=await ready,result=build(M,state,design),mounted=printParts(build(M,state,design,true).parts);self.postMessage({id,ok:true,...result,mounted});}
 catch(error){self.postMessage({id,ok:false,error:error instanceof Error?error.message:String(error)});}
};
