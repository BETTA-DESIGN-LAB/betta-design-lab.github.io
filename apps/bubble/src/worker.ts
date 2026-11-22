import {loadManifold} from '@bdl/geometry';
import wasmUrl from 'manifold-3d/manifold.wasm?url';
import {build} from './geometry.ts';
import type {Params} from './params.ts';
import type {Glyph} from './lettering.ts';
const ready=loadManifold(wasmUrl);
self.onmessage=async (event:MessageEvent<{id:number;params:Params;glyphs:Glyph[]}>)=>{
  const {id,params,glyphs}=event.data;
  try {self.postMessage({id,result:build(await ready,params,glyphs)});}
  catch(error){self.postMessage({id,error:error instanceof Error?error.message:String(error)});}
};
