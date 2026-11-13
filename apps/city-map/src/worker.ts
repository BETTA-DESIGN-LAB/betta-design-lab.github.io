import {loadManifold} from '@bdl/geometry';
import wasmUrl from 'manifold-3d/manifold.wasm?url';
import {build,type Settings} from './geometry.ts';
import type {Area,Element,Point} from './data.ts';
import type {Elevation} from './elevation.ts';
import type {Captions} from './caption.ts';
const ready=loadManifold(wasmUrl);
self.onmessage=async(e:MessageEvent<{id:number;area:Area;data:Element[];settings:Settings;elevation?:Elevation;label?:Captions;route?:Point[][]}>)=>{
  const {id,area,data,settings,elevation,label,route}=e.data;
  try { self.postMessage({id,result:build(await ready,area,data,settings,elevation,label,route)}); }
  catch(error) { self.postMessage({id,error:error instanceof Error?error.message:String(error)}); }
};
