import {loadManifold,type MeshData} from '@bdl/geometry';
import wasmUrl from 'manifold-3d/manifold.wasm?url';
import {build} from './geometry.ts';
import type {Params} from './params.ts';
import type {SvgArtwork} from '../../coaster/src/svg.ts';
import {stlProfile} from './profile.ts';
const ready=loadManifold(wasmUrl);
self.onmessage=async(event:MessageEvent<{id:number;kind:'build'|'stl';params:Params;artwork?:SvgArtwork;mesh?:MeshData}>)=>{
 const {id,kind,params,artwork,mesh}=event.data;
 try{
  const M=await ready;
  if(kind==='stl'){
   if(!mesh)throw new Error('STL mancante.');self.postMessage({id,kind,artwork:stlProfile(M,mesh)});
  }else self.postMessage({id,kind,result:build(M,params,artwork)});
 }catch(error){self.postMessage({id,kind,error:error instanceof Error?error.message:String(error)});}
};
