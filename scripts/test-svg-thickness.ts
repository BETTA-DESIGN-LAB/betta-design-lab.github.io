import assert from 'node:assert/strict';
import {loadManifold,Scope,type Part} from '@bdl/geometry';
import {thickenSvg} from '../apps/shared/svg-thickness.ts';
import {build as keychain} from '../apps/keychain/src/geometry.ts';
import {DEFAULTS as K} from '../apps/keychain/src/params.ts';
import {buildCoaster as coaster} from '../apps/coaster/src/geometry.ts';
import {DEFAULTS as C} from '../apps/coaster/src/params.ts';
import {buildKeycap as keycap} from '../apps/keycap/src/geometry.ts';
import {DEFAULTS as F} from '../apps/keycap/src/params.ts';
import {build as christmas} from '../apps/christmas/src/geometry.ts';
import {DEFAULTS as N} from '../apps/christmas/src/params.ts';
import {buildBox as box} from '../apps/box/src/geometry.ts';
import {DEFAULTS as B} from '../apps/box/src/params.ts';
import {validateDecorations,type Decoration} from '../apps/box/src/decoration.ts';
import {build as thermoform} from '../apps/thermoform/src/geometry.ts';
import {DEFAULTS as T} from '../apps/thermoform/src/params.ts';
import type {SvgArtwork} from '../apps/coaster/src/svg.ts';
import {to3MF} from '@bdl/export';
import {unzipSync} from 'fflate';
const M=await loadManifold();
const art:SvgArtwork={name:'Tratto',shapes:[[[[-.5,-.02],[.5,-.02],[.5,.02],[-.5,.02]]]]};
const square:SvgArtwork={name:'Sagoma',shapes:[[[[-.5,-.5],[.5,-.5],[.5,.5],[-.5,.5]]]]};
const cases:((n:number)=>{parts:Part[]})[]=[
 n=>keychain(M,{...K,model:'svg',shape:'square',loop:false,svgThicken:n},{main:art}),
 n=>coaster(M,{...C,svgUse:'decoration',svgThicken:n},art),
 n=>keycap(M,{...F,svgThicken:n},art),
 n=>christmas(M,{...N,text:'',svgThicken:n,extraY:0},{extra:art}),
 n=>box(M,B,[{id:1,face:'lid',mode:'relief',size:20,u:0,v:0,angle:0,depth:.6,color:'#ffffff',artwork:art,thicken:n}]),
 n=>thermoform(M,{...T,shape:'svg',svgThicken:n},square),
];
for(const make of cases){
 const baseline=make(0),grown=make(.4);
 assert.notEqual(JSON.stringify(baseline.parts),JSON.stringify(grown.parts),'Il controllo deve cambiare la geometria esportata');
 for(const p of grown.parts){const mesh=new M.Mesh({numProp:3,vertProperties:p.mesh.positions,triVerts:p.mesh.indices});mesh.merge();const solid=new M.Manifold(mesh);assert.equal(solid.status(),'NoError');assert.ok(solid.volume()>0);solid.delete();}
 assert.ok(unzipSync(to3MF(grown.parts))['3D/3dmodel.model']);
}
const s=new Scope();try{
 const line=s.t(M.CrossSection.square([12,.24],true));
 assert.equal(thickenSvg(s,line,0),line);
 assert.equal(thickenSvg(s,line,NaN),line);
 const b=thickenSvg(s,line,.3).bounds();assert.ok(Math.abs(b.max[1]-b.min[1]-.54)<.001);
}finally{s.free();}
assert.equal(validateDecorations([{id:1,face:'lid',mode:'relief',size:20,u:0,v:0,angle:0,depth:.6,color:'#ffffff',artwork:art} as Decoration])[0].thicken,0);
console.log('Ispessimento SVG: sei generatori, millimetri reali, geometrie ed export 3MF verificati.');
