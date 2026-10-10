import {trace,type Raster,type Options} from './trace.ts';
self.onmessage=(event:MessageEvent<{id:number;image:Raster;options:Options}>)=>{const {id,image,options}=event.data;try{self.postMessage({id,...trace(image,options)});}catch(e){self.postMessage({id,error:e instanceof Error?e.message:String(e)});}};
